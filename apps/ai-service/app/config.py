import os
from typing import Optional

class GeminiConfig:
    MODEL_NAME: str = "gemini-2.5-flash"
    MAX_RETRIES: int = 2
    TIMEOUT: int = 15
    TEMPERATURE: float = 0.1
    TOP_P: float = 0.95
    TOP_K: int = 40
    MAX_OUTPUT_TOKENS: int = 256
    
    @staticmethod
    def get_api_key() -> Optional[str]:
        return os.getenv("GEMINI_API_KEY")
    
    @staticmethod
    def is_configured() -> bool:
        return bool(GeminiConfig.get_api_key())


class AudioConfig:
    MIN_AUDIO_SIZE_BYTES: int = 1000
    MIME_TYPE: str = "audio/wav"
    PROCESSING_CHECK_INTERVAL: float = 0.1


SAFETY_SETTINGS = [
    {
        "category": "HARM_CATEGORY_HARASSMENT",
        "threshold": "BLOCK_NONE"
    },
    {
        "category": "HARM_CATEGORY_HATE_SPEECH",
        "threshold": "BLOCK_NONE"
    },
    {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "threshold": "BLOCK_NONE"
    },
    {
        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
        "threshold": "BLOCK_NONE"
    }
]
