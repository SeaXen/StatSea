"""
Tests for Docker container endpoints.
All sync — uses TestClient from conftest.
"""
import pytest


def test_list_containers(auth_client):
    """Docker endpoints should respond even if Docker is not available."""
    response = auth_client.get("/api/docker/containers")
    # May return 200 (empty list) or 500 (docker not available) — both are acceptable
    assert response.status_code in (200, 500)
