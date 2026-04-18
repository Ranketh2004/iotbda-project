from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse, Response

from config import settings
from services.database import database
from services.user_uploads import PHOTO_ROLES

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])


def _role_from_filename(filename: str) -> str | None:
    role = Path(filename).stem.strip().lower()
    return role if role in PHOTO_ROLES else None


def _legacy_photo_path(user_id: str, filename: str) -> Path | None:
    base = (Path(settings.UPLOAD_DIR) / "users" / user_id).resolve()
    candidate = (base / filename).resolve()
    try:
        candidate.relative_to(base)
    except ValueError:
        return None
    return candidate


@router.get("/users/{user_id}/{filename}")
async def get_user_photo(user_id: str, filename: str):
    role = _role_from_filename(filename)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")

    user_exists, stored_photo = await database.get_user_photo(user_id, role)
    if not user_exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if isinstance(stored_photo, dict) and stored_photo.get("data") is not None:
        mime_type = (stored_photo.get("mime_type") or "application/octet-stream").strip()
        return Response(
            content=bytes(stored_photo.get("data") or b""),
            media_type=mime_type,
            headers={"Cache-Control": "public, max-age=300"},
        )

    legacy = _legacy_photo_path(user_id, filename)
    if legacy and legacy.is_file():
        return FileResponse(
            legacy,
            headers={"Cache-Control": "public, max-age=300"},
        )

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")
