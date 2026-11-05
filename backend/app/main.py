import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.gzip import GZipMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# Import routers (settings module is safe now — no naming clash)
from .api import api_keys, audit, billing, saas_extras
from .api.routes import (
    admin,
    agents,
    alerts,
    analytics,
    auth,
    bandwidth,
    devices,
    docker,
    export,
    groups,
    health,
    metrics,
    network,
    reports,
    security,
    settings as settings_router,
    speedtests,
    system,
    websockets,
)
from .core.collector import global_collector

# Import config FIRST, aliased to avoid collision with the settings router
from .core.config import settings as app_settings
from .core.docker_monitor import docker_monitor
from .core.limiter import limiter
from .core.logging import get_logger, set_request_id, setup_logging
from .core.metrics import metrics_manager
from .core.monitor import monitor
from .core.scheduler import scheduler
from .core.system_monitor import system_monitor
from .db.database import Base, SessionLocal, engine
from .models import models
from .services.docker_update_service import docker_update_service

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
        is_dev = app_settings.ENVIRONMENT.lower() in ("development", "dev", "local", "test")
        if not admin_user:
            admin_user = models.User(
                username="admin",
                email="admin@statsea.local",
                hashed_password=models.User.get_password_hash("admin123"),
                full_name="StatSea Admin",
                is_admin=True,
                must_change_password=False if is_dev else True,
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            logger.info("Default admin user created.")
        elif is_dev and admin_user.must_change_password:
            admin_user.must_change_password = False
            db.commit()
            logger.info("Dev admin password rotation requirement cleared.")
        
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


_PLACEHOLDER_PATTERNS = (
    "change-me", "changeme", "change_me", "your-secret",
    "placeholder", "example", "todo", "xxx", "secret-key-change"
)


def _validate_jwt_secret(secret: str | None, environment: str) -> None:
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY is not set. Refusing to start.")
    if len(secret) < 32:
        if environment != "development":
            raise RuntimeError("JWT_SECRET_KEY must be at least 32 characters in production.")
        logger.warning("SECURITY RISK: JWT_SECRET_KEY is shorter than 32 characters.")
    lowered = secret.lower()
    if any(p in lowered for p in _PLACEHOLDER_PATTERNS):
        if environment != "development":
            raise RuntimeError(
                "SECURITY BREACH PREVENTION: JWT_SECRET_KEY looks like a placeholder. "
                "Generate one with `python -c \"import secrets; print(secrets.token_urlsafe(48))\"`."
            )
        logger.warning("SECURITY RISK: Using placeholder JWT_SECRET_KEY. Change it in .env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables at startup (gated for development/testing)
    if app_settings.ENVIRONMENT.lower() in ("development", "dev", "local", "test"):
        Base.metadata.create_all(bind=engine)
    
    # Seed data after tables are verified
    seed_initial_data()
    
    # Security check: Validate JWT secret fails closed in production
    _validate_jwt_secret(app_settings.JWT_SECRET_KEY, app_settings.ENVIRONMENT)

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


_is_dev = app_settings.ENVIRONMENT.lower() in ("development", "dev", "local", "test")
app = FastAPI(
    title=app_settings.PROJECT_NAME,
    version=app_settings.PROJECT_VERSION,
    description="Network Intelligence Dashboard API",
    lifespan=lifespan,
    docs_url="/docs" if _is_dev else None,
    redoc_url="/redoc" if _is_dev else None,
    openapi_url="/openapi.json" if _is_dev else None,
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


# CORS setup: strict origins in production, localhost/loopback origins in development
valid_origins = [o for o in app_settings.CORS_ORIGINS if o != "*"]
if app_settings.ENVIRONMENT != "development" and "*" in app_settings.CORS_ORIGINS:
    logger.critical("SECURITY BREACH PREVENTION: Wildcard CORS origin (*) is not allowed in production.")
    raise RuntimeError("Wildcard CORS origin (*) is not allowed in production.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=valid_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$" if app_settings.ENVIRONMENT == "development" else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Network data optimization: Compress API JSON responses larger than 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)


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
    uvicorn.run("app.main:app", host=app_settings.HOST, port=app_settings.PORT, reload=True)
