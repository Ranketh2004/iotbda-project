from fastapi import APIRouter, Header, Request, Query
from fastapi.responses import JSONResponse
import logging

from routes.auth_routes import _decode_bearer_user_id
from services.state_manager import state_manager
from services.database import database

router = APIRouter(prefix="/api", tags=["Sensors"])
logger = logging.getLogger(__name__)


def _optional_user_id(authorization: str | None, payload: dict | None = None) -> str | None:
    if authorization:
        try:
            return _decode_bearer_user_id(authorization)
        except Exception:
            return None
    if payload:
        explicit = payload.get("user_id") or payload.get("logged_user_id")
        if explicit:
            return str(explicit)
    return None


@router.post("/sensor-data", summary="Receive sensor data from ESP32")
async def receive_sensor_data(request: Request, authorization: str | None = Header(None)):
    """
    Receives JSON sensor data from ESP32 and stores it in MongoDB:
    {
        "temperature": 28.5,
        "humidity": 65.0,
        "motion": true,
        "light_dark": false
    }
    """
    try:
        data = await request.json()
        logger.info(f"Sensor data received: {data}")
        user_id = _optional_user_id(authorization, data) or state_manager.active_user_id

        # Update in-memory state + broadcast via WebSocket + save to MongoDB
        await state_manager.update_sensor_data(data, user_id=user_id)

        return JSONResponse(content={
            "status": "ok",
            "message": "Sensor data received and stored.",
            "user_id": user_id,
        })

    except Exception as e:
        logger.error(f"Error processing sensor data: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)},
        )


@router.get("/sensor-data", summary="Get latest sensor data from MongoDB")
async def get_sensor_data(authorization: str | None = Header(None)):
    """Return the latest sensor readings from MongoDB."""
    try:
        user_id = _optional_user_id(authorization)
        if user_id:
            state_manager.active_user_id = user_id
        latest = await database.get_latest_sensor_data(user_id=user_id)
        esp_status = await database.get_esp_status()

        esp_connected = False
        if esp_status:
            import time
            esp_connected = (time.time() - esp_status.get("last_seen", 0)) < state_manager.ESP_TIMEOUT

        return JSONResponse(content={
            "esp_connected": esp_connected,
            "sensor_data": latest if latest else state_manager.sensor_data,
        })
    except Exception as e:
        logger.error(f"Error fetching sensor data from MongoDB: {e}")
        return JSONResponse(content={
            "esp_connected": state_manager.is_esp_connected(),
            "sensor_data": state_manager.sensor_data,
        })


@router.get("/sensor-data/history", summary="Get sensor data history from MongoDB")
async def get_sensor_history(limit: int = Query(default=50, ge=1, le=500), authorization: str | None = Header(None)):
    """Return recent sensor readings from MongoDB."""
    try:
        user_id = _optional_user_id(authorization)
        if user_id:
            state_manager.active_user_id = user_id
        history = await database.get_sensor_history(limit=limit, user_id=user_id)
        return JSONResponse(content={
            "count": len(history),
            "data": history,
        })
    except Exception as e:
        logger.error(f"Error fetching sensor history: {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)},
        )


@router.get("/status", summary="Get system status from MongoDB")
async def get_status(authorization: str | None = Header(None)):
    """Return full system status fetched from MongoDB."""
    try:
        user_id = _optional_user_id(authorization)
        if user_id:
            state_manager.active_user_id = user_id
        latest_sensor = await database.get_latest_sensor_data(user_id=user_id)
        cry_status = await database.get_cry_status(user_id=user_id)
        notifications = await database.get_notifications(limit=10, user_id=user_id)
        esp_status = await database.get_esp_status()

        import time
        esp_connected = False
        if esp_status:
            esp_connected = (time.time() - esp_status.get("last_seen", 0)) < state_manager.ESP_TIMEOUT

        return JSONResponse(content={
            "esp_connected": esp_connected,
            "sensor_data": latest_sensor if latest_sensor else state_manager.sensor_data,
            "cry_status": cry_status if cry_status else state_manager.cry_status,
            "notifications": notifications,
        })
    except Exception as e:
        logger.error(f"Error fetching status from MongoDB: {e}")
        return JSONResponse(content={
            "esp_connected": state_manager.is_esp_connected(),
            "sensor_data": state_manager.sensor_data,
            "cry_status": state_manager.cry_status,
            "notifications": state_manager.notifications[-10:],
        })


@router.get("/notifications", summary="Get notifications from MongoDB")
async def get_notifications(limit: int = Query(default=50, ge=1, le=200), authorization: str | None = Header(None)):
    """Return recent notifications from MongoDB."""
    try:
        user_id = _optional_user_id(authorization)
        if user_id:
            state_manager.active_user_id = user_id
        notifications = await database.get_notifications(limit=limit, user_id=user_id)
        return JSONResponse(content={
            "count": len(notifications),
            "notifications": notifications,
        })
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)},
        )
