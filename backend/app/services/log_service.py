from sqlalchemy.orm import Session
from ..models import models
from ..core.logging import get_logger

logger = get_logger("LogService")

class LogService:
    @staticmethod
    def get_dns_logs(db: Session, skip: int = 0, limit: int = 100):
        return (
            db.query(models.DnsLog)
            .order_by(models.DnsLog.timestamp.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_device_logs(db: Session, device_id: int = None, skip: int = 0, limit: int = 100):
        query = db.query(models.DeviceStatusLog)
        if device_id:
            query = query.filter(models.DeviceStatusLog.device_id == device_id)
        return (
            query.order_by(models.DeviceStatusLog.timestamp.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
