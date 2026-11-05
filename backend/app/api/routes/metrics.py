import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.auth_jwt import get_current_user
from app.core.limiter import limiter
from app.core.metrics import metrics_manager
from app.models import models

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Metrics & Observability"])

@router.get(
    "/metrics",
    summary="Get system metrics",
    description="Retrieve in-memory performance and usage metrics.",
)
def get_metrics(current_user: models.User = Depends(get_current_user)):
    """Exposes internal metrics similar to a Prometheus endpoint."""
    return metrics_manager.get_metrics()


@router.post(
    "/client-errors",
    summary="Report client error",
    description="Endpoint for the frontend to report unhandled exceptions or render errors.",
)
@limiter.limit("20/minute")
async def report_client_error(
    request: Request,
    current_user: models.User = Depends(get_current_user),
):
    """Logs client-side errors reported by the frontend with auth, rate limits and body cap."""
    body = await request.body()
    if len(body) > 4096:
        raise HTTPException(status_code=413, detail="Payload too large (max 4KB)")
    try:
        data = json.loads(body.decode("utf-8"))
        logger.error(
            "Frontend Client Error",
            extra={
                "client_error": data,
                "event_type": "CLIENT_ERROR",
                "reporter_user": current_user.username,
            }
        )
        return {"status": "logged"}
    except (json.JSONDecodeError, UnicodeDecodeError):
        logger.warning("Received invalid JSON for client error report")
        return {"status": "error", "message": "Invalid JSON"}
    except Exception as e:
        logger.error(f"Failed to process client error report: {e}")
        return {"status": "error", "message": "Internal error processing report"}

