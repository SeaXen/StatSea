import uuid
import hashlib
import secrets
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models import models
from app.schemas import agent as schemas
from app.api.deps import get_current_user

router = APIRouter(prefix="/agents", tags=["Agents"])

def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()

def get_current_agent(
    x_agent_key: str = Header(..., description="Agent API Key"),
    db: Session = Depends(get_db)
) -> models.AgentNode:
    key_hash = hash_api_key(x_agent_key)
    agent = db.query(models.AgentNode).filter(models.AgentNode.api_key_hash == key_hash).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Agent API Key",
        )
    return agent

@router.get("/", response_model=List[schemas.AgentResponse])
def get_agents(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List all registered agents."""
    agents = db.query(models.AgentNode).offset(skip).limit(limit).all()
    return agents

@router.post("/", response_model=schemas.AgentResponse, status_code=status.HTTP_201_CREATED)
def register_agent(
    agent_in: schemas.AgentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Register a new agent node. 
    Returns the newly generated API key exactly ONCE.
    """
    raw_key = secrets.token_urlsafe(32)
    key_hash = hash_api_key(raw_key)
    
    # Optional: associate with organization if applicable
    # We might use current_user's organization if needed, for MVP we just create it
    
    agent = models.AgentNode(
        id=str(uuid.uuid4()),
        name=agent_in.name,
        api_key_hash=key_hash,
        status="offline"
    )
    
    db.add(agent)
    db.commit()
    db.refresh(agent)
    
    # Attach raw key for the response only
    response = schemas.AgentResponse.model_validate(agent)
    response.api_key = raw_key
    
    return response

@router.post("/{agent_id}/metrics", status_code=status.HTTP_201_CREATED)
def submit_metrics(
    agent_id: str,
    metrics: schemas.AgentMetricSubmit,
    agent: models.AgentNode = Depends(get_current_agent),
    db: Session = Depends(get_db)
):
    """
    Submit system metrics from a remote agent.
    Must be authenticated via X-Agent-Key header.
    """
    if agent.id != agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agent ID mismatch with authenticated key"
        )
        
    db_metric = models.AgentMetric(
        agent_id=agent.id,
        cpu_pct=metrics.cpu_pct,
        mem_usage=metrics.mem_usage,
        disk_usage=metrics.disk_usage,
        net_rx=metrics.net_rx,
        net_tx=metrics.net_tx
    )
    
    # Update agent status
    agent.status = "online"
    agent.last_seen = db_metric.timestamp # This will be func.now() from DB but roughly mapped
    
    # Store latest metrics in system_info for easy retrieval by dashboard
    if agent.system_info is None:
        agent.system_info = {}
    
    agent.system_info["latest_metrics"] = {
        "cpu_pct": metrics.cpu_pct,
        "mem_usage": metrics.mem_usage,
        "disk_usage": metrics.disk_usage,
        "net_rx": metrics.net_rx,
        "net_tx": metrics.net_tx
    }
    
    # SQLAlchemy might not detect dictionary updates unless reassigned or flagged
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(agent, "system_info")
    
    db.add(db_metric)
    db.commit()
    
    return {"status": "success"}
