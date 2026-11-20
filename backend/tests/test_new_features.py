from types import SimpleNamespace

import pytest

from app.core.scheduler import _evaluate_condition, _parse_condition
from app.models import models
from app.services.backup_service import restore_backup


def test_condition_evaluator_accepts_legacy_rule_names_and_rejects_injection():
    row = SimpleNamespace(download_bytes=900_000, upload_bytes=10, protocol="HTTP", app_category="Web")
    assert _evaluate_condition("bytes > 500000 && proto == 'HTTP'", row) is True
    assert _evaluate_condition("download_bytes > 1000000", row) is False
    with pytest.raises(ValueError):
        _parse_condition("__import__('os').system('id') == 0")
    with pytest.raises(ValueError):
        _parse_condition("unknown_field > 1")


def test_resolve_alert_endpoint(auth_client, db_session):
    org = db_session.query(models.Organization).first()
    alert = models.SecurityAlert(
        title="Test", description="desc", severity="warning",
        organization_id=org.id, is_resolved=False,
    )
    db_session.add(alert)
    db_session.commit()
    db_session.refresh(alert)

    response = auth_client.patch(f"/api/alerts/{alert.id}/resolve")
    assert response.status_code == 200
    assert response.json()["is_resolved"] is True
    assert auth_client.patch("/api/alerts/999999/resolve").status_code == 404


def test_report_settings_roundtrip(auth_client):
    current = auth_client.get("/api/reports/settings")
    assert current.status_code == 200
    assert "reports_frequency" in current.json()

    updated = auth_client.post("/api/reports/settings", json={"reports_frequency": "daily"})
    assert updated.status_code == 200
    assert auth_client.get("/api/reports/settings").json()["reports_frequency"] == "daily"
    assert auth_client.post(
        "/api/reports/settings", json={"reports_frequency": "yearly"}
    ).status_code == 422


def test_restore_rejects_path_outside_backup_dir(db_session):
    record = models.BackupRecord(
        filename="evil.gz", file_path="/etc/passwd", size_bytes=1
    )
    db_session.add(record)
    db_session.commit()
    db_session.refresh(record)

    with pytest.raises(ValueError):
        restore_backup(db_session, record.id)
