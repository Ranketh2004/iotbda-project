from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
import logging
import time

from config import settings
from utils.audio_processing import preprocess_audio
from services.cry_detection_service import cry_service
from services.state_manager import state_manager

router = APIRouter(prefix="/api", tags=["Audio"])
logger = logging.getLogger(__name__)

@router.post("/audio", summary="Detect baby cry from audio data")
async def detect_cry_endpoint(request: Request):
    """
    Endpoint to receive raw audio bytes from ESP32 and detect if a baby is crying.
    """
    try:
        # Receive raw binary data
        audio_bytes = await request.body()
        
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty body or no audio data received.")
            
        logger.info(f"Received {len(audio_bytes)} bytes of audio data.")

        # Update ESP32 connection status
        state_manager.update_esp_status(connected=True)
        
        # 1. Preprocess (MFCC) + waveform RMS for silence gating
        features, audio_rms = preprocess_audio(audio_bytes)

        # 2. Skip model on near-silence — normalized MFCC of noise looks like fake "structure"
        if audio_rms < settings.MIN_AUDIO_RMS:
            logger.info(
                f"No cry: below energy gate (audio_rms={audio_rms:.6f} < {settings.MIN_AUDIO_RMS})"
            )
            is_crying, cry_probability = False, 0.0
        else:
            is_crying, cry_probability = cry_service.detect_cry(features)

        # 3. Combine mic + PIR; cry_detected / alerts only when both agree
        result = {
            "message": "Your baby is crying!" if is_crying else "No cry detected",
            "timestamp": time.time(),
            "audio_rms": audio_rms,
        }
        if cry_probability is not None:
            result["cry_probability"] = cry_probability

        result = state_manager.merge_mic_cry_with_pir(is_crying, result)

        await state_manager.update_cry_status(result)

        if result.get("cry_detected"):
            logger.info("Cry alert: audio + PIR motion confirmed.")
        elif is_crying:
            logger.info("Mic cry-like; PIR no motion — no combined alert.")
        else:
            logger.info("No cry detected.")
            
        return JSONResponse(content=result)
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"An error occurred while processing audio: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while processing audio.")
