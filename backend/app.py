from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import logging

from config import settings
from routes import audio_routes
from routes import auth_routes
from routes import sensor_routes
from routes import ws_routes
from routes import audio_stream_routes
from routes import care_log_routes
from routes import uploads_routes
from services.database import database

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

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
app.include_router(auth_routes.router)
app.include_router(audio_routes.router)
app.include_router(sensor_routes.router)
app.include_router(uploads_routes.router)
app.include_router(ws_routes.router)
app.include_router(audio_stream_routes.router)
app.include_router(care_log_routes.router)

# Serve Vite build so client-side routes (/login, /dashboard) work when using the API port (8080)
if FRONTEND_DIST.is_dir() and (FRONTEND_DIST / "index.html").is_file():
    _assets = FRONTEND_DIST / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")
    _images = FRONTEND_DIST / "images"
    if _images.is_dir():
        app.mount("/images", StaticFiles(directory=str(_images)), name="images")

    @app.get("/vite.svg", include_in_schema=False)
    async def vite_icon():
        p = FRONTEND_DIST / "vite.svg"
        if p.is_file():
            return FileResponse(p)
        raise HTTPException(status_code=404)

    logger.info("Serving frontend from %s", FRONTEND_DIST)
else:
    logger.info(
        "Frontend dist not found at %s — build with: cd frontend && npm run build",
        FRONTEND_DIST,
    )


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
    """Serve SPA when built; otherwise JSON health for API-only deployments."""
    index = FRONTEND_DIST / "index.html"
    if index.is_file():
        return FileResponse(index)
    return {"status": "ok", "message": f"{settings.APP_NAME} is running."}


@app.get("/health", tags=["Health"])
async def health_check():
    """Explicit health check endpoint."""
    return {"status": "ok", "message": f"{settings.APP_NAME} is healthy and running."}


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    """
    Client-side routes (e.g. /login) when the app is served from the backend.
    API routes under /api and /ws are registered above and take precedence.
    """
    if full_path.startswith("api"):
        raise HTTPException(status_code=404, detail="Not found")

    index = FRONTEND_DIST / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=404, detail="Frontend not built")

    candidate = (FRONTEND_DIST / full_path).resolve()
    try:
        candidate.relative_to(FRONTEND_DIST.resolve())
    except ValueError:
        return FileResponse(index)
    if candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(index)


if __name__ == "__main__":
    logger.info("Starting Uvicorn server...")
    # Run the in-memory app object directly to avoid module-resolution mismatches
    # (which can happen with string imports like "app:app" on Windows shells).
    uvicorn.run(app, host="0.0.0.0", port=8080, reload=False)
