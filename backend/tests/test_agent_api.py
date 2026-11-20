import uuid

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_org_id, get_current_user
from app.db.database import get_db
from app.main import app
from app.models.models import Organization


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

    def override_get_current_org_id():
        return org.id

    # Agent routes are organization-scoped; the mocked user has no DB membership.
    org = Organization(name="Agent Test Org", plan_tier="pro", default_language="en")
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_org_id] = override_get_current_org_id
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


def test_get_agents_is_org_scoped(agent_client, db_session):
    """A caller must never see another organization's agents."""
    from app.models.models import AgentNode

    other_org = Organization(name="Other Org", plan_tier="pro", default_language="en")
    db_session.add(other_org)
    db_session.commit()
    db_session.refresh(other_org)

    db_session.add(AgentNode(
        id=str(uuid.uuid4()),
        name="Other Org Agent",
        api_key_hash="x",
        organization_id=other_org.id,
        status="offline",
    ))
    db_session.commit()
    agent_client.post("/api/agents/", json={"name": "My Agent"})

    names = [a["name"] for a in agent_client.get("/api/agents/").json()]
    assert "My Agent" in names
    assert "Other Org Agent" not in names


def test_get_agents_without_membership_is_403(agent_client):
    """The real org dependency rejects users with no OrganizationMember."""
    app.dependency_overrides.pop(get_current_org_id)
    assert agent_client.get("/api/agents/").status_code == 403


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
