from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class AgentCreate(BaseModel):
    name: str

class AgentResponse(BaseModel):
    id: str
    name: str
    ip_address: Optional[str] = None
    status: str
    last_seen: Optional[datetime] = None
    system_info: Optional[Dict[str, Any]] = None
    organization_id: Optional[int] = None
    created_at: datetime
    
    # Only returned during creation
    api_key: Optional[str] = None

    class Config:
        from_attributes = True

class AgentMetricSubmit(BaseModel):
    cpu_pct: float
    mem_usage: float
    disk_usage: float
    net_rx: int = 0
    net_tx: int = 0
