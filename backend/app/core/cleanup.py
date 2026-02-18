from sqlalchemy.orm import Session
from ..db.database import SessionLocal
from ..models import models
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

def run_cleanup_job():
    """
    Deletes old records based on retention policy.
    Targets: DockerContainerMetric, SystemNetworkHistory, TrafficLog, SecurityEvent
    """
    db: Session = SessionLocal()
    try:
        # Get retention days from settings, default to 30
        retention_setting = db.query(models.SystemSettings).filter(models.SystemSettings.key == "data_retention_days").first()
        retention_days = 30
        if retention_setting and retention_setting.value:
            try:
                retention_days = int(retention_setting.value)
            except ValueError:
                pass

        if retention_days <= 0:
            logger.info("Data retention cleanup disabled (days <= 0).")
            return

        cutoff_date = datetime.now() - timedelta(days=retention_days)
        logger.info(f"Running data cleanup for records older than {cutoff_date} ({retention_days} days retention).")

        # 1. Docker Metrics
        deleted_docker = db.query(models.DockerContainerMetric).filter(models.DockerContainerMetric.timestamp < cutoff_date).delete()
        
        # 2. System Network History
        deleted_net = db.query(models.SystemNetworkHistory).filter(models.SystemNetworkHistory.timestamp < cutoff_date).delete()

        # 3. Device Traffic Logs (Daily Summaries)
        deleted_traffic = db.query(models.DeviceDailySummary).filter(models.DeviceDailySummary.date < cutoff_date.date()).delete()

        # 4. Security Events
        deleted_security = db.query(models.SecurityEvent).filter(models.SecurityEvent.timestamp < cutoff_date).delete()
        
        # 5. Speedtest Results
        deleted_speedtest = db.query(models.SpeedtestResult).filter(models.SpeedtestResult.timestamp < cutoff_date).delete()

        # 6. Bandwidth History (High frequency)
        deleted_bandwidth = db.query(models.BandwidthHistory).filter(models.BandwidthHistory.timestamp < cutoff_date).delete()
        
        # 7. Latency Logs (High frequency)
        deleted_latency = db.query(models.LatencyLog).filter(models.LatencyLog.timestamp < cutoff_date).delete()

        db.commit()
        
        logger.info(f"Cleanup complete. Deleted: {deleted_docker} docker metrics, {deleted_net} net history, {deleted_traffic} traffic logs, {deleted_security} security events, {deleted_speedtest} speedtests, {deleted_bandwidth} bandwidth logs, {deleted_latency} latency logs.")

    except Exception as e:
        logger.error(f"Data cleanup job failed: {e}")
        db.rollback()
    finally:
        db.close()
