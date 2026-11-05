"""
RBAC & Security negative tests (P4-3):
- Non-admin blocked from admin-gated endpoints (403)
- Token revocation and token_version validation (401)
- Password rotation enforcement (must_change_password)
- Refresh token reuse detection
"""
from fastapi.testclient import TestClient
from app.core.auth_jwt import create_access_token
from app.models.models import Organization, OrganizationMember, RefreshToken, User
from app.services.auth_service import AuthService


def _create_regular_user(db_session, username="reguser", password="password123"):
    org = Organization(name=f"Org {username}", plan_tier="standard", default_language="en")
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)

    user = User(
        username=username,
        email=f"{username}@example.com",
        hashed_password=User.get_password_hash(password),
        is_admin=False,
        must_change_password=False,
        token_version=1,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    member = OrganizationMember(user_id=user.id, organization_id=org.id, role="member")
    db_session.add(member)
    db_session.commit()
    return user


def test_non_admin_blocked_from_admin_users_list(client, db_session):
    user = _create_regular_user(db_session, "plainuser")
    token = create_access_token({"sub": user.username}, token_version=user.token_version)
    client.headers["Authorization"] = f"Bearer {token}"

    response = client.get("/api/admin/users")
    assert response.status_code == 403


def test_non_admin_blocked_from_docker_logs(client, db_session):
    user = _create_regular_user(db_session, "plainuser2")
    token = create_access_token({"sub": user.username}, token_version=user.token_version)
    client.headers["Authorization"] = f"Bearer {token}"

    response = client.get("/api/docker/containers/dummy-container/logs")
    assert response.status_code == 403


def test_revoked_token_version_rejected(client, db_session):
    user = _create_regular_user(db_session, "revokeduser")
    # Issue token with version 1
    token = create_access_token({"sub": user.username}, token_version=1)
    # Increment user's token version in database
    user.token_version = 2
    db_session.commit()

    client.headers["Authorization"] = f"Bearer {token}"
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_must_change_password_blocks_normal_api(client, db_session):
    user = _create_regular_user(db_session, "forcechangeuser")
    user.must_change_password = True
    db_session.commit()

    token = create_access_token({"sub": user.username}, token_version=user.token_version)
    client.headers["Authorization"] = f"Bearer {token}"

    # Normal endpoint should be blocked
    response = client.get("/api/devices/")
    assert response.status_code == 403
    assert "Password rotation required" in response.json().get("detail", "")


def test_must_change_password_can_change_password(client, db_session):
    user = _create_regular_user(db_session, "mustchangeuser", "oldpass123")
    user.must_change_password = True
    db_session.commit()

    token = create_access_token({"sub": user.username}, token_version=user.token_version)
    client.headers["Authorization"] = f"Bearer {token}"

    # Can successfully call change-password
    response = client.post(
        "/api/auth/change-password",
        json={"current_password": "oldpass123", "new_password": "NewSecretPassword123!"},
    )
    assert response.status_code == 200

    # User in DB should now have must_change_password = False and incremented token_version
    db_session.refresh(user)
    assert user.must_change_password is False
    assert user.token_version == 2


def test_refresh_token_reuse_detection(client, db_session):
    user = _create_regular_user(db_session, "reuseuser", "password123")
    auth_service = AuthService()

    # Create session
    session_data = auth_service.create_session(db_session, user, False, "TestClient", "127.0.0.1")
    rt = session_data["refresh_token"]

    # Use refresh token once (valid rotation)
    rotated = auth_service.refresh_session(db_session, rt)
    assert rotated is not None

    # Re-use the old revoked refresh token -> must detect reuse and raise AuthenticationException
    import pytest
    from app.core.exceptions import AuthenticationException
    with pytest.raises(AuthenticationException):
        auth_service.refresh_session(db_session, rt)

    # All sessions for user should now be revoked
    active_sessions = db_session.query(RefreshToken).filter(
        RefreshToken.user_id == user.id, RefreshToken.is_revoked == False
    ).all()
    assert len(active_sessions) == 0
