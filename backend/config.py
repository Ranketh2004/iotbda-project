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
    MODEL_PATH: str = os.path.join(BASE_DIR, "models", "cnn_lstm.keras")
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "uploads")

    # Audio constants
    SAMPLE_RATE: int = 16000
    MEL_BINS: int = 40
    MAX_FREQ: int = 8000
    EXPECTED_FRAMES = 313
    # Binary cry model: probability above this counts as crying (sigmoid output)
    CRY_PROBABILITY_THRESHOLD: float = float(os.getenv("CRY_PROBABILITY_THRESHOLD", "0.5"))
    # Skip neural net when waveform RMS is below this (silence / line noise); librosa float audio in [-1, 1]
    MIN_AUDIO_RMS: float = float(os.getenv("MIN_AUDIO_RMS", "0.012"))
    # Multi-class softmax: require top class this confident (reduces false cries on ambiguous input)
    CRY_MULTICLASS_MIN_CONFIDENCE: float = float(os.getenv("CRY_MULTICLASS_MIN_CONFIDENCE", "0.58"))

    # MongoDB
    MONGO_URI: str = os.getenv("MONGO_URI", "")
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "cryguard")

    # Auth (JWT)
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production-use-long-random-string")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days

    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000")

    # SMTP Email
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Infant Cry Guard")

    # OpenAI (LLM chat agent)
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    def validate(self):
        if not self.MONGO_URI:
            raise ValueError(f"MONGO_URI is not set. Expected it in: {ENV_PATH}")


settings = Settings()
settings.validate()