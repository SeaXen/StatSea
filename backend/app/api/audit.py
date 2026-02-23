from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models import models
from app.api.deps import get_current_org_id
from app.core.auth_jwt import get_current_user
from app.services.audit_service import AuditService

router = APIRouter()

@router.get("/", response_model=List[dict])
def get_audit_logs(
    skip: int = 0,
    limit: int = 100,
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get audit logs for the organization.
    """
    logs = AuditService.get_logs(db, organization_id, skip, limit)
    # Serialize manually or use Pydantic models. For now, manual dict return to be quick.
    return [
        {
            "id": log.id,
            "actor": log.actor.username if log.actor else "System",
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": log.details,
            "timestamp": log.timestamp
        }
        for log in logs
    ]
