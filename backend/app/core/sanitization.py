import re


def sanitize_string(text: str | None, max_length: int = 255) -> str | None:
    """
    Basic sanitization:
    - Strips HTML tags
    - Trims whitespace
    - Limits length
    """
    if text is None:
        return None

    # Strip HTML tags using regex
    clean = re.compile("<.*?>")
    text = re.sub(clean, "", text)

    # Trim whitespace
    text = text.strip()

    # Limit length
    if len(text) > max_length:
        text = text[:max_length]

    return text


def sanitize_email(email: str | None) -> str | None:
    """Sanitize email address."""
    if email is None:
        return None
    return sanitize_string(email.lower(), max_length=255)


def sanitize_username(username: str | None) -> str | None:
    """Sanitize username."""
    if username is None:
        return None
    # Remove any non-alphanumeric characters except underscores/hyphens
    clean_username = re.sub(r"[^a-zA-Z0-9_\-]", "", username)
    return sanitize_string(clean_username, max_length=50)
