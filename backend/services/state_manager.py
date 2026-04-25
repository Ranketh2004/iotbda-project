import asyncio
import json
import time
import logging
from typing import List, Dict, Any
from fastapi import WebSocket
from config import settings

logger = logging.getLogger(__name__)


class StateManager:
    """
    Central state manager that tracks ESP32 data, persists to MongoDB,
    and broadcasts to WebSocket clients.
    """

    def __init__(self):
        self.connected_clients: List[WebSocket] = []

        # ESP32 connection tracking
        self.esp_connected: bool = False
        self.esp_last_seen: float = 0
        self.ESP_TIMEOUT: float = 10.0  

        # Latest sensor data 
        self.sensor_data: Dict[str, Any] = {
            "temperature": None,
            "humidity": None,
            "motion": False,
            "light_dark": False,
            "timestamp": None,
        }

        # Latest cry detection result
        self.cry_status: Dict[str, Any] = {
            "cry_detected": False,
            "message": "No data yet",
            "timestamp": None,
        }
        self.active_user_id: str | None = None

        # Notification history 
        self.notifications: List[Dict[str, Any]] = []

    @staticmethod
    def _coerce_bool(value: Any, default: bool = False) -> bool:
        """
        Normalize mixed bool-like payloads (bool/int/str) from device or API.
        Prevents values like "false" (non-empty string) becoming True via bool().
        """
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        if isinstance(value, str):
            v = value.strip().lower()
            if v in {"true", "1", "yes", "y", "on"}:
                return True
            if v in {"false", "0", "no", "n", "off", ""}:
                return False
        return default

    # WebSocket Client Management

    async def register(self, ws: WebSocket):
        await ws.accept()
        self.connected_clients.append(ws)
        logger.info(f"WebSocket client connected. Total: {len(self.connected_clients)}")
        # Send current state immediately (from MongoDB)
        await self._send_to(ws, await self._full_state())

    def unregister(self, ws: WebSocket):
        if ws in self.connected_clients:
            self.connected_clients.remove(ws)
        logger.info(f"WebSocket client disconnected. Total: {len(self.connected_clients)}")

    # Broadcast Helpers 

    async def _broadcast(self, message: dict):
        dead: List[WebSocket] = []
        for ws in self.connected_clients:
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.unregister(ws)

    async def _send_to(self, ws: WebSocket, message: dict):
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            self.unregister(ws)

    # State Updates

    def update_esp_status(self, connected: bool = True):
        self.esp_connected = connected
        self.esp_last_seen = time.time()

    def is_esp_connected(self) -> bool:
        if self.esp_last_seen == 0:
            return False
        return (time.time() - self.esp_last_seen) < self.ESP_TIMEOUT

    def merge_mic_cry_with_pir(self, mic_cry: bool, result: dict) -> dict:
        """
        Combine microphone cry model output with latest PIR motion from sensor_data.
        By default, allow mic-only alerts when model confidence is high enough.
        This helps detect distant cries that may not trigger PIR motion.
        """
        merged = dict(result)
        pir_motion = self._coerce_bool(self.sensor_data.get("motion", False), default=False)
        merged["mic_cry_detected"] = bool(mic_cry)
        merged["pir_motion"] = pir_motion
        prob_raw = merged.get("cry_probability")
        try:
            cry_probability = float(prob_raw) if prob_raw is not None else None
        except (TypeError, ValueError):
            cry_probability = None

        pir_confirmed = bool(mic_cry and pir_motion)
        mic_only_high_conf = bool(
            mic_cry
            and settings.ALLOW_MIC_ONLY_CRY_ALERT
            and cry_probability is not None
            and cry_probability >= settings.MIC_ONLY_CRY_MIN_PROBABILITY
        )
        merged["cry_detected"] = bool(pir_confirmed or mic_only_high_conf)

        if merged["cry_detected"]:
            if pir_confirmed:
                merged["message"] = "Baby is crying, audio and motion confirmed."
            else:
                merged["message"] = "Baby is crying, high-confidence audio detected."
        elif mic_cry:
            if settings.ALLOW_MIC_ONLY_CRY_ALERT:
                merged["message"] = (
                    "Cry-like audio detected, but confidence is below mic-only alert threshold."
                )
            else:
                merged["message"] = (
                    "Cry-like audio; PIR shows no motion, combined alert not sent."
                )
        else:
            merged.setdefault("message", "No cry detected")
        return merged

    async def update_sensor_data(self, data: dict, user_id: str | None = None):
        from services.database import database

        if user_id:
            self.active_user_id = user_id

        self.sensor_data = {
            "temperature": data.get("temperature"),
            "humidity": data.get("humidity"),
            "motion": self._coerce_bool(data.get("motion", False), default=False),
            "light_dark": self._coerce_bool(data.get("light_dark", False), default=False),
            "timestamp": time.time(),
        }
        cry_label = self.cry_status.get("cry_label")
        if cry_label:
            self.sensor_data["cry_label"] = cry_label
        if self.cry_status.get("prediction_index") is not None:
            self.sensor_data["prediction_index"] = self.cry_status.get("prediction_index")
        if self.cry_status.get("max_prob") is not None:
            self.sensor_data["max_prob"] = self.cry_status.get("max_prob")
        self.update_esp_status(connected=True)

        # Persist to MongoDB
        try:
            await database.save_sensor_data(self.sensor_data.copy(), user_id=self.active_user_id)
            await database.save_esp_status(True, self.esp_last_seen)
        except Exception as e:
            logger.error(f"Failed to save sensor data to MongoDB: {e}")

        # Broadcast to WebSocket clients for real-time updates
        await self._broadcast({
            "type": "sensor_update",
            "data": self.sensor_data,
            "esp_connected": True,
        })

    async def update_cry_status(self, result: dict, user_id: str | None = None):
        from services.database import database

        if user_id:
            self.active_user_id = user_id

        self.cry_status = result

        # Persist to MongoDB
        try:
            await database.save_cry_status(result.copy(), user_id=self.active_user_id)
        except Exception as e:
            logger.error(f"Failed to save cry status to MongoDB: {e}")

        if result.get("cry_detected"):
            notification = {
                "type": "cry_alert",
                "message": result.get("message", "Baby is crying!"),
                "timestamp": time.time(),
            }
            cry_label = result.get("cry_label")
            if cry_label:
                notification["cry_label"] = cry_label
            self.notifications.append(notification)
            # Keep last 50
            self.notifications = self.notifications[-50:]

            # Persist notification to MongoDB
            try:
                await database.save_notification(notification.copy(), user_id=self.active_user_id)
            except Exception as e:
                logger.error(f"Failed to save notification to MongoDB: {e}")

            from services.cry_alert_sms import schedule_cry_escalation

            schedule_cry_escalation(
                self.active_user_id,
                str(notification.get("message") or "Baby is crying!"),
                cry_label=str(cry_label) if cry_label else None,
            )

            await self._broadcast({
                "type": "cry_alert",
                "data": result,
                "notification": notification,
            })
        else:
            await self._broadcast({
                "type": "cry_update",
                "data": result,
            })

    # Full State Snapshot

    async def _full_state(self) -> dict:
        """Build full state from MongoDB, falling back to in-memory cache."""
        from services.database import database

        try:
            latest_sensor = await database.get_latest_sensor_data()
            cry_status = await database.get_cry_status()
            notifications = await database.get_notifications(limit=10)
            esp_status = await database.get_esp_status()

            esp_connected = False
            if esp_status:
                esp_connected = (time.time() - esp_status.get("last_seen", 0)) < self.ESP_TIMEOUT

            return {
                "type": "full_state",
                "esp_connected": esp_connected,
                "sensor_data": latest_sensor if latest_sensor else self.sensor_data,
                "cry_status": cry_status if cry_status else self.cry_status,
                "notifications": notifications,
            }
        except Exception as e:
            logger.error(f"Failed to build full state from MongoDB: {e}")
            return {
                "type": "full_state",
                "esp_connected": self.is_esp_connected(),
                "sensor_data": self.sensor_data,
                "cry_status": self.cry_status,
                "notifications": self.notifications[-10:],
            }


# Singleton
state_manager = StateManager()
