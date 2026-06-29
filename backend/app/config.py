"""应用配置:从环境读取密钥,缺失即 fail-fast。"""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    """运行期不可变配置。"""

    JWT_SECRET: str
    ADMIN_PASSWORD_HASH: str


@lru_cache
def get_settings() -> Settings:
    """读取并校验环境变量;任一缺失抛 RuntimeError(启动 fail-fast)。"""
    jwt_secret = os.environ.get("JWT_SECRET")
    admin_password_hash = os.environ.get("ADMIN_PASSWORD_HASH")
    missing = [
        name
        for name, value in (
            ("JWT_SECRET", jwt_secret),
            ("ADMIN_PASSWORD_HASH", admin_password_hash),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(
            "Missing required environment variables: " + ", ".join(missing)
        )
    assert jwt_secret is not None and admin_password_hash is not None
    return Settings(JWT_SECRET=jwt_secret, ADMIN_PASSWORD_HASH=admin_password_hash)
