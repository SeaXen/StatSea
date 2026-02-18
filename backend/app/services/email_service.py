from ..core.logging import get_logger

logger = get_logger("EmailService")


class EmailService:
    @staticmethod
    def send_daily_summary(email: str):
        """
        Stubs the email sending process.
        In a real implementation, this would use SMTP or an email API (SendGrid, SES, etc.)
        """
        logger.info(f"STUB: Sending daily summary email to {email}")
        # Logic to gather stats would go here
        return True
