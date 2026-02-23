from ..core.logging import get_logger

logger = get_logger("EmailService")


class EmailService:
    @staticmethod
    def send_daily_summary(email: str):
        """
        [STUB] Email sending is not yet implemented.
        In production, integrate with SMTP or an email API (SendGrid, SES, etc.)
        """
        logger.info(f"[STUB] Daily summary email to {email} — email service not configured")
        return True
