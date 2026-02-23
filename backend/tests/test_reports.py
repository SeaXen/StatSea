import pytest


API_PREFIX = "/api"


def test_export_devices_csv(auth_client):
    response = auth_client.get(
        f"{API_PREFIX}/reports/export/devices?format=csv"
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=statsea_devices_" in response.headers["content-disposition"]

def test_export_devices_json(auth_client):
    response = auth_client.get(
        f"{API_PREFIX}/reports/export/devices?format=json"
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert "attachment; filename=statsea_devices_" in response.headers["content-disposition"]

def test_generate_pdf_report_weekly(auth_client):
    response = auth_client.get(
        f"{API_PREFIX}/reports/pdf/weekly"
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment; filename=statsea_weekly_report_" in response.headers["content-disposition"]

def test_generate_pdf_report_monthly(auth_client):
    response = auth_client.get(
        f"{API_PREFIX}/reports/pdf/monthly"
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment; filename=statsea_monthly_report_" in response.headers["content-disposition"]

def test_export_invalid_resource(auth_client):
    response = auth_client.get(
        f"{API_PREFIX}/reports/export/invalid_resource?format=csv"
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid resource for export"

def test_export_invalid_format(auth_client):
    response = auth_client.get(
        f"{API_PREFIX}/reports/export/devices?format=xml"
    )
    assert response.status_code == 422  # Validation error
