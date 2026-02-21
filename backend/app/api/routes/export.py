import csv
import io
import json
from datetime import datetime
from fastapi import APIRouter, Depends, Query, Response, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models import models
from app.core.auth_jwt import get_current_user, get_current_admin_user
from app.api.deps import get_current_org_id

router = APIRouter(prefix="/export", tags=["Export"])

def _generate_csv(data: list[dict]):
    if not data:
        return ""
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=data[0].keys())
    writer.writeheader()
    for row in data:
        writer.writerow(row)
    return output.getvalue()

@router.get("/devices")
def export_devices(
    format: str = Query("csv", pattern="^(csv|json)$"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    organization_id: int = Depends(get_current_org_id),
):
    devices = db.query(models.Device).filter(models.Device.organization_id == organization_id).all()
    
    data = []
    for d in devices:
        data.append({
            "id": d.id,
            "mac_address": d.mac_address,
            "ip_address": d.ip_address,
            "hostname": d.hostname,
            "vendor": d.vendor,
            "type": d.type,
            "is_online": d.is_online,
            "first_seen": d.first_seen.isoformat() if d.first_seen else None,
            "last_seen": d.last_seen.isoformat() if d.last_seen else None,
        })
        
    if format == "json":
        return Response(content=json.dumps(data, indent=2), media_type="application/json")
    
    return Response(content=_generate_csv(data), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="devices.csv"'})

@router.get("/audit-logs")
def export_audit_logs(
    format: str = Query("csv", pattern="^(csv|json)$"),
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    organization_id = admin_user.organization_id
    
    query = db.query(models.AuditLog)
    if organization_id:
        query = query.filter(models.AuditLog.organization_id == organization_id)
        
    logs = query.order_by(models.AuditLog.timestamp.desc()).limit(10000).all()
    
    data = []
    for log in logs:
        data.append({
            "id": log.id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "actor_id": log.actor_id,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": log.details,
            "organization_id": log.organization_id
        })
        
    if format == "json":
        return Response(content=json.dumps(data, indent=2), media_type="application/json")
    
    return Response(content=_generate_csv(data), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="audit_logs.csv"'})
