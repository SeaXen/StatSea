
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional

class Settings(BaseSettings):
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "StatSea"
    
    # Security
    API_KEY: Optional[str] = None
    SECRET_KEY: str = "changeme"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:21080"]
    
    # Database
    DATABASE_URL: str = "sqlite:///./statsea.db"
    
    # Notifications (Optional)
    DISCORD_WEBHOOK_URL: Optional[str] = None
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_CHAT_ID: Optional[str] = None
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
