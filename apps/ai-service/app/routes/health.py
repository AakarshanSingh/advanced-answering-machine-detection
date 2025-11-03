from fastapi import APIRouter
import sys
from app.config import GeminiConfig, HuggingFaceConfig
from app.models import get_model_loader

router = APIRouter()


@router.get("/health")
async def detailed_health():
    model_loader = get_model_loader()
    
    return {
        "status": "healthy",
        "python_version": sys.version,
        "services": {
            "gemini": {
                "configured": GeminiConfig.is_configured(),
                "status": "ready" if GeminiConfig.is_configured() else "not_configured"
            },
            "huggingface": {
                "configured": HuggingFaceConfig.is_configured(),
                "model_loaded": model_loader.is_loaded(),
                "model_info": model_loader.get_model_info() if model_loader.is_loaded() else None,
                "status": "ready" if HuggingFaceConfig.is_configured() else "not_configured"
            }
        }
    }
