import json
import re
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


def parse_gemini_response(response_text: str) -> Dict[str, Any]:
    try:
        json_match = re.search(r'\{[^}]+\}', response_text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            
            classification = result.get("classification", "UNKNOWN").upper()
            if classification not in ["HUMAN", "MACHINE", "UNKNOWN"]:
                classification = "UNKNOWN"
            
            confidence = float(result.get("confidence", 0.5))
            confidence = max(0.0, min(1.0, confidence))
            
            return {
                "classification": classification,
                "confidence": confidence,
                "reasoning": result.get("reasoning", "")
            }
    except Exception as e:
        logger.warning(f"Failed to parse Gemini response: {e}")

    text_lower = response_text.lower()
    if "human" in text_lower and "machine" not in text_lower:
        return {
            "classification": "HUMAN",
            "confidence": 0.7,
            "reasoning": "Detected human from text analysis"
        }
    elif "machine" in text_lower or "voicemail" in text_lower:
        return {
            "classification": "MACHINE",
            "confidence": 0.7,
            "reasoning": "Detected machine from text analysis"
        }
    
    return {
        "classification": "UNKNOWN",
        "confidence": 0.3,
        "reasoning": "Could not parse response"
    }


def validate_audio_buffer(buffer: bytes, min_size_bytes: int = 1000) -> bool:
    if not buffer or len(buffer) < min_size_bytes:
        return False
    return True
