"""
Tests for analytics endpoints (network history, topology, dns logs, device logs).
All sync — uses TestClient from conftest.
"""
import pytest


def test_network_history(auth_client):
    response = auth_client.get("/api/network/history")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_network_topology(auth_client):
    response = auth_client.get("/api/network/topology")
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "edges" in data


def test_dns_logs(auth_client):
    response = auth_client.get("/api/analytics/dns-logs")
    assert response.status_code == 200
    assert "items" in response.json()


def test_device_logs(auth_client):
    response = auth_client.get("/api/analytics/device-logs")
    assert response.status_code == 200
    assert "items" in response.json()


def test_analytics_summary(auth_client):
    response = auth_client.get("/api/analytics/summary")
    assert response.status_code == 200


def test_usage_prediction(auth_client):
    response = auth_client.get("/api/analytics/prediction")
    assert response.status_code == 200


def test_usage_anomalies(auth_client):
    response = auth_client.get("/api/analytics/anomalies")
    assert response.status_code == 200
