import logging
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request

from app.models import models
from app.core.auth_jwt import get_current_user
from app.core.metrics import metrics_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Metrics & Observability"])

@router.get(
    "/metrics",
    summary="Get system metrics",
    description="Retrieve in-memory performance and usage metrics.",
)
def get_metrics(current_user: models.User = Depends(get_current_user)):
    """Exposes internal metrics similar to a Prometheus endpoint."""
    # We could restrict this to admins only, but let's allow authenticated users for dashboard use.
    return metrics_manager.get_metrics()


@router.post(
    "/client-errors",
    summary="Report client error",
    description="Endpoint for the frontend to report unhandled exceptions or render errors.",
)
async def report_client_error(request: Request):
    """Logs client-side errors reported by the frontend."""
    try:
        data = await request.json()
        logger.error(
            "Frontend Client Error",
            extra={
                "client_error": data,
                "event_type": "CLIENT_ERROR"
            }
        )
        return {"status": "logged"}
    except json.JSONDecodeError:
        logger.warning("Received invalid JSON for client error report")
        return {"status": "error", "message": "Invalid JSON"}
    except Exception as e:
        logger.error(f"Failed to process client error report: {e}")
        return {"status": "error", "message": str(e)}
