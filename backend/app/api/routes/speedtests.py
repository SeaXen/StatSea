import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.api.deps import get_current_org_id
from app.core.auth_jwt import get_current_user
from app.models import models
from app.core.speedtest_service import speedtest_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/speedtest", tags=["Speedtest"])

@router.get(
    "/",
    summary="Get speedtest history",
)
def get_speedtest_history(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Fetch history directly since no specific service method existed
    results = (
        db.query(models.SpeedtestResult)
        .order_by(models.SpeedtestResult.timestamp.desc())
        .limit(limit)
        .all()
    )
    return results


@router.post(
    "/",
    summary="Run speedtest",
)
async def run_speedtest(
    provider: str = "ookla",
    server_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Pass execution to the existing core speedtest service
    result = await speedtest_service.run_speedtest(
        db=db, server_id=server_id, provider=provider
    )
    return result
