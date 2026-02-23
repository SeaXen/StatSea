import pytest
from unittest.mock import patch, MagicMock
from app.services.notification_service import NotificationService
from app.models.models import NotificationChannel, Organization, User, OrganizationMember
import json

def test_create_notification_channel(db_session, auth_client):
    """Test creating a new notification channel through the API."""
    # Organization is already created by auth_client fixture
    payload = {
        "name": "My Slack",
        "type": "slack",
        "config": {"webhook_url": "https://hooks.slack.com/services/test"},
        "events": ["*"]
    }
    
    response = auth_client.post("/api/notifications/channels", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "My Slack"
    # The API returns {"id": 1, "name": "...", "status": "created"}
    
    # Verify in DB
    channel = db_session.query(NotificationChannel).filter(NotificationChannel.id == data["id"]).first()
    assert channel is not None
    assert channel.name == "My Slack"
    assert channel.type == "slack"

def test_list_notification_channels(db_session, auth_client):
    """Test listing notification channels."""
    # 1. Get Org
    org = db_session.query(Organization).first()
    
    # 2. Add channel
    channel = NotificationChannel(
        organization_id=org.id,
        name="Discord Alert",
        type="discord",
        events=json.dumps(["*"]),
        config=json.dumps({"webhook_url": "https://discord.com/api/webhooks/test"}),
        is_enabled=True
    )
    db_session.add(channel)
    db_session.commit()
    
    response = auth_client.get("/api/notifications/channels")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(c["name"] == "Discord Alert" for c in data)

@patch("httpx.post")
def test_test_notification_channel(mock_post, db_session, auth_client):
    """Test the test_channel endpoint."""
    mock_post.return_value = MagicMock(status_code=200)
    
    # 1. Get Org
    org = db_session.query(Organization).first()
    
    # 2. Setup channel
    channel = NotificationChannel(
        organization_id=org.id,
        name="Test Telegram",
        type="telegram",
        events=json.dumps(["*"]),
        config=json.dumps({"token": "123:ABC", "chat_id": "987"}),
        is_enabled=True
    )
    db_session.add(channel)
    db_session.commit()
    
    # 3. Trigger test
    response = auth_client.post(f"/api/notifications/channels/{channel.id}/test")
    assert response.status_code == 200
    assert response.json()["status"] == "test_sent"
    
    # 4. Verify mock
    assert mock_post.called

@patch("app.services.notification_service.NotificationService._send_discord")
def test_send_alert_helper(mock_send_discord, db_session):
    """Test the send_alert helper sends notifications to all enabled channels."""
    # 1. Setup Org and Channel
    org = Organization(name="Alert Org")
    db_session.add(org)
    db_session.commit()
    
    channel = NotificationChannel(
        organization_id=org.id,
        name="Discord",
        type="discord",
        events=json.dumps(["*"]),
        config=json.dumps({"webhook_url": "t"}),
        is_enabled=True
    )
    db_session.add(channel)
    db_session.commit()
    
    # 2. Trigger send_alert
    NotificationService.send_alert(
        db=db_session,
        organization_id=org.id,
        title="Test Alert",
        description="Something happened"
    )
    
    # 3. Verify dispatch
    assert mock_send_discord.called
    # Check title matches
    args, kwargs = mock_send_discord.call_args
    assert args[1] == "Test Alert"

def test_delete_notification_channel(db_session, auth_client):
    """Test deleting a notification channel."""
    org = db_session.query(Organization).first()
    channel = NotificationChannel(
        organization_id=org.id,
        name="To Delete",
        type="ntfy",
        events=json.dumps(["*"]),
        config=json.dumps({"url": "t"}),
        is_enabled=True
    )
    db_session.add(channel)
    db_session.commit()
    
    response = auth_client.delete(f"/api/notifications/channels/{channel.id}")
    assert response.status_code == 200
    
    # Verify gone
    db_session.expire_all()
    channel_in_db = db_session.query(NotificationChannel).filter(NotificationChannel.id == channel.id).first()
    assert channel_in_db is None
