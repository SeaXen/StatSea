from sqlalchemy.orm import Session
from app.models import models
import json

class NotificationService:
    @staticmethod
    def create_channel(db: Session, organization_id: int, name: str, type: str, config: dict, events: list):
        channel = models.NotificationChannel(
            organization_id=organization_id,
            name=name,
            type=type,
            config=json.dumps(config),
            events=json.dumps(events),
            is_enabled=True
        )
        db.add(channel)
        db.commit()
        db.refresh(channel)
        return channel

    @staticmethod
    def list_channels(db: Session, organization_id: int):
        return db.query(models.NotificationChannel).filter(models.NotificationChannel.organization_id == organization_id).all()

    @staticmethod
    def send_notification(db: Session, organization_id: int, event_type: str, message: str):
        """
        Sends a notification to all enabled channels for the organization that subscribe to this event type.
        """
        channels = db.query(models.NotificationChannel).filter(
            models.NotificationChannel.organization_id == organization_id,
            models.NotificationChannel.is_enabled == True
        ).all()
        
        sent_count = 0
        for channel in channels:
            events = json.loads(channel.events)
            if event_type in events or "*" in events:
                # Mock sending
                print(f"[NOTIFICATION] To {channel.name} ({channel.type}): {message}")
                sent_count += 1
        return sent_count
