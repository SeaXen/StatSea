import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.database import get_db
from app.schemas import defaults as schemas
from app.core.auth_jwt import get_current_admin_user
from app.services.user_service import UserService
from app.services.audit_service import AuditService
from app.models import models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get(
    "/users",
    response_model=schemas.CursorPage[schemas.User],
    summary="List users",
    description="Retrieve a list of all users.",
)
def list_users(
    cursor: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    return UserService.list_users(db, cursor, limit)


@router.post(
    "/users",
    response_model=schemas.User,
    summary="Create user",
    description="Create a new user.",
)
def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    return UserService.create_user(db, user, actor_id=admin_user.id)


@router.put(
    "/users/{user_id}",
    response_model=schemas.User,
    summary="Update user",
    description="Update an existing user.",
)
def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    return UserService.update_user(db, user_id, user_update, actor_id=admin_user.id)


@router.delete(
    "/users/{user_id}",
    summary="Delete user",
    description="Delete a user.",
)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    UserService.delete_user(db, user_id, admin_user.id)
    return {"status": "success"}

@router.get(
    "/audit-log",
    response_model=schemas.OffsetPage[schemas.AuditLogResponse],
    summary="Get audit logs",
    description="Retrieve a paginated list of audit logs.",
)
def get_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=1000),
    action: str | None = None,
    user: int | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    skip = (page - 1) * per_page
    logs = AuditService.get_logs(
        db=db,
        skip=skip,
        limit=per_page,
        action=action,
        actor_id=user,
        start_date=start,
        end_date=end
    )
    total = AuditService.get_logs_count(
        db=db,
        action=action,
        actor_id=user,
        start_date=start,
        end_date=end
    )
    pages = (total + per_page - 1) // per_page
    
    return schemas.OffsetPage(
        items=logs,
        total=total,
        page=page,
        size=per_page,
        pages=pages
    )
