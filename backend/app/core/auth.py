import logging
import os

from dotenv import load_dotenv
from fastapi import HTTPException, Security, status
from fastapi.security.api_key import APIKeyHeader

load_dotenv()

logger = logging.getLogger(__name__)

API_KEY = os.getenv("API_KEY", "")
API_KEY_NAME = "X-API-Key"
_DEFAULT_KEY = "statsea-default-secret-key-change-me"

if not API_KEY or API_KEY == _DEFAULT_KEY:
    logger.warning(
        "API_KEY is not set or uses the default value. "
        "API key authentication will reject all requests until a proper key is configured."
    )

api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)


async def verify_api_key(api_key_header: str = Security(api_key_header)):
    # Reject if no API key is configured on the server
    if not API_KEY or API_KEY == _DEFAULT_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API key not configured on server. Set the API_KEY environment variable.",
        )

    if not api_key_header:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing API key header",
        )

    if api_key_header == API_KEY:
        return api_key_header

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Could not validate credentials",
    )
