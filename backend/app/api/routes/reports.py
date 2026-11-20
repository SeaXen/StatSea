from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api import deps
from app.core.auth_jwt import get_current_admin_user
from app.db.database import get_db
from app.models import models
from app.services.report_service import (
    get_report_settings,
    report_service,
    update_report_settings,
)

router = APIRouter(prefix="/reports", tags=["Reports & Export"])

# Frontend report-type IDs map onto the two PDF windows the report builder supports.
PDF_REPORT_TYPE_ALIASES = {
    "network_summary": "weekly",
    "security_audit": "monthly",
    "traffic": "weekly",
    "devices": "monthly",
}


class ReportSettingsUpdate(BaseModel):
    reports_email_enabled: bool | None = None
    reports_frequency: str | None = Field(default=None)

    @field_validator("reports_frequency")
    @classmethod
    def validate_frequency(cls, value: str | None) -> str | None:
        if value is not None and value not in ("daily", "weekly", "monthly"):
            raise ValueError("frequency must be one of daily, weekly, monthly")
        return value


@router.get("/settings")
def get_reports_settings(
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    """Return (and seed, on first read) the scheduled email report settings."""
    return get_report_settings(db)


@router.post("/settings")
def set_reports_settings(
    payload: ReportSettingsUpdate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    """Update the scheduled email report settings."""
    try:
        return update_report_settings(
            db,
            email_enabled=payload.reports_email_enabled,
            frequency=payload.reports_frequency,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.get("/export/{resource}")
def export_data(
    resource: str,
    format: str = Query("csv", pattern="^(csv|json)$"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
    organization_id: int = Depends(deps.get_current_org_id),
):
    """
    Export raw network data in CSV or JSON format.
    Valid resources: devices, dns_logs, traffic_logs, speedtests, alerts
    """
    if format == "csv":
        data = report_service.export_to_csv(db, resource, organization_id)
        if data is None:
            raise HTTPException(status_code=400, detail="Invalid resource for export")

        filename = f"statsea_{resource}_{datetime.now().strftime('%Y%m%d')}.csv"
        return Response(
            content=data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    else:
        data = report_service.export_to_json(db, resource, organization_id)
        if data is None:
            raise HTTPException(status_code=400, detail="Invalid resource for export")

        filename = f"statsea_{resource}_{datetime.now().strftime('%Y%m%d')}.json"
        return Response(
            content=data,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

@router.get("/pdf/{report_type}")
def get_pdf_report(
    report_type: str = Path(
        ..., pattern="^(weekly|monthly|network_summary|security_audit|traffic|devices)$"
    ),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
    organization_id: int = Depends(deps.get_current_org_id),
):
    """
    Generate and download a summary PDF report (Weekly or Monthly).
    Frontend report IDs are accepted as aliases for the two supported windows.
    """
    window = PDF_REPORT_TYPE_ALIASES.get(report_type, report_type)
    try:
        pdf_content = report_service.generate_pdf_report(db, window, organization_id)
        filename = f"statsea_{window}_report_{datetime.now().strftime('%Y%m%d')}.pdf"

        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}") from e
