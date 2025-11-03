from fastapi import APIRouter, UploadFile, File, Header, HTTPException, WebSocket, WebSocketDisconnect, Request
from pydantic import BaseModel
from typing import Optional, Literal
import time
import logging
import asyncio
import threading

from app.config import HuggingFaceConfig, AudioConfig
from app.models import get_model_loader
from app.utils.audio_processing import (
    AudioBuffer,
    load_audio_from_bytes,
    validate_audio_buffer,
    trim_silence,
    normalize_audio,
    AudioMetrics
)
from app.security import (
    check_rate_limit,
    predict_rate_limiter,
    get_client_ip,
    validate_audio_file,
    validate_call_sid,
    AudioPredictionRequest
)

logger = logging.getLogger(__name__)

router = APIRouter()

model_loader = get_model_loader()

# Lock to prevent concurrent model loading attempts
_model_load_lock = threading.Lock()


class HFAMDResponse(BaseModel):
    label: Literal["human", "voicemail", "unknown"]
    confidence: float
    reasoning: Optional[str] = None
    processingTimeMs: int
    audioMetrics: Optional[dict] = None
    callSid: Optional[str] = None


class HuggingFaceAMDDetector:
    """
    HuggingFace wav2vec AMD detector.
    Optimized for real-time inference with ONNX runtime.
    """
    
    def __init__(self):
        self.model_name = HuggingFaceConfig.MODEL_NAME
        self.use_onnx = HuggingFaceConfig.USE_ONNX
        self.device = HuggingFaceConfig.DEVICE
        self.threshold = HuggingFaceConfig.CONFIDENCE_THRESHOLD
        self.sample_rate = HuggingFaceConfig.SAMPLE_RATE
        
        # Don't load model at init - load on first use (lazy loading)
        logger.info("HuggingFaceAMDDetector initialized (model will load on first use)")
    
    def _ensure_model_loaded(self):
        """Lazy load model on first use with thread-safe locking"""
        if not model_loader.is_loaded():
            with _model_load_lock:
                # Double-check inside lock (another thread might have loaded it)
                if not model_loader.is_loaded():
                    logger.info("Loading HuggingFace model on first use...")
                    model_loader.load_model(
                        self.model_name,
                        use_onnx=self.use_onnx,
                        device=self.device
                    )
    
    async def analyze_audio(
        self,
        audio_data: bytes,
        call_sid: str,
        preprocess: bool = True
    ) -> HFAMDResponse:
        """
        Analyze audio and return AMD result.
        
        Args:
            audio_data: Raw audio bytes
            call_sid: Call identifier
            preprocess: Whether to apply preprocessing (trim silence, normalize)
            
        Returns:
            HFAMDResponse with label and confidence
        """
        # Ensure model is loaded (lazy loading on first request)
        self._ensure_model_loaded()
        
        start_time = time.time()
        
        try:
            audio_array, sample_rate = load_audio_from_bytes(
                audio_data,
                target_sample_rate=self.sample_rate
            )
            
            if len(audio_array) == 0:
                raise ValueError("Empty audio array")
            
            metrics = AudioMetrics.from_audio(audio_array, sample_rate)
            logger.info(f"Audio loaded: {metrics.duration_seconds:.2f}s, RMS: {metrics.rms_level:.3f}")
            
            if preprocess:
                audio_array = trim_silence(audio_array, sample_rate=sample_rate)
                audio_array = normalize_audio(audio_array)
            
            max_length = self.sample_rate * HuggingFaceConfig.MAX_AUDIO_LENGTH_SECONDS
            if len(audio_array) > max_length:
                logger.warning(f"Audio too long ({len(audio_array)} samples), truncating")
                audio_array = audio_array[:max_length]
            
            label, confidence = model_loader.predict(audio_array, sample_rate)
            
            processing_time = int((time.time() - start_time) * 1000)
            
            reasoning = self._generate_reasoning(label, confidence, metrics)
            
            logger.info(
                f"HF AMD result for {call_sid}: {label.upper()} "
                f"(confidence: {confidence:.3f}, time: {processing_time}ms)"
            )
            
            return HFAMDResponse(
                label=label,
                confidence=confidence,
                reasoning=reasoning,
                processingTimeMs=processing_time,
                audioMetrics=metrics.dict()
            )
            
        except Exception as e:
            logger.error(f"HF AMD error for {call_sid}: {str(e)}", exc_info=True)
            processing_time = int((time.time() - start_time) * 1000)
            
            return HFAMDResponse(
                label="unknown",
                confidence=0.0,
                reasoning=f"Processing error: {str(e)[:100]}",
                processingTimeMs=processing_time
            )
    
    def _generate_reasoning(
        self,
        label: str,
        confidence: float,
        metrics: AudioMetrics
    ) -> str:
        """Generate human-readable reasoning"""
        reasons = []
        
        if metrics.is_too_quiet:
            reasons.append("audio very quiet")
        
        if metrics.is_clipping:
            reasons.append("audio clipping detected")
        
        if confidence > 0.9:
            reasons.append(f"high confidence {label} detection")
        elif confidence > 0.7:
            reasons.append(f"moderate confidence {label} detection")
        else:
            reasons.append(f"low confidence {label} detection")
        
        if metrics.duration_seconds < 1.0:
            reasons.append("very short audio")
        
        return ", ".join(reasons) if reasons else f"{label} detected"


# Global detector instance (lazy loaded)
_detector_instance: Optional[HuggingFaceAMDDetector] = None


def get_detector() -> HuggingFaceAMDDetector:
    """Get or create the singleton HuggingFace detector instance"""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = HuggingFaceAMDDetector()
    return _detector_instance


@router.post("/predict", response_model=HFAMDResponse)
async def predict_amd(
    request: Request,
    audio: UploadFile = File(...),
    call_sid: str = Header(None, alias="X-Call-SID"),
    preprocess: bool = True
):
    """
    Predict AMD from uploaded audio file.
    
    - **audio**: Audio file (WAV, raw PCM, or mulaw)
    - **X-Call-SID**: Call identifier (optional)
    - **preprocess**: Apply audio preprocessing (default: true)
    
    Returns AMD prediction with confidence score.
    
    **Security:**
    - Rate limited: 20 requests/minute per IP
    - Input validation: File type, size, Call SID format
    - Audio sanitization: Validates audio format and content
    """
    # 1. Rate limiting
    client_ip = get_client_ip(request)
    check_rate_limit(client_ip, predict_rate_limiter)
    
    # 2. Validate Call SID format
    if call_sid and not validate_call_sid(call_sid):
        raise HTTPException(status_code=400, detail="Invalid Call SID format")
    
    if not call_sid:
        call_sid = "unknown"
    
    # 3. Validate audio file
    validate_audio_file(audio, max_size_mb=10)
    
    logger.info(f"Processing HF AMD prediction for call: {call_sid} from IP: {client_ip}")
    
    try:
        audio_data = await audio.read()
        
        if not validate_audio_buffer(audio_data, AudioConfig.MIN_AUDIO_SIZE_BYTES):
            raise HTTPException(
                status_code=400,
                detail=f"Audio file too small (< {AudioConfig.MIN_AUDIO_SIZE_BYTES} bytes)"
            )
        
        detector = get_detector()
        result = await detector.analyze_audio(audio_data, call_sid, preprocess)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing AMD request: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.websocket("/stream")
async def stream_amd(websocket: WebSocket):
    """
    WebSocket endpoint for real-time audio streaming.
    
    Protocol:
    1. Client connects and starts sending audio chunks
    2. Server buffers audio until threshold reached
    3. Server runs inference and sends result
    4. Connection closes
    
    Message format:
    - Incoming: Binary audio chunks (PCM 16-bit, 16kHz)
    - Outgoing: JSON with {"label": "human"|"voicemail", "confidence": 0.95}
    """
    await websocket.accept()
    
    buffer = AudioBuffer(
        sample_rate=AudioConfig.SAMPLE_RATE,
        channels=AudioConfig.CHANNELS
    )
    
    call_sid = websocket.headers.get("X-Call-SID", "websocket_unknown")
    logger.info(f"WebSocket AMD stream started for {call_sid}")
    
    try:
        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_bytes(),
                    timeout=5.0
                )
                
                buffer.append(data)
                current_duration = buffer.get_duration_ms()
                
                if current_duration >= AudioConfig.BUFFER_SIZE_MS:
                    logger.info(f"Buffer threshold reached: {current_duration}ms")
                    
                    audio_array = buffer.get_audio_array()
                    
                    if len(audio_array) > 0:
                        label, confidence = model_loader.predict(
                            audio_array,
                            AudioConfig.SAMPLE_RATE
                        )
                        
                        response = {
                            "label": label,
                            "confidence": float(confidence),
                            "duration_ms": current_duration
                        }
                        
                        await websocket.send_json(response)
                        logger.info(f"Sent prediction: {label} ({confidence:.3f})")
                        
                        buffer.clear()
                        
                        if confidence > HuggingFaceConfig.CONFIDENCE_THRESHOLD:
                            logger.info("High confidence reached, closing connection")
                            await websocket.close(code=1000)
                            break
                
            except asyncio.TimeoutError:
                if not buffer.is_empty():
                    logger.info("Timeout reached, processing buffered audio")
                    
                    audio_array = buffer.get_audio_array()
                    label, confidence = model_loader.predict(
                        audio_array,
                        AudioConfig.SAMPLE_RATE
                    )
                    
                    response = {
                        "label": label,
                        "confidence": float(confidence),
                        "duration_ms": buffer.get_duration_ms(),
                        "reason": "timeout"
                    }
                    
                    await websocket.send_json(response)
                    await websocket.close(code=1000)
                break
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for {call_sid}")
    except Exception as e:
        logger.error(f"WebSocket error for {call_sid}: {str(e)}")
        try:
            await websocket.send_json({
                "error": str(e),
                "label": "unknown",
                "confidence": 0.0
            })
            await websocket.close(code=1011)
        except:
            pass


@router.get("/model-info")
async def get_model_info():
    """Get information about loaded model"""
    info = model_loader.get_model_info()
    info.update({
        "model_name": HuggingFaceConfig.MODEL_NAME,
        "use_onnx": HuggingFaceConfig.USE_ONNX,
        "device": HuggingFaceConfig.DEVICE,
        "sample_rate": HuggingFaceConfig.SAMPLE_RATE,
        "confidence_threshold": HuggingFaceConfig.CONFIDENCE_THRESHOLD
    })
    return info
