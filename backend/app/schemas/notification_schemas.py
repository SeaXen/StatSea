from pydantic import BaseModel, Field, HttpUrl, EmailStr
from typing import List, Optional, Dict, Any

class SmtpConfig(BaseModel):
    host: str = Field(..., description="SMTP Server Host (e.g., smtp.gmail.com)")
    port: int = Field(587, description="SMTP Server Port (usually 587 or 465)")
    user: str = Field(..., description="SMTP Username")
    password: str = Field(..., description="SMTP Password")
    from_email: EmailStr = Field(..., description="Sender Email Address")
    to_emails: List[EmailStr] = Field(..., description="List of recipient email addresses")

class SlackConfig(BaseModel):
    webhook_url: HttpUrl = Field(..., description="Slack Incoming Webhook URL")

class DiscordConfig(BaseModel):
    webhook_url: HttpUrl = Field(..., description="Discord Webhook URL")

class NtfyConfig(BaseModel):
    server_url: HttpUrl = Field("https://ntfy.sh", description="ntfy.sh server URL")
    topic: str = Field(..., description="ntfy.sh topic name")
    priority: int = Field(3, description="ntfy.sh priority (1-5)")
    token: Optional[str] = Field(None, description="ntfy.sh auth token (if required)")

class ChannelBase(BaseModel):
    name: str = Field(..., description="Name of the channel (e.g., My Slack Alerts)")
    type: str = Field(..., description="Channel type (email, slack, discord, ntfy, push)")
    config: Dict[str, Any] = Field(..., description="Channel-specific configuration")
    events: List[str] = Field(default=["*"], description="Events that trigger this channel")

class ChannelCreate(ChannelBase):
    pass

class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    events: Optional[List[str]] = None
    is_enabled: Optional[bool] = None

class ChannelResponse(ChannelBase):
    id: int
    is_enabled: bool
    
    class Config:
        from_attributes = True
