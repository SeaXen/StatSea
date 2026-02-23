import sqlalchemy.exc
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from ..db.database import SessionLocal
from ..models import models
from .aggregator import run_aggregation_job
from .cleanup import run_cleanup_job
from .logging import get_logger
from ..services.notification_service import NotificationService
from .quotas import check_quotas
from .speedtest_service import speedtest_service
from .uptime import check_device_availability
from ..services.port_scanner import run_port_scan_job
from ..services import system_metrics as system_service
from ..services import backup_service as backup_service_lib
from ..services import health_checker as health_service
from ..services.certificate_service import CertificateMonitor
import asyncio

logger = get_logger("Scheduler")


class SchedulerService:
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.scheduler.start()
        self.job_id = "auto_speedtest"
        self.cleanup_job_id = "data_cleanup"
        self.quota_job_id = "quota_check"

        # Schedule cleanup daily
        self.schedule_cleanup()

        # Schedule quota check every 15 minutes
        self.schedule_quota_check()

        # Schedule uptime check every 1 minute
        self.schedule_uptime_check()

        # Schedule aggregation every hour
        self.schedule_aggregation()

        # Schedule port scanning every 6 hours
        self.schedule_port_scanning()

        # Phase 6: System Management
        self.schedule_system_metrics()
        self.schedule_health_checks()
        self.schedule_backups()

        # Phase 11: SSL Monitoring
        self.schedule_certificate_checks()

    def schedule_uptime_check(self):
        """Schedules the device uptime/offline check."""
        if not self.scheduler.get_job("uptime_monitor"):
            self.scheduler.add_job(
                check_device_availability,
                "interval",
                minutes=1,
                id="uptime_monitor",
                replace_existing=True,
            )
            logger.info("Uptime monitor scheduled (Every 1 min).")

    def schedule_aggregation(self):
        """Schedules the daily aggregation job."""
        if not self.scheduler.get_job("daily_aggregation"):
            self.scheduler.add_job(
                run_aggregation_job,
                "interval",
                hours=1,
                id="daily_aggregation",
                replace_existing=True,
            )
            logger.info("Daily aggregation scheduled (Every 1 hour).")

    def schedule_port_scanning(self):
        """Schedules the background port scanning job."""
        if not self.scheduler.get_job("port_scanner"):
            # Run every 6 hours
            self.scheduler.add_job(
                run_port_scan_job,
                "interval",
                hours=6,
                id="port_scanner",
                replace_existing=True,
            )
            logger.info("Background port scanner scheduled (Every 6 hours).")

    def schedule_quota_check(self):
        """Schedules the bandwidth quota check."""
        if not self.scheduler.get_job(self.quota_job_id):
            self.scheduler.add_job(
                check_quotas, "interval", minutes=15, id=self.quota_job_id, replace_existing=True
            )
            logger.info("Bandwidth quota check scheduled (Every 15 mins).")

    def schedule_speedtest(self, interval_hours: float = 0):
        """Schedules the speedtest job. If interval_hours is 0, removes the job."""
        if self.scheduler.get_job(self.job_id):
            self.scheduler.remove_job(self.job_id)

        if interval_hours > 0:
            self.scheduler.add_job(
                self.run_scheduled_speedtest, "interval", hours=interval_hours, id=self.job_id
            )
            logger.info(f"Speedtest scheduled every {interval_hours} hours.")
        else:
            logger.info("Speedtest automation disabled.")

    def schedule_cleanup(self):
        """Schedules the daily data cleanup job."""
        if not self.scheduler.get_job(self.cleanup_job_id):
            self.scheduler.add_job(
                run_cleanup_job, "interval", days=1, id=self.cleanup_job_id, replace_existing=True
            )
            logger.info("Data cleanup job scheduled (Daily).")

    def run_scheduled_speedtest(self):
        """Runs the speedtest and sends notifications."""
        logger.info("Running scheduled speedtest...")
        db: Session = SessionLocal()
        try:
            # Run test (using default provider preference from simple logic or settings)
            # For now, we'll default to 'ookla' or fetch from settings if we implement that
            provider = "ookla"

            # Fetch settings for provider and server if needed
            settings = db.query(models.SystemSettings).all()
            settings_map = {s.key: s.value for s in settings}

            provider = settings_map.get("speedtest_provider", "ookla")
            server_id = int(settings_map.get("speedtest_server_id", 0)) or None

            # Get notification config
            notify_config = {
                "telegram_token": settings_map.get("telegram_bot_token"),
                "telegram_chat_id": settings_map.get("telegram_chat_id"),
                "discord_webhook_url": settings_map.get("discord_webhook_url"),
            }

            # Run the test (we need an async wrapper or run sync? speedtest_service methods are sync except run_speedtest wrapper)
            # speedtest_service.run_speedtest is async.
            # we should use the synchronous methods inside run_speedtest or call it synchronously.
            # But run_speedtest in endpoint is async. The service methods `run_ookla_speedtest` are sync (blocking).
            # We should probably run it in a thread executor if it was an API call, but here we are in a background job.

            # Run test (Synchronous calls)
            result_data = None
            if provider == "cloudflare":
                result_data = speedtest_service.run_cloudflare_speedtest()
            else:
                result_data = speedtest_service.run_ookla_speedtest(server_id=server_id)

            # Save to Database
            if result_data:
                db_item = models.SpeedtestResult(
                    timestamp=result_data["timestamp"],
                    ping=result_data["ping"],
                    download=result_data["download"],
                    upload=result_data["upload"],
                    server_id=int(result_data["server"]["id"]),
                    server_name=f"{result_data['server']['name']}, {result_data['server']['country']}",
                    server_country=result_data.get("server", {}).get("country", "Unknown"),
                    provider=provider,
                )
                db.add(db_item)
                db.commit()
                db.refresh(db_item)

                # Send Notification
                result_dict = {
                    "download": result_data["download"],
                    "upload": result_data["upload"],
                    "ping": result_data["ping"],
                    "provider": provider,
                    "server_name": result_data["server"]["name"],
                }
                
                # Use new NotificationService - defaulting to first organization for now
                try:
                    org = db.query(models.Organization).first()
                    org_id = org.id if org else 1
                    NotificationService.send_speedtest_alert(db, org_id, result_dict)
                except Exception as e:
                    logger.error(f"Failed to send new-style speedtest alert: {e}")

        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception("Database error during scheduled speedtest")
            db.rollback()
        except Exception:
            logger.exception("Scheduled speedtest failed unexpectedly")
            db.rollback()
        finally:
            db.close()

    def schedule_system_metrics(self):
        """Schedule metric collection every 5 minutes."""
        if not self.scheduler.get_job("system_metrics"):
            self.scheduler.add_job(
                self._run_system_metrics,
                "interval",
                minutes=5,
                id="system_metrics",
                replace_existing=True
            )
            logger.info("System metrics collection scheduled (Every 5 mins).")

    def schedule_health_checks(self):
        """Schedule health checks every 5 minutes."""
        if not self.scheduler.get_job("health_checks"):
            self.scheduler.add_job(
                self._run_health_checks,
                "interval",
                minutes=5,
                id="health_checks",
                replace_existing=True
            )
            logger.info("Health checks scheduled (Every 5 mins).")

    def schedule_backups(self):
        """Schedule automated backups daily."""
        if not self.scheduler.get_job("automated_backup"):
            self.scheduler.add_job(
                self._run_backup,
                "interval",
                days=1,
                id="automated_backup",
                replace_existing=True
            )
            logger.info("Automated backup scheduled (Daily).")

    def schedule_certificate_checks(self):
        """Schedule SSL certificate monitoring every 24 hours."""
        if not self.scheduler.get_job("certificate_checks"):
            self.scheduler.add_job(
                self._run_certificate_checks,
                "interval",
                hours=24,
                id="certificate_checks",
                replace_existing=True
            )
            logger.info("SSL Certificate monitoring scheduled (Every 24 hours).")

    def _run_system_metrics(self):
        db = SessionLocal()
        try:
            system_service.record_system_metrics(db)
        finally:
            db.close()

    def _run_health_checks(self):
        db = SessionLocal()
        try:
            # Bridging sync APScheduler to async health check
            asyncio.run(health_service.run_all_health_checks(db))
        finally:
            db.close()

    def _run_backup(self):
        db = SessionLocal()
        try:
            backup_service_lib.create_backup(db, is_manual=False)
        finally:
            db.close()

    def _run_certificate_checks(self):
        db = SessionLocal()
        try:
            CertificateMonitor.check_all_certificates(db)
        finally:
            db.close()

    def update_scheduler_from_db(self):
        db = SessionLocal()
        try:
            settings = db.query(models.SystemSettings).all()
            settings_map = {s.key: s.value for s in settings}
            
            # Speedtest interval (minutes)
            try:
                st_interval = int(settings_map.get("speedtest_interval", 180))
            except ValueError:
                st_interval = 180
                
            if st_interval > 0:
                self.schedule_speedtest(st_interval / 60.0)
            else:
                self.schedule_speedtest(0)
                
            logger.info("Scheduler updated from database settings.")
        finally:
            db.close()

scheduler = SchedulerService()
