"""Save signup/profile photos under backend/uploads/users/{user_id}/."""

from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from config import settings

ALLOWED_IMAGE_CT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


def _upload_root() -> Path:
    return Path(settings.UPLOAD_DIR)


async def save_user_profile_image(
    user_id: str,
    role: str,
    upload: UploadFile | None,
) -> str | None:
    """
    Persist image as users/{user_id}/{role}.<ext>. Returns public URL path /api/uploads/... or None if no file.
    """
    if upload is None:
        return None
    name = (upload.filename or "").strip()
    if not name:
        return None

    ct = (upload.content_type or "").split(";")[0].strip().lower()
    ext = ALLOWED_IMAGE_CT.get(ct)
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo must be JPEG, PNG, WebP, or GIF.",
        )

    data = await upload.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo must be 5MB or smaller.",
        )

    root = _upload_root()
    user_dir = root / "users" / user_id
    user_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{role}{ext}"
    path = user_dir / filename
    path.write_bytes(data)

    return f"/api/uploads/users/{user_id}/{filename}"
