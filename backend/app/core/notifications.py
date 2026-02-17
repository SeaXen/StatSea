import requests
import os
import json
from datetime import datetime

class NotificationService:
    def __init__(self):
        self.discord_webhook_url = os.getenv("DISCORD_WEBHOOK_URL", "")
        self.telegram_bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID", "")

    def send_alert(self, title: str, description: str, severity: str = "INFO", fields: list = None):
        """Dispatches alert to all configured providers."""
        if self.discord_webhook_url:
            self._send_discord(title, description, severity, fields)
        # Placeholder for Telegram implementation
        # if self.telegram_bot_token and self.telegram_chat_id:
        #     self._send_telegram(title, description)

    def _send_discord(self, title: str, description: str, severity: str, fields: list = None):
        color_map = {
            "INFO": 3447003,      # Blue
            "LOW": 3447003,       # Blue
            "MEDIUM": 16776960,   # Yellow
            "HIGH": 15158332,     # Red
            "CRITICAL": 15158332  # Red
        }
        
        embed = {
            "title": f"🛡️ Statsea Security Alert: {title}",
            "description": description,
            "color": color_map.get(severity.upper(), 3447003),
            "timestamp": datetime.utcnow().isoformat(),
            "footer": {"text": "Statsea Network Intelligence"},
        }

        if fields:
            embed["fields"] = fields

        payload = {
            "embeds": [embed]
        }

        try:
            requests.post(self.discord_webhook_url, json=payload, timeout=5)
        except Exception as e:
            print(f"Failed to send Discord alert: {e}")

notification_service = NotificationService()
