from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.models import models
from app.api.endpoints import get_current_org_id, get_current_user
from app.services.notification_service import NotificationService
from app.services.status_page_service import StatusPageService

# Notifications Router
notifications_router = APIRouter()

class ChannelCreate(BaseModel):
    name: str
    type: str
    config: dict
    events: list[str] = ["*"]

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
    channels = NotificationService.list_channels(db, organization_id)
    return [
        {"id": c.id, "name": c.name, "type": c.type, "enabled": c.is_enabled}
        for c in channels
    ]

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
