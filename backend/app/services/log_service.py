from sqlalchemy.orm import Session
from ..models import models
from ..core.logging import get_logger

logger = get_logger("LogService")

from ..schemas import defaults as schemas

class LogService:
    @staticmethod
    def get_dns_logs(
        db: Session, 
        device_id: int | None = None,
        query: str | None = None,
        cursor: int | None = None, 
        limit: int = 100
    ) -> schemas.CursorPage[schemas.DnsLog]:
        db_query = db.query(models.DnsLog)

        if device_id is not None:
             db_query = db_query.filter(models.DnsLog.device_id == device_id)
        
        if query:
            db_query = db_query.filter(models.DnsLog.query_domain.ilike(f"%{query}%"))

        if cursor is not None:
             db_query = db_query.filter(models.DnsLog.id < cursor)

        logs = db_query.order_by(models.DnsLog.id.desc()).limit(limit).all()
        next_cursor = logs[-1].id if len(logs) == limit else None
        return schemas.CursorPage(items=logs, next_cursor=next_cursor)

    @staticmethod
    def get_top_dns_domains(db: Session, limit: int = 10) -> list[dict]:
        """Aggregate top DNS domains."""
        from sqlalchemy import func
        
        results = (
            db.query(
                models.DnsLog.query_domain,
                func.count(models.DnsLog.id).label("count")
            )
            .group_by(models.DnsLog.query_domain)
            .order_by(func.count(models.DnsLog.id).desc())
            .limit(limit)
            .all()
        )
        
        return [{"domain": r[0], "count": r[1]} for r in results]

    @staticmethod
    def get_traffic_categories(db: Session, device_id: int | None = None, limit: int = 20) -> list[dict]:
        """Aggregate total traffic by app category."""
        from sqlalchemy import func
        
        query = db.query(
            models.TrafficLog.app_category,
            func.sum(models.TrafficLog.download_bytes).label("total_download"),
            func.sum(models.TrafficLog.upload_bytes).label("total_upload")
        )
        
        if device_id:
            query = query.filter(models.TrafficLog.device_id == device_id)
            
        results = (
            query
            .group_by(models.TrafficLog.app_category)
            .order_by((func.sum(models.TrafficLog.download_bytes) + func.sum(models.TrafficLog.upload_bytes)).desc())
            .limit(limit)
            .all()
        )
        
        return [
            {
                "category": r[0],
                "download_bytes": int(r[1] or 0),
                "upload_bytes": int(r[2] or 0),
            }
            for r in results
        ]

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
