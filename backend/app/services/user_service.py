import sqlalchemy.exc
from sqlalchemy.orm import Session

from ..schemas import defaults as schemas
from ..core import sanitization
from ..core.exceptions import UserNotFoundException, ValidationException
from ..core.logging import get_logger
from ..models import models

logger = get_logger("UserService")


class UserService:
    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> models.User:
        """
        Retrieves a user by their unique ID.
        Raises UserNotFoundException if not found.
        """
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            logger.warning(f"User not found: {user_id}")
            raise UserNotFoundException(f"ID {user_id}")
        return user

    @staticmethod
    def list_users(db: Session, skip: int = 0, limit: int = 100) -> list[models.User]:
        """Returns a paginated list of all users in the system."""
        return db.query(models.User).offset(skip).limit(limit).all()

    @staticmethod
    def create_user(db: Session, user_data: schemas.UserCreate) -> models.User:
        """
        Creates a new user with sanitized inputs.
        Checks for existing username or email before creation.
        """
        sanitized_username = sanitization.sanitize_username(user_data.username)
        sanitized_email = sanitization.sanitize_email(user_data.email)

        existing_user = (
            db.query(models.User)
            .filter(
                (models.User.username == sanitized_username)
                | (models.User.email == sanitized_email)
            )
            .first()
        )

        if existing_user:
            logger.warning(
                f"Registration failed: Conflict for {sanitized_username}/{sanitized_email}"
            )
            raise ValidationException("Username or email already exists")

        try:
            new_user = models.User(
                username=sanitized_username,
                email=sanitized_email,
                full_name=sanitization.sanitize_string(user_data.full_name, max_length=100),
                hashed_password=models.User.get_password_hash(user_data.password),
                is_active=user_data.is_active,
                is_admin=user_data.is_admin,
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            logger.info(f"User created: {sanitized_username}")
            return new_user
        except sqlalchemy.exc.SQLAlchemyError as e:
            logger.exception("Database error during user creation")
            db.rollback()
            raise ValidationException("Could not create user due to a database error") from e

    @staticmethod
    def update_user(db: Session, user_id: int, update_data: schemas.UserUpdate) -> models.User:
        """
        Updates an existing user's profile or status.
        Only fields provided in update_data are modified.
        """
        db_user = UserService.get_user_by_id(db, user_id)

        try:
            if update_data.email is not None:
                db_user.email = sanitization.sanitize_email(update_data.email)
            if update_data.full_name is not None:
                db_user.full_name = sanitization.sanitize_string(
                    update_data.full_name, max_length=100
                )
            if update_data.is_active is not None:
                db_user.is_active = update_data.is_active
            if update_data.is_admin is not None:
                db_user.is_admin = update_data.is_admin
            if update_data.password is not None:
                db_user.hashed_password = models.User.get_password_hash(update_data.password)

            db.commit()
            db.refresh(db_user)
            logger.info(f"User updated: {db_user.username}")
            return db_user
        except sqlalchemy.exc.SQLAlchemyError as e:
            logger.exception(f"Database error updating user {user_id}")
            db.rollback()
            raise ValidationException("Could not update user") from e

    @staticmethod
    def delete_user(db: Session, user_id: int, current_admin_id: int):
        """
        Deletes a user. Prevent users from deleting their own admin account.
        """
        if user_id == current_admin_id:
            logger.warning(f"Admin {current_admin_id} attempted self-deletion")
            raise ValidationException("Cannot delete yourself")

        db_user = UserService.get_user_by_id(db, user_id)
        try:
            username = db_user.username
            db.delete(db_user)
            db.commit()
            logger.info(f"User deleted: {username}")
        except sqlalchemy.exc.SQLAlchemyError as e:
            logger.exception(f"Database error deleting user {user_id}")
            db.rollback()
            raise ValidationException("Could not delete user") from e
