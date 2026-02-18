from datetime import datetime, timedelta, timezone

import sqlalchemy.exc
from sqlalchemy.orm import Session

from ..core.auth_jwt import create_access_token, create_refresh_token
from ..core.exceptions import AuthenticationException, ValidationException
from ..core.logging import get_logger
from ..models import models

logger = get_logger("AuthService")


class AuthService:
    @staticmethod
    def authenticate_user(db: Session, username: str, password: str) -> models.User:
        """
        Authenticates a user against stored credentials.
        Raises AuthenticationException on failure.
        """
        user = db.query(models.User).filter(models.User.username == username).first()
        if not user or not user.verify_password(password):
            logger.warning(f"Auth failure: Incorrect credentials for {username}")
            raise AuthenticationException("Incorrect username or password")
        if not user.is_active:
            logger.warning(f"Auth failure: Inactive account {username}")
            raise AuthenticationException("User account is inactive")
        return user

    @staticmethod
    def create_session(db: Session, user: models.User, remember_me: bool = False) -> dict:
        """
        Creates a new session for the user, including access and refresh tokens.
        Updates last_login timestamp.
        """
        try:
            expires_delta = timedelta(days=7) if remember_me else timedelta(days=1)
            refresh_token_str, expires_at = create_refresh_token(
                user_id=user.id, expires_delta=expires_delta
            )

            db_refresh_token = models.RefreshToken(
                token=refresh_token_str, user_id=user.id, expires_at=expires_at
            )
            db.add(db_refresh_token)

            user.last_login = datetime.now(timezone.utc)
            db.commit()

            access_token = create_access_token(data={"sub": user.username})
            logger.info(f"Session created for {user.username}")
            return {
                "access_token": access_token,
                "refresh_token": refresh_token_str,
                "token_type": "bearer",
            }
        except sqlalchemy.exc.SQLAlchemyError as e:
            logger.exception(f"Database error creating session for {user.username}")
            db.rollback()
            raise AuthenticationException("Could not complete login due to a system error") from e

    @staticmethod
    def refresh_session(db: Session, refresh_token: str) -> dict:
        """
        Invalidates current refresh token and issues a new pair.
        Used for token rotation.
        """
        db_token = (
            db.query(models.RefreshToken)
            .filter(
                models.RefreshToken.token == refresh_token,
                models.RefreshToken.is_revoked == False,
                models.RefreshToken.expires_at > datetime.now(timezone.utc),
            )
            .first()
        )

        if not db_token:
            logger.warning("Token refresh failed: Invalid token")
            raise AuthenticationException("Invalid or expired refresh token")

        user = db_token.user
        if not user or not user.is_active:
            raise AuthenticationException("User unavailable")

        try:
            db_token.is_revoked = True

            new_access_token = create_access_token(data={"sub": user.username})
            new_refresh_token_str, new_expires_at = create_refresh_token(user_id=user.id)

            new_db_token = models.RefreshToken(
                token=new_refresh_token_str, user_id=user.id, expires_at=new_expires_at
            )
            db.add(new_db_token)
            db.commit()

            logger.info(f"Session refreshed for {user.username}")
            return {
                "access_token": new_access_token,
                "refresh_token": new_refresh_token_str,
                "token_type": "bearer",
            }
        except sqlalchemy.exc.SQLAlchemyError as e:
            logger.exception("Database error during token refresh")
            db.rollback()
            raise AuthenticationException("Could not refresh session") from e

    @staticmethod
    def change_password(db: Session, user: models.User, current_password: str, new_password: str):
        """
        Changes a user's password after verifying the current one.
        """
        if not user.verify_password(current_password):
            logger.warning(
                f"Password change failed: Incorrect current password for {user.username}"
            )
            raise ValidationException("Incorrect current password")

        try:
            user.hashed_password = models.User.get_password_hash(new_password)
            db.commit()
            logger.info(f"Password changed for {user.username}")
        except sqlalchemy.exc.SQLAlchemyError as e:
            logger.exception(f"Database error during password change for {user.username}")
            db.rollback()
            raise ValidationException("Could not update password") from e

    @staticmethod
    def logout(db: Session, refresh_token: str | None):
        """
        Invalidates a refresh token to effectively logout the user.
        """
        if refresh_token:
            try:
                db_token = (
                    db.query(models.RefreshToken)
                    .filter(models.RefreshToken.token == refresh_token)
                    .first()
                )
                if db_token:
                    db_token.is_revoked = True
                    db.commit()
                    logger.info("Session revoked (logout)")
            except sqlalchemy.exc.SQLAlchemyError:
                logger.exception("Database error during logout")
                db.rollback()
