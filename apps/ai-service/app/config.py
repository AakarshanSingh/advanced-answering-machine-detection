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


class HuggingFaceConfig:
    MODEL_NAME: str = "jakeBland/wav2vec-vm-finetune"
    USE_ONNX: bool = os.getenv("USE_ONNX_MODEL", "true").lower() == "true"
    DEVICE: str = "cpu"
    CONFIDENCE_THRESHOLD: float = 0.7
    SAMPLE_RATE: int = 16000
    MAX_AUDIO_LENGTH_SECONDS: int = 10
    CHUNK_SIZE_MS: int = 3000
    
    CACHE_DIR: str = os.path.join(os.getcwd(), "models_cache")
    ONNX_MODEL_PATH: str = os.path.join(CACHE_DIR, "wav2vec_vm_model.onnx")
    
    LABELS: dict = {
        0: "human",
        1: "voicemail"
    }
    
    @staticmethod
    def is_configured() -> bool:
        return True


class AudioConfig:
    MIN_AUDIO_SIZE_BYTES: int = 1000
    MIME_TYPE: str = "audio/wav"
    PROCESSING_CHECK_INTERVAL: float = 0.1
    
    SAMPLE_RATE: int = 16000
    CHANNELS: int = 1
    SAMPLE_WIDTH: int = 2
    
    BUFFER_SIZE_MS: int = 3000
    MIN_BUFFER_SIZE_MS: int = 2000


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
