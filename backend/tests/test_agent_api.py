import uuid
import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.db.database import get_db
from app.main import app


class MockUser:
    id = 1
    username = "admin"
    is_admin = True
    must_change_password = False
    token_version = 1


@pytest.fixture
def agent_client(db_session):
    def override_get_db():
        yield db_session

    def override_get_current_user():
        return MockUser()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_register_agent(agent_client):
    response = agent_client.post("/api/agents/", json={"name": "Test Agent 1"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Agent 1"
    assert "id" in data
    assert "api_key" in data  # API key should be returned once
    assert data["status"] == "offline"


def test_get_agents(agent_client):
    # Register an agent first
    agent_client.post("/api/agents/", json={"name": "Test Agent 2"})

    response = agent_client.get("/api/agents/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["name"] == "Test Agent 2"
    assert data[0].get("api_key") is None  # API key should NOT be returned (should be null) in GET


def test_submit_metrics(agent_client):
    # 1. Register agent
    reg_response = agent_client.post("/api/agents/", json={"name": "Metric Agent"})
    agent_data = reg_response.json()
    agent_id = agent_data["id"]
    api_key = agent_data["api_key"]

    # 2. Submit metrics using the API key
    metrics = {
        "cpu_pct": 45.2,
        "mem_usage": 1024.5,
        "disk_usage": 80.0,
        "net_rx": 1000,
        "net_tx": 500,
    }

    response = agent_client.post(
        f"/api/agents/{agent_id}/metrics",
        json=metrics,
        headers={"X-Agent-Key": api_key},
    )

    assert response.status_code == 201
    assert response.json() == {"status": "success"}

    # 3. Verify agent status changed to online
    get_response = agent_client.get("/api/agents/")
    updated_agent = next(a for a in get_response.json() if a["id"] == agent_id)
    assert updated_agent["status"] == "online"


def test_submit_metrics_invalid_auth(agent_client):
    # Register agent
    reg_response = agent_client.post("/api/agents/", json={"name": "Rogue Agent"})
    agent_id = reg_response.json()["id"]

    metrics = {"cpu_pct": 0, "mem_usage": 0, "disk_usage": 0}

    # Try with wrong key
    response = agent_client.post(
        f"/api/agents/{agent_id}/metrics",
        json=metrics,
        headers={"X-Agent-Key": "wrong-key"},
    )
    assert response.status_code == 401


def test_submit_metrics_wrong_agent_id(agent_client):
    reg_response = agent_client.post("/api/agents/", json={"name": "Agent A"})
    api_key = reg_response.json()["api_key"]

    fake_id = str(uuid.uuid4())
    metrics = {"cpu_pct": 0, "mem_usage": 0, "disk_usage": 0}

    response = agent_client.post(
        f"/api/agents/{fake_id}/metrics",
        json=metrics,
        headers={"X-Agent-Key": api_key},
    )
    # The dependency authenticates the key, but the route checks if agent.id == fake_id
    assert response.status_code == 403
