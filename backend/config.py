import os
from dotenv import load_dotenv

# backend/config.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))              # backend/
PROJECT_ROOT = os.path.dirname(BASE_DIR)                           # CRY-GUARD/
ENV_PATH = os.path.join(PROJECT_ROOT, ".env")

load_dotenv(ENV_PATH)


class Settings:
    APP_NAME: str = "Baby Cry Detection API"

    # Paths
    BASE_DIR: str = BASE_DIR
    MODEL_PATH: str = os.path.join(BASE_DIR, "models", "baby_cry_model.h5")

    # Audio constants
    SAMPLE_RATE: int = 16000
    MEL_BINS: int = 128
    MAX_FREQ: int = 8000

    # MongoDB
    MONGO_URI: str = os.getenv("MONGO_URI", "")
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "cryguard")

    def validate(self):
        if not self.MONGO_URI:
            raise ValueError(f"MONGO_URI is not set. Expected it in: {ENV_PATH}")


settings = Settings()
settings.validate()