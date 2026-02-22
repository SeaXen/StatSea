import logging
from fastapi import APIRouter, Depends, Form, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas import defaults as schemas
from app.services.auth_service import AuthService
from app.api.deps import get_current_org_id
from app.core.auth_jwt import get_current_user
from app.models import models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post(
    "/login",
    response_model=schemas.Token,
    summary="Login",
)
def login(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = Form(False),
):
    user = AuthService.authenticate_user(db, form_data.username, form_data.password)
    return AuthService.create_session(db, user, remember_me)


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
