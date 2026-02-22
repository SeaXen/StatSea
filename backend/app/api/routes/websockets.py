import logging
import asyncio
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from typing import Dict, Set

from ...core.config import settings
from ...core.collector import global_collector
from ...db.database import SessionLocal
from ...models import models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["WebSockets"])

# Reference to the main event loop, set on first WebSocket connect
_event_loop: asyncio.AbstractEventLoop | None = None

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "events": set(),
        }

    async def connect(self, websocket: WebSocket, channel: str = "events"):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
        logger.debug(f"Client connected to {channel} channel")

    def disconnect(self, websocket: WebSocket, channel: str = "events"):
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
            logger.debug(f"Client disconnected from {channel} channel")

    async def broadcast(self, message: dict, channel: str = "events"):
        if channel in self.active_connections:
            for connection in list(self.active_connections[channel]):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to client in {channel}: {e}")
                    self.disconnect(connection, channel)

manager = ConnectionManager()

def _safe_broadcast(msg: dict):
    """Safely broadcast from sync threads using run_coroutine_threadsafe."""
    if _event_loop and not _event_loop.is_closed():
        asyncio.run_coroutine_threadsafe(manager.broadcast(msg, "events"), _event_loop)

# Hook the global collector's event callback to broadcast to "events" channel
global_collector.set_event_callback(_safe_broadcast)

async def authenticate_websocket(websocket: WebSocket, token: str) -> models.User | None:
    """Validate token for WebSocket connections."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
            
        with SessionLocal() as db:
            user = db.query(models.User).filter(models.User.username == username).first()
            if user and user.is_active:
                return user
    except JWTError:
        pass
    return None

@router.websocket("/live")
async def websocket_live(websocket: WebSocket, token: str = Query(None)):
    global _event_loop
    if _event_loop is None:
        _event_loop = asyncio.get_running_loop()

    user = await authenticate_websocket(websocket, token)
    if not user:
        await websocket.close(code=1008, reason="Authentication required")
        return

    await websocket.accept()
    try:
        while True:
            stats = global_collector.get_current_stats()
            data = {
                "timestamp": time.time(),
                "u": stats["u"],
                "d": stats["d"],
                "active_devices": stats["active_device_count"],
            }
            await websocket.send_json(data)
            await asyncio.sleep(1)
    except Exception as e:
        logger.debug(f"Live stats WebSocket disconnected: {e}")

@router.websocket("/events")
async def websocket_events(websocket: WebSocket, token: str = Query(None)):
    user = await authenticate_websocket(websocket, token)
    if not user:
        await websocket.close(code=1008, reason="Authentication required")
        return

    await manager.connect(websocket, "events")
    try:
        while True:
            await websocket.receive_text()
    except Exception as e:
        logger.debug(f"Events WebSocket disconnected: {e}")
        manager.disconnect(websocket, "events")

@router.websocket("/speedtest")
async def speedtest_websocket(websocket: WebSocket, provider: str = "ookla", token: str = Query(None)):
    user = await authenticate_websocket(websocket, token)
    if not user:
        await websocket.close(code=1008, reason="Authentication required")
        return

    await websocket.accept()
    try:
        from ...core.speedtest_service import speedtest_service
        from ...api.deps import get_db
        
        queue = asyncio.Queue()
        main_loop = asyncio.get_running_loop()

        def bridge_callback(data):
            try:
                if not main_loop.is_closed():
                    asyncio.run_coroutine_threadsafe(queue.put(data), main_loop)
            except Exception as e:
                logger.error(f"Bridge callback error: {e}")

        async def run_test():
            db = next(get_db())
            try:
                result = await speedtest_service.run_speedtest(db, provider=provider, progress_callback=bridge_callback)
                await queue.put({"phase": "complete", "result": {
                    "download": result.download,
                    "upload": result.upload,
                    "ping": result.ping,
                    "server": {
                        "name": result.server_name,
                        "country": result.server_country,
                        "id": result.server_id
                    },
                    "isp": result.isp
                }})
            except Exception as e:
                await queue.put({"error": str(e)})
            finally:
                await queue.put(None)

        task = asyncio.create_task(run_test())

        while True:
            data = await queue.get()
            if data is None:
                break
            await websocket.send_json(data)

        await task
        
    except WebSocketDisconnect:
        logger.debug("Speedtest WebSocket disconnected")
    except Exception as e:
        logger.error(f"Speedtest WebSocket error: {e}")
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
