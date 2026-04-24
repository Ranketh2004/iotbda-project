"""
Derive daily care log hints from MongoDB sensor_data + cry_alert notifications
for a single calendar day in a given IANA timezone.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from zoneinfo import ZoneInfo


def _norm_ts(raw: Any) -> float | None:
    if raw is None:
        return None
    try:
        t = float(raw)
    except (TypeError, ValueError):
        return None
    if t > 1e12:
        t /= 1000.0
    return t


def day_unix_bounds(entry_date: str, tz_name: str) -> tuple[float, float]:
    zi = ZoneInfo(tz_name)
    y, m, d = (int(x) for x in entry_date.split("-"))
    start = datetime(y, m, d, 0, 0, 0, tzinfo=zi)
    end = start + timedelta(days=1)
    return start.timestamp(), end.timestamp()


def _local_hour(ts: float, tz_name: str) -> int:
    return datetime.fromtimestamp(ts, tz=ZoneInfo(tz_name)).hour


def _motion_fraction(sensor_docs: list[dict]) -> float | None:
    motions = []
    for doc in sensor_docs:
        if "motion" not in doc:
            continue
        motions.append(bool(doc.get("motion")))
    if not motions:
        return None
    return sum(1 for x in motions if x) / len(motions)


def motion_level_from_fraction(frac: float | None) -> str:
    if frac is None:
        return "normal"
    if frac < 0.18:
        return "low"
    if frac < 0.42:
        return "normal"
    return "high"


def _message_intensity_score(message: str) -> float:
    m = (message or "").lower()
    if any(
        k in m
        for k in (
            "sustained",
            "critical",
            "spike",
            "intensity high",
            "high intensity",
            "loud",
            "severe",
            "escalat",
        )
    ):
        return 2.0
    if any(k in m for k in ("mild", "brief", "soft", "quiet", "gentle", "minor")):
        return 0.0
    return 1.0


def avg_intensity_label(scores: list[float]) -> str:
    if not scores:
        return "medium"
    avg = sum(scores) / len(scores)
    if avg < 0.85:
        return "low"
    if avg < 1.45:
        return "medium"
    return "high"


def peak_cry_bucket(hours: list[int]) -> str:
    if not hours:
        return "morning"
    morning = sum(1 for h in hours if 6 <= h < 12)
    afternoon = sum(1 for h in hours if 12 <= h < 18)
    night = sum(1 for h in hours if h >= 18 or h < 6)
    ranked = [("afternoon", afternoon), ("morning", morning), ("night", night)]
    ranked.sort(key=lambda kv: (-kv[1], kv[0]))
    return ranked[0][0]


async def compute_day_insights(
    db,
    *,
    entry_date: str,
    tz_name: str,
    user_id: str | None = None,
    sensor_limit: int = 30000,
    notif_limit: int = 8000,
) -> dict[str, Any]:
    start_ts, end_ts = day_unix_bounds(entry_date, tz_name)

    sensor_docs = await db.query_sensor_data_range(start_ts, end_ts, limit=sensor_limit, user_id=user_id)
    notif_docs = await db.query_notifications_range(start_ts, end_ts, limit=notif_limit, user_id=user_id)

    cry_ts: list[float] = []
    intensity_scores: list[float] = []
    for n in notif_docs:
        ntype = (n.get("type") or "").lower()
        if ntype and ntype != "cry_alert":
            continue
        ts = _norm_ts(n.get("timestamp"))
        if ts is None or ts < start_ts or ts >= end_ts:
            continue
        msg = str(n.get("message") or "")
        if ntype != "cry_alert" and "cry" not in msg.lower():
            continue
        cry_ts.append(ts)
        intensity_scores.append(_message_intensity_score(msg))

    cry_frequency = len(cry_ts)
    hours = [_local_hour(ts, tz_name) for ts in cry_ts]
    peak = peak_cry_bucket(hours)

    mfrac = _motion_fraction(sensor_docs)
    motion_level = motion_level_from_fraction(mfrac)
    intensity = avg_intensity_label(intensity_scores)

    return {
        "entry_date": entry_date,
        "timezone": tz_name,
        "cry_frequency": min(60, cry_frequency),
        "time_of_day_peak_cry": peak,
        "motion_activity_level": motion_level,
        "cry_intensity_avg": intensity,
        "sources": {
            "sensor_samples": len(sensor_docs),
            "cry_alerts": cry_frequency,
            "motion_fraction": None if mfrac is None else round(mfrac, 4),
            "window_start_ts": start_ts,
            "window_end_ts": end_ts,
        },
    }
