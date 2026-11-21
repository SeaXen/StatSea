"""Regression tests for device history and certificate alert argument order."""

from datetime import date, datetime, timezone

from app.models.models import (
    Device,
    DeviceDailySummary,
    MonitoredCertificate,
    Organization,
    TrafficLog,
)
from app.services.analytics_service import AnalyticsService
from app.services.certificate_service import CertificateMonitor


def test_device_history_returns_persisted_summaries(db_session):
    org = Organization(name="History Org", plan_tier="pro", default_language="en")
    db_session.add(org)
    db_session.commit()
    device = Device(mac_address="aa:bb:cc:dd:ee:ff", organization_id=org.id)
    db_session.add(device)
    db_session.commit()
    db_session.add(
        DeviceDailySummary(
            device_id=device.id, date=date(2026, 1, 1), upload_bytes=10, download_bytes=20
        )
    )
    db_session.add(
        TrafficLog(
            device_id=device.id,
            timestamp=datetime(2026, 1, 1, 10, 3, tzinfo=timezone.utc),
            upload_bytes=5,
            download_bytes=7,
        )
    )
    db_session.commit()

    result = AnalyticsService.get_device_history(db_session, "aa:bb:cc:dd:ee:ff", org.id)

    assert result["daily"] == [{"date": "2026-01-01", "download": 20, "upload": 10}]
    assert result["monthly"] == []
    assert result["hourly"] == [{"time": "10:00", "download": 7, "upload": 5}]
    assert result["five_minute"] == [{"time": "10:00", "download": 7, "upload": 5}]


def test_device_history_unknown_mac_is_empty(db_session):
    result = AnalyticsService.get_device_history(db_session, "no:such:mac", None)
    assert result["daily"] == []


def test_certificate_alert_uses_correct_argument_order(db_session, monkeypatch):
    org = Organization(name="Cert Org", plan_tier="pro", default_language="en")
    db_session.add(org)
    db_session.commit()
    cert = MonitoredCertificate(
        domain="example.com",
        port=443,
        organization_id=org.id,
        is_active=True,
    )
    db_session.add(cert)
    db_session.commit()

    calls = []
    monkeypatch.setattr(
        "app.services.notification_service.NotificationService.send_alert",
        lambda db, org_id, title, description, severity="INFO": calls.append(
            (db, org_id, title, description, severity)
        ),
    )
    monkeypatch.setattr(
        CertificateMonitor,
        "get_certificate_details",
        staticmethod(lambda domain, port: {"error": "DNS Resolution Failed: nope"}),
    )

    CertificateMonitor.check_all_certificates(db_session)

    assert len(calls) == 1
    assert calls[0][1] == org.id
    assert calls[0][2] == "Certificate Check Failed"
