import asyncio
import time
import logging
import httpx
from datetime import datetime, timezone

from config import settings
from services.database import database

logger = logging.getLogger(__name__)

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
_ESP_TIMEOUT_SEC = 30


def _fmt_ts(ts: float | None) -> str:
    if not ts:
        return "unknown"
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _build_system_prompt(
    latest_sensor: dict | None,
    esp_connected: bool,
    sensor_history: list,
    notifications: list,
    care_logs: list,
) -> str:
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # ── Current sensor reading ──────────────────────────────────────────────
    if latest_sensor:
        temp = latest_sensor.get("temperature")
        hum = latest_sensor.get("humidity")
        motion = latest_sensor.get("motion")
        light = latest_sensor.get("light_dark")
        ts = latest_sensor.get("timestamp")
        sensor_str = (
            f"  Temperature: {temp}°C\n"
            f"  Humidity:    {hum}%\n"
            f"  Motion:      {'Yes' if motion else 'No'}\n"
            f"  Light/Dark:  {'Dark' if light else 'Light'}\n"
            f"  Recorded:    {_fmt_ts(ts)}"
        )
    else:
        sensor_str = "  No sensor readings available yet."

    # ── Environment statistics from history ─────────────────────────────────
    if sensor_history:
        temps = [r["temperature"] for r in sensor_history if r.get("temperature") is not None]
        hums = [r["humidity"] for r in sensor_history if r.get("humidity") is not None]
        motion_count = sum(1 for r in sensor_history if r.get("motion"))
        total = len(sensor_history)

        def _rng(lst: list) -> str:
            if not lst:
                return "N/A"
            avg = sum(lst) / len(lst)
            return f"avg {avg:.1f} (range {min(lst):.1f}–{max(lst):.1f})"

        stats_str = (
            f"  Based on last {total} readings:\n"
            f"  Temperature: {_rng(temps)}°C\n"
            f"  Humidity:    {_rng(hums)}%\n"
            f"  Motion:      {motion_count}/{total} readings ({round(100 * motion_count / total)}%)"
        )
    else:
        stats_str = "  No sensor history available."

    # ── Recent cry alerts ───────────────────────────────────────────────────
    if notifications:
        lines = [
            f"  [{_fmt_ts(n.get('timestamp'))}] {n.get('message', 'Cry detected')}"
            for n in notifications[:20]
        ]
        notif_str = "\n".join(lines)
    else:
        notif_str = "  No recent cry alerts."

    # ── Parent care logs ────────────────────────────────────────────────────
    if care_logs:
        lines = []
        for log in care_logs[:14]:
            date = log.get("entry_date", "?")
            freq = log.get("cry_frequency", "?")
            intensity = log.get("cry_intensity_avg", "?")
            peak = log.get("time_of_day_peak_cry", "?")
            feeding = log.get("feeding_type", "?")
            feed_freq = log.get("feeding_frequency", "?")
            water = log.get("water_intake", "?")
            nutrition = log.get("estimated_nutrition_level", "?")
            motion_lvl = log.get("motion_activity_level", "?")
            lines.append(
                f"  {date}: cries={freq} ({intensity} intensity, peak={peak}), "
                f"feeding={feeding} ({feed_freq}), water={water}, "
                f"nutrition={nutrition}, motion={motion_lvl}"
            )
        care_str = "\n".join(lines)
    else:
        care_str = "  No parent care logs on record."

    esp_label = "Connected" if esp_connected else "Disconnected (readings may be stale)"

    return f"""You are CryGuard Nursery Coach, an AI assistant embedded in a smart baby IoT monitoring system called CryGuard.
Your role is to help parents understand their baby's wellbeing through data-driven insights on nursery conditions, cry patterns, feeding habits, and environmental trends.

=== LIVE NURSERY DATA (snapshot at {now_str}) ===

[ESP32 SENSOR]
  Status: {esp_label}

[CURRENT READING]
{sensor_str}

[ENVIRONMENT STATISTICS]
{stats_str}

[RECENT CRY ALERTS]
{notif_str}

[PARENT CARE LOGS]
{care_str}

=== RESPONSE GUIDELINES ===
- Be empathetic, concise, and data-driven; cite numbers when relevant
- Healthy infant room: temperature 18–22°C, relative humidity 40–60%
- Never provide medical diagnoses; recommend a paediatrician for health concerns
- If the available data is insufficient to answer, say so honestly
- Respond in the same language the user writes in
- Keep answers under ~200 words unless a detailed breakdown is explicitly requested
"""


async def get_chat_reply(
    user_message: str,
    history: list[dict],
    user_id: str | None = None,
) -> str:
    if not settings.OPENAI_API_KEY:
        return (
            "The AI assistant is not configured yet. "
            "Please add your OPENAI_API_KEY to the .env file and restart the backend."
        )

    # ── Fetch live data from MongoDB ────────────────────────────────────────
    latest_sensor = await database.get_latest_sensor_data()

    esp_status = await database.get_esp_status()
    esp_connected = bool(
        esp_status and (time.time() - esp_status.get("last_seen", 0)) < _ESP_TIMEOUT_SEC
    )

    sensor_history = await database.get_sensor_history(limit=100)
    notifications = await database.get_notifications(limit=30)

    care_logs: list = []
    if user_id:
        care_logs = await database.get_parent_care_logs_for_user(user_id, limit=14)

    system_prompt = _build_system_prompt(
        latest_sensor, esp_connected, sensor_history, notifications, care_logs
    )

    # ── Build messages array ─────────────────────────────────────────────────
    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for msg in history[-10:]:
        role = msg.get("role")
        content = msg.get("content") or msg.get("text", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": str(content)})
    messages.append({"role": "user", "content": user_message})

    # ── Call OpenAI (retry up to 3× on 429 rate-limit) ──────────────────────
    _MAX_RETRIES = 3
    async with httpx.AsyncClient(timeout=60.0) as client:
        for attempt in range(_MAX_RETRIES):
            resp = await client.post(
                OPENAI_URL,
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.OPENAI_MODEL,
                    "messages": messages,
                    "max_tokens": 512,
                    "temperature": 0.7,
                },
            )
            if resp.status_code == 429 and attempt < _MAX_RETRIES - 1:
                retry_after = float(resp.headers.get("retry-after", 2 ** (attempt + 1)))
                wait = min(retry_after, 30.0)
                logger.warning("OpenAI rate-limited (429); retrying in %.1fs (attempt %d/%d)", wait, attempt + 1, _MAX_RETRIES)
                await asyncio.sleep(wait)
                continue
            break

    resp.raise_for_status()
    data = resp.json()
    reply: str = data["choices"][0]["message"]["content"]
    logger.info("Chat reply generated via %s (%d chars)", settings.OPENAI_MODEL, len(reply))
    return reply
