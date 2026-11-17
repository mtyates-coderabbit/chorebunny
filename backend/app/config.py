from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./chorebunny.db"
    vapid_public_key: str | None = None
    vapid_private_key: str | None = None

    model_config = {"env_file": ".env"}


settings = Settings()
