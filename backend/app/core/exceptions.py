from fastapi import HTTPException, status


class StatSeaException(HTTPException):
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=status_code, detail=detail)


class DeviceNotFoundException(StatSeaException):
    def __init__(self, device_id: str):
        super().__init__(
            detail=f"Device with ID {device_id} not found", status_code=status.HTTP_404_NOT_FOUND
        )


class UserNotFoundException(StatSeaException):
    def __init__(self, username: str):
        super().__init__(detail=f"User {username} not found", status_code=status.HTTP_404_NOT_FOUND)


class AuthenticationException(StatSeaException):
    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(detail=detail, status_code=status.HTTP_401_UNAUTHORIZED)


class PermissionDeniedException(StatSeaException):
    def __init__(self, detail: str = "Not enough permissions"):
        super().__init__(detail=detail, status_code=status.HTTP_403_FORBIDDEN)


class ValidationException(StatSeaException):
    def __init__(self, detail: str):
        super().__init__(detail=detail, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)
