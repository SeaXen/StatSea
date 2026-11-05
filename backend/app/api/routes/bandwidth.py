import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth_jwt import get_current_user
from app.db.database import get_db
from app.models import models
from app.services.bandwidth_service import BandwidthAggregationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bandwidth", tags=["Bandwidth"])


@router.get(
    "/interfaces",
    summary="List all known interfaces",
    response_model=list[str],
)
def get_interfaces(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return BandwidthAggregationService.get_interfaces(db)


@router.get(
    "/summary",
    summary="Get interface summaries (vnStat-style)",
    response_model=dict[str, Any],
)
def get_bandwidth_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns today, yesterday, current month, and all-time totals per interface.
    Includes avg_rate, estimated monthly totals, and a 'since' date.
    """
    return BandwidthAggregationService.get_summary(db)


@router.get(
    "/fiveminute",
    summary="Get 5-minute traffic buckets",
    response_model=list[dict[str, Any]],
)
def get_fiveminute(
    interface: str,
    hours: int = Query(24, ge=1, le=72),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Aggregate raw 1-minute snapshots into 5-minute buckets."""
    return BandwidthAggregationService.get_fiveminute(db, interface, hours=hours)


@router.get(
    "/hourly",
    summary="Get hourly breakdown",
    response_model=list[dict[str, Any]],
)
def get_hourly(
    interface: str,
    date_str: str = Query(..., alias="date", description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD") from None

    return BandwidthAggregationService.get_hourly(db, interface, target_date=target_date)


@router.get(
    "/daily",
    summary="Get daily breakdown with avg rate",
    response_model=list[dict[str, Any]],
)
def get_daily(
    interface: str,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return BandwidthAggregationService.get_daily(db, interface, days=days)


@router.get(
    "/monthly",
    summary="Get monthly aggregates with avg rate and estimated",
    response_model=list[dict[str, Any]],
)
def get_monthly(
    interface: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return BandwidthAggregationService.get_monthly(db, interface)


@router.get(
    "/yearly",
    summary="Get yearly aggregates",
    response_model=list[dict[str, Any]],
)
def get_yearly(
    interface: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Aggregate monthly summaries into yearly totals."""
    return BandwidthAggregationService.get_yearly(db, interface)


@router.get(
    "/top",
    summary="Get top traffic days with full details",
    response_model=list[dict[str, Any]],
)
def get_top_days(
    interface: str,
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return BandwidthAggregationService.get_top_days(db, interface, limit=limit)
