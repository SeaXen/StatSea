from sqlalchemy.orm import Session
from app.models import models
from datetime import datetime, timezone
import json

class AuditService:
    @staticmethod
    def log_action(
        db: Session,
        actor_id: int,
        action: str,
        resource_type: str,
        resource_id: str,
        details: dict | str = None,
        organization_id: int = None
    ):
        """
        Logs an audit event.
        """
        if isinstance(details, dict):
            details = json.dumps(details)
            
        audit_log = models.AuditLog(
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            details=details,
            organization_id=organization_id,
            timestamp=datetime.now(timezone.utc)
        )
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        return audit_log

    @staticmethod
    def get_logs(db: Session, organization_id: int, skip: int = 0, limit: int = 100):
        return db.query(models.AuditLog).filter(
            models.AuditLog.organization_id == organization_id
        ).order_by(models.AuditLog.timestamp.desc()).offset(skip).limit(limit).all()
