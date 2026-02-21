import logging
from datetime import datetime, timedelta, date
from typing import List, Dict, Any
from calendar import monthrange

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.db.database import get_db
from app.models import models
from app.core.auth_jwt import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bandwidth", tags=["Bandwidth"])


def _format_rate(total_bytes: int, seconds: int) -> str:
    """Format average rate as human-readable bit/s string."""
    if seconds <= 0:
        return "0 bit/s"
    bits_per_sec = (total_bytes * 8) / seconds
    if bits_per_sec >= 1_000_000_000:
        return f"{bits_per_sec / 1_000_000_000:.2f} Gbit/s"
    elif bits_per_sec >= 1_000_000:
        return f"{bits_per_sec / 1_000_000:.2f} Mbit/s"
    elif bits_per_sec >= 1_000:
        return f"{bits_per_sec / 1_000:.2f} kbit/s"
    return f"{bits_per_sec:.0f} bit/s"


def _calc_rate_bps(total_bytes: int, seconds: int) -> float:
    """Return average rate in bits per second."""
    if seconds <= 0:
        return 0.0
    return (total_bytes * 8) / seconds


@router.get(
    "/interfaces",
    summary="List all known interfaces",
    response_model=List[str],
)
def get_interfaces(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    interfaces = db.query(models.SystemNetworkHistory.interface).distinct().all()
    return [i[0] for i in interfaces if i[0]]


@router.get(
    "/summary",
    summary="Get interface summaries (vnStat-style)",
    response_model=Dict[str, Any],
)
def get_bandwidth_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns today, yesterday, current month, and all-time totals per interface.
    Includes avg_rate, estimated monthly totals, and a 'since' date.
    """
    today = date.today()
    yesterday = today - timedelta(days=1)
    current_month = today.strftime("%Y-%m")
    days_in_month = monthrange(today.year, today.month)[1]
    day_of_month = today.day

    interfaces = [
        i[0]
        for i in db.query(models.SystemNetworkHistory.interface).distinct().all()
        if i[0]
    ]

    summary: Dict[str, Any] = {}
    for interface in interfaces:
        iface_data: Dict[str, Any] = {
            "today": {"rx": 0, "tx": 0, "total": 0, "avg_rate": "0 bit/s", "avg_rate_bps": 0},
            "yesterday": {"rx": 0, "tx": 0, "total": 0, "avg_rate": "0 bit/s", "avg_rate_bps": 0},
            "month": {"rx": 0, "tx": 0, "total": 0, "avg_rate": "0 bit/s", "avg_rate_bps": 0},
            "all_time": {"rx": 0, "tx": 0, "total": 0, "avg_rate": "0 bit/s", "avg_rate_bps": 0, "since": None},
            "estimated": {"rx": 0, "tx": 0, "total": 0},
        }

        # ── Today ──
        today_stats = (
            db.query(
                func.sum(models.SystemNetworkHistory.bytes_recv).label("rx"),
                func.sum(models.SystemNetworkHistory.bytes_sent).label("tx"),
            )
            .filter(
                models.SystemNetworkHistory.interface == interface,
                func.date(models.SystemNetworkHistory.timestamp) == today,
            )
            .first()
        )
        if today_stats and today_stats.rx is not None:
            rx, tx = int(today_stats.rx), int(today_stats.tx)
            total = rx + tx
            # seconds elapsed today
            now = datetime.now()
            elapsed = (now - now.replace(hour=0, minute=0, second=0, microsecond=0)).total_seconds()
            iface_data["today"] = {
                "rx": rx, "tx": tx, "total": total,
                "avg_rate": _format_rate(total, int(elapsed)),
                "avg_rate_bps": _calc_rate_bps(total, int(elapsed)),
            }

        # ── Yesterday ──
        yesterday_stats = (
            db.query(
                func.sum(models.SystemNetworkHistory.bytes_recv).label("rx"),
                func.sum(models.SystemNetworkHistory.bytes_sent).label("tx"),
            )
            .filter(
                models.SystemNetworkHistory.interface == interface,
                func.date(models.SystemNetworkHistory.timestamp) == yesterday,
            )
            .first()
        )
        if yesterday_stats and yesterday_stats.rx is not None:
            rx, tx = int(yesterday_stats.rx), int(yesterday_stats.tx)
            total = rx + tx
            iface_data["yesterday"] = {
                "rx": rx, "tx": tx, "total": total,
                "avg_rate": _format_rate(total, 86400),
                "avg_rate_bps": _calc_rate_bps(total, 86400),
            }

        # ── Month ──
        month_stats = (
            db.query(
                models.SystemInterfaceMonthlySummary.bytes_recv,
                models.SystemInterfaceMonthlySummary.bytes_sent,
            )
            .filter(
                models.SystemInterfaceMonthlySummary.interface == interface,
                models.SystemInterfaceMonthlySummary.month == current_month,
            )
            .first()
        )
        if month_stats:
            rx, tx = int(month_stats.bytes_recv), int(month_stats.bytes_sent)
            total = rx + tx
            elapsed_month = day_of_month * 86400
            iface_data["month"] = {
                "rx": rx, "tx": tx, "total": total,
                "avg_rate": _format_rate(total, elapsed_month),
                "avg_rate_bps": _calc_rate_bps(total, elapsed_month),
            }
            # Estimated month-end
            if day_of_month > 0:
                factor = days_in_month / day_of_month
                iface_data["estimated"] = {
                    "rx": int(rx * factor),
                    "tx": int(tx * factor),
                    "total": int(total * factor),
                }

        # ── All Time ──
        all_time = (
            db.query(
                func.sum(models.SystemInterfaceDailySummary.bytes_recv).label("rx"),
                func.sum(models.SystemInterfaceDailySummary.bytes_sent).label("tx"),
                func.min(models.SystemInterfaceDailySummary.date).label("since"),
            )
            .filter(models.SystemInterfaceDailySummary.interface == interface)
            .first()
        )
        if all_time and all_time.rx is not None:
            rx, tx = int(all_time.rx), int(all_time.tx)
            total = rx + tx
            since_date = all_time.since
            if since_date:
                elapsed_all = (today - since_date).days * 86400
                iface_data["all_time"] = {
                    "rx": rx, "tx": tx, "total": total,
                    "avg_rate": _format_rate(total, elapsed_all),
                    "avg_rate_bps": _calc_rate_bps(total, elapsed_all),
                    "since": since_date.isoformat(),
                }

        summary[interface] = iface_data

    return summary


@router.get(
    "/fiveminute",
    summary="Get 5-minute traffic buckets",
    response_model=List[Dict[str, Any]],
)
def get_fiveminute(
    interface: str,
    hours: int = Query(24, ge=1, le=72),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Aggregate raw 1-minute snapshots into 5-minute buckets."""
    since = datetime.now() - timedelta(hours=hours)

    stats = (
        db.query(
            models.SystemNetworkHistory.timestamp,
            models.SystemNetworkHistory.bytes_recv,
            models.SystemNetworkHistory.bytes_sent,
        )
        .filter(
            models.SystemNetworkHistory.interface == interface,
            models.SystemNetworkHistory.timestamp >= since,
        )
        .order_by(models.SystemNetworkHistory.timestamp.asc())
        .all()
    )

    # Bucket into 5-minute intervals
    buckets: Dict[str, Dict[str, int]] = {}
    for s in stats:
        ts = s.timestamp
        # Round down to nearest 5-minute mark
        bucket_min = (ts.minute // 5) * 5
        bucket_ts = ts.replace(minute=bucket_min, second=0, microsecond=0)
        key = bucket_ts.isoformat()
        if key not in buckets:
            buckets[key] = {"rx": 0, "tx": 0}
        buckets[key]["rx"] += int(s.bytes_recv)
        buckets[key]["tx"] += int(s.bytes_sent)

    result = []
    for ts_key in sorted(buckets.keys()):
        b = buckets[ts_key]
        result.append({
            "timestamp": ts_key,
            "rx": b["rx"],
            "tx": b["tx"],
            "total": b["rx"] + b["tx"],
        })
    return result


@router.get(
    "/hourly",
    summary="Get hourly breakdown",
    response_model=List[Dict[str, Any]],
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
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")

    stats = (
        db.query(
            func.strftime("%H", models.SystemNetworkHistory.timestamp).label("hour"),
            func.sum(models.SystemNetworkHistory.bytes_recv).label("rx"),
            func.sum(models.SystemNetworkHistory.bytes_sent).label("tx"),
        )
        .filter(
            models.SystemNetworkHistory.interface == interface,
            func.date(models.SystemNetworkHistory.timestamp) == target_date,
        )
        .group_by(func.strftime("%H", models.SystemNetworkHistory.timestamp))
        .order_by("hour")
        .all()
    )

    results = {f"{i:02d}": {"rx": 0, "tx": 0, "total": 0} for i in range(24)}
    for stat in stats:
        if stat.hour in results:
            rx, tx = int(stat.rx), int(stat.tx)
            results[stat.hour] = {"rx": rx, "tx": tx, "total": rx + tx}

    return [{"hour": k, **v} for k, v in sorted(results.items())]


@router.get(
    "/daily",
    summary="Get daily breakdown with avg rate",
    response_model=List[Dict[str, Any]],
)
def get_daily(
    interface: str,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    start_date = date.today() - timedelta(days=days - 1)

    stats = (
        db.query(
            models.SystemInterfaceDailySummary.date,
            models.SystemInterfaceDailySummary.bytes_recv,
            models.SystemInterfaceDailySummary.bytes_sent,
        )
        .filter(
            models.SystemInterfaceDailySummary.interface == interface,
            models.SystemInterfaceDailySummary.date >= start_date,
        )
        .order_by(models.SystemInterfaceDailySummary.date.desc())
        .all()
    )

    result = []
    for stat in stats:
        rx, tx = int(stat.bytes_recv), int(stat.bytes_sent)
        total = rx + tx
        result.append({
            "date": stat.date.isoformat(),
            "rx": rx,
            "tx": tx,
            "total": total,
            "avg_rate": _format_rate(total, 86400),
            "avg_rate_bps": _calc_rate_bps(total, 86400),
        })
    return result


@router.get(
    "/monthly",
    summary="Get monthly aggregates with avg rate and estimated",
    response_model=List[Dict[str, Any]],
)
def get_monthly(
    interface: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    stats = (
        db.query(
            models.SystemInterfaceMonthlySummary.month,
            models.SystemInterfaceMonthlySummary.bytes_recv,
            models.SystemInterfaceMonthlySummary.bytes_sent,
        )
        .filter(models.SystemInterfaceMonthlySummary.interface == interface)
        .order_by(desc(models.SystemInterfaceMonthlySummary.month))
        .limit(12)
        .all()
    )

    today = date.today()
    current_month_str = today.strftime("%Y-%m")
    days_in_month = monthrange(today.year, today.month)[1]
    day_of_month = today.day

    result = []
    for stat in stats:
        rx, tx = int(stat.bytes_recv), int(stat.bytes_sent)
        total = rx + tx

        # Parse month to get days
        parts = stat.month.split("-")
        year, month = int(parts[0]), int(parts[1])
        total_days_in_month = monthrange(year, month)[1]
        elapsed_seconds = total_days_in_month * 86400

        entry: Dict[str, Any] = {
            "month": stat.month,
            "rx": rx,
            "tx": tx,
            "total": total,
            "avg_rate": _format_rate(total, elapsed_seconds),
            "avg_rate_bps": _calc_rate_bps(total, elapsed_seconds),
        }

        # Add estimated for current month
        if stat.month == current_month_str and day_of_month > 0:
            factor = days_in_month / day_of_month
            entry["estimated_rx"] = int(rx * factor)
            entry["estimated_tx"] = int(tx * factor)
            entry["estimated_total"] = int(total * factor)

        result.append(entry)
    return result


@router.get(
    "/yearly",
    summary="Get yearly aggregates",
    response_model=List[Dict[str, Any]],
)
def get_yearly(
    interface: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Aggregate monthly summaries into yearly totals."""
    stats = (
        db.query(
            models.SystemInterfaceMonthlySummary.month,
            models.SystemInterfaceMonthlySummary.bytes_recv,
            models.SystemInterfaceMonthlySummary.bytes_sent,
        )
        .filter(models.SystemInterfaceMonthlySummary.interface == interface)
        .all()
    )

    yearly: Dict[str, Dict[str, int]] = {}
    for stat in stats:
        year = stat.month.split("-")[0]
        if year not in yearly:
            yearly[year] = {"rx": 0, "tx": 0}
        yearly[year]["rx"] += int(stat.bytes_recv)
        yearly[year]["tx"] += int(stat.bytes_sent)

    today = date.today()
    current_year = str(today.year)
    day_of_year = today.timetuple().tm_yday
    is_leap = (today.year % 4 == 0 and today.year % 100 != 0) or (today.year % 400 == 0)
    days_in_year = 366 if is_leap else 365

    result = []
    for year in sorted(yearly.keys(), reverse=True):
        rx, tx = yearly[year]["rx"], yearly[year]["tx"]
        total = rx + tx
        year_days = days_in_year if year == current_year else 365
        elapsed = year_days * 86400

        entry: Dict[str, Any] = {
            "year": year,
            "rx": rx,
            "tx": tx,
            "total": total,
            "avg_rate": _format_rate(total, elapsed),
            "avg_rate_bps": _calc_rate_bps(total, elapsed),
        }

        # Estimated for current year
        if year == current_year and day_of_year > 0:
            factor = days_in_year / day_of_year
            entry["estimated_rx"] = int(rx * factor)
            entry["estimated_tx"] = int(tx * factor)
            entry["estimated_total"] = int(total * factor)

        result.append(entry)
    return result


@router.get(
    "/top",
    summary="Get top traffic days with full details",
    response_model=List[Dict[str, Any]],
)
def get_top_days(
    interface: str,
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    stats = (
        db.query(
            models.SystemInterfaceDailySummary.date,
            models.SystemInterfaceDailySummary.bytes_recv,
            models.SystemInterfaceDailySummary.bytes_sent,
            (
                models.SystemInterfaceDailySummary.bytes_recv
                + models.SystemInterfaceDailySummary.bytes_sent
            ).label("total"),
        )
        .filter(models.SystemInterfaceDailySummary.interface == interface)
        .order_by(desc("total"))
        .limit(limit)
        .all()
    )

    result = []
    for stat in stats:
        rx, tx = int(stat.bytes_recv), int(stat.bytes_sent)
        total = int(stat.total)
        result.append({
            "date": stat.date.isoformat(),
            "rx": rx,
            "tx": tx,
            "total": total,
            "avg_rate": _format_rate(total, 86400),
            "avg_rate_bps": _calc_rate_bps(total, 86400),
        })
    return result
