from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models import models
from app.core.auth_jwt import get_current_user

# Alias for compatibility with routes expecting get_current_active_user
get_current_active_user = get_current_user

def get_current_org_id(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> int:
    """
    Dependency to get the current user's active organization ID.
    For now, it returns the first organization found.
    """
    member = (
        db.query(models.OrganizationMember)
        .filter(models.OrganizationMember.user_id == current_user.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=403, detail="User is not a member of any organization")
    return member.organization_id

from fastapi import Response

def get_cache_header(max_age: int = 60):
    """
    Dependency to set Cache-Control headers on the response.
    """
    def _set_cache_header(response: Response):
        response.headers["Cache-Control"] = f"public, max-age={max_age}"
    return _set_cache_header

def check_admin(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    """
    Dependency to ensure the current user is an admin.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403, 
            detail="Forbidden: Admin privileges required"
        )
    return current_user
