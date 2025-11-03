from fastapi import APIRouter, UploadFile, File, Header, HTTPException, Request
from pydantic import BaseModel
import google.generativeai as genai
from typing import Optional, Literal
import time
import io
import logging

from app.config import GeminiConfig, AudioConfig, SAFETY_SETTINGS
from app.prompts.amd_prompts import GEMINI_AMD_CLASSIFICATION_PROMPT
from app.utils.response_parser import parse_gemini_response, validate_audio_buffer
from app.security import (
    check_rate_limit,
    predict_rate_limiter,
    get_client_ip,
    validate_audio_file,
    validate_call_sid
)

logger = logging.getLogger(__name__)

router = APIRouter()

GEMINI_API_KEY = GeminiConfig.get_api_key()
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    logger.warning("GEMINI_API_KEY not set - Gemini AMD will not function")


class AMDResponse(BaseModel):
    result: Literal["HUMAN", "MACHINE", "UNDECIDED"]
    confidence: float
    reasoning: Optional[str] = None
    processingTimeMs: int


class GeminiAMDDetector:
    def __init__(self):
        self.model_name = GeminiConfig.MODEL_NAME
        self.max_retries = GeminiConfig.MAX_RETRIES
        self.timeout = GeminiConfig.TIMEOUT

    async def analyze_audio(
        self, audio_data: bytes, call_sid: str
    ) -> AMDResponse:
        start_time = time.time()

        if not GEMINI_API_KEY:
            raise HTTPException(
                status_code=503,
                detail="Gemini API key not configured"
            )

        try:
            audio_file = genai.upload_file(
                io.BytesIO(audio_data),
                mime_type=AudioConfig.MIME_TYPE,
                display_name=f"call_{call_sid}"
            )

            while audio_file.state.name == "PROCESSING":
                time.sleep(AudioConfig.PROCESSING_CHECK_INTERVAL)
                audio_file = genai.get_file(audio_file.name)

            if audio_file.state.name == "FAILED":
                raise Exception("Audio processing failed")

            model = genai.GenerativeModel(
                model_name=self.model_name,
                generation_config={
                    "temperature": GeminiConfig.TEMPERATURE,
                    "top_p": GeminiConfig.TOP_P,
                    "top_k": GeminiConfig.TOP_K,
                    "max_output_tokens": GeminiConfig.MAX_OUTPUT_TOKENS,
                },
                safety_settings=SAFETY_SETTINGS
            )

            response = model.generate_content(
                [GEMINI_AMD_CLASSIFICATION_PROMPT, audio_file],
                request_options={"timeout": self.timeout}
            )

            if not response.candidates or not response.candidates[0].content.parts:
                logger.warning(f"Gemini blocked response for {call_sid}. Finish reason: {response.candidates[0].finish_reason if response.candidates else 'unknown'}")
                genai.delete_file(audio_file.name)
                processing_time = int((time.time() - start_time) * 1000)
                return AMDResponse(
                    result="UNDECIDED",
                    confidence=0.5,
                    reasoning="Response blocked by safety filters",
                    processingTimeMs=processing_time
                )

            result = parse_gemini_response(response.text)

            genai.delete_file(audio_file.name)

            processing_time = int((time.time() - start_time) * 1000)

            return AMDResponse(
                result=result["classification"],
                confidence=result["confidence"],
                reasoning=result.get("reasoning"),
                processingTimeMs=processing_time
            )

        except Exception as e:
            logger.error(f"Gemini AMD error for call {call_sid}: {str(e)}")
            logger.error(f"Error type: {type(e).__name__}")
            processing_time = int((time.time() - start_time) * 1000)

            return AMDResponse(
                result="UNDECIDED",
                confidence=0.3,
                reasoning=f"Processing error: {type(e).__name__}",
                processingTimeMs=processing_time
            )


detector = GeminiAMDDetector()


@router.post("/gemini", response_model=AMDResponse)
async def detect_amd_gemini(
    request: Request,
    audio: UploadFile = File(...),
    call_sid: str = Header(None, alias="X-Call-SID")
):
    """
    Detect AMD using Google Gemini AI.
    
    **Security:**
    - Rate limited: 20 requests/minute per IP
    - Input validation: File type, size, Call SID format
    - Audio validation: Minimum size requirements
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

    logger.info(f"Processing Gemini AMD for call: {call_sid} from IP: {client_ip}")

    try:
        audio_data = await audio.read()

        if not validate_audio_buffer(audio_data, AudioConfig.MIN_AUDIO_SIZE_BYTES):
            raise HTTPException(
                status_code=400,
                detail=f"Audio file too small (< {AudioConfig.MIN_AUDIO_SIZE_BYTES} bytes)"
            )

        result = await detector.analyze_audio(audio_data, call_sid)

        logger.info(
            f"Gemini AMD result for {call_sid}: "
            f"{result.result} (confidence: {result.confidence:.2f})"
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing AMD request: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {str(e)}"
        )
