from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./chorebunny.db"

    model_config = {"env_file": ".env"}


settings = Settings()
