import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# Import config FIRST, aliased to avoid collision with the settings router
from .core.config import settings as app_settings
from .core.docker_monitor import docker_monitor
from .core.limiter import limiter
from .core.logging import get_logger, set_request_id, setup_logging
from .core.monitor import monitor
from .core.scheduler import scheduler
from .core.system_monitor import system_monitor
from .core.collector import global_collector
from .core.metrics import metrics_manager
from .services.docker_update_service import docker_update_service
from .db.database import Base, SessionLocal, engine
from .models import models

# Import routers (settings module is safe now — no naming clash)
from .api import audit, billing, api_keys, saas_extras
from .api.routes import (
    devices, analytics, docker, system, auth, network,
    admin, groups, settings as settings_router, websockets,
    speedtests, alerts, health, reports, metrics, export, bandwidth, agents,
    security
)

# Initialize structured logging
setup_logging(level=logging.DEBUG if app_settings.ENVIRONMENT == "development" else logging.INFO)
logger = get_logger("main")


# Seed default data
def seed_initial_data():
    db = SessionLocal()
    try:
        # 1. Create default Organization
        org = db.query(models.Organization).filter(models.Organization.name == "Default Organization").first()
        if not org:
            org = models.Organization(name="Default Organization", plan_tier="enterprise")
            db.add(org)
            db.commit()
            db.refresh(org)
            logger.info("Default Organization created.")

        # 2. Create Admin User
        admin_user = db.query(models.User).filter(models.User.username == "admin").first()
        if not admin_user:
            admin_user = models.User(
                username="admin",
                email="admin@statsea.local",
                hashed_password=models.User.get_password_hash("admin123"),
                full_name="StatSea Admin",
                is_admin=True,
                must_change_password=True,
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            logger.info("Default admin user created: admin / admin123")
        
        # 3. Add Admin to Organization
        member = db.query(models.OrganizationMember).filter(
            models.OrganizationMember.user_id == admin_user.id, 
            models.OrganizationMember.organization_id == org.id
        ).first()
        
        if not member:
            member = models.OrganizationMember(user_id=admin_user.id, organization_id=org.id, role="owner")
            db.add(member)
            db.commit()
            logger.info("Admin added to Default Organization.")

    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables at startup
    Base.metadata.create_all(bind=engine)
    
    # Seed data after tables are created
    seed_initial_data()
    
    # Security check: Warn or fail if using default JWT secret
    is_default_secret = app_settings.JWT_SECRET_KEY == "statsea-jwt-secret-key-change-me-at-least-thirty-two-chars"
    if is_default_secret:
        if app_settings.ENVIRONMENT != "development":
            logger.critical("SECURITY BREACH PREVENTION: Cannot start in production with default JWT_SECRET_KEY.")
            raise RuntimeError("Must change JWT_SECRET_KEY in production.")
        else:
            logger.warning("SECURITY RISK: Using default JWT_SECRET_KEY. Change it in .env")

    # Start services
    global_collector.start()
    docker_monitor.start()
    docker_update_service.start()
    await monitor.start()
    system_monitor.start()
    scheduler.update_scheduler_from_db()

    yield

    # Stop services
    global_collector.stop()
    docker_monitor.stop()
    monitor.stop()
    system_monitor.stop()
    scheduler.scheduler.shutdown()


app = FastAPI(
    title=app_settings.PROJECT_NAME,
    version=app_settings.PROJECT_VERSION,
    description="Network Intelligence Dashboard API",
    lifespan=lifespan,
)

# Limiter setup
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    metrics_manager.increment_request()
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    set_request_id(request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    if response.status_code >= 400:
        metrics_manager.increment_failed_request()
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    metrics_manager.increment_failed_request()
    error_id = datetime.now().strftime("%Y%m%d%H%M%S%f")
    logger.exception(
        f"Unhandled exception: {exc}", extra={"error_id": error_id, "path": request.url.path}
    )

    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected internal error occurred.",
            "error_code": "INTERNAL_SERVER_ERROR",
            "error_id": error_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


# CORS setup with safe wildcard/LAN support in development
valid_origins = app_settings.CORS_ORIGINS
if app_settings.ENVIRONMENT != "development" and "*" in valid_origins:
    logger.critical("SECURITY BREACH PREVENTION: Wildcard CORS origin (*) is not allowed in production.")
    raise RuntimeError("Wildcard CORS origin (*) is not allowed in production.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[] if "*" in valid_origins or app_settings.ENVIRONMENT == "development" else valid_origins,
    allow_origin_regex=".*" if ("*" in valid_origins or app_settings.ENVIRONMENT == "development") else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' ws: wss: https:;"
    )
    return response


# Register all routers
routers = [
    auth.router, devices.router, analytics.router,
    docker.router, system.router, network.router, admin.router,
    groups.router, settings_router.router, websockets.router, speedtests.router,
    alerts.router, health.router, reports.router, metrics.router, export.router, bandwidth.router, agents.router,
    security.router
]
for r in routers:
    app.include_router(r, prefix="/api")
app.include_router(audit.router, prefix="/api/audit", tags=["Audit"])
app.include_router(billing.router, prefix="/api/billing", tags=["Billing"])
app.include_router(api_keys.router, prefix="/api/keys", tags=["API Keys"])
app.include_router(saas_extras.notifications_router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(saas_extras.status_page_router, prefix="/api/status-settings", tags=["Status Page"])
app.include_router(saas_extras.certificates_router, prefix="/api/certificates", tags=["Certificates"])
app.include_router(saas_extras.public_status_router, prefix="/status", tags=["Public Status"])


@app.get("/")
def read_root():
    return {"status": "online", "system": "Statsea Core"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
