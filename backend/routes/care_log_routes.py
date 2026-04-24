"""
Parent daily care log, fields aligned with infant_cry_nutrition_data.csv.
Preferred submission window: 20:00–22:00 in the client's timezone (informational + stored flag).
Submissions are accepted at any time.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from routes.auth_routes import _decode_bearer_user_id
from services.database import database
from services.day_insights import compute_day_insights

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/care-logs", tags=["Care logs"])

EVENING_START_MIN = 20 * 60  # 8:00 PM
EVENING_END_MIN = 22 * 60  # 10:00 PM (exclusive of 22:00 → last minute 21:59)

CRY_INTENSITY = frozenset({"low", "medium", "high"})
MOTION_LEVEL = frozenset({"low", "normal", "high"})
FEEDING_TYPE = frozenset({"formula", "breastmilk", "mixed", "solids"})
FEEDING_FREQ = frozenset({"low", "normal", "high"})
WATER_INTAKE = frozenset({"low", "adequate", "high"})
MEAL_TIMING = frozenset({"regular", "irregular"})
NUTRITION_LEVEL = frozenset({"low", "balanced", "high"})
PEAK_CRY = frozenset({"morning", "afternoon", "night"})
DAY_TYPE = frozenset({"weekday", "weekend"})

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _local_now(tz_name: str) -> datetime:
    try:
        return datetime.now(ZoneInfo(tz_name))
    except (ZoneInfoNotFoundError, TypeError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid timezone: {tz_name!r} ({e})",
        ) from e


def _evening_window_ok(local_dt: datetime) -> bool:
    minutes = local_dt.hour * 60 + local_dt.minute
    return EVENING_START_MIN <= minutes < EVENING_END_MIN


def _today_iso(local_dt: datetime) -> str:
    return local_dt.date().isoformat()


class CareLogCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    timezone: str = Field(..., min_length=2, max_length=64, description="IANA zone, e.g. Asia/Colombo")
    entry_date: str = Field(..., min_length=10, max_length=10, description="YYYY-MM-DD diary date")
    age_days: int = Field(..., ge=0, le=1200)
    cry_frequency: int = Field(..., ge=0, le=60)
    cry_intensity_avg: str
    motion_activity_level: str
    feeding_type: str
    main_food_types: str = Field(..., min_length=1, max_length=120)
    feeding_frequency: str
    water_intake: str
    meal_timing_pattern: str
    estimated_nutrition_level: str
    time_of_day_peak_cry: str
    day_type: str

    @field_validator("entry_date")
    @classmethod
    def entry_date_shape(cls, v: str) -> str:
        if not _DATE_RE.match(v or ""):
            raise ValueError("entry_date must be YYYY-MM-DD")
        return v

    @field_validator(
        "cry_intensity_avg",
        "motion_activity_level",
        "feeding_type",
        "feeding_frequency",
        "water_intake",
        "meal_timing_pattern",
        "estimated_nutrition_level",
        "time_of_day_peak_cry",
        "day_type",
    )
    @classmethod
    def enums(cls, v: str, info) -> str:
        key = info.field_name
        val = (v or "").strip().lower()
        allowed = {
            "cry_intensity_avg": CRY_INTENSITY,
            "motion_activity_level": MOTION_LEVEL,
            "feeding_type": FEEDING_TYPE,
            "feeding_frequency": FEEDING_FREQ,
            "water_intake": WATER_INTAKE,
            "meal_timing_pattern": MEAL_TIMING,
            "estimated_nutrition_level": NUTRITION_LEVEL,
            "time_of_day_peak_cry": PEAK_CRY,
            "day_type": DAY_TYPE,
        }.get(key, frozenset())
        if val not in allowed:
            raise ValueError(f"Invalid {key}")
        return val


@router.get("/window")
async def care_log_window(authorization: str | None = Header(None), tz: str = "UTC"):
    """Preferred 8–10 PM window in the given IANA timezone (submissions are always allowed)."""
    _decode_bearer_user_id(authorization)
    local = _local_now(tz)
    in_preferred = _evening_window_ok(local)
    return {
        "in_preferred_window": in_preferred,
        "allowed": in_preferred,
        "timezone": tz,
        "local_time": local.isoformat(timespec="seconds"),
        "preferred_window_label": "8:00 PM – 10:00 PM (local)",
        "submissions_allowed_anytime": True,
    }


@router.get("/me")
async def list_my_care_logs(authorization: str | None = Header(None), limit: int = 40):
    user_id = _decode_bearer_user_id(authorization)
    if limit < 1 or limit > 120:
        limit = 40
    items = await database.get_parent_care_logs_for_user(user_id, limit=limit)
    return {"items": items}


@router.get("/me/today")
async def get_today_draft(authorization: str | None = Header(None), tz: str = "UTC"):
    """Existing log for today's local date (prefill)."""
    user_id = _decode_bearer_user_id(authorization)
    today = _today_iso(_local_now(tz))
    doc = await database.get_parent_care_log_by_user_and_date(user_id, today)
    return {"entry_date": today, "log": doc}


@router.get("/suggestions")
async def care_log_suggestions(
    authorization: str | None = Header(None),
    tz: str = "UTC",
    entry_date: str | None = None,
):
    """
    Autofill hints for the daily care form: cry count, peak time, motion band, intensity -
    derived from MongoDB `notifications` (cry alerts) and `sensor_data` for the diary day in `tz`.
    """
    _decode_bearer_user_id(authorization)
    local = _local_now(tz)
    ed = (entry_date or "").strip() or _today_iso(local)
    if not _DATE_RE.match(ed):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="entry_date must be YYYY-MM-DD")
    return await compute_day_insights(database, entry_date=ed, tz_name=tz, user_id=user_id)


@router.post("", status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/submit", status_code=status.HTTP_201_CREATED)
@router.post("/submit/", status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_care_log(body: CareLogCreate, authorization: str | None = Header(None)):
    user_id = _decode_bearer_user_id(authorization)
    local = _local_now(body.timezone)
    in_preferred_window = _evening_window_ok(local)

    expected_today = _today_iso(local)
    if body.entry_date != expected_today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"entry_date must be today's date in your timezone ({expected_today}).",
        )

    try:
        y, m, d = (int(x) for x in body.entry_date.split("-"))
        wd = date(y, m, d).weekday()
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid entry_date") from e
    expected_day_type = "weekend" if wd >= 5 else "weekday"
    if body.day_type != expected_day_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"day_type must be '{expected_day_type}' for this entry_date.",
        )

    store = {
        "timezone": body.timezone,
        "age_days": body.age_days,
        "cry_frequency": body.cry_frequency,
        "cry_intensity_avg": body.cry_intensity_avg,
        "motion_activity_level": body.motion_activity_level,
        "feeding_type": body.feeding_type,
        "main_food_types": body.main_food_types,
        "feeding_frequency": body.feeding_frequency,
        "water_intake": body.water_intake,
        "meal_timing_pattern": body.meal_timing_pattern,
        "estimated_nutrition_level": body.estimated_nutrition_level,
        "time_of_day_peak_cry": body.time_of_day_peak_cry,
        "day_type": body.day_type,
        "submitted_in_preferred_window": in_preferred_window,
        "submitted_local_time": local.isoformat(timespec="seconds"),
    }

    oid = await database.upsert_parent_care_log(user_id, body.entry_date, store)
    logger.info(
        "Care log saved user=%s date=%s id=%s preferred_window=%s",
        user_id,
        body.entry_date,
        oid,
        in_preferred_window,
    )
    return {
        "status": "ok",
        "id": oid,
        "entry_date": body.entry_date,
        "submitted_in_preferred_window": in_preferred_window,
    }
