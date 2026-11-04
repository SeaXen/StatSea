from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class AgentCreate(BaseModel):
    name: str

class AgentResponse(BaseModel):
    id: str
    name: str
    ip_address: str | None = None
    status: str
    last_seen: datetime | None = None
    system_info: dict[str, Any] | None = None
    organization_id: int | None = None
    created_at: datetime
    
    # Only returned during creation
    api_key: str | None = None

    model_config = ConfigDict(from_attributes=True)

class AgentMetricSubmit(BaseModel):
    cpu_pct: float
    mem_usage: float
    disk_usage: float
    net_rx: int = 0
    net_tx: int = 0
