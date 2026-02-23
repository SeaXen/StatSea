import logging

from fastapi import APIRouter, Depends, Form, Query, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas import defaults as schemas
from app.services.auth_service import AuthService
from app.api.deps import get_current_org_id, check_admin
from app.core.auth_jwt import get_current_user
from app.models import models

logger = logging.getLogger(__name__)

from app.core.limiter import limiter

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post(
    "/login",
    response_model=schemas.Token,
    summary="Login",
)
@limiter.limit("5/minute")
def login(
    request: Request,
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = Form(False),
):
    user = AuthService.authenticate_user(db, form_data.username, form_data.password)
    user_agent = request.headers.get("User-Agent")
    ip_address = request.client.host if request.client else None
    return AuthService.create_session(
        db, user, remember_me, user_agent=user_agent, ip_address=ip_address
    )


@router.post(
    "/refresh",
    response_model=schemas.Token,
    summary="Refresh Token",
)
def refresh_token(
    refresh_token: str = Query(...),
    db: Session = Depends(get_db),
):
    return AuthService.refresh_session(db, refresh_token)


@router.post(
    "/logout",
    summary="Logout",
)
def logout(
    logout_req: schemas.LogoutRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    AuthService.logout(db, logout_req.refresh_token)
    return {"status": "success"}


@router.get(
    "/me",
    response_model=schemas.User,
    summary="Get current user",
)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@router.get("/sessions", response_model=list[schemas.SessionResponse])
def list_my_sessions(
    current_token: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    List all active sessions for the current user.
    """
    sessions = AuthService.get_active_sessions(db, current_user.id)
    
    # Map to schemas and set is_current flag
    response = []
    for s in sessions:
        session_dict = schemas.SessionResponse.model_validate(s).model_dump()
        session_dict["is_current"] = (s.token == current_token)
        response.append(session_dict)
        
    return response

@router.post("/sessions/revoke-others")
def revoke_other_sessions(
    request: schemas.LogoutRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Revoke all other active sessions for the current user.
    """
    if not request.refresh_token:
        # If not provided, we can't identify the current session to exclude it
        # However, typically the client should know its current refresh token
        return {"status": "error", "message": "Current refresh token required"}
        
    AuthService.revoke_other_sessions(db, current_user.id, request.refresh_token)
    return {"status": "success"}

@router.get("/push-config")
def get_push_config(current_user: models.User = Depends(get_current_user)):
    """
    Get VAPID public key for push notifications.
    """
    from app.core.config import settings
    return {
        "publicKey": settings.VAPID_PUBLIC_KEY
    }

@router.post("/push-subscribe", status_code=201)
def subscribe_push(
    subscription: schemas.PushSubscriptionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Register a new push subscription for the current user.
    """
    # Check if this endpoint already exists for this user
    existing = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == subscription.endpoint
    ).first()
    
    import json
    keys_json = json.dumps(subscription.keys)
    user_agent = request.headers.get("User-Agent")
    
    if existing:
        existing.keys = keys_json
        existing.user_id = current_user.id
        existing.user_agent = user_agent
    else:
        new_sub = models.PushSubscription(
            user_id=current_user.id,
            endpoint=subscription.endpoint,
            keys=keys_json,
            user_agent=user_agent
        )
        db.add(new_sub)
    
    db.commit()
    return {"status": "success"}

@router.post("/push-unsubscribe")
def unsubscribe_push(
    endpoint: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Remove a push subscription.
    """
    sub = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == endpoint,
        models.PushSubscription.user_id == current_user.id
    ).first()
    
    if sub:
        db.delete(sub)
        db.commit()
        
    return {"status": "success"}
