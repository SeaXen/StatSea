import logging
import psutil
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
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
    
    return {
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_status,
        "memory": {
            "total_bytes": memory.total,
            "used_bytes": memory.used,
            "percent": memory.percent
        }
    }
