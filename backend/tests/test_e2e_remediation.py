"""
End-to-End Remediation Integration Tests for StatSea.
Verifies Security Hardening, SQLite WAL, Telemetry Transparency, and Token Refresh APIs.
"""

from sqlalchemy import text

from app.core.collector import global_collector
from app.db.database import engine


def test_cors_security(client):
    """Verify CORS preflight only permits allowed local origins."""
    # Test valid origin
    resp = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"

    # Test unauthorized external origin
    unauthorized = client.options(
        "/api/health",
        headers={
            "Origin": "https://malicious-attacker.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert unauthorized.headers.get("access-control-allow-origin") != "https://malicious-attacker.com"


def test_sqlite_wal_pragma():
    """Verify SQLite connection hook enforces WAL journal mode and busy_timeout."""
    with engine.connect() as conn:
        journal_mode = conn.execute(text("PRAGMA journal_mode;")).scalar()
        busy_timeout = conn.execute(text("PRAGMA busy_timeout;")).scalar()
        assert str(journal_mode).lower() in ("wal", "memory")
        assert busy_timeout >= 5000


def test_synthetic_telemetry_flag():
    """Verify telemetry engine tracks driver state (synthetic vs live hardware)."""
    stats = global_collector.get_current_stats()
    assert "is_synthetic" in stats
    assert isinstance(stats["is_synthetic"], bool)
    assert stats["is_synthetic"] == global_collector.is_synthetic


def test_refresh_token_json_body(auth_client):
    """Verify POST /api/auth/refresh accepts JSON body schema."""
    # Invalid token in JSON body should return 401, not 422 Unprocessable Entity
    resp = auth_client.post(
        "/api/auth/refresh",
        json={"refresh_token": "invalid_test_refresh_token"},
    )
    assert resp.status_code == 401
    assert "detail" in resp.json()
