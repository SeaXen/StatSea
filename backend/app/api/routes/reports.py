import logging
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.services.email_service import EmailService
from app.core.auth_jwt import get_current_admin_user
from app.models import models

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/reports", tags=["Reports"])

class TestEmailRequest(BaseModel):
    to_email: str

@router.post(
    "/test-email",
    summary="Send test email",
    description="Trigger a test email for scheduled reports.",
)
@limiter.limit("3/minute")
def send_test_email(request: Request, payload: TestEmailRequest, admin_user: models.User = Depends(get_current_admin_user)):
    EmailService.send_daily_summary(payload.to_email)
    return {"status": "success", "message": f"Test email sent to {payload.to_email}"}
