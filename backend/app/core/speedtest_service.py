import speedtest
import asyncio
import logging
import time
import requests
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.models import SpeedtestResult

logger = logging.getLogger(__name__)

class SpeedtestService:
    def get_servers(self):
        try:
            st = speedtest.Speedtest()
            st.get_servers()
            servers = []
            for _, server_list in st.servers.items():
                for server in server_list:
                    servers.append({
                        "id": server["id"],
                        "name": f"{server['name']} ({server['sponsor']})",
                        "country": server["country"],
                        "cc": server["cc"],
                        "host": server["host"],
                        "lat": server["lat"],
                        "lon": server["lon"]
                    })
            # Return top 20 closest servers
            return servers[:20]
        except Exception as e:
            logger.error(f"Failed to get servers: {str(e)}")
            return []

    def run_cloudflare_speedtest(self):
        """
        Runs a speedtest using Cloudflare's speed test endpoint.
        """
        try:
            logger.info("Starting Cloudflare speedtest...")
            start_time = time.time()
            
            # 1. Ping / Latency
            # perform 5 pings to get average latency
            latencies = []
            for _ in range(5):
                t0 = time.time()
                requests.get("https://speed.cloudflare.com/__down?bytes=0", timeout=5)
                latencies.append((time.time() - t0) * 1000)
            avg_ping = sum(latencies) / len(latencies)

            # 2. Download Speed
            # Download 10MB file for test
            # Start timer
            t0 = time.time()
            # 10MB = 10 * 1024 * 1024 bytes
            size_bytes = 10 * 1024 * 1024 
            requests.get(f"https://speed.cloudflare.com/__down?bytes={size_bytes}", timeout=30)
            duration = time.time() - t0
            download_bps = (size_bytes * 8) / duration

            # 3. Upload Speed
            # Upload 1MB of data
            t0 = time.time()
            upload_data = b'0' * (1 * 1024 * 1024)
            requests.post("https://speed.cloudflare.com/__up", data=upload_data, timeout=30)
            duration = time.time() - t0
            upload_bps = (len(upload_data) * 8) / duration

            logger.info("Cloudflare Speedtest complete.")
            return {
                "download": download_bps / 1_000_000, # Convert to Mbps
                "upload": upload_bps / 1_000_000,     # Convert to Mbps
                "ping": avg_ping,
                "server": {
                    "id": 0,
                    "name": "Cloudflare",
                    "country": "Anycast",
                    "cc": "Unknown" # Was hardcoded to CL
                },
                "timestamp": datetime.now(),
                "provider": "cloudflare"
            }

        except Exception as e:
            logger.error(f"Cloudflare speedtest failed: {str(e)}")
            raise e

    def run_ookla_speedtest(self, server_id=None):
        try:
            logger.info("Starting Ookla speedtest...")
            st = speedtest.Speedtest()
            if server_id:
                st.get_servers([int(server_id)])
            else:
                st.get_best_server()
            
            logger.info("Testing download speed...")
            download = st.download()
            logger.info("Testing upload speed...")
            upload = st.upload()
            logger.info("Ookla Speedtest complete.")
            
            return {
                "download": download / 1_000_000, # Convert to Mbps
                "upload": upload / 1_000_000,     # Convert to Mbps
                "ping": st.results.ping,
                "server": st.results.server,
                "timestamp": datetime.now(),
                "provider": "ookla"
            }
        except Exception as e:
            logger.error(f"Ookla speedtest failed: {str(e)}")
            raise e

    async def run_speedtest(self, db: Session, server_id: int = None, provider: str = "ookla"):
        loop = asyncio.get_event_loop()
        try:
            if provider == "cloudflare":
                result = await loop.run_in_executor(None, self.run_cloudflare_speedtest)
            else:
                 # Run in executor to avoid blocking the main thread
                result = await loop.run_in_executor(None, lambda: self.run_ookla_speedtest(server_id))
            
            db_item = SpeedtestResult(
                timestamp=result["timestamp"],
                ping=result["ping"],
                download=result["download"],
                upload=result["upload"],
                server_id=int(result["server"]["id"]),
                server_name=f"{result['server']['name']}, {result['server']['country']}",
                server_country=result.get("server", {}).get("country", "Unknown"),
                provider=provider
            )
            db.add(db_item)
            db.commit()
            db.refresh(db_item)
            return db_item
        except Exception as e:
            logger.error(f"Error in run_speedtest: {str(e)}")
            raise e

speedtest_service = SpeedtestService()
