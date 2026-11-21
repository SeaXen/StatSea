"""Regression tests for tenant-scoped audit export and admin password reset."""

from datetime import datetime, timedelta, timezone

from app.models.models import AuditLog, Organization, RefreshToken, User
from app.schemas.defaults import UserUpdate
from app.services.user_service import UserService


def test_export_audit_logs_scoped_to_org(auth_client, db_session):
    org = db_session.query(Organization).first()
    other = Organization(name="Other Org", plan_tier="pro", default_language="en")
    db_session.add(other)
    db_session.commit()
    db_session.add(AuditLog(action="LOGIN", resource_type="USER", organization_id=org.id))
    db_session.add(AuditLog(action="FOREIGN_ACTION", resource_type="USER", organization_id=other.id))
    db_session.commit()

    response = auth_client.get("/api/export/audit-logs")

    assert response.status_code == 200
    assert "LOGIN" in response.text
    assert "FOREIGN_ACTION" not in response.text


def test_admin_password_reset_revokes_existing_sessions(auth_client, db_session):
    user = db_session.query(User).filter_by(username="testadmin").one()
    token = RefreshToken(
        token="reset-test-token",
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    db_session.add(token)
    db_session.commit()
    old_version = user.token_version

    UserService.update_user(
        db_session, user.id, UserUpdate(password="NewPass123!"), actor_id=user.id
    )

    db_session.refresh(user)
    db_session.refresh(token)
    assert user.token_version == old_version + 1
    assert token.is_revoked is True
