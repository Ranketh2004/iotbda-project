import asyncio
import json
import time
import logging
from typing import List, Dict, Any
from fastapi import WebSocket

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
        self.ESP_TIMEOUT: float = 10.0  # seconds before marking as disconnected

        # Latest sensor data (in-memory cache)
        self.sensor_data: Dict[str, Any] = {
            "temperature": None,
            "humidity": None,
            "motion": False,
            "light_dark": False,
            "timestamp": None,
        }

        # Latest cry detection result (in-memory cache)
        self.cry_status: Dict[str, Any] = {
            "cry_detected": False,
            "message": "No data yet",
            "timestamp": None,
        }

        # Notification history (in-memory cache, last 50)
        self.notifications: List[Dict[str, Any]] = []

    # ── WebSocket Client Management ──────────────────────────

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

    # ── Broadcast Helpers ────────────────────────────────────

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

    # ── State Updates ────────────────────────────────────────

    def update_esp_status(self, connected: bool = True):
        self.esp_connected = connected
        self.esp_last_seen = time.time()

    def is_esp_connected(self) -> bool:
        if self.esp_last_seen == 0:
            return False
        return (time.time() - self.esp_last_seen) < self.ESP_TIMEOUT

    async def update_sensor_data(self, data: dict):
        from services.database import database

        self.sensor_data = {
            "temperature": data.get("temperature"),
            "humidity": data.get("humidity"),
            "motion": data.get("motion", False),
            "light_dark": data.get("light_dark", False),
            "timestamp": time.time(),
        }
        self.update_esp_status(connected=True)

        # Persist to MongoDB
        try:
            await database.save_sensor_data(self.sensor_data.copy())
            await database.save_esp_status(True, self.esp_last_seen)
        except Exception as e:
            logger.error(f"Failed to save sensor data to MongoDB: {e}")

        # Broadcast to WebSocket clients for real-time updates
        await self._broadcast({
            "type": "sensor_update",
            "data": self.sensor_data,
            "esp_connected": True,
        })

    async def update_cry_status(self, result: dict):
        from services.database import database

        self.cry_status = result

        # Persist to MongoDB
        try:
            await database.save_cry_status(result.copy())
        except Exception as e:
            logger.error(f"Failed to save cry status to MongoDB: {e}")

        if result.get("cry_detected"):
            notification = {
                "type": "cry_alert",
                "message": result.get("message", "Baby is crying!"),
                "timestamp": time.time(),
            }
            self.notifications.append(notification)
            # Keep last 50
            self.notifications = self.notifications[-50:]

            # Persist notification to MongoDB
            try:
                await database.save_notification(notification.copy())
            except Exception as e:
                logger.error(f"Failed to save notification to MongoDB: {e}")

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

    # ── Full State Snapshot ──────────────────────────────────

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
