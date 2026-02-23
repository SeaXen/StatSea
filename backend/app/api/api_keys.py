from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.db.database import get_db
from app.models import models
from app.api.deps import get_current_org_id
from app.core.auth_jwt import get_current_user
from app.services.api_key_service import ApiKeyService

router = APIRouter()

class CreateApiKeyRequest(BaseModel):
    name: str
    permissions: str = "read"

@router.post("/", response_model=dict)
def create_api_key(
    req: CreateApiKeyRequest,
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Create a new API key. Returns the raw key only once.
    """
    api_key, raw_key = ApiKeyService.generate_api_key(
        db, current_user.id, organization_id, req.name, req.permissions
    )
    return {
        "id": api_key.id,
        "name": api_key.name,
        "key": raw_key,
        "created_at": api_key.created_at
    }

@router.get("/", response_model=List[dict])
def list_api_keys(
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    keys = ApiKeyService.list_keys(db, organization_id)
    return [
        {
            "id": k.id,
            "name": k.name,
            "created_at": k.created_at,
            "last_used": k.last_used,
            "permissions": k.permissions
        } for k in keys
    ]

@router.delete("/{key_id}")
def revoke_api_key(
    key_id: int,
    organization_id: int = Depends(get_current_org_id),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    success = ApiKeyService.revoke_key(db, key_id, organization_id)
    if not success:
        raise HTTPException(status_code=404, detail="API Key not found")
    return {"status": "revoked"}
