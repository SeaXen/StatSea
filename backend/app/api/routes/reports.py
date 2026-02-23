from fastapi import APIRouter, Depends, HTTPException, Path, Response, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api import deps
from app.models import models
from app.services.report_service import report_service
from datetime import datetime

router = APIRouter(prefix="/reports", tags=["Reports & Export"])

@router.get("/export/{resource}")
def export_data(
    resource: str,
    format: str = Query("csv", pattern="^(csv|json)$"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Export raw network data in CSV or JSON format.
    Valid resources: devices, dns_logs, traffic_logs, speedtests, alerts
    """
    if format == "csv":
        data = report_service.export_to_csv(db, resource)
        if data is None:
            raise HTTPException(status_code=400, detail="Invalid resource for export")
        
        filename = f"statsea_{resource}_{datetime.now().strftime('%Y%m%d')}.csv"
        return Response(
            content=data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    else:
        data = report_service.export_to_json(db, resource)
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
    report_type: str = Path(..., pattern="^(weekly|monthly)$"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Generate and download a summary PDF report (Weekly or Monthly).
    """
    try:
        pdf_content = report_service.generate_pdf_report(db, report_type)
        filename = f"statsea_{report_type}_report_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
