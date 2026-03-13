from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging

from services.state_manager import state_manager

router = APIRouter(tags=["WebSocket"])
logger = logging.getLogger(__name__)


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """
    WebSocket endpoint for real-time frontend communication.
    On connect, sends full state. Then pushes sensor updates,
    cry alerts and notifications in real time.
    """
    await state_manager.register(ws)
    try:
        while True:
            # Keep connection alive; optionally handle client messages
            data = await ws.receive_text()
            logger.debug(f"WS message from client: {data}")
    except WebSocketDisconnect:
        state_manager.unregister(ws)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        state_manager.unregister(ws)
