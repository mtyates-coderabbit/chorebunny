import os

from fastapi import HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

_header = APIKeyHeader(name="X-Api-Key", auto_error=False)


def verify_api_key(key: str = Security(_header)) -> None:
    expected = os.getenv("API_KEY", "")
    if expected and key != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")
