from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.models import models
from app.api.deps import get_current_org_id
from app.core.auth_jwt import get_current_user
from app.services.notification_service import NotificationService
from app.services.status_page_service import StatusPageService

from app.schemas.notification_schemas import ChannelCreate, ChannelUpdate

# Notifications Router
notifications_router = APIRouter(tags=["Notifications"])

@notifications_router.post("/channels")
def create_channel(
    req: ChannelCreate,
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    channel = NotificationService.create_channel(
        db, organization_id, req.name, req.type, req.config, req.events
    )
    return {"id": channel.id, "name": channel.name, "status": "created"}

@notifications_router.get("/channels")
def list_channels(
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    import json
    channels = NotificationService.list_channels(db, organization_id)
    return [
        {
            "id": c.id, 
            "name": c.name, 
            "type": c.type, 
            "enabled": c.is_enabled,
            "config": json.loads(c.config),
            "events": json.loads(c.events)
        }
        for c in channels
    ]

@notifications_router.patch("/channels/{channel_id}")
def update_channel(
    channel_id: int,
    req: ChannelUpdate,
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        channel = NotificationService.update_channel(
            db, 
            channel_id, 
            name=req.name, 
            config=req.config, 
            events=req.events, 
            is_enabled=req.is_enabled
        )
        return {"id": channel.id, "status": "updated"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@notifications_router.delete("/channels/{channel_id}")
def delete_channel(
    channel_id: int,
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    NotificationService.delete_channel(db, channel_id)
    return {"status": "deleted"}

@notifications_router.post("/channels/{channel_id}/test")
def test_channel(
    channel_id: int,
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        NotificationService.test_channel(db, channel_id)
        return {"status": "test_sent"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send test: {str(e)}")

class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: dict
    user_agent: str = None

@notifications_router.post("/push/subscribe", status_code=status.HTTP_201_CREATED)
def subscribe_push(
    sub: PushSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    import json
    
    # Check if exists
    existing = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == sub.endpoint
    ).first()
    
    if existing:
        # Update user if different? Or just return success
        if existing.user_id != current_user.id:
            existing.user_id = current_user.id
            db.commit()
        return {"status": "updated"}
        
    new_sub = models.PushSubscription(
        user_id=current_user.id,
        endpoint=sub.endpoint,
        keys=json.dumps(sub.keys),
        user_agent=sub.user_agent
    )
    db.add(new_sub)
    db.commit()
    return {"status": "subscribed"}

# Status Page Router (Internal Management)
status_page_router = APIRouter()

class StatusPageUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    is_public: Optional[bool] = None
    description: Optional[str] = None

@status_page_router.get("/settings")
def get_status_page_settings(
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    settings = StatusPageService.get_settings(db, organization_id)
    return {
        "title": settings.title,
        "slug": settings.slug,
        "is_public": settings.is_public,
        "description": settings.description,
        "public_url": f"/status/{settings.slug}" # Logic to be handled by frontend/main routing
    }

@status_page_router.patch("/settings")
def update_status_page(
    req: StatusPageUpdate,
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        updated = StatusPageService.update_settings(
            db, organization_id, req.title, req.slug, req.is_public, req.description
        )
        return {"status": "updated", "slug": updated.slug}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Public Status Page Router (No Auth)
public_status_router = APIRouter()

@public_status_router.get("/{slug}")
def get_public_status_page(
    slug: str,
    db: Session = Depends(get_db)
):
    data = StatusPageService.get_public_status(db, slug)
    if not data:
        raise HTTPException(status_code=404, detail="Status page not found")
    return data

from app.schemas.defaults import CertificateCreate, CertificateUpdate, CertificateResponse
from app.services.certificate_service import CertificateMonitor
from datetime import datetime, timezone

certificates_router = APIRouter(tags=["Certificates"])

@certificates_router.post("", response_model=CertificateResponse)
def create_certificate(
    req: CertificateCreate,
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    cert = models.MonitoredCertificate(**req.dict(), organization_id=organization_id)
    db.add(cert)
    db.commit()
    db.refresh(cert)
    
    # Trigger an immediate check in the background or synchronously
    details = CertificateMonitor.get_certificate_details(cert.domain, cert.port)
    if "error" in details:
        cert.error_message = details["error"]
    else:
        cert.expiration_date = details["expiration_date"]
        cert.issuer = details.get("issuer", "Unknown")
        cert.error_message = None
        delta = cert.expiration_date - datetime.now(timezone.utc)
        cert.days_until_expiration = delta.days
    cert.last_checked = datetime.now(timezone.utc)
    db.commit()
    db.refresh(cert)
    
    return cert

@certificates_router.get("", response_model=list[CertificateResponse])
def get_certificates(
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.MonitoredCertificate).filter(
        models.MonitoredCertificate.organization_id == organization_id
    ).all()

@certificates_router.patch("/{cert_id}", response_model=CertificateResponse)
def update_certificate(
    cert_id: int,
    req: CertificateUpdate,
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    cert = db.query(models.MonitoredCertificate).filter(
        models.MonitoredCertificate.id == cert_id,
        models.MonitoredCertificate.organization_id == organization_id
    ).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
        
    for k, v in req.dict(exclude_unset=True).items():
        setattr(cert, k, v)
        
    db.commit()
    db.refresh(cert)
    return cert

@certificates_router.delete("/{cert_id}")
def delete_certificate(
    cert_id: int,
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    cert = db.query(models.MonitoredCertificate).filter(
        models.MonitoredCertificate.id == cert_id,
        models.MonitoredCertificate.organization_id == organization_id
    ).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
        
    db.delete(cert)
    db.commit()
    return {"status": "deleted"}
