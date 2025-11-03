"""
Security and validation utilities for FastAPI

Provides input validation, rate limiting, and request validation
"""

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field, validator
from typing import Optional, Literal
import re
import time
from collections import defaultdict
import threading

# Simple in-memory rate limiter (for production, use Redis)
class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = defaultdict(list)
        self.lock = threading.Lock()
    
    def is_allowed(self, identifier: str) -> bool:
        """Check if request is allowed"""
        with self.lock:
            now = time.time()
            window_start = now - self.window_seconds
            
            # Clean old requests
            self.requests[identifier] = [
                req_time for req_time in self.requests[identifier]
                if req_time > window_start
            ]
            
            # Check limit
            if len(self.requests[identifier]) >= self.max_requests:
                return False
            
            # Add current request
            self.requests[identifier].append(now)
            return True

# Rate limiters for different endpoints
predict_rate_limiter = RateLimiter(max_requests=20, window_seconds=60)  # 20 req/min
health_rate_limiter = RateLimiter(max_requests=100, window_seconds=60)  # 100 req/min


def get_client_ip(request: Request) -> str:
    """Extract client IP from request"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    return request.client.host if request.client else "unknown"


def check_rate_limit(identifier: str, limiter: RateLimiter) -> None:
    """Check rate limit and raise exception if exceeded"""
    if not limiter.is_allowed(identifier):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again later.",
            headers={"Retry-After": str(limiter.window_seconds)}
        )


# Validation models with Pydantic
class AudioPredictionRequest(BaseModel):
    """Validation model for audio prediction requests"""
    
    # Optional fields for metadata
    call_sid: Optional[str] = Field(None, pattern=r"^CA[a-f0-9]{32}$")
    source: Optional[str] = Field(None, max_length=50)
    
    class Config:
        json_schema_extra = {
            "example": {
                "call_sid": "CA1234567890abcdef1234567890abcdef",
                "source": "twilio"
            }
        }


class GeminiPredictionRequest(BaseModel):
    """Validation model for Gemini prediction requests"""
    
    # Optional metadata
    call_sid: Optional[str] = Field(None, pattern=r"^CA[a-f0-9]{32}$")
    prompt_type: Optional[Literal["default", "detailed"]] = "default"
    
    class Config:
        json_schema_extra = {
            "example": {
                "call_sid": "CA1234567890abcdef1234567890abcdef",
                "prompt_type": "default"
            }
        }


def validate_audio_file(file, max_size_mb: int = 10) -> None:
    """
    Validate uploaded audio file
    
    Args:
        file: UploadFile object
        max_size_mb: Maximum file size in MB
        
    Raises:
        HTTPException: If validation fails
    """
    # Check content type
    if file.content_type not in [
        "audio/wav",
        "audio/mpeg",
        "audio/mp3",
        "audio/mp4",
        "audio/x-wav",
        "audio/wave",
        "application/octet-stream"  # Sometimes Twilio sends this
    ]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format: {file.content_type}. Supported: WAV, MP3, MP4"
        )
    
    # Check file size (if available)
    if hasattr(file, 'size') and file.size:
        max_size_bytes = max_size_mb * 1024 * 1024
        if file.size > max_size_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size: {max_size_mb}MB"
            )


def sanitize_input(text: str, max_length: int = 1000) -> str:
    """
    Sanitize text input to prevent injection attacks
    
    Args:
        text: Input text
        max_length: Maximum allowed length
        
    Returns:
        Sanitized text
    """
    if not text:
        return ""
    
    # Truncate to max length
    text = text[:max_length]
    
    # Remove control characters except newlines and tabs
    text = re.sub(r'[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]', '', text)
    
    # Remove potential script tags
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)
    
    return text.strip()


def validate_call_sid(call_sid: Optional[str]) -> bool:
    """
    Validate Twilio Call SID format
    
    Args:
        call_sid: Call SID to validate
        
    Returns:
        True if valid, False otherwise
    """
    if not call_sid:
        return True  # Optional field
    
    pattern = r'^CA[a-f0-9]{32}$'
    return bool(re.match(pattern, call_sid, re.IGNORECASE))


# Security headers middleware
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # CORS headers (adjust for production)
    if request.method == "OPTIONS":
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    return response
