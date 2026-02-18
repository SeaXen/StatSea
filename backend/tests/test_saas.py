import pytest
from httpx import AsyncClient
from app.main import app
from app.models import models
from app.db.database import get_db

# Use auth client fixture from conftest (if available) or create a new one
# Assuming conftest exists and handles auth. 
# If not, we need to mock auth or login first. 
# Previous context showed test_auth.py working, so auth flow exists.

@pytest.mark.asyncio
async def test_audit_logs(auth_client, db_session):
    # Action which triggers audit log? 
    # Currently only explicit calls in code would trigger it. 
    # We added endpoints but didn't hook generic creates yet (Phase 10 implementation plan said "Inject audit_service.log_action calls").
    # For now, let's just test the GET endpoint which ensures the router is mounted.
    
    response = await auth_client.get("/api/audit/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

@pytest.mark.asyncio
async def test_billing_stub(auth_client):
    # Subscribe to plan
    response = await auth_client.post("/api/billing/subscribe", json={"plan": "pro"})
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert response.json()["plan"] == "pro"

    # Get portal
    response = await auth_client.get("/api/billing/portal")
    assert response.status_code == 200
    assert "url" in response.json()

@pytest.mark.asyncio
async def test_api_keys(auth_client):
    # Create Key
    response = await auth_client.post("/api/keys/", json={"name": "Test Key", "permissions": "read"})
    assert response.status_code == 200
    data = response.json()
    assert "key" in data
    assert data["key"].startswith("sk_live_")
    key_id = data["id"]
    
    # List Keys
    response = await auth_client.get("/api/keys/")
    assert response.status_code == 200
    assert len(response.json()) > 0
    
    # Revoke Key
    response = await auth_client.delete(f"/api/keys/{key_id}")
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_notifications_lifecycle(auth_client):
    # Create Channel
    payload = {
        "name": "Slack Alert",
        "type": "slack",
        "config": {"webhook_url": "https://hooks.slack.com/services/xxx"},
        "events": ["alert.critical"]
    }
    response = await auth_client.post("/api/notifications/channels", json=payload)
    assert response.status_code == 200
    assert response.json()["name"] == "Slack Alert"
    
    # List Channels
    response = await auth_client.get("/api/notifications/channels")
    assert response.status_code == 200
    assert len(response.json()) >= 1

@pytest.mark.asyncio
async def test_status_page(auth_client):
    # Update settings
    payload = {
        "title": "My Status",
        "is_public": True,
        "description": "All good"
    }
    response = await auth_client.patch("/api/status-settings/settings", json=payload)
    assert response.status_code == 200
    assert response.json()["slug"] is not None
    slug = response.json()["slug"]

    # Access public page (client without auth)
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(f"/status/{slug}")
        assert response.status_code == 200
        assert response.json()["title"] == "My Status"
