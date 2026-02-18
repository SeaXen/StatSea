from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db.database import SessionLocal
from ..models import models


def check_quotas(db: Session = None):
    """
    Checks all configured bandwidth quotas against current usage.
    Triggers alerts if limits are exceeded.
    """
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        quotas = db.query(models.BandwidthQuota).all()
        today = datetime.now().date()
        current_month_start = today.replace(day=1)

        for quota in quotas:
            device = quota.device
            if not device:
                continue

            # 1. Check Daily Limit
            if quota.daily_limit_bytes and quota.daily_limit_bytes > 0:
                daily_usage = (
                    db.query(
                        func.sum(
                            models.DeviceDailySummary.upload_bytes
                            + models.DeviceDailySummary.download_bytes
                        )
                    )
                    .filter(
                        models.DeviceDailySummary.device_id == device.id,
                        models.DeviceDailySummary.date == today,
                    )
                    .scalar()
                    or 0
                )

                if daily_usage > quota.daily_limit_bytes:
                    _trigger_alert(db, device, "Daily", daily_usage, quota.daily_limit_bytes)

            # 2. Check Monthly Limit
            if quota.monthly_limit_bytes and quota.monthly_limit_bytes > 0:
                monthly_usage = (
                    db.query(
                        func.sum(
                            models.DeviceDailySummary.upload_bytes
                            + models.DeviceDailySummary.download_bytes
                        )
                    )
                    .filter(
                        models.DeviceDailySummary.device_id == device.id,
                        models.DeviceDailySummary.date >= current_month_start,
                    )
                    .scalar()
                    or 0
                )

                if monthly_usage > quota.monthly_limit_bytes:
                    _trigger_alert(db, device, "Monthly", monthly_usage, quota.monthly_limit_bytes)

    except Exception as e:
        print(f"Error checking quotas: {e}")
    finally:
        if close_db:
            db.close()


def _trigger_alert(db: Session, device: models.Device, period: str, usage: int, limit: int):
    """
    Creates a security alert if one doesn't already exist for today/this month.
    """
    # Prevent spamming: Check if an alert for this device and period already exists within the last 24h
    # For simplicity, we check if there is an unresolved alert with the same title pattern created recently.

    alert_title = f"{period} Bandwidth Quota Exceeded"

    # Check for recent existing alert
    from datetime import timedelta

    recent = datetime.now() - timedelta(hours=24)

    existing = (
        db.query(models.SecurityAlert)
        .filter(
            models.SecurityAlert.device_id == device.id,
            models.SecurityAlert.title == alert_title,
            models.SecurityAlert.timestamp >= recent,
            models.SecurityAlert.is_resolved == False,
        )
        .first()
    )

    if existing:
        return

    # Create new alert
    usage_mb = round(usage / (1024 * 1024), 2)
    limit_mb = round(limit / (1024 * 1024), 2)

    alert = models.SecurityAlert(
        severity="warning",
        title=alert_title,
        description=f"Device '{device.hostname or device.mac_address}' has used {usage_mb} MB, exceeding the {period.lower()} limit of {limit_mb} MB.",
        device_id=device.id,
        is_resolved=False,
    )
    db.add(alert)
    db.commit()
    print(f"Quota Alert Triggered: {device.hostname} - {period} Limit Exceeded")
