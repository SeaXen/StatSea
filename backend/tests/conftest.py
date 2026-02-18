import sys
from unittest.mock import MagicMock

# Mock scapy before it's imported anywhere
sys.modules["scapy"] = MagicMock()
sys.modules["scapy.all"] = MagicMock()
sys.modules["scapy.layers.inet"] = MagicMock()
sys.modules["scapy.layers.dns"] = MagicMock()

import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
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
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    autocommit=False, autoflush=False, bind=engine, expire_on_commit=False
)

# @pytest_asyncio.fixture(scope="session")
# def event_loop():
#     loop = asyncio.get_event_loop_policy().new_event_loop()
#     yield loop
#     loop.close()

@pytest.fixture(scope="session", autouse=True)
def mock_services():
    """Mock background services to prevent them from running during tests."""
    # Mock start/stop methods
    global_collector.start = MagicMock()
    global_collector.stop = MagicMock()
    
    monitor.start = MagicMock()
    monitor.stop = MagicMock()
    
    system_monitor.start = MagicMock()
    system_monitor.stop = MagicMock()
    
    docker_monitor.start = MagicMock()
    docker_monitor.stop = MagicMock()
    
    # Scheduler needs special handling
    if hasattr(scheduler, "scheduler"):
        scheduler.scheduler.start = MagicMock()
        scheduler.scheduler.shutdown = MagicMock()
    else:
        # If the attribute doesn't exist yet (mocked?), just ensure methods exist
        scheduler.scheduler = MagicMock()
    
    scheduler.update_scheduler_from_db = MagicMock()
    
    # Force disabling SCAPY_AVAILABLE in collector module if possible
    # (Thoughsys.modules patch should handle the import)

@pytest_asyncio.fixture(scope="function")
async def db_session():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestingSessionLocal() as session:
        yield session
    
    # Drop tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture(scope="function")
async def client(db_session):
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest_asyncio.fixture(scope="function")
async def auth_client(client):
    # Retrieve the admin user created by seed_admin or create one
    # Note: seed_admin in main.py runs on import, but separate DB session.
    # We need to ensure the user exists in the *test* DB session.
    from app.models.models import User
    from app.core.auth_jwt import create_access_token
    
    # Create admin user in test DB
    admin = User(
        username="testadmin",
        email="testadmin@example.com",
        hashed_password="hashedpassword",
        is_admin=True,
        full_name="Test Admin"
    )
    # We must use the session associated with the client override
    # But client fixture sets dependency override. 
    # db_session fixture yields a session.
    # We need to add to that session.
    # However, db_session fixture yields the session object, but 'client' wraps it.
    # Ideally we should accept db_session here.
    pass

# Redefine auth_client to correctly access db_session
@pytest_asyncio.fixture(scope="function")
async def auth_client(client, db_session):
    from app.models.models import User
    from app.core.auth_jwt import create_access_token
    
    admin = User(
        username="testadmin",
        email="testadmin@example.com",
        hashed_password="hashedpassword",
        is_admin=True,
        full_name="Test Admin"
    )
    db_session.add(admin)
    await db_session.commit()
    
    token = create_access_token({"sub": "testadmin"})
    client.headers["Authorization"] = f"Bearer {token}"
    yield client
