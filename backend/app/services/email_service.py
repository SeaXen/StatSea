import json

from app.core.logging import get_logger
from app.db.database import SessionLocal
from app.models import models
from app.services.notification_service import NotificationService

logger = get_logger("EmailService")


class EmailService:
    @staticmethod
    def send_daily_summary(email: str):
        """Send a daily summary to an address configured on an enabled email channel."""
        db = SessionLocal()
        try:
            channels = db.query(models.NotificationChannel).filter(
                models.NotificationChannel.type == "email",
                models.NotificationChannel.is_enabled.is_(True),
            ).all()
            for channel in channels:
                try:
                    config = json.loads(channel.config or "{}")
                except (TypeError, ValueError):
                    continue
                if email in config.get("to_emails", []):
                    NotificationService._send_email(
                        config,
                        "StatSea Daily Summary",
                        "Your StatSea daily summary report is ready.",
                    )
                    return True
            logger.warning("No enabled email notification channel for %s", email)
            return False
        except Exception:
            logger.exception("Failed to send daily summary email to %s", email)
            return False
        finally:
            db.close()
