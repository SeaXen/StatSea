from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .core.limiter import limiter
from .api import endpoints
from .core.collector import global_collector
from .core.docker_monitor import docker_monitor
from .core.monitor import monitor
from .core.scheduler import scheduler
from .core.system_monitor import system_monitor
from .db.database import engine, Base
from .models import models

# Create database tables
Base.metadata.create_all(bind=engine)

# Seed default admin user
from .db.database import SessionLocal
def seed_admin():
    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.username == "admin").first()
        if not admin:
            admin = models.User(
                username="admin",
                email="admin@statsea.local",
                hashed_password=models.User.get_password_hash("admin123"),
                full_name="StatSea Admin",
                is_admin=True
            )
            db.add(admin)
            db.commit()
            print("Default admin user created: admin / admin123")
    finally:
        db.close()

seed_admin()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Security check: Warn if using default JWT secret
    jwt_secret = os.getenv("JWT_SECRET_KEY")
    if not jwt_secret or jwt_secret == "statsea-jwt-secret-key-change-me-at-least-thirty-two-chars":
        print("\n" + "!" * 80)
        print("WARNING: SECURITY RISK DETECTED")
        print("You are using the default JWT_SECRET_KEY. This is highly insecure.")
        print("Please set a secure JWT_SECRET_KEY in your environment variables.")
        print("!" * 80 + "\n")

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
    title="Statsea API",
    description="Network Intelligence Dashboard API",
    version="0.1.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import logging
    logger = logging.getLogger("uvicorn.error")
    logger.error(f"Global exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )
# CORS (Allow all for local dev)
# CORS (Allow specific origins for local dev)
# CORS (Allow specific origins for local dev)
origins = os.getenv("CORS_ORIGINS", "http://localhost,http://localhost:5173,http://localhost:5174,http://127.0.0.1,http://127.0.0.1:5173,http://127.0.0.1:5174").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
    # Content-Security-Policy (Restricted to 'self' and allowed domains)
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

@app.get("/")
def read_root():
    return {"status": "online", "system": "Statsea Core"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
