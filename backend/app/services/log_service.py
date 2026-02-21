from sqlalchemy.orm import Session
from ..models import models
from ..core.logging import get_logger

logger = get_logger("LogService")

from ..schemas import defaults as schemas

class LogService:
    @staticmethod
    def get_dns_logs(db: Session, cursor: int | None = None, limit: int = 100) -> schemas.CursorPage[schemas.DnsLog]:
        query = db.query(models.DnsLog)
        
        if cursor is not None:
             query = query.filter(models.DnsLog.id < cursor)
             
        logs = query.order_by(models.DnsLog.id.desc()).limit(limit).all()
        next_cursor = logs[-1].id if len(logs) == limit else None
        return schemas.CursorPage(items=logs, next_cursor=next_cursor)

    @staticmethod
    def get_device_logs(db: Session, device_id: int = None, cursor: int | None = None, limit: int = 100) -> schemas.CursorPage[schemas.DeviceStatusLog]:
        query = db.query(models.DeviceStatusLog)
        if device_id:
            query = query.filter(models.DeviceStatusLog.device_id == device_id)
            
        if cursor is not None:
            query = query.filter(models.DeviceStatusLog.id < cursor)
            
        logs = query.order_by(models.DeviceStatusLog.id.desc()).limit(limit).all()
        next_cursor = logs[-1].id if len(logs) == limit else None
        return schemas.CursorPage(items=logs, next_cursor=next_cursor)
