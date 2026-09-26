import os

from fastapi import HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

_header = APIKeyHeader(name="X-Api-Key", auto_error=False)


def validate_api_key() -> None:
    if not os.getenv("API_KEY"):
        raise RuntimeError("API_KEY must be configured and non-empty")


def verify_api_key(key: str | None = Security(_header)) -> None:
    expected = os.getenv("API_KEY", "")
    if not expected or key != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")
