"""
Tests for authentication endpoints: login, me, change-password, logout.
All sync — uses TestClient from conftest.
"""
import pytest
from app.models.models import User, Organization, OrganizationMember
from app.core.auth_jwt import create_access_token


def _create_user(db_session, username="testuser", password="testpassword", is_admin=False):
    """Helper: create a real user with hashed password + org membership."""
    org = Organization(name="Auth Test Org", plan_tier="pro", default_language="en")
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)

    user = User(
        username=username,
        email=f"{username}@test.com",
        hashed_password=User.get_password_hash(password),
        is_admin=is_admin,
        full_name="Test User",
        preferred_language="en",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    member = OrganizationMember(user_id=user.id, organization_id=org.id, role="owner")
    db_session.add(member)
    db_session.commit()

    return user


# --- Login ---

def test_login_success(client, db_session):
    _create_user(db_session, "loginuser", "pass1234")
    response = client.post(
        "/api/auth/login",
        data={"username": "loginuser", "password": "pass1234"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client, db_session):
    _create_user(db_session, "wrongpwuser", "correctpass")
    response = client.post(
        "/api/auth/login",
        data={"username": "wrongpwuser", "password": "wrongpass"},
    )
    assert response.status_code in (401, 400)


def test_login_nonexistent_user(client):
    response = client.post(
        "/api/auth/login",
        data={"username": "ghost", "password": "nope"},
    )
    assert response.status_code in (401, 400)


# --- Get Me ---

def test_get_me_authenticated(auth_client):
    response = auth_client.get("/api/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testadmin"


def test_get_me_unauthenticated(client):
    response = client.get("/api/auth/me")
    assert response.status_code in (401, 403)


# --- Logout ---

def test_logout(auth_client):
    response = auth_client.post("/api/auth/logout")
    assert response.status_code == 200
