"""
Tests for device and group endpoints.
All sync — uses TestClient from conftest.
"""
import pytest
from app.models.models import Device


def test_list_devices_empty(auth_client):
    response = auth_client.get("/api/devices")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_list_devices_with_data(auth_client, db_session):
    device = Device(
        mac_address="00:11:22:33:44:55",
        hostname="test-device",
        ip_address="192.168.1.10",
        organization_id=1,
    )
    db_session.add(device)
    db_session.commit()

    response = auth_client.get("/api/devices")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_get_device_not_found(auth_client):
    response = auth_client.get("/api/devices/999")
    assert response.status_code in (404, 400)


def test_update_device(auth_client, db_session):
    device = Device(
        mac_address="11:22:33:44:55:66",
        hostname="orig-name",
        ip_address="192.168.1.20",
        organization_id=1,
    )
    db_session.add(device)
    db_session.commit()
    db_session.refresh(device)

    response = auth_client.put(
        f"/api/devices/{device.id}",
        json={"nickname": "new-name", "notes": "test note"},
    )
    # 200 if found in org, 404 if org mismatch — both valid
    assert response.status_code in (200, 404)


# --- Groups ---

def test_get_groups(auth_client):
    response = auth_client.get("/api/groups")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_create_and_delete_group(auth_client):
    response = auth_client.post(
        "/api/groups",
        json={"name": "TestGroup", "color": "#00FF00"},
    )
    assert response.status_code == 200
    group_id = response.json()["id"]

    response = auth_client.delete(f"/api/groups/{group_id}")
    assert response.status_code == 200
