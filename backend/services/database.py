import logging
import re
import certifi
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

logger = logging.getLogger(__name__)

USER_DOC_DEFAULT_PROJECTION = {
    "photos.parent.data": 0,
    "photos.baby.data": 0,
}


class Database:
    """
    MongoDB async database manager using Motor.
    """

    def __init__(self):
        self.client: AsyncIOMotorClient = None
        self.db = None

    async def connect(self):
        """Connect to MongoDB."""
        try:
            self.client = AsyncIOMotorClient(
                settings.MONGO_URI,
                tlsCAFile=certifi.where(),
            )
            self.db = self.client[settings.MONGO_DB_NAME]
            # Verify connection
            await self.client.admin.command("ping")
            print("MongoDB connected successfully!")
            logger.info(f"Connected to MongoDB at {settings.MONGO_URI}, database: {settings.MONGO_DB_NAME}")

            # Create indexes for efficient queries
            await self.db.sensor_data.create_index("timestamp", unique=False)
            await self.db.notifications.create_index("timestamp", unique=False)
            await self.db.users.create_index("email", unique=True)
            await self.db.users.create_index("phone", unique=True, sparse=True)
            logger.info("MongoDB indexes created.")
        except Exception as e:
            print(f"MongoDB connection failed: {e}")
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    async def close(self):
        """Close MongoDB connection."""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed.")

    # ── Sensor Data ──────────────────────────────────────────

    async def save_sensor_data(self, data: dict):
        """Insert a sensor reading document into the sensor_data collection."""
        result = await self.db.sensor_data.insert_one(data)
        logger.debug(f"Sensor data saved with id: {result.inserted_id}")
        return result.inserted_id

    async def get_latest_sensor_data(self) -> dict | None:
        """Get the most recent sensor reading."""
        doc = await self.db.sensor_data.find_one(
            sort=[("timestamp", -1)]
        )
        if doc:
            doc["_id"] = str(doc["_id"])  # Convert ObjectId to string for JSON
        return doc

    async def get_sensor_history(self, limit: int = 50) -> list:
        """Get recent sensor readings."""
        cursor = self.db.sensor_data.find().sort("timestamp", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        for doc in docs:
            doc["_id"] = str(doc["_id"])
        return docs

    # ── Notifications ────────────────────────────────────────

    async def save_notification(self, notification: dict):
        """Save a cry alert notification."""
        result = await self.db.notifications.insert_one(notification)
        logger.debug(f"Notification saved with id: {result.inserted_id}")
        return result.inserted_id

    async def get_notifications(self, limit: int = 50) -> list:
        """Get recent notifications."""
        cursor = self.db.notifications.find().sort("timestamp", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        for doc in docs:
            doc["_id"] = str(doc["_id"])
        return docs

    # ── Cry Status ───────────────────────────────────────────

    async def save_cry_status(self, status: dict):
        """Save/update the latest cry detection status."""
        await self.db.cry_status.replace_one(
            {"_type": "latest"},
            {**status, "_type": "latest"},
            upsert=True,
        )

    async def get_cry_status(self) -> dict | None:
        """Get the latest cry status."""
        doc = await self.db.cry_status.find_one({"_type": "latest"})
        if doc:
            doc["_id"] = str(doc["_id"])
            doc.pop("_type", None)
        return doc

    # ── ESP Status ───────────────────────────────────────────

    async def save_esp_status(self, connected: bool, last_seen: float):
        """Save ESP32 connection status."""
        await self.db.esp_status.replace_one(
            {"_type": "latest"},
            {"_type": "latest", "connected": connected, "last_seen": last_seen},
            upsert=True,
        )

    async def get_esp_status(self) -> dict | None:
        """Get current ESP status."""
        doc = await self.db.esp_status.find_one({"_type": "latest"})
        if doc:
            doc["_id"] = str(doc["_id"])
            doc.pop("_type", None)
        return doc

    # ── Users (parent accounts) ─────────────────────────────

    @staticmethod
    def normalize_email(email: str) -> str:
        return (email or "").strip().lower()

    @staticmethod
    def normalize_phone(phone: str) -> str | None:
        if not phone or not str(phone).strip():
            return None
        digits = re.sub(r"\D", "", str(phone).strip())
        return digits or None

    async def insert_user(self, user_doc: dict) -> str:
        user_doc["created_at"] = datetime.now(timezone.utc)
        result = await self.db.users.insert_one(user_doc)
        return str(result.inserted_id)

    async def find_user_by_email(self, email: str) -> dict | None:
        key = self.normalize_email(email)
        if not key:
            return None
        doc = await self.db.users.find_one({"email": key}, USER_DOC_DEFAULT_PROJECTION)
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    async def find_user_by_phone(self, phone: str) -> dict | None:
        key = self.normalize_phone(phone)
        if not key:
            return None
        doc = await self.db.users.find_one({"phone": key}, USER_DOC_DEFAULT_PROJECTION)
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    async def find_user_by_login_identifier(self, identifier: str) -> dict | None:
        """Match login field labeled 'email' that may be an email address or phone number."""
        raw = (identifier or "").strip()
        if not raw:
            return None
        by_email = await self.find_user_by_email(raw)
        if by_email:
            return by_email
        return await self.find_user_by_phone(raw)

    async def get_user_by_id(self, user_id: str) -> dict | None:
        from bson import ObjectId

        try:
            oid = ObjectId(user_id)
        except Exception:
            return None
        doc = await self.db.users.find_one({"_id": oid}, USER_DOC_DEFAULT_PROJECTION)
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    async def update_user_by_id(self, user_id: str, updates: dict) -> bool:
        from bson import ObjectId

        try:
            oid = ObjectId(user_id)
        except Exception:
            return False
        if not updates:
            return True
        r = await self.db.users.update_one({"_id": oid}, {"$set": updates})
        return r.matched_count > 0

    async def patch_user(
        self,
        user_id: str,
        set_fields: dict | None = None,
        unset_fields: list[str] | None = None,
    ) -> bool:
        from bson import ObjectId

        try:
            oid = ObjectId(user_id)
        except Exception:
            return False
        cmd: dict = {}
        if set_fields:
            cmd["$set"] = set_fields
        if unset_fields:
            cmd["$unset"] = {k: "" for k in unset_fields}
        if not cmd:
            return True
        r = await self.db.users.update_one({"_id": oid}, cmd)
        return r.matched_count > 0

    async def set_user_photo(self, user_id: str, role: str, photo_doc: dict) -> bool:
        from bson import ObjectId

        try:
            oid = ObjectId(user_id)
        except Exception:
            return False
        if not role or not photo_doc:
            return False
        field = f"photos.{role}"
        r = await self.db.users.update_one({"_id": oid}, {"$set": {field: photo_doc}})
        return r.matched_count > 0

    async def get_user_photo(self, user_id: str, role: str) -> tuple[bool, dict | str | None]:
        """
        Return (user_exists, photo_value_for_role).
        photo_value_for_role can be dict (db-backed photo object), str (legacy URL), or None.
        """
        from bson import ObjectId

        try:
            oid = ObjectId(user_id)
        except Exception:
            return False, None
        projection = {f"photos.{role}": 1}
        doc = await self.db.users.find_one({"_id": oid}, projection)
        if not doc:
            return False, None
        photos = doc.get("photos") or {}
        return True, photos.get(role)


# Singleton
database = Database()
