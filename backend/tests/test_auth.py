import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient


def test_get_settings_reads_env(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "x" * 32)
    monkeypatch.setenv("ADMIN_PASSWORD_HASH", "$2b$12$abcdefghijklmnopqrstuv")
    from app import config

    config.get_settings.cache_clear()
    settings = config.get_settings()
    assert settings.JWT_SECRET == "x" * 32
    assert settings.ADMIN_PASSWORD_HASH.startswith("$2b$")
    config.get_settings.cache_clear()  # teardown: don't leak test values into cache


def test_get_settings_fail_fast_when_missing(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD_HASH", raising=False)
    from app import config

    config.get_settings.cache_clear()
    with pytest.raises(RuntimeError):
        config.get_settings()
    config.get_settings.cache_clear()


def test_get_settings_enforces_jwt_secret_min_length(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "tooshort")
    monkeypatch.setenv("ADMIN_PASSWORD_HASH", "$2b$12$abcdefghijklmnopqrstuv")
    from app import config

    config.get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="32 bytes"):
        config.get_settings()
    config.get_settings.cache_clear()


def test_startup_fails_when_env_missing(monkeypatch):
    """Lifespan calls get_settings(); a missing JWT_SECRET aborts startup."""
    from app import config
    from app.main import app as main_app

    monkeypatch.delenv("JWT_SECRET", raising=False)
    config.get_settings.cache_clear()
    with pytest.raises(RuntimeError):
        with TestClient(main_app):
            pass
    config.get_settings.cache_clear()


def test_create_and_decode_token_roundtrip():
    from app.auth import create_access_token, decode_token

    token = create_access_token()
    payload = decode_token(token)
    assert payload["sub"] == "admin"
    assert "exp" in payload


def test_verify_password_true_and_false():
    from passlib.hash import bcrypt

    from app.auth import verify_password

    h = bcrypt.hash("correct-horse-battery-staple")
    assert verify_password("correct-horse-battery-staple", h) is True
    assert verify_password("wrong", h) is False


def test_require_admin_missing_header_raises_401():
    from app.auth import require_admin

    with pytest.raises(HTTPException) as exc:
        require_admin(authorization=None)
    assert exc.value.status_code == 401


def test_require_admin_forged_bearer_raises_401():
    from app.auth import require_admin

    with pytest.raises(HTTPException) as exc:
        require_admin(authorization="Bearer not-a-real-jwt")
    assert exc.value.status_code == 401


def test_require_admin_non_bearer_scheme_raises_401():
    from app.auth import require_admin

    with pytest.raises(HTTPException) as exc:
        require_admin(authorization="Basic abc123")
    assert exc.value.status_code == 401


def test_require_admin_valid_token_passes():
    from app.auth import create_access_token, require_admin

    token = create_access_token()
    assert require_admin(authorization=f"Bearer {token}") is None


def test_login_correct_password_returns_token(client, admin_password):
    resp = client.post("/api/login", json={"password": admin_password})
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body["token"], str) and body["token"]


def test_login_wrong_password_returns_401(client):
    resp = client.post("/api/login", json={"password": "definitely-wrong"})
    assert resp.status_code == 401


def test_login_rate_limited_after_5_per_minute(client):
    for _ in range(5):
        client.post("/api/login", json={"password": "definitely-wrong"})
    resp = client.post("/api/login", json={"password": "definitely-wrong"})
    assert resp.status_code == 429
