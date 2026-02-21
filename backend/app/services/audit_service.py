from sqlalchemy.orm import Session, joinedload
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
    def get_logs(
        db: Session, 
        organization_id: int | None = None, 
        skip: int = 0, 
        limit: int = 100,
        action: str | None = None,
        actor_id: int | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None
    ):
        query = db.query(models.AuditLog)
        
        if organization_id is not None:
            query = query.filter(models.AuditLog.organization_id == organization_id)
            
        if action:
            query = query.filter(models.AuditLog.action == action)
            
        if actor_id:
            query = query.filter(models.AuditLog.actor_id == actor_id)
            
        if start_date:
            query = query.filter(models.AuditLog.timestamp >= start_date)
            
        if end_date:
            query = query.filter(models.AuditLog.timestamp <= end_date)
            
        return query.options(joinedload(models.AuditLog.actor)).order_by(models.AuditLog.timestamp.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_logs_count(
        db: Session, 
        organization_id: int | None = None, 
        action: str | None = None,
        actor_id: int | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None
    ) -> int:
        query = db.query(models.AuditLog)
        
        if organization_id is not None:
            query = query.filter(models.AuditLog.organization_id == organization_id)
            
        if action:
            query = query.filter(models.AuditLog.action == action)
            
        if actor_id:
            query = query.filter(models.AuditLog.actor_id == actor_id)
            
        if start_date:
            query = query.filter(models.AuditLog.timestamp >= start_date)
            
        if end_date:
            query = query.filter(models.AuditLog.timestamp <= end_date)
            
        return query.count()
