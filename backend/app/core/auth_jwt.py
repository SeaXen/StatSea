from datetime import datetime, timedelta, timezone

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.exceptions import AuthenticationException, PermissionDeniedException
from ..db.database import get_db
from ..models import models

SECRET_KEY = settings.JWT_SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def create_access_token(data: dict, expires_delta: timedelta | None = None, token_version: int = 1):
    to_encode = data.copy()
    if "tv" not in to_encode:
        to_encode["tv"] = token_version
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(user_id: int, expires_delta: timedelta | None = None):
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    import secrets

    token = secrets.token_urlsafe(32)
    return token, expire


def _extract_user_from_token(token: str, db: Session) -> tuple[models.User, dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise AuthenticationException("Invalid token payload")
    except Exception:
        raise AuthenticationException("Invalid or expired token") from None

    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise AuthenticationException("User not found")
    if not user.is_active:
        raise AuthenticationException("Inactive user")

    tv = payload.get("tv")
    if getattr(user, "token_version", None) is not None:
        if tv is None or tv != user.token_version:
            raise AuthenticationException("Token has been revoked")

    return user, payload


def get_current_user_allow_must_change(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user, _ = _extract_user_from_token(token, db)
    return user


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user, _ = _extract_user_from_token(token, db)
    if user.must_change_password:
        raise PermissionDeniedException("Password rotation required. Please change your password at /api/auth/change-password")
    return user


def get_current_admin_user(current_user: models.User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise PermissionDeniedException()
    return current_user

