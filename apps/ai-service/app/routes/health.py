from fastapi import APIRouter
import sys
from app.config import GeminiConfig

router = APIRouter()


@router.get("/health")
async def detailed_health():
    return {
        "status": "healthy",
        "python_version": sys.version,
        "services": {
            "gemini": {
                "configured": GeminiConfig.is_configured(),
                "status": "ready" if GeminiConfig.is_configured() else "not_configured"
            }
        }
    }
