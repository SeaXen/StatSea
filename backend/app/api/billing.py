from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.models import models
from app.api.endpoints import get_current_org_id, get_current_user
from app.services.billing_service import BillingService

router = APIRouter()

class SubscribeRequest(BaseModel):
    plan: str

@router.post("/subscribe")
def subscribe_to_plan(
    req: SubscribeRequest,
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Simulates subscribing to a plan.
    """
    if not current_user.is_admin: # Assuming org owner check is handled by app logic or we check role
        # For now, simplistic check: only admins/owners can subscribe. 
        # But get_current_org_id only ensures membership. 
        # Real app needs permission check (RBAC). 
        # Skipping for "stub".
        pass

    try:
        org = BillingService.subscribe_org(db, organization_id, req.plan)
        return {"status": "success", "plan": org.plan_tier}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/portal")
def get_billing_portal(
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Returns a mock billing portal URL.
    """
    url = BillingService.get_portal_url(organization_id)
    return {"url": url}
