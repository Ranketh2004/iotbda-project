"""Persist signup/profile photos in MongoDB while keeping stable public URLs."""

from datetime import datetime, timezone

from bson.binary import Binary

from fastapi import HTTPException, UploadFile, status

from services.database import database

ALLOWED_IMAGE_CT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_IMAGE_BYTES = 5 * 1024 * 1024
PHOTO_ROLES = frozenset({"parent", "baby"})


def _normalize_ext(ext: str) -> str:
    e = (ext or "").strip().lower()
    if not e:
        return ""
    return e if e.startswith(".") else f".{e}"


def build_public_photo_url(user_id: str, role: str, ext: str) -> str:
    return f"/api/uploads/users/{user_id}/{role}{_normalize_ext(ext)}"


def photo_public_url_from_stored_value(user_id: str, role: str, stored_value: object) -> str:
    """
    Convert stored photo value to public URL.
    Supports legacy string URLs and db-backed photo objects.
    """
    if isinstance(stored_value, str):
        return stored_value.strip()
    if not isinstance(stored_value, dict):
        return ""

    ext = _normalize_ext(str(stored_value.get("ext") or ""))
    if not ext:
        ct = (stored_value.get("mime_type") or "").split(";")[0].strip().lower()
        ext = ALLOWED_IMAGE_CT.get(ct) or ".jpg"
    return build_public_photo_url(user_id, role, ext)


async def save_user_profile_image(
    user_id: str,
    role: str,
    upload: UploadFile | None,
) -> str | None:
    """
    Persist image as users.photos.{role} in MongoDB and return /api/uploads/users/... URL.
    """
    role_norm = (role or "").strip().lower()
    if role_norm not in PHOTO_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid photo role.",
        )

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

    photo_doc = {
        "mime_type": ct,
        "ext": ext,
        "size_bytes": len(data),
        "uploaded_at": datetime.now(timezone.utc),
        "data": Binary(data),
    }
    ok = await database.set_user_photo(user_id, role_norm, photo_doc)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return build_public_photo_url(user_id, role_norm, ext)
