"""
Tests for root and health endpoints.
All sync — uses TestClient from conftest.
"""


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"


def test_health_check(auth_client):
    response = auth_client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_unauthenticated_blocked(client):
    """Ensure protected routes reject unauthenticated requests."""
    response = client.get("/api/devices")
    assert response.status_code in (401, 403)


def test_admin_users_list(auth_client):
    """Admin can list users."""
    response = auth_client.get("/api/admin/users")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_settings_get(auth_client):
    response = auth_client.get("/api/settings")
    assert response.status_code == 200


def test_system_info(auth_client):
    response = auth_client.get("/api/system/info")
    assert response.status_code == 200


def test_alerts(auth_client):
    """Security alerts endpoint is accessible for admin users."""
    response = auth_client.get("/api/alerts")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
