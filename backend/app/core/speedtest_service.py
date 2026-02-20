import asyncio
import logging
import time
from datetime import datetime

import requests
import speedtest
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
                    servers.append(
                        {
                            "id": server["id"],
                            "name": f"{server['name']} ({server['sponsor']})",
                            "country": server["country"],
                            "cc": server["cc"],
                            "host": server["host"],
                            "lat": server["lat"],
                            "lon": server["lon"],
                        }
                    )
            # Return top 20 closest servers
            return servers[:20]
        except Exception as e:
            logger.error(f"Failed to get servers: {str(e)}")
            return []

    def run_cloudflare_speedtest(self):
        """
        Runs a speedtest using Cloudflare's speed test endpoint.
        Returns results in BPS (bits per second).
        """
        try:
            logger.info("Starting Cloudflare speedtest...")

            # 1. Ping / Latency
            # perform 5 pings to get average latency
            latencies = []
            for _ in range(5):
                t0 = time.time()
                resp = requests.get("https://speed.cloudflare.com/__down?bytes=0", timeout=5)
                resp.raise_for_status()
                latencies.append((time.time() - t0) * 1000)
            avg_ping = sum(latencies) / len(latencies)

            # 2. Download Speed
            # Download 10MB file for test
            # Start timer
            t0 = time.time()
            # 10MB = 10 * 1024 * 1024 bytes
            size_bytes = 10 * 1024 * 1024
            resp = requests.get(f"https://speed.cloudflare.com/__down?bytes={size_bytes}", stream=True, timeout=30)
            resp.raise_for_status()
            
            downloaded = 0
            for chunk in resp.iter_content(chunk_size=8192):
                downloaded += len(chunk)
            
            duration = time.time() - t0
            # Calculate actual bps based on received data
            download_bps = (downloaded * 8) / duration

            # 3. Upload Speed
            # Upload 1MB of data
            t0 = time.time()
            upload_data = b"0" * (1 * 1024 * 1024)
            resp = requests.post("https://speed.cloudflare.com/__up", data=upload_data, timeout=30)
            resp.raise_for_status()
            duration = time.time() - t0
            upload_bps = (len(upload_data) * 8) / duration

            logger.info("Cloudflare Speedtest complete.")
            return {
                "download": download_bps,  # bps
                "upload": upload_bps,      # bps
                "ping": avg_ping,
                "server": {
                    "id": 0,
                    "name": "Cloudflare",
                    "country": "Anycast",
                    "cc": "Unknown",
                },
                "timestamp": datetime.now(),
                "provider": "cloudflare",
            }

        except Exception as e:
            logger.error(f"Cloudflare speedtest failed: {str(e)}")
            raise e

    def run_ookla_speedtest(self, server_id=None):
        try:
            logger.info("Starting Ookla speedtest...")
            # Initialize with secure=True to avoid some common connection issues
            st = speedtest.Speedtest(secure=True)
            if server_id:
                st.get_servers([int(server_id)])
            else:
                st.get_best_server()

            logger.info("Testing download speed...")
            download = st.download() # Returns bps
            logger.info("Testing upload speed...")
            upload = st.upload() # Returns bps
            logger.info("Ookla Speedtest complete.")

            return {
                "download": download, # bps
                "upload": upload,     # bps
                "ping": st.results.ping,
                "server": st.results.server,
                "client": st.results.client,
                "timestamp": datetime.now(),
                "provider": "ookla",
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
                result = await loop.run_in_executor(
                    None, lambda: self.run_ookla_speedtest(server_id)
                )

            isp = result.get("client", {}).get("isp")
            if provider == "cloudflare":
                isp = "Cloudflare Network"

            db_item = SpeedtestResult(
                timestamp=result["timestamp"],
                ping=result["ping"],
                download=result["download"], # Storing as bps
                upload=result["upload"],     # Storing as bps
                server_id=int(result["server"]["id"]),
                server_name=f"{result['server']['name']}, {result['server']['country']}",
                server_country=result.get("server", {}).get("country", "Unknown"),
                provider=provider,
                isp=isp,
            )
            db.add(db_item)
            db.commit()
            db.refresh(db_item)
            return db_item
        except Exception as e:
            logger.error(f"Error in run_speedtest: {str(e)}")
            raise e


speedtest_service = SpeedtestService()
