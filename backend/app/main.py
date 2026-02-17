from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from .api import endpoints
from .core.collector import global_collector
from .core.docker_monitor import docker_monitor
from .core.monitor import monitor
from .db.database import engine, Base
from .models import models

# Create database tables
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start services
    global_collector.start()
    docker_monitor.start()
    monitor.start()
    yield
    # Stop services
    global_collector.stop()
    docker_monitor.stop()
    monitor.stop()

app = FastAPI(
    title="Statsea API",
    description="Network Intelligence Dashboard API",
    version="0.1.0",
    lifespan=lifespan
)

# CORS (Allow all for local dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(endpoints.router, prefix="/api")

@app.get("/")
def read_root():
    return {"status": "online", "system": "Statsea Core"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
