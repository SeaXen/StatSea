from datetime import datetime, timedelta, timezone

import sqlalchemy.exc
from sqlalchemy.orm import Session

from ..core.auth_jwt import create_access_token, create_refresh_token
from ..core.exceptions import AuthenticationException, ValidationException
from ..core.logging import get_logger
from ..models import models
from .audit_service import AuditService

logger = get_logger("AuthService")


class AuthService:
    @staticmethod
    def authenticate_user(db: Session, username: str, password: str) -> models.User:
        """
        Authenticates a user against stored credentials.
        Raises AuthenticationException on failure.
        """
        user = db.query(models.User).filter(models.User.username == username).first()
        
        if user and user.locked_until and user.locked_until > datetime.now(timezone.utc):
            logger.warning(f"Auth failure: Account locked for {username}")
            raise AuthenticationException("Account is locked due to too many failed attempts. Try again later.")

        if not user or not user.verify_password(password):
            if user:
                user.failed_login_attempts += 1
                if user.failed_login_attempts >= 5:
                    user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
                    logger.warning(f"Account locked: Too many failed attempts for {username}")
                db.commit()
            logger.warning(f"Auth failure: Incorrect credentials for {username}")
            raise AuthenticationException("Incorrect username or password")

        if not user.is_active:
            logger.warning(f"Auth failure: Inactive account {username}")
            raise AuthenticationException("User account is inactive")
            
        if user.failed_login_attempts > 0 or user.locked_until:
            user.failed_login_attempts = 0
            user.locked_until = None
            db.commit()

        return user

    @staticmethod
    def create_session(
        db: Session, 
        user: models.User, 
        remember_me: bool = False,
        user_agent: str | None = None,
        ip_address: str | None = None
    ) -> dict:
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
                token=refresh_token_str, 
                user_id=user.id, 
                expires_at=expires_at,
                user_agent=user_agent,
                ip_address=ip_address
            )
            db.add(db_refresh_token)

            user.last_login = datetime.now(timezone.utc)
            db.commit()

            access_token = create_access_token(data={"sub": user.username})
            logger.info(f"Session created for {user.username}")
            
            org_id = user.organizations[0].organization_id if user.organizations else None
            AuditService.log_action(
                db=db,
                actor_id=user.id,
                action="LOGIN",
                resource_type="USER",
                resource_id=str(user.id),
                organization_id=org_id,
            )
            
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
            
            org_id = user.organizations[0].organization_id if user.organizations else None
            AuditService.log_action(
                db=db,
                actor_id=user.id,
                action="CHANGE_PASSWORD",
                resource_type="USER",
                resource_id=str(user.id),
                organization_id=org_id,
            )
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
                    user_id = db_token.user_id
                    org_id = db_token.user.organizations[0].organization_id if db_token.user and db_token.user.organizations else None
                    
                    db_token.is_revoked = True
                    db.commit()
                    logger.info("Session revoked (logout)")
                    
                    AuditService.log_action(
                        db=db,
                        actor_id=user_id,
                        action="LOGOUT",
                        resource_type="USER",
                        resource_id=str(user_id),
                        organization_id=org_id,
                    )
            except sqlalchemy.exc.SQLAlchemyError:
                logger.exception("Database error during logout")
                db.rollback()
    @staticmethod
    def get_active_sessions(db: Session, user_id: int):
        """
        Returns a list of active (non-revoked and not expired) refresh tokens for a user.
        """
        return (
            db.query(models.RefreshToken)
            .filter(
                models.RefreshToken.user_id == user_id,
                models.RefreshToken.is_revoked == False,
                models.RefreshToken.expires_at > datetime.now(timezone.utc),
            )
            .order_by(models.RefreshToken.created_at.desc())
            .all()
        )

    @staticmethod
    def revoke_other_sessions(db: Session, user_id: int, current_refresh_token: str):
        """
        Revokes all refresh tokens for a user except the provided one.
        """
        try:
            db.query(models.RefreshToken).filter(
                models.RefreshToken.user_id == user_id,
                models.RefreshToken.token != current_refresh_token,
                models.RefreshToken.is_revoked == False
            ).update({"is_revoked": True}, synchronize_session=False)
            db.commit()
            logger.info(f"Other sessions revoked for user {user_id}")
        except sqlalchemy.exc.SQLAlchemyError:
            db.rollback()
            logger.exception(f"Failed to revoke other sessions for user {user_id}")
            raise AuthenticationException("Could not revoke other sessions")
