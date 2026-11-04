import logging
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.auth_jwt import get_current_user
from app.db.database import get_db
from app.models import models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/security", tags=["Security"])

class SecurityEvent(BaseModel):
    id: int
    timestamp: datetime
    event_type: str
    severity: str
    description: str
    source_ip: str
    resolved: bool

    model_config = ConfigDict(from_attributes=True)

@router.get(
    "/events",
    response_model=list[SecurityEvent],
    summary="Get security events",
)
def get_security_events(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Fetch latest security alerts to serve as events
    alerts = db.query(models.SecurityAlert).order_by(models.SecurityAlert.timestamp.desc()).limit(limit).all()
    events = []
    for alert in alerts:
        events.append(SecurityEvent(
            id=alert.id,
            timestamp=alert.timestamp,
            event_type=alert.title, # Mapping title to event_type
            severity=alert.severity.upper() if alert.severity else 'LOW',
            description=alert.description,
            source_ip="N/A", # default if we don't track source IP on the alert yet
            resolved=alert.is_resolved
        ))
    
    return events
