import contextvars
import json
import logging
import os
from datetime import datetime
from typing import Any
from logging.handlers import RotatingFileHandler
from .config import settings

# Context variable to store the request ID
request_id_ctx_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id", default=None
)


class JsonFormatter(logging.Formatter):
    """
    Custom formatter that outputs logs as JSON, including request ID if available.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_record: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "funcName": record.funcName,
            "line": record.lineno,
            "request_id": request_id_ctx_var.get(),
        }

        # Add exception info if available
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)

        # Add custom fields (extra={...})
        if hasattr(record, "extra"):
            log_record.update(record.extra)

        return json.dumps(log_record)


def setup_logging(level: int = logging.INFO):
    """
    Configures the root logger to use JSON formatting and RotatingFileHandler.
    """
    formatter = JsonFormatter()

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    root = logging.getLogger()
    # Try to use config LOG_LEVEL string, fallback to level arg
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), level)
    root.setLevel(log_level)

    # Remove existing handlers to avoid duplicates
    for h in root.handlers[:]:
        root.removeHandler(h)

    root.addHandler(console_handler)

    # File handler
    if getattr(settings, "LOG_FILE", None):
        log_file = settings.LOG_FILE
        # Ensure log directory exists
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)
            
        # 10MB per file, keep 5 backups
        file_handler = RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=5)
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)


def get_logger(name: str) -> logging.Logger:
    """
    Returns a logger instance with the given name.
    """
    return logging.getLogger(name)


def set_request_id(request_id: str):
    """Sets the request ID for the current context."""
    request_id_ctx_var.set(request_id)
