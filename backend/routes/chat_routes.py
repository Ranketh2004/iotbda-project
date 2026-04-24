import logging

import httpx
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel

from routes.auth_routes import _decode_bearer_user_id
from services.chat_service import get_chat_reply

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.post("", summary="Chat with the CryGuard AI nursery coach")
async def chat(body: ChatRequest, authorization: str | None = Header(None)):
    msg = (body.message or "").strip()
    if not msg:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message cannot be empty")

    # Auth is optional — unauthenticated users get sensor/alert context but no care-log data
    user_id: str | None = None
    if authorization:
        try:
            user_id = _decode_bearer_user_id(authorization)
        except HTTPException:
            pass

    try:
        reply = await get_chat_reply(
            user_message=msg,
            history=body.history,
            user_id=user_id,
        )
        return {"reply": reply}
    except httpx.HTTPStatusError as exc:
        logger.error("Chat service error: %s", exc, exc_info=True)
        if exc.response.status_code == 429:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="The AI service is currently rate-limited. Please wait a moment and try again.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service temporarily unavailable. Please try again in a moment.",
        ) from exc
    except Exception as exc:
        logger.error("Chat service error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service temporarily unavailable. Please try again in a moment.",
        ) from exc
