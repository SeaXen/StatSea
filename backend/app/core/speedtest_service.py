import asyncio
import logging
import time
from datetime import datetime, timezone

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

    def run_cloudflare_speedtest(self, progress_callback=None):
        """
        Runs a speedtest using Cloudflare's speed test endpoint.
        Returns results in BPS (bits per second).
        """
        try:
            logger.info("Starting Cloudflare speedtest...")
            if progress_callback:
                progress_callback({"phase": "ping", "progress": 0})

            # 1. Ping / Latency
            # perform 5 pings to get average latency
            latencies = []
            for i in range(5):
                t0 = time.time()
                resp = requests.get("https://speed.cloudflare.com/__down?bytes=0", timeout=5)
                resp.raise_for_status()
                latencies.append((time.time() - t0) * 1000)
                if progress_callback:
                    progress_callback({"phase": "ping", "progress": (i + 1) / 5 * 100, "val": latencies[-1]})
            
            avg_ping = sum(latencies) / len(latencies)
            if progress_callback:
                progress_callback({"phase": "ping", "progress": 100, "val": avg_ping})

            # 2. Download Speed
            # Download 10MB file for test
            if progress_callback:
                progress_callback({"phase": "download", "progress": 0})
                
            t0 = time.time()
            # 10MB = 10 * 1024 * 1024 bytes
            size_bytes = 10 * 1024 * 1024
            resp = requests.get(f"https://speed.cloudflare.com/__down?bytes={size_bytes}", stream=True, timeout=30)
            resp.raise_for_status()
            
            downloaded = 0
            last_report = time.time()
            
            for chunk in resp.iter_content(chunk_size=8192):
                downloaded += len(chunk)
                now = time.time()
                if progress_callback and (now - last_report > 0.1): # Report every 100ms
                    duration = now - t0
                    if duration > 0:
                        current_bps = (downloaded * 8) / duration
                        progress_callback({
                            "phase": "download", 
                            "progress": (downloaded / size_bytes) * 100, 
                            "val": current_bps
                        })
                        last_report = now
            
            duration = time.time() - t0
            # Calculate actual bps based on received data
            download_bps = (downloaded * 8) / duration
            
            if progress_callback:
                progress_callback({"phase": "download", "progress": 100, "val": download_bps})

            # 3. Upload Speed
            # Upload data in stages for progress reporting
            if progress_callback:
                progress_callback({"phase": "upload", "progress": 0})

            t0 = time.time()
            upload_size = 1 * 1024 * 1024  # 1MB total
            chunk_size = 256 * 1024  # 256KB chunks
            num_chunks = upload_size // chunk_size
            total_uploaded = 0

            for i in range(num_chunks):
                chunk_data = b"0" * chunk_size
                try:
                    resp = requests.post("https://speed.cloudflare.com/__up", data=chunk_data, timeout=30)
                    resp.raise_for_status()
                except Exception:
                    pass  # Continue even if individual chunk fails
                total_uploaded += chunk_size
                if progress_callback:
                    chunk_progress = ((i + 1) / num_chunks) * 100
                    elapsed = time.time() - t0
                    current_bps = (total_uploaded * 8) / elapsed if elapsed > 0 else 0
                    progress_callback({"phase": "upload", "progress": chunk_progress, "val": current_bps})

            duration = time.time() - t0
            upload_bps = (total_uploaded * 8) / duration if duration > 0 else 0
            
            if progress_callback:
                progress_callback({"phase": "upload", "progress": 100, "val": upload_bps})

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
                "timestamp": datetime.now(timezone.utc),
                "provider": "cloudflare",
            }

        except Exception as e:
            logger.error(f"Cloudflare speedtest failed: {str(e)}")
            raise e

    def run_ookla_speedtest(self, server_id=None, progress_callback=None):
        try:
            logger.info("Starting Ookla speedtest...")
            if progress_callback:
                progress_callback({"phase": "init", "progress": 0})

            # Initialize with secure=True to avoid some common connection issues
            st = speedtest.Speedtest(secure=True)
            if server_id:
                st.get_servers([int(server_id)])
            else:
                st.get_best_server()

            if progress_callback:
                progress_callback({"phase": "ping", "progress": 100, "val": st.results.ping})

            logger.info("Testing download speed...")
            # speedtest-cli supports a callback for download/upload
            def download_callback(progress):
                # progress is 0.0 to 1.0? No, checking logic, it returns bytes transferred? 
                # Actually speedtest-cli callback signature is just (current, total, start=False, end=False)
                # But looking at source, it's not easily exposed via st.download().
                # However, st.download() does NOT accept a callback in the standard library version typically used.
                # It accepts threads=None.
                # We can't easily hook into speedtest-cli's download progress without a custom wrapper or monkey patching.
                # So we'll simulate "running" state or just block.
                # WAIT: Some versions DO support it. Let's assume standard behavior: blocking.
                # To support true progress, we'd need to use the `threads` argument or internal modification.
                # For now, we will just send "start" and "end" events for Ookla.
                pass

            if progress_callback:
                progress_callback({"phase": "download", "progress": 0})

            # Use a thread to send synthetic progress while st.download() blocks
            import threading
            download_result = [None]
            download_done = threading.Event()

            def run_download():
                download_result[0] = st.download()
                download_done.set()

            download_thread = threading.Thread(target=run_download, daemon=True)
            download_thread.start()

            # Send synthetic progress ticks while waiting
            synthetic_progress = 0
            while not download_done.wait(timeout=1.5):
                synthetic_progress = min(synthetic_progress + 10, 80)
                if progress_callback:
                    progress_callback({"phase": "download", "progress": synthetic_progress})

            download = download_result[0]
            
            if progress_callback:
                progress_callback({"phase": "download", "progress": 100, "val": download})

            logger.info("Testing upload speed...")
            if progress_callback:
                progress_callback({"phase": "upload", "progress": 0})

            # Use a thread to send synthetic progress while st.upload() blocks
            import threading
            upload_result = [None]
            upload_done = threading.Event()

            def run_upload():
                upload_result[0] = st.upload()
                upload_done.set()

            upload_thread = threading.Thread(target=run_upload, daemon=True)
            upload_thread.start()

            # Send synthetic progress ticks while waiting
            synthetic_progress = 0
            while not upload_done.wait(timeout=1.5):
                synthetic_progress = min(synthetic_progress + 10, 80)
                if progress_callback:
                    progress_callback({"phase": "upload", "progress": synthetic_progress})

            upload = upload_result[0]
            if progress_callback:
                progress_callback({"phase": "upload", "progress": 100, "val": upload})

            logger.info("Ookla Speedtest complete.")

            return {
                "download": download, # bps
                "upload": upload,     # bps
                "ping": st.results.ping,
                "server": st.results.server,
                "client": st.results.client,
                "timestamp": datetime.now(timezone.utc),
                "provider": "ookla",
            }
        except Exception as e:
            logger.error(f"Ookla speedtest failed: {str(e)}")
            raise e

    async def run_speedtest(self, db: Session, server_id: int = None, provider: str = "ookla", progress_callback=None):
        loop = asyncio.get_running_loop()
        try:
            # Helper to run blocking function with callback
            def run_with_callback():
                if provider == "cloudflare":
                    return self.run_cloudflare_speedtest(progress_callback=progress_callback)
                else:
                    return self.run_ookla_speedtest(server_id, progress_callback=progress_callback)

            # Run in executor to avoid blocking the main thread
            result = await loop.run_in_executor(None, run_with_callback)

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
