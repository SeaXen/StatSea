import pytest
from app.core.auth_jwt import create_access_token
from app.models.models import User
from app.services.auth_service import AuthService

@pytest.mark.asyncio
async def test_login_success(client, db_session):
    # Prepare admin user
    user = User(
        username="testadmin",
        hashed_password=User.get_password_hash("testpassword"),
        is_admin=True,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    
    response = await client.post(
        "/auth/login",
        data={"username": "testadmin", "password": "testpassword"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_login_wrong_password(client, db_session):
    user = User(
        username="testuser",
        hashed_password=User.get_password_hash("testpassword"),
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    
    response = await client.post(
        "/auth/login",
        data={"username": "testuser", "password": "wrongpassword"}
    )
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_get_current_user_unauthorized(client):
    response = await client.get("/devices")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_get_current_user_success(client, db_session):
    user = User(
        username="authuser",
        hashed_password="...",
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    token = create_access_token(data={"sub": user.username})
    headers = {"Authorization": f"Bearer {token}"}
    
    response = await client.get("/devices", headers=headers)
    assert response.status_code == 200
