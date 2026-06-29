"""测试夹具:注入鉴权环境变量,提供 client / admin_token / 限流重置。"""
from __future__ import annotations

import os
import tempfile
from collections.abc import Generator
from pathlib import Path

import pytest
from passlib.hash import bcrypt
from sqlmodel import Session, SQLModel

# 必须在 import app 之前设置所有环境变量,避免污染 xjxz.db 且满足 config fail-fast。
_TMP_DIR = tempfile.mkdtemp(prefix="xjxz-test-")
os.environ["XJXZ_DB_PATH"] = str(Path(_TMP_DIR) / "test.db")

# 已知测试口令(≥16 位)及其 bcrypt 哈希,导入 app 之前注入环境。
TEST_PASSWORD = "test-admin-password-0123456789"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-pytest-32bytes-minimum-xx"
os.environ["ADMIN_PASSWORD_HASH"] = bcrypt.hash(TEST_PASSWORD)

from app import config  # noqa: E402
from app.auth import create_access_token, limiter  # noqa: E402
from app.db import create_db_engine, get_session  # noqa: E402
from app.main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

config.get_settings.cache_clear()

# 用 create_db_engine 构造，确保测试引擎应用与生产「完全相同」的 PRAGMA。
test_engine = create_db_engine(f"sqlite:///{os.environ['XJXZ_DB_PATH']}")

# 提前建好所有表(含 Relationship),使 _clean_db autouse 安全运行
SQLModel.metadata.create_all(test_engine)


def _get_session_override() -> Generator[Session, None, None]:
    with Session(test_engine) as session:
        yield session


@pytest.fixture(autouse=True)
def _reset_limiter() -> None:
    """每个用例前清空内存限流计数,避免跨用例污染。"""
    limiter.reset()


@pytest.fixture(autouse=True)
def _clean_db() -> Generator[None, None, None]:
    """每个用例结束后清空所有表,保证测试之间 DB 隔离。"""
    yield
    from sqlalchemy import text
    with Session(test_engine) as session:
        # 关系表先删(有 FK),再删人物表
        session.execute(text("DELETE FROM relationships"))
        session.execute(text("DELETE FROM characters"))
        session.commit()


@pytest.fixture
def admin_password() -> str:
    return TEST_PASSWORD


@pytest.fixture
def db_engine():
    return test_engine


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_session] = _get_session_override
    with TestClient(app) as c:  # 进入 context 触发 lifespan → create_all
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_token() -> str:
    return create_access_token()
