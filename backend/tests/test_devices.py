import pytest
from app.models.models import Device, DeviceGroup

@pytest.mark.asyncio
async def test_list_devices(auth_client, db_session):
    # Add a test device
    device = Device(mac_address="00:11:22:33:44:55", hostname="test-device", ip_address="192.168.1.10")
    db_session.add(device)
    await db_session.commit()

    response = await auth_client.get("/api/v1/devices")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(d["mac_address"] == "00:11:22:33:44:55" for d in data)

@pytest.mark.asyncio
async def test_get_device(auth_client, db_session):
    device = Device(mac_address="AA:BB:CC:DD:EE:FF", hostname="detail-device")
    db_session.add(device)
    await db_session.commit()
    await db_session.refresh(device)

    response = await auth_client.get(f"/api/v1/devices/{device.id}")
    assert response.status_code == 200
    assert response.json()["mac_address"] == "AA:BB:CC:DD:EE:FF"

@pytest.mark.asyncio
async def test_update_device(auth_client, db_session):
    device = Device(mac_address="11:22:33:44:55:66", hostname="old-name")
    db_session.add(device)
    await db_session.commit()
    await db_session.refresh(device)

    response = await auth_client.put(
        f"/api/v1/devices/{device.id}",
        json={"hostname": "new-name"}
    )
    assert response.status_code == 200
    assert response.json()["hostname"] == "new-name"

@pytest.mark.asyncio
async def test_device_groups(auth_client, db_session):
    # Create group
    response = await auth_client.post(
        "/api/v1/groups",
        json={"name": "Test Group", "color": "#FF0000"}
    )
    assert response.status_code == 200
    group_id = response.json()["id"]

    # List groups
    response = await auth_client.get("/api/v1/groups")
    assert response.status_code == 200
    assert any(g["name"] == "Test Group" for g in response.json())
