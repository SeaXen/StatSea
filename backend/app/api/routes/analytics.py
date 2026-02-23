import logging
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import models
from app.schemas import defaults as schemas
from app.core.auth_jwt import get_current_user
from app.core.collector import global_collector
from app.core.ai_predictor import ai_predictor
from app.services.log_service import LogService
from app.api.deps import get_cache_header

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get(
    "/summary",
    summary="Get analytics summary",
    description="Retrieve a summary of network analytics.",
    dependencies=[Depends(get_cache_header(max_age=30))],
)
async def get_analytics_summary(current_user: models.User = Depends(get_current_user)):
    return global_collector.get_analytics_summary()


@router.get(
    "/heatmap",
    summary="Get 7x24 network traffic heatmap",
    description="Retrieve a 7x24 matrix representing traffic volume over the week.",
    dependencies=[Depends(get_cache_header(max_age=60))],
)
async def get_analytics_heatmap(current_user: models.User = Depends(get_current_user)):
    return global_collector.get_analytics_heatmap()


@router.get(
    "/packets",
    summary="Get packet log",
    description="Retrieve packet logs with optional filtering.",
)
def get_packet_log(
    limit: int = 100,
    protocol: str | None = None,
    ip: str | None = None,
    port: int | None = None,
    flags: str | None = None,
    current_user: models.User = Depends(get_current_user),
):
    return global_collector.get_packet_log(
        limit=limit, protocol=protocol, ip=ip, port=port, flags=flags
    )


@router.get(
    "/prediction",
    summary="Get usage prediction",
    description="Predict future network usage.",
)
def get_usage_prediction(current_user: models.User = Depends(get_current_user)):
    return ai_predictor.predict_total_usage()


@router.get(
    "/anomalies",
    summary="Get usage anomalies",
    description="Detect network usage anomalies.",
)
def get_usage_anomalies(current_user: models.User = Depends(get_current_user)):
    return ai_predictor.detect_anomalies()


@router.get(
    "/dns-logs",
    response_model=schemas.CursorPage[schemas.DnsLog],
    summary="Get DNS logs",
    description="Retrieve DNS query logs with optional search and device filtering.",
)
def get_dns_logs(
    device_id: int | None = None,
    query: str | None = None,
    cursor: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return LogService.get_dns_logs(db, device_id, query, cursor, limit)


@router.get(
    "/dns-logs/top",
    summary="Get top DNS domains",
    description="Retrieve most queried DNS domains.",
)
def get_dns_top_domains(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return LogService.get_top_dns_domains(db, limit)


@router.get(
    "/traffic-categories",
    summary="Get traffic categories",
    description="Retrieve aggregated traffic by application category.",
)
def get_traffic_categories(
    device_id: int | None = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return LogService.get_traffic_categories(db, device_id, limit)


@router.get(
    "/device-logs",
    response_model=schemas.CursorPage[schemas.DeviceStatusLog],
    summary="Get device logs",
    description="Retrieve logs for a specific device.",
)
def get_device_logs(
    device_id: int | None = None,
    cursor: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return LogService.get_device_logs(db, device_id, cursor, limit)


@router.get(
    "/history/system",
    summary="Get system-wide bandwidth history",
    description="Retrieve aggregated bandwidth history for the entire system.",
    dependencies=[Depends(get_cache_header(max_age=60))],
)
def get_system_history(
    period: str = Query("daily", regex="^(daily|monthly|yearly)$"),
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = []
    if period == "daily":
        start_date = date.today() - timedelta(days=days - 1)
        stats = (
            db.query(
                models.SystemInterfaceDailySummary.date,
                func.sum(models.SystemInterfaceDailySummary.bytes_recv).label("rx"),
                func.sum(models.SystemInterfaceDailySummary.bytes_sent).label("tx"),
            )
            .filter(models.SystemInterfaceDailySummary.date >= start_date)
            .group_by(models.SystemInterfaceDailySummary.date)
            .order_by(models.SystemInterfaceDailySummary.date.asc())
            .all()
        )
        for stat in stats:
            result.append({
                "date": stat.date.isoformat(),
                "recv": int(stat.rx or 0),
                "sent": int(stat.tx or 0),
            })
    elif period == "monthly":
        stats = (
            db.query(
                models.SystemInterfaceMonthlySummary.month,
                func.sum(models.SystemInterfaceMonthlySummary.bytes_recv).label("rx"),
                func.sum(models.SystemInterfaceMonthlySummary.bytes_sent).label("tx"),
            )
            .group_by(models.SystemInterfaceMonthlySummary.month)
            .order_by(models.SystemInterfaceMonthlySummary.month.asc())
            .limit(12)
            .all()
        )
        for stat in stats:
            result.append({
                "date": stat.month,
                "recv": int(stat.rx or 0),
                "sent": int(stat.tx or 0),
            })
    elif period == "yearly":
        stats = (
            db.query(
                func.substr(models.SystemInterfaceMonthlySummary.month, 1, 4).label("year"),
                func.sum(models.SystemInterfaceMonthlySummary.bytes_recv).label("rx"),
                func.sum(models.SystemInterfaceMonthlySummary.bytes_sent).label("tx"),
            )
            .group_by("year")
            .order_by("year")
            .all()
        )
        for stat in stats:
            result.append({
                "date": stat.year,
                "recv": int(stat.rx or 0),
                "sent": int(stat.tx or 0),
            })
    return result


@router.get(
    "/history/device/{mac}",
    summary="Get timeseries device bandwidth history",
    description="Retrieve 5-min, hourly, daily, and monthly bandwidth history for a specific device.",
    dependencies=[Depends(get_cache_header(max_age=60))],
)
async def get_device_history(mac: str, current_user: models.User = Depends(get_current_user)):
    return global_collector.get_device_history(mac)
