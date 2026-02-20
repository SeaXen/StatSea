import sys
from unittest.mock import MagicMock, AsyncMock

# Mock scapy before it's imported anywhere
sys.modules["scapy"] = MagicMock()
sys.modules["scapy.all"] = MagicMock()
sys.modules["scapy.layers.inet"] = MagicMock()
sys.modules["scapy.layers.dns"] = MagicMock()

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Now imports are safe
from app.main import app
from app.db.database import Base, get_db
from app.core.collector import global_collector
from app.core.monitor import monitor
from app.core.system_monitor import system_monitor
from app.core.docker_monitor import docker_monitor
from app.core.scheduler import scheduler

# Use in-memory SQLite for testing
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def mock_services():
    """Mock background services to prevent them from running during tests.
    
    CRITICAL: monitor.start() is async (called with `await` in lifespan),
    so it MUST use AsyncMock. Using MagicMock causes `await MagicMock()`
    to hang forever, freezing all tests.
    """
    global_collector.start = MagicMock()
    global_collector.stop = MagicMock()

    # monitor.start is ASYNC — must use AsyncMock!
    monitor.start = AsyncMock()
    monitor.stop = MagicMock()

    system_monitor.start = MagicMock()
    system_monitor.stop = MagicMock()

    docker_monitor.start = MagicMock()
    docker_monitor.stop = MagicMock()

    if hasattr(scheduler, "scheduler"):
        scheduler.scheduler.start = MagicMock()
        scheduler.scheduler.shutdown = MagicMock()
    else:
        scheduler.scheduler = MagicMock()

    scheduler.update_scheduler_from_db = MagicMock()


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def auth_client(client, db_session):
    from app.models.models import User, Organization, OrganizationMember
    from app.core.auth_jwt import create_access_token

    # 1. Create Organization
    org = Organization(name="Test Org", plan_tier="pro", default_language="en")
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)

    # 2. Create User
    admin = User(
        username="testadmin",
        email="testadmin@example.com",
        hashed_password="hashedpassword",
        is_admin=True,
        full_name="Test Admin",
        preferred_language="en",
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)

    # 3. Add User to Org
    member = OrganizationMember(
        user_id=admin.id, organization_id=org.id, role="owner"
    )
    db_session.add(member)
    db_session.commit()

    token = create_access_token({"sub": "testadmin"})
    client.headers["Authorization"] = f"Bearer {token}"
    yield client
