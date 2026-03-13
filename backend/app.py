from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging

from config import settings
from routes import audio_routes
from routes import sensor_routes
from routes import ws_routes
from routes import audio_stream_routes
from services.database import database

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for Baby Cry Detection System receiving audio from ESP32.",
    version="1.0.0"
)

# CORS - allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(audio_routes.router)
app.include_router(sensor_routes.router)
app.include_router(ws_routes.router)
app.include_router(audio_stream_routes.router)

@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting {settings.APP_NAME}...")
    # Connect to MongoDB
    await database.connect()
    logger.info("MongoDB connected successfully.")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info(f"Shutting down {settings.APP_NAME}...")
    await database.close()

@app.get("/", tags=["Health"])
async def root_health_check():
    """Root health check endpoint."""
    return {"status": "ok", "message": f"{settings.APP_NAME} is running."}

@app.get("/health", tags=["Health"])
async def health_check():
    """Explicit health check endpoint."""
    return {"status": "ok", "message": f"{settings.APP_NAME} is healthy and running."}

if __name__ == "__main__":
    logger.info("Starting Uvicorn server...")
    uvicorn.run("app:app", host="0.0.0.0", port=8080, reload=True)
