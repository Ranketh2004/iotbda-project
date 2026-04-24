"""
Hierarchical cry-alert SMS: one immediate recipient, then timed guardian steps unless acknowledged.
Manual sends: Parent 2, Guardian 1, Guardian 2 via API.
Persists an in-memory "wave" per user for the escalation UI (last ~15 minutes).
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from config import settings

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()
_last_auto_escalation_at: dict[str, float] = {}

_escalation_events: dict[str, asyncio.Event] = {}
_running_tasks: dict[str, list[asyncio.Task]] = {}

# Last cry SMS wave per user (for dashboard / escalation page)
_waves: dict[str, dict[str, Any]] = {}
WAVE_TTL_SEC = 900


def _reset_escalation_event(user_id: str) -> asyncio.Event:
    """Fresh unset event (compatible with Python <3.10 where Event has no clear())."""
    ev = asyncio.Event()
    _escalation_events[user_id] = ev
    return ev


def _append_sms_event(
    user_id: str,
    target: str,
    label: str,
    resp: dict | None,
    err: str | None,
) -> None:
    w = _waves.get(user_id)
    if not w:
        w = {
            "started_at": time.time(),
            "acknowledged": False,
            "events": [],
            "cry_label": "",
            "alert_preview": "",
        }
        _waves[user_id] = w
    ev: dict[str, Any] = {"target": target, "label": label, "at": time.time()}
    if err:
        ev["status"] = "error"
        ev["detail"] = err[:300]
    elif resp and isinstance(resp, dict):
        ev["status"] = str(resp.get("status") or "unknown")
        if resp.get("group_id") is not None:
            ev["group_id"] = str(resp["group_id"])
        if resp.get("message"):
            ev["detail"] = str(resp["message"])[:300]
    else:
        ev["status"] = "unknown"
    w.setdefault("events", []).append(ev)


def acknowledge_cry_escalation(user_id: str) -> None:
    """Stop pending timed SMS for this user (Acknowledge / Stop alarm)."""
    ev = _escalation_events.get(user_id)
    if ev:
        ev.set()
    for t in _running_tasks.pop(user_id, []):
        t.cancel()
    w = _waves.get(user_id)
    if w:
        w["acknowledged"] = True


async def _cancel_tasks(user_id: str) -> None:
    tasks = _running_tasks.pop(user_id, [])
    for t in tasks:
        t.cancel()
        try:
            await t
        except asyncio.CancelledError:
            pass


def _format_phone_display(digits: str) -> str:
    d = "".join(c for c in (digits or "") if c.isdigit())
    if not d:
        return "-"
    if len(d) <= 6:
        return f"+{d}"
    return f"+{d[:2]} … {d[-4:]}"


def _slot_events(wave: dict | None, slot: str) -> list[dict]:
    if not wave:
        return []
    return [e for e in wave.get("events") or [] if e.get("target") == slot]


def _last_slot_status(wave: dict | None, slot: str) -> str | None:
    evs = _slot_events(wave, slot)
    if not evs:
        return None
    return str(evs[-1].get("status") or "")


def _next_auto_guardian_slot(
    wave: dict | None,
    now: float,
    started: float,
    d1: int,
    d2: int,
    has_g1: bool,
    has_g2: bool,
) -> str | None:
    """Which guardian slot receives the next automatic SMS (timed), if any."""
    if not wave or wave.get("acknowledged"):
        return None
    evs = wave.get("events") or []
    if not evs:
        return None
    if has_g1 and not _slot_events(wave, "guardian1") and now < started + float(d1):
        return "guardian1"
    if has_g2 and not _slot_events(wave, "guardian2") and now < started + float(d2):
        return "guardian2"
    return None


def _contact_badge_and_icon(
    wave: dict | None,
    wave_active: bool,
    slot: str,
    has_phone: bool,
    next_auto: str | None,
) -> tuple[str, str]:
    """
    badge: notified | failed | scheduled | manual | pending | no_phone | idle
    icon: check | phone | hourglass | none
    """
    if not has_phone:
        return ("no_phone", "none")

    st = _last_slot_status(wave, slot)
    if st == "error":
        return ("failed", "phone")
    if st in ("queued", "success", "unknown"):
        return ("notified", "check")

    if not wave_active or not wave:
        return ("idle", "phone")

    if wave.get("acknowledged"):
        return ("idle", "phone")

    if slot == "parent2":
        return ("manual", "phone")

    if slot in ("guardian1", "guardian2") and next_auto == slot:
        return ("scheduled", "hourglass")

    if slot in ("guardian1", "guardian2") and next_auto and next_auto != slot:
        return ("pending", "phone")

    if slot == "parent1":
        evs_all = wave.get("events") or []
        if evs_all and not _slot_events(wave, "parent1"):
            return ("idle", "phone")
        if not evs_all:
            return ("pending", "phone")

    return ("pending", "phone")


async def get_escalation_status_payload(user_id: str) -> dict[str, Any]:
    """JSON for GET /api/sms/escalation-status (cry escalation UI)."""
    from services.database import database
    from services.sms_service import get_escalation_recipient, is_keen_sms_configured

    user = await database.get_user_by_id(user_id)
    if not user:
        return {"ok": False, "error": "user_not_found"}

    now = time.time()
    wave = _waves.get(user_id)
    wave_age = (now - float(wave.get("started_at", 0))) if wave else 999999.0
    wave_active = bool(wave) and wave_age < WAVE_TTL_SEC

    d1 = max(1, settings.CRY_ESCALATE_GUARDIAN1_DELAY_SEC)
    d2 = max(d1 + 1, settings.CRY_ESCALATE_GUARDIAN2_DELAY_SEC)

    has_guardian1 = bool(get_escalation_recipient(user, "guardian1"))
    has_guardian2 = bool(get_escalation_recipient(user, "guardian2"))
    started_ts = float(wave.get("started_at") or 0) if wave else 0.0
    next_auto: str | None = None
    if wave_active and wave:
        next_auto = _next_auto_guardian_slot(
            wave, now, started_ts, d1, d2, has_guardian1, has_guardian2
        )

    slots_meta: list[dict[str, Any]] = []
    order = (
        ("parent1", "Parent 1"),
        ("parent2", "Parent 2"),
        ("guardian1", "Guardian 1"),
        ("guardian2", "Guardian 2"),
    )
    for key, role in order:
        pair = get_escalation_recipient(user, key)
        has_phone = bool(pair)
        digits = pair[1] if pair else ""
        label = pair[0] if pair else ""
        badge, icon = _contact_badge_and_icon(wave, wave_active, key, has_phone, next_auto)
        slots_meta.append(
            {
                "slot": key,
                "role": role,
                "label": label,
                "phone_digits": digits,
                "phone_display": _format_phone_display(digits),
                "has_phone": has_phone,
                "badge": badge,
                "icon": icon,
            }
        )

    g1_in = g2_in = None
    if wave_active and wave and not wave.get("acknowledged"):
        evs = wave.get("events") or []
        has_any = len(evs) > 0
        if has_any and not _slot_events(wave, "guardian1") and has_guardian1:
            g1_in = max(0, int(started_ts + d1 - now))
        if has_any and not _slot_events(wave, "guardian2") and has_guardian2:
            g2_in = max(0, int(started_ts + d2 - now))

    wave_out = None
    if wave and wave_active:
        wave_out = {
            "active": True,
            "started_at": wave.get("started_at"),
            "acknowledged": bool(wave.get("acknowledged")),
            "cry_label": wave.get("cry_label") or "",
            "alert_preview": wave.get("alert_preview") or "",
            "events": list(wave.get("events") or []),
        }

    return {
        "ok": True,
        "sms_configured": is_keen_sms_configured(),
        "delays_sec": {"guardian1": d1, "guardian2": d2},
        "wave": wave_out,
        "next_auto_sec": {"guardian1": g1_in, "guardian2": g2_in},
        "contacts": slots_meta,
    }


async def begin_cry_escalation_sms(
    user_id: str | None,
    alert_message: str,
    cry_label: str | None = None,
) -> None:
    """
    Send SMS to the first available contact (parent1 → parent2 → guardian1 → guardian2),
    then optionally guardian1 @ +30s and guardian2 @ +120s if not acknowledged and numbers differ.
    """
    if not user_id:
        return

    from services.database import database
    from services.sms_service import (
        format_cry_alert_message,
        get_escalation_recipient,
        is_keen_sms_configured,
        keen_send_sms,
    )

    if not is_keen_sms_configured():
        return

    now = time.monotonic()
    cooldown = max(30, settings.CRY_ALERT_SMS_COOLDOWN_SECONDS)
    async with _lock:
        prev = _last_auto_escalation_at.get(user_id)
        if prev is not None and (now - prev) < cooldown:
            logger.info(
                "Cry escalation SMS skipped for user %s (cooldown %.0fs remaining).",
                user_id,
                cooldown - (now - prev),
            )
            return
        _last_auto_escalation_at[user_id] = now

    await _cancel_tasks(user_id)
    ev = _reset_escalation_event(user_id)

    try:
        user = await database.get_user_by_id(user_id)
    except Exception as e:
        logger.error("Cry escalation SMS: failed to load user %s: %s", user_id, e)
        return

    if not user:
        return

    baby = user.get("baby") or {}
    baby_name = baby.get("name")
    text = format_cry_alert_message(alert_message, cry_label, baby_name)

    order_keys = ("parent1", "parent2", "guardian1", "guardian2")
    first_key: str | None = None
    first_pair: tuple[str, str] | None = None
    for key in order_keys:
        p = get_escalation_recipient(user, key)
        if p:
            first_key, first_pair = key, p
            break

    if not first_pair or not first_key:
        logger.info("Cry escalation SMS: user %s has no phone on file.", user_id)
        return

    _waves[user_id] = {
        "started_at": time.time(),
        "acknowledged": False,
        "events": [],
        "cry_label": (cry_label or "")[:120],
        "alert_preview": (alert_message or "")[:240],
    }

    sent_digits: set[str] = set()

    async def send_pair(slot_key: str, label: str, digits: str) -> None:
        try:
            resp = await keen_send_sms(digits, text)
            _append_sms_event(user_id, slot_key, label, resp if isinstance(resp, dict) else None, None)
            if isinstance(resp, dict) and resp.get("status") == "queued":
                logger.info("Cry SMS queued to %s group_id=%s", label, resp.get("group_id"))
            elif isinstance(resp, dict) and resp.get("status") == "error":
                logger.warning("Cry SMS error for %s: %s", label, resp.get("message"))
        except Exception as e:
            logger.exception("Cry SMS failed for %s: %s", label, e)
            _append_sms_event(user_id, slot_key, label, None, str(e))

    label0, digits0 = first_pair
    await send_pair(first_key, label0, digits0)
    sent_digits.add(digits0)

    d1 = max(1, settings.CRY_ESCALATE_GUARDIAN1_DELAY_SEC)
    d2 = max(d1 + 1, settings.CRY_ESCALATE_GUARDIAN2_DELAY_SEC)

    async def delayed_send(delay: float, slot: str) -> None:
        try:
            await asyncio.sleep(float(delay))
        except asyncio.CancelledError:
            raise
        if ev.is_set():
            return
        pair = get_escalation_recipient(user, slot)
        if not pair:
            return
        lab, digits = pair
        if digits in sent_digits:
            return
        await send_pair(slot, lab, digits)
        sent_digits.add(digits)

    tasks: list[asyncio.Task] = []
    g1 = get_escalation_recipient(user, "guardian1")
    if g1 and g1[1] not in sent_digits:
        tasks.append(asyncio.create_task(delayed_send(float(d1), "guardian1"), name=f"cry-g1-{user_id}"))
    g2 = get_escalation_recipient(user, "guardian2")
    if g2 and g2[1] not in sent_digits:
        tasks.append(asyncio.create_task(delayed_send(float(d2), "guardian2"), name=f"cry-g2-{user_id}"))
    if tasks:
        _running_tasks[user_id] = tasks


async def send_manual_cry_escalation_sms(
    user_id: str,
    target: str,
    alert_message: str | None = None,
    cry_label: str | None = None,
) -> dict:
    """Send one SMS to parent2 or guardian1/2 (authenticated user)."""
    from services.database import database
    from services.sms_service import (
        format_cry_alert_message,
        get_escalation_recipient,
        is_keen_sms_configured,
        keen_send_sms,
        VALID_SMS_ESCALATION_TARGETS,
    )

    if target not in VALID_SMS_ESCALATION_TARGETS or target == "parent1":
        return {"ok": False, "error": "invalid_target"}

    if not is_keen_sms_configured():
        return {"ok": False, "error": "sms_not_configured"}

    user = await database.get_user_by_id(user_id)
    if not user:
        return {"ok": False, "error": "user_not_found"}

    pair = get_escalation_recipient(user, target)
    if not pair:
        return {"ok": False, "error": "no_recipient", "target": target}

    baby = user.get("baby") or {}
    text = format_cry_alert_message(
        alert_message or "Please check the nursery, cry alert.",
        cry_label,
        baby.get("name"),
    )
    label, digits = pair
    try:
        resp = await keen_send_sms(digits, text)
    except Exception as e:
        logger.exception("Manual cry SMS failed: %s", e)
        _append_sms_event(user_id, target, label, None, str(e))
        return {"ok": False, "error": str(e), "target": target}

    _append_sms_event(user_id, target, label, resp if isinstance(resp, dict) else None, None)
    ok = isinstance(resp, dict) and resp.get("status") != "error"
    return {"ok": ok, "target": target, "label": label, "provider": resp}


def schedule_cry_escalation(
    user_id: str | None,
    alert_message: str,
    cry_label: str | None = None,
) -> None:
    """Start hierarchical SMS without blocking cry detection."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(
        begin_cry_escalation_sms(user_id, alert_message, cry_label),
        name=f"cry-escalation-{user_id or 'none'}",
    )


def schedule_cry_alert_sms(
    user_id: str | None,
    alert_message: str,
    cry_label: str | None = None,
) -> None:
    schedule_cry_escalation(user_id, alert_message, cry_label)
