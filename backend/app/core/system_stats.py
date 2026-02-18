import psutil
import time
import os
import platform
from datetime import datetime

class SystemStats:
    @staticmethod
    def get_uptime():
        """Returns system uptime in a human-readable format."""
        boot_time_timestamp = psutil.boot_time()
        uptime_seconds = time.time() - boot_time_timestamp
        
        days, remainder = divmod(uptime_seconds, 86400)
        hours, remainder = divmod(remainder, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        parts = []
        if days > 0: parts.append(f"{int(days)}d")
        if hours > 0: parts.append(f"{int(hours)}h")
        if minutes > 0: parts.append(f"{int(minutes)}m")
        parts.append(f"{int(seconds)}s")
        
        return " ".join(parts)

    @staticmethod
    def get_info():
        """Returns comprehensive host metrics."""
        cpu_pct = psutil.cpu_percent(interval=None)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        net_io = psutil.net_io_counters()

        # Try to get CPU Load (average)
        try:
            if hasattr(os, "getloadavg"):
                load_avg = os.getloadavg()[0]
            else:
                # Windows fallback
                load_avg = cpu_pct / 10 # rough estimation for UI
        except Exception:
            load_avg = 0

        return {
            "hostname": platform.node(),
            "uptime": SystemStats.get_uptime(),
            "cpu_pct": cpu_pct,
            "cpu_load": round(load_avg, 2),
            "ram": {
                "total": memory.total,
                "used": memory.used,
                "percent": memory.percent
            },
            "disk": {
                "total": disk.total,
                "used": disk.used,
                "percent": disk.percent
            },
            "network": {
                "sent": net_io.bytes_sent,
                "recv": net_io.bytes_recv
            }
        }

    @staticmethod
    def get_top_processes(limit=10):
        """Returns top resource consuming processes."""
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info']):
            try:
                # Need to call cpu_percent twice or once with interval to get real value if first call
                # But since we are likely calling this repeatedly, it's fine
                processes.append({
                    "id": str(proc.info['pid']),
                    "name": proc.info['name'],
                    "cpu": proc.info['cpu_percent'],
                    "ram": proc.info['memory_info'].rss,
                    "type": "Process"
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        
        # Sort by CPU then RAM
        top = sorted(processes, key=lambda x: (x['cpu'], x['ram']), reverse=True)[:limit]
        return top

system_stats = SystemStats()
