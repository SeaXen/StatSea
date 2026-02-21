import re
from fastapi import HTTPException
from .config import settings

def validate_password_complexity(password: str):
    """
    Validates a password against standard complexity requirements:
    - Minimum length (configurable, default 8)
    - At least one uppercase letter
    - At least one number
    - At least one special character
    """
    min_length = settings.PASSWORD_MIN_LENGTH
    
    if len(password) < min_length:
        raise HTTPException(
            status_code=400, 
            detail=f"Password must be at least {min_length} characters long"
        )
    if not re.search(r"[A-Z]", password):
        raise HTTPException(
            status_code=400, 
            detail="Password must contain at least one uppercase letter"
        )
    if not re.search(r"[0-9]", password):
        raise HTTPException(
            status_code=400, 
            detail="Password must contain at least one number"
        )
    if not re.search(r"[\W_]", password):
        raise HTTPException(
            status_code=400, 
            detail="Password must contain at least one special character"
        )
    
    return True
