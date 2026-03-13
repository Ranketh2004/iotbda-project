import logging
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

logger = logging.getLogger(__name__)


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


# Singleton
database = Database()
