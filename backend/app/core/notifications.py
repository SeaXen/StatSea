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
        if self.telegram_bot_token and self.telegram_chat_id:
            self._send_telegram(title, description, severity)

    def send_speedtest_alert(self, result: dict, config: dict):
        """Sends speedtest results to configured channels."""
        # Config contains: telegram_token, telegram_chat_id, discord_webhook_url
        
        title = f"🚀 Speedtest Result: {result.get('download', 0):.2f} Mbps"
        description = (
            f"**Download:** {result.get('download', 0):.2f} Mbps\n"
            f"**Upload:** {result.get('upload', 0):.2f} Mbps\n"
            f"**Ping:** {result.get('ping', 0):.0f} ms\n"
            f"**Provider:** {result.get('provider', 'Unknown')}\n"
            f"**Server:** {result.get('server_name', 'Auto')}"
        )
        
        fields = [
            {"name": "Download", "value": f"{result.get('download', 0):.2f} Mbps", "inline": True},
            {"name": "Upload", "value": f"{result.get('upload', 0):.2f} Mbps", "inline": True},
            {"name": "Ping", "value": f"{result.get('ping', 0):.0f} ms", "inline": True},
        ]

        # Send to Discord if configured
        if config.get('discord_webhook_url'):
            self.discord_webhook_url = config['discord_webhook_url'] # Temporarily override or use directly
            self._send_discord("Speedtest Completed", description, "INFO", fields)

        # Send to Telegram if configured
        if config.get('telegram_token') and config.get('telegram_chat_id'):
            self._send_telegram_direct(config['telegram_token'], config['telegram_chat_id'], f"🚀 *Speedtest Completed*\n\n{description}")

    def _send_telegram_direct(self, token, chat_id, message):
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "Markdown"
        }
        try:
            requests.post(url, json=payload, timeout=5)
        except Exception as e:
            print(f"Failed to send Telegram alert: {e}")

    def _send_telegram(self, title: str, description: str, severity: str):
         # Uses env var credentials
        message = f"🛡️ *{title}* ({severity})\n\n{description}"
        self._send_telegram_direct(self.telegram_bot_token, self.telegram_chat_id, message)

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
