"""
Keen Systems SMS gateway (https://keensystems.com.lk/smsAPI).
Credentials and sender ID must be set via environment variables — never commit secrets.
"""

from __future__ import annotations

import json
import logging
from typing import Any
from urllib.parse import quote, urlencode

import httpx

from config import settings
from services.database import database

logger = logging.getLogger(__name__)


def is_keen_sms_configured() -> bool:
    return bool(
        settings.KEEN_SMS_API_KEY
        and settings.KEEN_SMS_API_TOKEN
        and settings.KEEN_SMS_SENDER_ID
    )


async def keen_send_sms(to_digits: str, text: str, route: str = "0") -> dict[str, Any]:
    """
    Send one SMS. `to_digits` should be digits only with country code (e.g. 94771234567).
    Returns parsed JSON from the provider.
    """
    if not is_keen_sms_configured():
        raise RuntimeError("Keen SMS is not configured (missing API key, token, or sender ID).")

    to_clean = "".join(c for c in (to_digits or "") if c.isdigit())
    if not to_clean:
        raise ValueError("Invalid destination phone (no digits).")

    base = settings.KEEN_SMS_API_URL.rstrip("/")
    # Provider samples use `?sendsms&apikey=...` (flag-style first param).
    q = urlencode(
        {
            "apikey": settings.KEEN_SMS_API_KEY,
            "apitoken": settings.KEEN_SMS_API_TOKEN,
            "type": "sms",
            "from": settings.KEEN_SMS_SENDER_ID,
            "to": to_clean,
            "text": text,
            "route": route,
        },
        safe="",
        quote_via=quote,
    )
    url = f"{base}?sendsms&{q}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url)
        r.raise_for_status()
        try:
            data = r.json()
        except json.JSONDecodeError:
            logger.error("Keen SMS non-JSON response: %s", r.text[:500])
            raise

    if isinstance(data, dict) and data.get("status") == "error":
        logger.warning("Keen SMS error: %s", data.get("message", data))
    return data


VALID_SMS_ESCALATION_TARGETS = frozenset({"parent1", "parent2", "guardian1", "guardian2"})


def get_escalation_recipient(user_doc: dict, target: str) -> tuple[str, str] | None:
    """
    Resolve one SMS recipient by escalation slot.
    parent1 = mother (or legacy single-account phone); parent2 = father;
    guardian1 / guardian2 = 1st and 2nd guardian rows by priority (with phone).
    Returns (label, digits) or None.
    """
    if target not in VALID_SMS_ESCALATION_TARGETS:
        return None

    mother = dict(user_doc.get("mother") or {})
    father = dict(user_doc.get("father") or {})
    m_name = (mother.get("name") or "").strip()
    f_name = (father.get("name") or "").strip()

    def pair(label: str, phone_raw: str) -> tuple[str, str] | None:
        digits = database.normalize_phone(phone_raw)
        if not digits:
            return None
        return (label, digits)

    if not m_name and not f_name:
        legacy_name = (user_doc.get("full_name") or "Parent").strip() or "Parent"
        legacy_phone = str(user_doc.get("phone") or "")
        if target == "parent1":
            return pair(f"Parent ({legacy_name})", legacy_phone)
        if target == "parent2":
            return None
    else:
        if target == "parent1":
            if m_name:
                p = pair(f"Mother ({m_name})", str(mother.get("phone") or ""))
                if p:
                    return p
            if f_name:
                p = pair(f"Father ({f_name})", str(father.get("phone") or ""))
                if p:
                    return p
            return None
        if target == "parent2":
            if f_name:
                return pair(f"Father ({f_name})", str(father.get("phone") or ""))
            return None

    guardians = [g for g in (user_doc.get("guardians") or []) if isinstance(g, dict)]
    guardians.sort(key=lambda g: int((g or {}).get("priority") or 99))
    idx = 0 if target == "guardian1" else 1
    if len(guardians) <= idx:
        return None
    g = guardians[idx]
    name = (g.get("name") or "").strip() or "Guardian"
    rel = (g.get("relationship") or "").strip()
    label = f"Guardian ({name})" + (f", {rel}" if rel else "")
    return pair(label, str(g.get("phone") or ""))


def format_cry_alert_message(
    base_message: str,
    cry_label: str | None,
    baby_name: str | None = None,
) -> str:
    parts = ["Infant Cry Guard", "Baby cry alert."]
    if baby_name and str(baby_name).strip():
        parts.append(f"Baby: {str(baby_name).strip()}.")
    if cry_label and str(cry_label).strip():
        parts.append(f"Hint: {str(cry_label).strip()}.")
    parts.append((base_message or "Please check the nursery.").strip())
    text = " ".join(p for p in parts if p)
    if len(text) > 600:
        text = text[:597] + "..."
    return text
