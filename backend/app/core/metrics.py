import time
from typing import Dict
from pydantic import BaseModel

class MetricsState(BaseModel):
    # API Requests
    total_requests: int = 0
    failed_requests: int = 0
    active_connections: int = 0
    
    # Internal Events
    dns_queries_processed: int = 0
    packets_analyzed: int = 0
    alerts_generated: int = 0
    
    # Uptime
    start_time: float = time.time()

class MetricsManager:
    """In-memory metrics counter for Prometheus-like observability."""
    def __init__(self):
        self._state = MetricsState()

    def increment_request(self):
        self._state.total_requests += 1

    def increment_failed_request(self):
        self._state.failed_requests += 1

    def increment_connection(self):
        self._state.active_connections += 1

    def decrement_connection(self):
        self._state.active_connections = max(0, self._state.active_connections - 1)

    def increment_dns_query(self):
        self._state.dns_queries_processed += 1

    def increment_packet(self):
        self._state.packets_analyzed += 1

    def increment_alert(self):
        self._state.alerts_generated += 1

    def get_metrics(self) -> Dict[str, float]:
        uptime = time.time() - self._state.start_time
        return {
            "uptime_seconds": uptime,
            "api_total_requests": self._state.total_requests,
            "api_failed_requests": self._state.failed_requests,
            "api_active_connections": self._state.active_connections,
            "dns_queries_processed": self._state.dns_queries_processed,
            "packets_analyzed": self._state.packets_analyzed,
            "alerts_generated": self._state.alerts_generated,
        }

metrics_manager = MetricsManager()
