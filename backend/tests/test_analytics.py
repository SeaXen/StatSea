import pytest
from app.models.models import BandwidthHistory, DnsLog

@pytest.mark.asyncio
async def test_network_history(auth_client, db_session):
    # Add history data
    history = BandwidthHistory(upload_bytes=1000, download_bytes=2000)
    db_session.add(history)
    await db_session.commit()

    response = await auth_client.get("/api/v1/network/history")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[-1]["upload"] == 1000

@pytest.mark.asyncio
async def test_topology(auth_client, db_session):
    response = await auth_client.get("/api/v1/network/topology")
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "edges" in data
    assert any(n["id"] == "router" for n in data["nodes"])

@pytest.mark.asyncio
async def test_dns_logs(auth_client, db_session):
    log = DnsLog(ip_address="192.168.1.10", domain="google.com", query_type="A")
    db_session.add(log)
    await db_session.commit()

    response = await auth_client.get("/api/v1/analytics/dns-logs")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["domain"] == "google.com"

@pytest.mark.asyncio
async def test_device_logs(auth_client, db_session):
    # This assumes we have a device for the foreign key if needed
    # but the current model might allow null device_id if not strictly enforced in test db
    response = await auth_client.get("/api/v1/analytics/device-logs")
    assert response.status_code == 200
