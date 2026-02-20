import asyncio
import websockets
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def connect_and_listen(uri):
    logger.info(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            logger.info("Connected!")
            while True:
                try:
                    message = await websocket.recv()
                    data = json.loads(message)
                    logger.info(f"Received: {data}")
                    
                    if data.get("phase") == "complete" or data.get("error"):
                        break
                except websockets.exceptions.ConnectionClosed:
                    logger.info("Connection closed")
                    break
    except Exception as e:
        logger.error(f"Failed to connect to {uri}: {e}")

async def test_speedtest_ws():
    uris = [
        # Correct path based on main.py
        "ws://localhost:8001/api/ws/speedtest?provider=ookla",
        "ws://127.0.0.1:8001/api/ws/speedtest?provider=ookla",
        
        # Also try v1 just in case I misread something or there's a proxy
        "ws://localhost:8001/api/v1/ws/speedtest?provider=ookla",
    ]
    
    for uri in uris:
        print(f"Trying {uri}...")
        await connect_and_listen(uri)
        
if __name__ == "__main__":
    asyncio.run(test_speedtest_ws())
