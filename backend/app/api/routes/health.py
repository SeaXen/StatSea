import logging
from datetime import datetime, timezone

import psutil
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.collector import global_collector
from app.core.scheduler import scheduler
from app.db.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])

@router.get(
    "/health",
    summary="Health check",
    description="Check if the API and database are running.",
)
async def health_check(db: Session = Depends(get_db)):
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Health check DB error: {e}")
        db_status = "error"
    
    memory = psutil.virtual_memory()
    
    status = "healthy" if db_status == "ok" else "unhealthy"

    try:
        job_count = len(scheduler.scheduler.get_jobs())
    except Exception:
        job_count = 0

    payload = {
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_status,
        "memory": {
            "total_bytes": memory.total,
            "used_bytes": memory.used,
            "percent": memory.percent
        },
        "services": {
            "collector_running": bool(global_collector.running),
            "capture_failed": bool(global_collector.is_capture_failed()),
            "synthetic_mode": bool(global_collector.is_synthetic),
            "scheduler_running": bool(getattr(scheduler.scheduler, "running", False)),
            "job_count": job_count,
        },
    }
    if db_status != "ok":
        # Surface a dead database to orchestrators instead of a false 200.
        return JSONResponse(status_code=503, content=payload)
    return payload
