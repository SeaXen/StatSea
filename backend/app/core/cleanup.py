import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from ..db.database import SessionLocal
from ..models import models

logger = logging.getLogger(__name__)


def run_cleanup_job():
    """
    Deletes old records based on granular retention policies.
    """
    db: Session = SessionLocal()
    try:
        def get_retention_days(key: str, default: int) -> int:
            setting = db.query(models.SystemSettings).filter(models.SystemSettings.key == key).first()
            if setting and setting.value:
                try:
                    return int(setting.value)
                except ValueError:
                    pass
            return default

        # Fetch retention settings
        retention_raw = get_retention_days("retention_days_raw", 7)
        retention_daily = get_retention_days("retention_days_daily", 90)
        retention_events = get_retention_days("retention_days_events", 30)

        # Cutoffs
        cutoff_raw = datetime.now(timezone.utc) - timedelta(days=retention_raw)
        cutoff_daily = datetime.now(timezone.utc) - timedelta(days=retention_daily)
        cutoff_events = datetime.now(timezone.utc) - timedelta(days=retention_events)

        logger.info(
            f"Running cleanup: raw (> {cutoff_raw}), daily (> {cutoff_daily}), events (> {cutoff_events})"
        )

        # 1. Raw Data (High frequency)
        deleted_bandwidth = 0
        deleted_latency = 0
        deleted_net = 0
        if retention_raw > 0:
            deleted_bandwidth = db.query(models.BandwidthHistory).filter(models.BandwidthHistory.timestamp < cutoff_raw).delete()
            deleted_latency = db.query(models.LatencyLog).filter(models.LatencyLog.timestamp < cutoff_raw).delete()
            deleted_net = db.query(models.SystemNetworkHistory).filter(models.SystemNetworkHistory.timestamp < cutoff_raw).delete()

        # 2. Daily Summaries / Medium frequency
        deleted_traffic = 0
        deleted_docker = 0
        if retention_daily > 0:
            deleted_traffic = db.query(models.DeviceDailySummary).filter(models.DeviceDailySummary.date < cutoff_daily.date()).delete()
            # Docker metrics can be kept for medium frequency
            deleted_docker = db.query(models.DockerContainerMetric).filter(models.DockerContainerMetric.timestamp < cutoff_daily).delete()

        # 3. Events / Logs
        deleted_security = 0
        deleted_speedtest = 0
        if retention_events > 0:
            deleted_security = db.query(models.SecurityEvent).filter(models.SecurityEvent.timestamp < cutoff_events).delete()
            deleted_speedtest = db.query(models.SpeedtestResult).filter(models.SpeedtestResult.timestamp < cutoff_events).delete()

        db.commit()

        logger.info(
            f"Cleanup complete. Deleted: "
            f"{deleted_bandwidth} bandwidth logs, {deleted_latency} latency logs, {deleted_net} net history, "
            f"{deleted_traffic} traffic summaries, {deleted_docker} docker metrics, "
            f"{deleted_security} security events, {deleted_speedtest} speedtests."
        )

    except Exception as e:
        logger.error(f"Data cleanup job failed: {e}")
        db.rollback()
    finally:
        db.close()

