import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .api import endpoints, audit, billing, api_keys, saas_extras
from .core.collector import global_collector

# ... imports ...


# ... app setup ...




from .core.config import settings
from .core.docker_monitor import docker_monitor
from .core.limiter import limiter
from .core.logging import get_logger, set_request_id, setup_logging
from .core.monitor import monitor
from .core.scheduler import scheduler
from .core.system_monitor import system_monitor
from .db.database import Base, SessionLocal, engine
from .models import models

# Initialize structured logging
setup_logging(level=logging.DEBUG if settings.DEBUG else logging.INFO)
logger = get_logger("main")

# Create database tables
Base.metadata.create_all(bind=engine)


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
            print("Default Organization created.")

        # 2. Create Admin User
        admin = db.query(models.User).filter(models.User.username == "admin").first()
        if not admin:
            admin = models.User(
                username="admin",
                email="admin@statsea.local",
                hashed_password=models.User.get_password_hash("admin123"),
                full_name="StatSea Admin",
                is_admin=True,
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print("Default admin user created: admin / admin123")
        
        # 3. Add Admin to Organization
        member = db.query(models.OrganizationMember).filter(
            models.OrganizationMember.user_id == admin.id, 
            models.OrganizationMember.organization_id == org.id
        ).first()
        
        if not member:
            member = models.OrganizationMember(user_id=admin.id, organization_id=org.id, role="owner")
            db.add(member)
            db.commit()
            print("Admin added to Default Organization.")

    finally:
        db.close()


seed_initial_data()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Security check: Warn if using default JWT secret
    if settings.JWT_SECRET_KEY == "statsea-jwt-secret-key-change-me-at-least-thirty-two-chars":
        logger.warning("SECURITY RISK: Using default JWT_SECRET_KEY. Change it in .env")

    # Start services
    global_collector.start()
    docker_monitor.start()
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
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="Network Intelligence Dashboard API",
    lifespan=lifespan,
)

# Limiter setup
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    set_request_id(request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # The request_id is already in context from middleware
    # Use it consistently with error_id for debugging
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
            "timestamp": datetime.now().isoformat(),
        },
    )


# CORS settings from config
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
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


app.include_router(endpoints.router, prefix="/api")
app.include_router(audit.router, prefix="/api/audit", tags=["Audit"])
app.include_router(billing.router, prefix="/api/billing", tags=["Billing"])
app.include_router(api_keys.router, prefix="/api/keys", tags=["API Keys"])
app.include_router(saas_extras.notifications_router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(saas_extras.status_page_router, prefix="/api/status-settings", tags=["Status Page"])
app.include_router(saas_extras.public_status_router, prefix="/status", tags=["Public Status"])


@app.get("/")
def read_root():
    return {"status": "online", "system": "Statsea Core"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
