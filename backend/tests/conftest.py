import os
import tempfile
from collections.abc import Generator
from pathlib import Path

import pytest

# 必须在 import app 之前指向临时 DB，避免污染 xjxz.db。
_TMP_DIR = tempfile.mkdtemp(prefix="xjxz-test-")
os.environ["XJXZ_DB_PATH"] = str(Path(_TMP_DIR) / "test.db")

from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import Session  # noqa: E402

from app.db import create_db_engine, get_session  # noqa: E402
from app.main import app  # noqa: E402

# 用 create_db_engine 构造，确保测试引擎应用与生产「完全相同」的 PRAGMA。
test_engine = create_db_engine(f"sqlite:///{os.environ['XJXZ_DB_PATH']}")


def _get_session_override() -> Generator[Session, None, None]:
    with Session(test_engine) as session:
        yield session


@pytest.fixture
def db_engine():
    return test_engine


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_session] = _get_session_override
    with TestClient(app) as c:  # 进入 context 触发 lifespan → create_all
        yield c
    app.dependency_overrides.clear()
