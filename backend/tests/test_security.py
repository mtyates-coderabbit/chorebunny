import runpy
import tomllib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app


@pytest.mark.parametrize("key", [None, ""])
def test_startup_requires_api_key(monkeypatch, key):
    if key is None:
        monkeypatch.delenv("API_KEY", raising=False)
    else:
        monkeypatch.setenv("API_KEY", key)
    with pytest.raises(RuntimeError, match="API_KEY"):
        with TestClient(app):
            pass


@pytest.mark.parametrize("key", [None, "", "wrong", "test-api-key ", "TEST-API-KEY"])
@pytest.mark.parametrize("path", ["/api/tasks", "/api/completions", "/api/summary"])
def test_protected_routes_require_exact_key(client, key, path):
    client.headers.pop("X-Api-Key")
    headers = {} if key is None else {"X-Api-Key": key}
    assert client.get(path, headers=headers).status_code == 401


def test_auth_fails_closed_if_configuration_disappears(client, monkeypatch):
    monkeypatch.delenv("API_KEY")
    assert client.get("/api/tasks").status_code == 401
    assert client.get("/health").status_code == 200


def test_cors_trims_origins(monkeypatch):
    monkeypatch.setenv("API_KEY", "test-api-key")
    monkeypatch.setenv("ALLOWED_ORIGINS", " https://one.example , https://two.example ")
    configured_app = runpy.run_path("app/main.py")["app"]
    with TestClient(configured_app) as client:
        for origin in ["https://one.example", "https://two.example"]:
            response = client.options("/api/tasks", headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "X-Api-Key",
            })
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == origin
        assert client.options("/api/tasks", headers={
            "Origin": "https://other.example",
            "Access-Control-Request-Method": "GET",
        }).status_code == 400


def test_fly_database_uses_mounted_volume(monkeypatch):
    config = tomllib.loads(Path("fly.toml").read_text())
    monkeypatch.setenv("DATABASE_URL", config["env"]["DATABASE_URL"])
    assert Settings().database_url == "sqlite:////data/chorebunny.db"
    assert config["mounts"][0]["destination"] == "/data"
