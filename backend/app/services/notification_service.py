import json
import logging
import smtplib
from email.mime.text import MIMEText
from typing import List, Optional, Dict, Any
import httpx
from sqlalchemy.orm import Session
from app.models import models
from app.services.webpush_service import webpush_service

logger = logging.getLogger("NotificationService")

class NotificationService:
    @staticmethod
    def create_channel(
        db: Session, 
        organization_id: int, 
        name: str, 
        type: str, 
        config: dict, 
        events: List[str] = None
    ) -> models.NotificationChannel:
        """Creates a new notification channel."""
        channel = models.NotificationChannel(
            organization_id=organization_id,
            name=name,
            type=type,
            config=json.dumps(config),
            events=json.dumps(events or []),
            is_enabled=True
        )
        db.add(channel)
        db.commit()
        db.refresh(channel)
        return channel

    @staticmethod
    def list_channels(db: Session, organization_id: int) -> List[models.NotificationChannel]:
        """Lists all notification channels for an organization."""
        return db.query(models.NotificationChannel).filter(
            models.NotificationChannel.organization_id == organization_id
        ).all()

    @staticmethod
    def update_channel(
        db: Session,
        channel_id: int,
        name: Optional[str] = None,
        config: Optional[dict] = None,
        events: Optional[List[str]] = None,
        is_enabled: Optional[bool] = None
    ) -> models.NotificationChannel:
        """Updates an existing notification channel."""
        channel = db.query(models.NotificationChannel).filter(models.NotificationChannel.id == channel_id).first()
        if not channel:
            raise ValueError("Channel not found")
        
        if name is not None:
            channel.name = name
        if config is not None:
            channel.config = json.dumps(config)
        if events is not None:
            channel.events = json.dumps(events)
        if is_enabled is not None:
            channel.is_enabled = is_enabled
            
        db.commit()
        db.refresh(channel)
        return channel

    @staticmethod
    def test_channel(db: Session, channel_id: int):
        """Sends a test notification through the specified channel."""
        channel = db.query(models.NotificationChannel).filter(models.NotificationChannel.id == channel_id).first()
        if not channel:
            raise ValueError("Channel not found")
        
        config = json.loads(channel.config)
        NotificationService.dispatch(
            channel.type, config, "Test Notification", "This is a test notification from StatSea.", channel.organization_id, db
        )

    @staticmethod
    def delete_channel(db: Session, channel_id: int):
        """Deletes a notification channel."""
        channel = db.query(models.NotificationChannel).filter(models.NotificationChannel.id == channel_id).first()
        if channel:
            db.delete(channel)
            db.commit()

    @staticmethod
    def send_notification(db: Session, organization_id: int, event_type: str, title: str, message: str):
        """Sends a notification to all enabled channels for the given event type."""
        channels = NotificationService.list_channels(db, organization_id)
        for channel in channels:
            if not channel.is_enabled:
                continue
                
            events = json.loads(channel.events)
            if "*" in events or event_type in events:
                try:
                    config = json.loads(channel.config)
                    NotificationService.dispatch(channel.type, config, title, message, organization_id, db)
                    logger.info(f"Notification sent via {channel.type}: {title}")
                except Exception as e:
                    logger.error(f"Failed to send notification via {channel.type} (ID: {channel.id}): {str(e)}")

    @staticmethod
    def dispatch(channel_type: str, config: dict, title: str, message: str, organization_id: int, db: Session):
        """Dispatches notification to the appropriate provider."""
        providers = {
            "email": NotificationService._send_email,
            "slack": NotificationService._send_slack,
            "discord": NotificationService._send_discord,
            "ntfy": NotificationService._send_ntfy,
            "telegram": NotificationService._send_telegram,
            "push": lambda cfg, t, m: NotificationService._send_push(cfg, t, m, organization_id, db)
        }
        
        provider = providers.get(channel_type)
        if provider:
            try:
                provider(config, title, message)
            except Exception as e:
                logger.error(f"Failed to dispatch to {channel_type}: {e}")
        else:
            logger.warning(f"No provider found for channel type: {channel_type}")

    @staticmethod
    def _send_email(config: dict, title: str, message: str):
        """Sends an email notification via SMTP."""
        msg = MIMEText(message)
        msg['Subject'] = title
        msg['From'] = config.get('from_email')
        msg['To'] = ", ".join(config.get('to_emails', []))
        
        with smtplib.SMTP(config.get('host'), config.get('port', 587)) as server:
            if config.get('port') == 587:
                server.starttls()
            
            user = config.get('user')
            password = config.get('password')
            if user and password:
                server.login(user, password)
            server.send_message(msg)

    @staticmethod
    def _send_slack(config: dict, title: str, message: str):
        """Sends a Slack notification via webhook."""
        payload = {
            "text": f"*{title}*\n{message}"
        }
        httpx.post(config.get('webhook_url'), json=payload, timeout=10)

    @staticmethod
    def _send_discord(config: dict, title: str, message: str):
        """Sends a Discord notification via webhook with rich formatting."""
        from datetime import datetime, timezone
        
        embed = {
            "title": f"🛡️ StatSea Alert: {title}",
            "description": message,
            "color": 3447003,  # Default blue
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "footer": {"text": "StatSea Network Intelligence"}
        }
        
        payload = {"embeds": [embed]}
        httpx.post(config.get('webhook_url'), json=payload, timeout=10)

    @staticmethod
    def _send_ntfy(config: dict, title: str, message: str):
        """Sends a notification via ntfy.sh."""
        headers = {
            "Title": title,
            "Priority": str(config.get("priority", "default")),
            "Tags": config.get("tags", "notification")
        }
        server = config.get('server_url', 'https://ntfy.sh').rstrip('/')
        url = f"{server}/{config.get('topic')}"
        httpx.post(url, content=message, headers=headers, timeout=10)

    @staticmethod
    def _send_telegram(config: dict, title: str, message: str):
        """Sends a Telegram notification via bot."""
        token = config.get("token")
        chat_id = config.get("chat_id")
        if not token or not chat_id:
            return
            
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": f"🛡️ *{title}*\n\n{message}",
            "parse_mode": "Markdown"
        }
        httpx.post(url, json=payload, timeout=10)

    @staticmethod
    def _send_push(config: dict, title: str, message: str, organization_id: int, db: Session):
        """Sends a Web Push notification to all subscribers in the organization."""
        # Find all users in this organization
        members = db.query(models.OrganizationMember).filter(
            models.OrganizationMember.organization_id == organization_id
        ).all()
        
        payload = {
            "title": title,
            "body": message,
            "icon": "/icon-512.png",
            "data": {"url": "/"}
        }
        
        for member in members:
            user = db.query(models.User).filter(models.User.id == member.user_id).first()
            if user and user.push_subscriptions:
                for sub in user.push_subscriptions:
                    try:
                        subscription_info = {
                            "endpoint": sub.endpoint,
                            "keys": json.loads(sub.keys)
                        }
                        webpush_service.send_push_notification(
                            subscription_info,
                            payload
                        )
                    except Exception as e:
                        logger.warning(f"Failed to send push to user {user.id}: {str(e)}")

    @staticmethod
    def send_speedtest_alert(db: Session, organization_id: int, result: dict):
        """Helper to send speedtest alerts using the consolidated channel system."""
        title = f"🚀 Speedtest Result: {result.get('download', 0):.2f} Mbps"
        message = (
            f"**Download:** {result.get('download', 0):.2f} Mbps\n"
            f"**Upload:** {result.get('upload', 0):.2f} Mbps\n"
            f"**Ping:** {result.get('ping', 0):.0f} ms\n"
            f"**Provider:** {result.get('provider', 'Unknown')}\n"
            f"**Server:** {result.get('server_name', 'Auto')}"
        )
        NotificationService.send_notification(db, organization_id, "speedtest", title, message)

    @staticmethod
    def send_alert(db: Session, organization_id: int, title: str, description: str, severity: str = "INFO"):
        """Helper to send a generic alert using the consolidated channel system."""
        NotificationService.send_notification(db, organization_id, "alert", title, description)
