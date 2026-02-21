import logging
from fastapi import APIRouter, Depends
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
    description="Retrieve DNS query logs.",
)
def get_dns_logs(
    cursor: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return LogService.get_dns_logs(db, cursor, limit)


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
    "/history/device/{mac}",
    summary="Get timeseries device bandwidth history",
    description="Retrieve 5-min, hourly, daily, and monthly bandwidth history for a specific device.",
    dependencies=[Depends(get_cache_header(max_age=60))],
)
async def get_device_history(mac: str, current_user: models.User = Depends(get_current_user)):
    return global_collector.get_device_history(mac)
