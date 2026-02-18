from fastapi import Security, HTTPException, status
from fastapi.security.api_key import APIKeyHeader
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("API_KEY", "statsea-default-secret-key-change-me")
API_KEY_NAME = "X-API-Key"

api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

async def verify_api_key(api_key_header: str = Security(api_key_header)):
    if not API_KEY:
        # If no API key is set in env, we might want to fail open or closed.
        # For security, we should probably warn but allow if it matches the default?
        # Or if the user hasn't set one, maybe auth is disabled?
        # The plan says "checked against env variable".
        return api_key_header

    if api_key_header == API_KEY:
        return api_key_header
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Could not validate credentials",
    )
