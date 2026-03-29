import hashlib
import logging
import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone

import bcrypt
import httpx
import jwt
from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile, status
from fastapi.responses import RedirectResponse
from jwt.exceptions import PyJWTError
from pydantic import BaseModel, ConfigDict, EmailStr, Field, TypeAdapter, ValidationError

from config import settings
from services.database import database
from services.email_service import send_reset_email
from services.user_uploads import save_user_profile_image

router = APIRouter(prefix="/api/auth", tags=["Auth"])
logger = logging.getLogger(__name__)

BABY_GENDERS = frozenset({"boy", "girl", "other"})
_EMAIL_ADAPTER = TypeAdapter(EmailStr)


def _bcrypt_secret(password: str) -> bytes:
    """SHA-256 then bcrypt avoids bcrypt's 72-byte password limit and UTF-8 edge cases."""
    return hashlib.sha256(password.encode("utf-8")).digest()


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(_bcrypt_secret(password), salt).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(_bcrypt_secret(plain), hashed.encode("ascii"))
    except (ValueError, TypeError):
        return False


def create_access_token(subject_user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = jwt.encode(
        {"sub": subject_user_id, "exp": expire},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    if isinstance(token, bytes):
        return token.decode("utf-8")
    return token


def _decode_bearer_user_id(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    raw = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(raw, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        uid = payload.get("sub")
        if not uid:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return str(uid)
    except PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


class LoginRequest(BaseModel):
    """Matches login form: field is named `email` but accepts email or phone."""

    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class ParentPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = ""
    phone: str = ""
    email: str = ""


class UserPublic(BaseModel):
    id: str
    fullName: str
    email: str
    phone: str = ""
    mother: ParentPublic = Field(default_factory=ParentPublic)
    father: ParentPublic = Field(default_factory=ParentPublic)
    babyName: str = ""
    babyAge: str = "0-3"
    babyGender: str = "other"
    parentPhotoUrl: str = ""
    babyPhotoUrl: str = ""
    guardians: list[dict] = []


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class GuardianIn(BaseModel):
    priority: int = Field(..., ge=1, le=20)
    name: str = ""
    relationship: str = ""
    phone: str = ""


class GuardiansUpdateBody(BaseModel):
    guardians: list[GuardianIn] = Field(default_factory=list)


def _build_guardians(
    g1name: str,
    g1rel: str,
    g1phone: str,
    g2name: str,
    g2rel: str,
    g2phone: str,
) -> list[dict]:
    out: list[dict] = []
    pairs = [
        (1, g1name, g1rel, g1phone),
        (2, g2name, g2rel, g2phone),
    ]
    for priority, name, rel, phone in pairs:
        n = (name or "").strip()
        p = database.normalize_phone(phone)
        if not n and not p:
            continue
        out.append(
            {
                "priority": priority,
                "name": n,
                "relationship": (rel or "").strip(),
                "phone": p or "",
            }
        )
    return out


def _normalize_baby_gender(raw: str) -> str:
    g = (raw or "other").strip().lower()
    return g if g in BABY_GENDERS else "other"


def _parse_parent_subdoc(name: str, phone: str, email: str) -> dict:
    name_s = (name or "").strip()
    phone_s = database.normalize_phone(phone) or ""
    raw_email = (email or "").strip()
    email_s = ""
    if raw_email:
        try:
            email_s = database.normalize_email(str(_EMAIL_ADAPTER.validate_python(raw_email)))
        except ValidationError:
            email_s = ""
    return {"name": name_s, "phone": phone_s, "email": email_s}


def _display_full_name(mother: dict, father: dict, fallback: str = "") -> str:
    parts = [mother.get("name", "").strip(), father.get("name", "").strip()]
    parts = [p for p in parts if p]
    if parts:
        return " & ".join(parts)
    return (fallback or "").strip()


def _mother_father_for_public(doc: dict) -> tuple[dict, dict]:
    """Normalize DB doc to mother/father public dicts; map legacy single-parent fields."""
    mother = dict(doc.get("mother") or {})
    father = dict(doc.get("father") or {})
    m_name = (mother.get("name") or "").strip()
    f_name = (father.get("name") or "").strip()
    if not m_name and not f_name:
        legacy_name = (doc.get("full_name") or "").strip()
        legacy_phone = str(doc.get("phone") or "")
        legacy_email = doc.get("email") or ""
        mother = {
            "name": legacy_name,
            "phone": legacy_phone,
            "email": legacy_email,
        }
        father = {"name": "", "phone": "", "email": ""}
    else:
        mother = {
            "name": m_name,
            "phone": str(mother.get("phone") or ""),
            "email": (mother.get("email") or ""),
        }
        father = {
            "name": f_name,
            "phone": str(father.get("phone") or ""),
            "email": (father.get("email") or ""),
        }
    return mother, father


def _user_to_public(doc: dict) -> UserPublic:
    baby = doc.get("baby") or {}
    guardians = doc.get("guardians") or []
    photos = doc.get("photos") or {}
    mother, father = _mother_father_for_public(doc)
    full_display = _display_full_name(
        {"name": mother.get("name", ""), "phone": "", "email": ""},
        {"name": father.get("name", ""), "phone": "", "email": ""},
        doc.get("full_name", ""),
    )
    return UserPublic(
        id=doc["_id"],
        fullName=full_display,
        email=doc.get("email", ""),
        phone=doc.get("phone") or "",
        mother=ParentPublic(**mother),
        father=ParentPublic(**father),
        babyName=baby.get("name", ""),
        babyAge=baby.get("age_band", "0-3"),
        babyGender=baby.get("gender") or "other",
        parentPhotoUrl=photos.get("parent") or "",
        babyPhotoUrl=photos.get("baby") or "",
        guardians=guardians,
    )


@router.post("/register", response_model=TokenResponse)
async def register(
    email: str = Form(..., min_length=3),
    phone: str = Form(""),
    password: str = Form(..., min_length=1),
    password_confirm: str = Form(..., min_length=1, alias="passwordConfirm"),
    mother_name: str = Form("", alias="motherName"),
    mother_phone: str = Form("", alias="motherPhone"),
    mother_email: str = Form("", alias="motherEmail"),
    father_name: str = Form("", alias="fatherName"),
    father_phone: str = Form("", alias="fatherPhone"),
    father_email: str = Form("", alias="fatherEmail"),
    baby_name: str = Form("", alias="babyName"),
    baby_age: str = Form("0-3", alias="babyAge"),
    baby_gender: str = Form("other", alias="babyGender"),
    g1name: str = Form(""),
    g1rel: str = Form(""),
    g1phone: str = Form(""),
    g2name: str = Form(""),
    g2rel: str = Form(""),
    g2phone: str = Form(""),
    parent_photo: UploadFile | None = File(None, alias="parentPhoto"),
    baby_photo: UploadFile | None = File(None, alias="babyPhoto"),
):
    if password != password_confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match.",
        )

    try:
        email_valid = _EMAIL_ADAPTER.validate_python(email.strip())
    except ValidationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email address.",
        )

    email_norm = database.normalize_email(str(email_valid))
    if await database.find_user_by_email(email_norm):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    phone_norm = database.normalize_phone(phone)
    if phone_norm and await database.find_user_by_phone(phone):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this phone number already exists.",
        )

    gender = _normalize_baby_gender(baby_gender)

    mother_doc = _parse_parent_subdoc(mother_name, mother_phone, mother_email)
    father_doc = _parse_parent_subdoc(father_name, father_phone, father_email)
    if not mother_doc["name"] and not father_doc["name"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter at least the mother's or father's full name.",
        )
    full_name_display = _display_full_name(mother_doc, father_doc)

    user_doc: dict = {
        "email": email_norm,
        "password_hash": hash_password(password),
        "full_name": full_name_display,
        "mother": mother_doc,
        "father": father_doc,
        "photos": {},
        "baby": {
            "name": (baby_name or "").strip(),
            "age_band": baby_age or "0-3",
            "gender": gender,
        },
        "guardians": _build_guardians(g1name, g1rel, g1phone, g2name, g2rel, g2phone),
    }
    if phone_norm:
        user_doc["phone"] = phone_norm

    user_id = await database.insert_user(user_doc)
    user_doc["_id"] = user_id

    photo_updates: dict = {}
    try:
        parent_url = await save_user_profile_image(user_id, "parent", parent_photo)
        baby_url = await save_user_profile_image(user_id, "baby", baby_photo)
        if parent_url:
            photo_updates["parent"] = parent_url
        if baby_url:
            photo_updates["baby"] = baby_url
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to save signup photos: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save profile photos.",
        )

    if photo_updates:
        user_doc["photos"] = photo_updates
        await database.update_user_by_id(user_id, {"photos": photo_updates})

    token = create_access_token(user_id)
    return TokenResponse(access_token=token, user=_user_to_public(user_doc))


@router.patch("/profile", response_model=UserPublic)
async def update_profile(
    authorization: str | None = Header(None),
    phone: str = Form(""),
    mother_name: str = Form("", alias="motherName"),
    mother_phone: str = Form("", alias="motherPhone"),
    mother_email: str = Form("", alias="motherEmail"),
    father_name: str = Form("", alias="fatherName"),
    father_phone: str = Form("", alias="fatherPhone"),
    father_email: str = Form("", alias="fatherEmail"),
    baby_name: str = Form("", alias="babyName"),
    baby_age: str = Form("0-3", alias="babyAge"),
    baby_gender: str = Form("other", alias="babyGender"),
    parent_photo: UploadFile | None = File(None, alias="parentPhoto"),
    baby_photo: UploadFile | None = File(None, alias="babyPhoto"),
):
    uid = _decode_bearer_user_id(authorization)
    gender = _normalize_baby_gender(baby_gender)

    mother_doc = _parse_parent_subdoc(mother_name, mother_phone, mother_email)
    father_doc = _parse_parent_subdoc(father_name, father_phone, father_email)
    if not mother_doc["name"] and not father_doc["name"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter at least one parent's full name.",
        )

    set_fields: dict = {
        "full_name": _display_full_name(mother_doc, father_doc),
        "mother": mother_doc,
        "father": father_doc,
        "baby": {
            "name": (baby_name or "").strip(),
            "age_band": baby_age or "0-3",
            "gender": gender,
        },
    }
    unset: list[str] = []

    phone_norm = database.normalize_phone(phone)
    if phone_norm:
        other = await database.find_user_by_phone(phone)
        if other and other.get("_id") != uid:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This phone number is already used by another account.",
            )
        set_fields["phone"] = phone_norm
    else:
        if not (phone or "").strip():
            unset.append("phone")

    doc = await database.get_user_by_id(uid)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    photos = dict(doc.get("photos") or {})
    try:
        parent_url = await save_user_profile_image(uid, "parent", parent_photo)
        baby_url = await save_user_profile_image(uid, "baby", baby_photo)
        if parent_url:
            photos["parent"] = parent_url
        if baby_url:
            photos["baby"] = baby_url
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to save profile photos: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save profile photos.",
        )

    if photos:
        set_fields["photos"] = photos

    ok = await database.patch_user(uid, set_fields=set_fields, unset_fields=unset or None)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    updated = await database.get_user_by_id(uid)
    return _user_to_public(updated)


@router.patch("/guardians", response_model=UserPublic)
async def patch_guardians(
    body: GuardiansUpdateBody,
    authorization: str | None = Header(None),
):
    uid = _decode_bearer_user_id(authorization)
    normalized: list[dict] = []
    for g in body.guardians:
        normalized.append(
            {
                "priority": int(g.priority),
                "name": (g.name or "").strip(),
                "relationship": (g.relationship or "").strip(),
                "phone": database.normalize_phone(g.phone) or "",
            }
        )
    normalized.sort(key=lambda x: x["priority"])
    ok = await database.update_user_by_id(uid, {"guardians": normalized})
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    updated = await database.get_user_by_id(uid)
    return _user_to_public(updated)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    user = await database.find_user_by_login_identifier(body.email)
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(user["_id"])
    return TokenResponse(access_token=token, user=_user_to_public(user))


# ── Forgot / Reset Password ─────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=1)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    password_confirm: str = Field(..., min_length=1)


# In-memory reset tokens: token → {user_id, expires}
_reset_tokens: dict[str, dict] = {}
RESET_TOKEN_EXPIRE_MINUTES = 15


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    """Generate a password reset token and send it via email."""
    email_norm = database.normalize_email(body.email)
    user = await database.find_user_by_email(email_norm)
    # Always return success to avoid leaking whether email exists
    if not user:
        return {"message": "If that email is registered, a reset link has been sent."}

    # Google-only accounts have no password to reset
    if not user.get("password_hash"):
        return {"message": "If that email is registered, a reset link has been sent."}

    token = secrets.token_urlsafe(32)
    _reset_tokens[token] = {
        "user_id": user["_id"],
        "expires": datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
    }
    logger.info("Password reset token for %s: %s", email_norm, token)

    reset_link = f"{settings.GOOGLE_REDIRECT_URI}/reset-password?token={urllib.parse.quote(token)}"
    email_sent = send_reset_email(email_norm, reset_link)

    return {
        "message": "If that email is registered, a reset link has been sent.",
        "email_sent": email_sent,
    }


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    """Reset user password using a valid reset token."""
    entry = _reset_tokens.get(body.token)
    if not entry:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
    if datetime.now(timezone.utc) > entry["expires"]:
        del _reset_tokens[body.token]
        raise HTTPException(status_code=400, detail="Reset token has expired.")

    if body.password != body.password_confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    new_hash = hash_password(body.password)
    ok = await database.update_user_by_id(entry["user_id"], {"password_hash": new_hash})
    if not ok:
        raise HTTPException(status_code=404, detail="User not found.")

    del _reset_tokens[body.token]
    return {"message": "Password has been reset successfully. You can now log in."}


@router.get("/me", response_model=UserPublic)
async def read_me(authorization: str | None = Header(None)):
    uid = _decode_bearer_user_id(authorization)
    doc = await database.get_user_by_id(uid)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _user_to_public(doc)


# ── Google OAuth ─────────────────────────────────────────

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

# In-memory store for state ↔ nonce (short-lived; fine for single-instance dev)
_google_oauth_states: dict[str, float] = {}


@router.get("/google/login")
async def google_login():
    """Redirect browser to Google consent screen."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured.")

    state = secrets.token_urlsafe(32)
    _google_oauth_states[state] = datetime.now(timezone.utc).timestamp()

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI + "/api/auth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "state": state,
        "prompt": "consent",
    }
    url = f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(code: str = "", state: str = ""):
    """Exchange Google auth code for tokens, create/find user, redirect with JWT."""
    # Validate state to prevent CSRF
    if not state or state not in _google_oauth_states:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state.")
    del _google_oauth_states[state]

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code.")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI + "/api/auth/google/callback",
                "grant_type": "authorization_code",
            },
        )
    if token_resp.status_code != 200:
        logger.error("Google token exchange failed: %s", token_resp.text)
        raise HTTPException(status_code=400, detail="Failed to obtain Google tokens.")

    tokens = token_resp.json()
    access_token_google = tokens.get("access_token")
    if not access_token_google:
        raise HTTPException(status_code=400, detail="No access token from Google.")

    # Fetch user info
    async with httpx.AsyncClient() as client:
        info_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token_google}"},
        )
    if info_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch Google user info.")

    ginfo = info_resp.json()
    google_email = (ginfo.get("email") or "").strip().lower()
    google_name = ginfo.get("name") or google_email.split("@")[0]
    google_picture = ginfo.get("picture") or ""

    if not google_email:
        raise HTTPException(status_code=400, detail="Google account has no email.")

    # Find or create the user
    user = await database.find_user_by_email(google_email)
    if not user:
        user_doc = {
            "email": google_email,
            "password_hash": "",  # no password for Google-only accounts
            "full_name": google_name,
            "mother": {"name": google_name, "phone": "", "email": google_email},
            "father": {"name": "", "phone": "", "email": ""},
            "photos": {"parent": google_picture} if google_picture else {},
            "baby": {"name": "", "age_band": "0-3", "gender": "other"},
            "guardians": [],
            "google_sub": ginfo.get("sub", ""),
        }
        user_id = await database.insert_user(user_doc)
        user_doc["_id"] = user_id
        user = user_doc
    else:
        # Optionally update google_sub if not set
        if not user.get("google_sub"):
            await database.update_user_by_id(user["_id"], {"google_sub": ginfo.get("sub", "")})

    app_token = create_access_token(user["_id"])

    # Redirect back to frontend with token in query param
    redirect_url = f"{settings.GOOGLE_REDIRECT_URI}/auth/google/callback?token={urllib.parse.quote(app_token)}&user={urllib.parse.quote(user['_id'])}"
    return RedirectResponse(redirect_url)
