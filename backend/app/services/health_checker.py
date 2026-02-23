import httpx
import time
import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from ..models import models
from .notification_service import NotificationService

logger = logging.getLogger(__name__)

async def ping_url(check: models.HealthCheck, db: Session):
    """Perform an async HTTP ping and record the result."""
    start_time = time.time()
    status_code = None
    is_up = False
    error_msg = None
    
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            if check.method.upper() == "POST":
                response = await client.post(check.url)
            else:
                response = await client.get(check.url)
            
            status_code = response.status_code
            is_up = 200 <= status_code < 400
            
    except httpx.TransportError as e:
        error_msg = f"Connection error: {type(e).__name__}"
    except Exception as e:
        error_msg = f"Error: {str(e)}"
        
    response_time_ms = (time.time() - start_time) * 1000
    
    try:
        # Refresh object in session if needed
        db.add(check)
        
        # Trigger notification if status changed from UP to DOWN
        # We assume 200-399 is UP (as per line 26)
        was_up = check.last_status is not None and 200 <= check.last_status < 400
        
        if was_up and not is_up:
            # Went DOWN
            try:
                NotificationService.send_alert(
                    db=db,
                    organization_id=check.organization_id if hasattr(check, 'organization_id') else 1,
                    title=f"Health Check Failed: {check.name}",
                    description=f"The health check for **{check.url}** failed.\n\n**Status:** {status_code}\n**Error:** {error_msg if error_msg else 'None'}",
                    severity="CRITICAL"
                )
            except Exception as e:
                logger.error(f"Failed to send health check alert: {e}")
        elif not was_up and is_up and check.last_status is not None:
             # Recovered
             try:
                NotificationService.send_alert(
                    db=db,
                    organization_id=check.organization_id if hasattr(check, 'organization_id') else 1,
                    title=f"Health Check Recovered: {check.name}",
                    description=f"The health check for **{check.url}** is back online.\n\n**Status:** {status_code}",
                    severity="INFO"
                )
             except Exception as e:
                logger.error(f"Failed to send health check recovery alert: {e}")

        # Update check status
        check.last_status = status_code
        check.last_checked = datetime.now(timezone.utc)
        
        # Log result
        log = models.HealthCheckLog(
            check_id=check.id,
            status_code=status_code,
            response_time_ms=round(response_time_ms, 2),
            is_up=is_up,
            error=error_msg[:255] if error_msg else None
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to save health check result for {check.url}: {e}")
        db.rollback()
    
    return is_up

async def run_all_health_checks(db: Session):
    """Find checks that are due and run them."""
    active_checks = db.query(models.HealthCheck).filter(models.HealthCheck.is_active == True).all()
    
    if not active_checks:
        return

    # To avoid DB session conflicts in concurrent async tasks with synchronous SQLAlchemy,
    # we'll run them one by one or ensure each has its own session.
    # For simplicity in this architecture, we'll run them sequentially or wrap in a better way.
    # Given the scale, sequential is fine for now, or we could use a pool.
    
    for check in active_checks:
        # Check if due (simple logic: check if last_checked + interval < now)
        now = datetime.now(timezone.utc)
        if not check.last_checked or (now - check.last_checked).total_seconds() >= check.interval_seconds:
            await ping_url(check, db)
