from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
import logging
import time

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
        
        # 1. Preprocess the audio (extract mel spectrogram)
        features = preprocess_audio(audio_bytes)
        
        # 2. Run prediction using the service
        is_crying = cry_service.detect_cry(features)
        
        # 3. Update state and notify WebSocket clients
        result = {
            "cry_detected": bool(is_crying),
            "message": "Your baby is crying!" if is_crying else "No cry detected",
            "timestamp": time.time()
        }
        
        await state_manager.update_cry_status(result)
        
        if is_crying:
            logger.info("Cry detected!")
        else:
            logger.info("No cry detected.")
            
        return JSONResponse(content=result)
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"An error occurred while processing audio: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while processing audio.")
