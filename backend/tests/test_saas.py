import pytest
from app.main import app
from app.models import models
from app.db.database import get_db

# Use auth client fixture from conftest (if available) or create a new one
# Assuming conftest exists and handles auth. 
# If not, we need to mock auth or login first. 
# Previous context showed test_auth.py working, so auth flow exists.

def test_audit_logs(auth_client, db_session):
    # Action which triggers audit log? 
    # Currently only explicit calls in code would trigger it. 
    # We added endpoints but didn't hook generic creates yet (Phase 10 implementation plan said "Inject audit_service.log_action calls").
    # For now, let's just test the GET endpoint which ensures the router is mounted.
    
    response = auth_client.get("/api/audit/")
    if response.status_code != 200:
        print(f"DEBUG: Status {response.status_code}, Response: {response.text}")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_billing_stub(auth_client):
    # Subscribe to plan
    response = auth_client.post("/api/billing/subscribe", json={"plan": "pro"})
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert response.json()["plan"] == "pro"

    # Get portal
    response = auth_client.get("/api/billing/portal")
    assert response.status_code == 200
    assert "url" in response.json()

def test_api_keys(auth_client):
    # Create Key
    response = auth_client.post("/api/keys/", json={"name": "Test Key", "permissions": "read"})
    assert response.status_code == 200
    data = response.json()
    assert "key" in data
    assert data["key"].startswith("sk_live_")
    key_id = data["id"]
    
    # List Keys
    response = auth_client.get("/api/keys/")
    assert response.status_code == 200
    assert len(response.json()) > 0
    
    # Revoke Key
    response = auth_client.delete(f"/api/keys/{key_id}")
    assert response.status_code == 200

def test_notifications_lifecycle(auth_client):
    # Create Channel
    payload = {
        "name": "Slack Alert",
        "type": "slack",
        "config": {"webhook_url": "https://hooks.slack.com/services/xxx"},
        "events": ["alert.critical"]
    }
    response = auth_client.post("/api/notifications/channels", json=payload)
    assert response.status_code == 200
    assert response.json()["name"] == "Slack Alert"
    
    # List Channels
    response = auth_client.get("/api/notifications/channels")
    assert response.status_code == 200
    assert len(response.json()) >= 1

def test_status_page(auth_client):
    # Update settings
    payload = {
        "title": "My Status",
        "is_public": True,
        "description": "All good"
    }
    response = auth_client.patch("/api/status-settings/settings", json=payload)
    assert response.status_code == 200
    assert response.json()["slug"] is not None
    slug = response.json()["slug"]

    # Access public page (client without auth)
    # Since auth_client is a TestClient, we can use client fixture or create new TestClient
    from fastapi.testclient import TestClient
    with TestClient(app) as ac:
        response = ac.get(f"/status/{slug}")
        assert response.status_code == 200
        assert response.json()["title"] == "My Status"
