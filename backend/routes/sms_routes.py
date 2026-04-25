import logging
from typing import Literal

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from routes.auth_routes import _decode_bearer_user_id
from services.cry_alert_sms import (
    acknowledge_cry_escalation,
    get_escalation_status_payload,
    send_manual_cry_escalation_sms,
)

router = APIRouter(prefix="/api/sms", tags=["SMS"])
logger = logging.getLogger(__name__)


class CryAlertAckResponse(BaseModel):
    ok: bool = True


class ManualCrySmsBody(BaseModel):
    target: Literal["parent2", "guardian1", "guardian2"] = Field(
        ...,
        description="Escalation slot to SMS (Parent 1 is notified automatically on cry detect).",
    )
    message: str | None = Field(None, max_length=500)
    cry_label: str | None = Field(None, max_length=120)


@router.get("/escalation-status")
async def escalation_status(authorization: str | None = Header(None)):
    """Live SMS escalation row + event log for the Emergency Alert Escalation UI."""
    uid = _decode_bearer_user_id(authorization)
    payload = await get_escalation_status_payload(uid)
    if not payload.get("ok"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return payload


@router.post("/cry-alert/ack", response_model=CryAlertAckResponse)
async def cry_alert_ack(authorization: str | None = Header(None)):
    """Acknowledge the active cry alert, cancels pending timed guardian SMS."""
    uid = _decode_bearer_user_id(authorization)
    acknowledge_cry_escalation(uid)
    return CryAlertAckResponse()


@router.post("/cry-alert/send")
async def cry_alert_send_manual(body: ManualCrySmsBody, authorization: str | None = Header(None)):
    """Send a cry-alert SMS to Parent 2 or a guardian (hierarchy / manual escalation)."""
    uid = _decode_bearer_user_id(authorization)

    result = await send_manual_cry_escalation_sms(uid, body.target, body.message, body.cry_label)
    if result.get("error") == "sms_not_configured":
        raise HTTPException(status_code=503, detail="SMS gateway is not configured on the server.")
    if result.get("error") == "no_recipient":
        raise HTTPException(
            status_code=400,
            detail=f"No phone number on file for this contact ({body.target}).",
        )
    if not result.get("ok"):
        raise HTTPException(
            status_code=502,
            detail=result.get("error", "SMS send failed."),
        )
    return result
