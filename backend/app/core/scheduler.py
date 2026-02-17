from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from ..db.database import SessionLocal
from ..models import models
from .speedtest_service import speedtest_service
from .notifications import notification_service
import logging
import json

logger = logging.getLogger(__name__)

class SchedulerService:
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.scheduler.start()
        self.job_id = "auto_speedtest"

    def schedule_speedtest(self, interval_hours: int = 0):
        """Schedules the speedtest job. If interval_hours is 0, removes the job."""
        if self.scheduler.get_job(self.job_id):
            self.scheduler.remove_job(self.job_id)

        if interval_hours > 0:
            self.scheduler.add_job(
                self.run_scheduled_speedtest,
                'interval',
                hours=interval_hours,
                id=self.job_id
            )
            logger.info(f"Speedtest scheduled every {interval_hours} hours.")
        else:
            logger.info("Speedtest automation disabled.")

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
                    provider=provider
                )
                db.add(db_item)
                db.commit()
                db.refresh(db_item)

                # Send Notification
                result_dict = {
                    "download": result_data['download'] / 1_000_000, 
                    "upload": result_data['upload'] / 1_000_000,
                    "ping": result_data['ping'],
                    "provider": provider,
                    "server_name": result_data['server']['name']
                }
                notification_service.send_speedtest_alert(result_dict, notify_config)

        except Exception as e:
            logger.error(f"Scheduled speedtest failed: {e}")
        finally:
            db.close()

    def update_scheduler_from_db(self):
        """Refreshes scheduler config from DB."""
        db: Session = SessionLocal()
        try:
            setting = db.query(models.SystemSettings).filter(models.SystemSettings.key == "speedtest_interval").first()
            if setting and setting.value:
                try:
                    interval = float(setting.value) # Allow float for "0.5" hours etc if needed, though int is safer for hours
                    self.schedule_speedtest(interval)
                except ValueError:
                    pass
        finally:
            db.close()

scheduler = SchedulerService()
