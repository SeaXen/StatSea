from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "StatSea"
    PROJECT_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    PASSWORD_MIN_LENGTH: int = 8

    # Security
    JWT_SECRET_KEY: str = "statsea-jwt-secret-key-change-me-at-least-thirty-two-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = "sqlite:///./data/statsea_saas.db"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]

    # Features
    DEBUG: bool = False
    NETWORK_MONITOR_INTERVAL: int = 60

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/statsea.log"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
