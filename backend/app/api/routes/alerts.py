import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import models
from app.schemas import defaults as schemas
from app.core.auth_jwt import get_current_admin_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get(
    "",
    response_model=schemas.CursorPage[schemas.SecurityAlert],
    summary="Get alerts",
    description="Retrieve security alerts.",
)
async def get_alerts(
    severity: str = None,
    timeframe: str = None,
    cursor: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    query = db.query(models.SecurityAlert)
    if severity:
        severities = severity.upper().split(",")
        query = query.filter(models.SecurityAlert.severity.in_(severities))
    if timeframe:
        since = datetime.now(timezone.utc)
        if timeframe == "1h":
            since -= timedelta(hours=1)
        elif timeframe == "24h":
            since -= timedelta(hours=24)
        elif timeframe == "7d":
            since -= timedelta(days=7)
        elif timeframe == "30d":
            since -= timedelta(days=30)
        query = query.filter(models.SecurityAlert.timestamp >= since)
    
    if cursor is not None:
        query = query.filter(models.SecurityAlert.id < cursor)
        
    alerts = query.order_by(models.SecurityAlert.id.desc()).limit(limit).all()
    next_cursor = alerts[-1].id if len(alerts) == limit else None
    return schemas.CursorPage(items=alerts, next_cursor=next_cursor)


@router.get(
    "/rules",
    response_model=list[schemas.SecurityRule],
    summary="Get security rules",
    description="Retrieve all security alert rules.",
)
async def get_rules(
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    return db.query(models.SecurityRule).all()


@router.post(
    "/rules",
    response_model=schemas.SecurityRule,
    summary="Create a security rule",
)
async def create_rule(
    rule_in: schemas.SecurityRuleCreate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    rule = models.SecurityRule(**rule_in.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.put(
    "/rules/{rule_id}",
    response_model=schemas.SecurityRule,
    summary="Update a security rule",
)
async def update_rule(
    rule_id: int,
    rule_in: schemas.SecurityRuleUpdate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    rule = db.query(models.SecurityRule).filter(models.SecurityRule.id == rule_id).first()
    if not rule:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Rule not found")
        
    update_data = rule_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)
        
    db.commit()
    db.refresh(rule)
    return rule


@router.delete(
    "/rules/{rule_id}",
    summary="Delete a security rule",
)
async def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    rule = db.query(models.SecurityRule).filter(models.SecurityRule.id == rule_id).first()
    if not rule:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Rule not found")
        
    db.delete(rule)
    db.commit()
    return {"message": "Rule deleted successfully"}
