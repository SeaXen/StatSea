import logging
from datetime import date, timedelta

from sqlalchemy import Integer, func

from ..db.database import SessionLocal
from ..models.models import (
    Device,
    DeviceDailySummary,
    DeviceMonthlySummary,
    DeviceYearlySummary,
    SystemDailySummary,
    SystemMonthlySummary,
    SystemNetworkHistory,
    SystemYearlySummary,
)

logger = logging.getLogger("Aggregator")


def aggregate_system_daily(db_session=None):
    """
    Rolls up SystemNetworkHistory into SystemDailySummary.
    """
    db = db_session or SessionLocal()
    try:
        # Aggregate for today and yesterday to ensure completeness
        for day_offset in [0, 1]:
            target_date = date.today() - timedelta(days=day_offset)

            # Sum up all interfaces for that date
            stats = (
                db.query(
                    func.sum(SystemNetworkHistory.bytes_sent).label("bytes_sent"),
                    func.sum(SystemNetworkHistory.bytes_recv).label("bytes_recv"),
                    func.sum(SystemNetworkHistory.packets_sent).label("packets_sent"),
                    func.sum(SystemNetworkHistory.packets_recv).label("packets_recv"),
                )
                .filter(func.date(SystemNetworkHistory.timestamp) == target_date)
                .first()
            )

            if stats and (stats.bytes_sent or stats.bytes_recv):
                summary = (
                    db.query(SystemDailySummary)
                    .filter(SystemDailySummary.date == target_date)
                    .first()
                )

                if not summary:
                    summary = SystemDailySummary(date=target_date)
                    db.add(summary)

                summary.bytes_sent = stats.bytes_sent or 0
                summary.bytes_recv = stats.bytes_recv or 0
                summary.packets_sent = stats.packets_sent or 0
                summary.packets_recv = stats.packets_recv or 0

        db.commit()
    except Exception as e:
        logger.error(f"System daily aggregation failed: {e}")
        db.rollback()
    finally:
        if not db_session:
            db.close()


def aggregate_system_monthly(db_session=None):
    """Rolls up SystemDailySummary into SystemMonthlySummary."""
    db = db_session or SessionLocal()
    try:
        month_str = date.today().strftime("%Y-%m")
        stats = (
            db.query(
                func.sum(SystemDailySummary.bytes_sent).label("bytes_sent"),
                func.sum(SystemDailySummary.bytes_recv).label("bytes_recv"),
            )
            .filter(func.strftime("%Y-%m", SystemDailySummary.date) == month_str)
            .first()
        )

        if stats and (stats.bytes_sent or stats.bytes_recv):
            summary = (
                db.query(SystemMonthlySummary)
                .filter(SystemMonthlySummary.month == month_str)
                .first()
            )
            if not summary:
                summary = SystemMonthlySummary(month=month_str)
                db.add(summary)
            summary.bytes_sent = stats.bytes_sent or 0
            summary.bytes_recv = stats.bytes_recv or 0
        db.commit()
    except Exception as e:
        logger.error(f"System monthly aggregation failed: {e}")
        db.rollback()
    finally:
        if not db_session:
            db.close()


def aggregate_device_monthly(db_session=None):
    """Rolls up DeviceDailySummary into DeviceMonthlySummary."""
    db = db_session or SessionLocal()
    try:
        month_str = date.today().strftime("%Y-%m")
        devices = db.query(Device).all()
        for dev in devices:
            stats = (
                db.query(
                    func.sum(DeviceDailySummary.upload_bytes).label("upload"),
                    func.sum(DeviceDailySummary.download_bytes).label("download"),
                )
                .filter(
                    DeviceDailySummary.device_id == dev.id,
                    func.strftime("%Y-%m", DeviceDailySummary.date) == month_str,
                )
                .first()
            )

            if stats and (stats.upload or stats.download):
                summary = (
                    db.query(DeviceMonthlySummary)
                    .filter(
                        DeviceMonthlySummary.device_id == dev.id,
                        DeviceMonthlySummary.month == month_str,
                    )
                    .first()
                )
                if not summary:
                    summary = DeviceMonthlySummary(device_id=dev.id, month=month_str)
                    db.add(summary)
                summary.upload_bytes = stats.upload or 0
                summary.download_bytes = stats.download or 0
        db.commit()
    except Exception as e:
        logger.error(f"Device monthly aggregation failed: {e}")
        db.rollback()
    finally:
        if not db_session:
            db.close()


def aggregate_system_yearly(db_session=None):
    """Rolls up SystemMonthlySummary into SystemYearlySummary."""
    db = db_session or SessionLocal()
    try:
        year = date.today().year
        stats = (
            db.query(
                func.sum(SystemMonthlySummary.bytes_sent).label("bytes_sent"),
                func.sum(SystemMonthlySummary.bytes_recv).label("bytes_recv"),
            )
            .filter(func.cast(func.substr(SystemMonthlySummary.month, 1, 4), Integer) == year)
            .first()
        )

        if stats and (stats.bytes_sent or stats.bytes_recv):
            summary = db.query(SystemYearlySummary).filter(SystemYearlySummary.year == year).first()
            if not summary:
                summary = SystemYearlySummary(year=year)
                db.add(summary)
            summary.bytes_sent = stats.bytes_sent or 0
            summary.bytes_recv = stats.bytes_recv or 0
        db.commit()
    except Exception as e:
        logger.error(f"System yearly aggregation failed: {e}")
        db.rollback()
    finally:
        if not db_session:
            db.close()


def aggregate_device_yearly(db_session=None):
    """Rolls up DeviceMonthlySummary into DeviceYearlySummary."""
    db = db_session or SessionLocal()
    try:
        year = date.today().year
        devices = db.query(Device).all()
        for dev in devices:
            stats = (
                db.query(
                    func.sum(DeviceMonthlySummary.upload_bytes).label("upload"),
                    func.sum(DeviceMonthlySummary.download_bytes).label("download"),
                )
                .filter(
                    DeviceMonthlySummary.device_id == dev.id,
                    func.cast(func.substr(DeviceMonthlySummary.month, 1, 4), Integer) == year,
                )
                .first()
            )

            if stats and (stats.upload or stats.download):
                summary = (
                    db.query(DeviceYearlySummary)
                    .filter(
                        DeviceYearlySummary.device_id == dev.id, DeviceYearlySummary.year == year
                    )
                    .first()
                )
                if not summary:
                    summary = DeviceYearlySummary(device_id=dev.id, year=year)
                    db.add(summary)
                summary.upload_bytes = stats.upload or 0
                summary.download_bytes = stats.download or 0
        db.commit()
    except Exception as e:
        logger.error(f"Device yearly aggregation failed: {e}")
        db.rollback()
    finally:
        if not db_session:
            db.close()


def run_aggregation_job():
    """Main entry point for the scheduler."""
    logger.info("Running aggregation jobs...")
    aggregate_system_daily()
    aggregate_system_monthly()
    aggregate_device_monthly()
    aggregate_system_yearly()
    aggregate_device_yearly()
