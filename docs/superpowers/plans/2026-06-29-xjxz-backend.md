# 玄鉴仙族 Wiki — 后端实现计划

> ⚠️ **历史存档。** 本计划描述的后端(FastAPI + SQLite + 鉴权 + 服务器部署)原本是数据源,
> 现已改为**可选的本地编辑器**;线上数据源是静态 `frontend/public/data.json`。
> 当前架构以根目录 [README](../../../README.md) 为准。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 FastAPI + SQLModel + SQLite 后端:人物/关系 CRUD、单管理员 JWT 鉴权、批量导入导出,公开只读接口脱敏。

**Architecture:** 单进程 FastAPI(`uvicorn --workers 1`),SQLite(WAL + 外键级联),响应白名单分离「公开 / 管理员」视图,关系层做对称归一与父系环检测。characters / relationships 两张表驱动百科与族谱。

**Tech Stack:** Python 3.11+ · FastAPI · SQLModel · SQLite(WAL) · PyJWT(HS256) · passlib[bcrypt] · slowapi · pytest + httpx。

## Global Constraints

- Python ≥3.11;依赖 fastapi / sqlmodel / uvicorn[standard] / pyjwt / passlib[bcrypt] / slowapi / python-multipart;测试 pytest + httpx(TestClient)。
- DB 文件名 `xjxz.db`;部署固定 `uvicorn --workers 1`;**不用 alembic**(schema 演进走 `backend/migrations/` 一次性 ALTER 脚本)。
- 每个数据库连接强制 `PRAGMA foreign_keys=ON / journal_mode=WAL / busy_timeout=5000`。
- 公开读接口必须用 `PublicCharacter` 白名单,**绝不返回 `notes` 字段**。
- JWT 用 HS256 + 独立环境变量 `JWT_SECRET`(缺失则启动 fail-fast);`ADMIN_PASSWORD_HASH` 存 bcrypt 哈希,后端永不接触明文。
- 严禁占位符:每个写代码的 step 必须给出真实可运行代码。
- 提交遵循 conventional commits,英文小写开头,一个 commit 一件事。

---

### Task 1: 后端脚手架 + SQLite 引擎配置（PRAGMA / 健康检查）

**Files:**
- Create `backend/pyproject.toml`
- Create `backend/app/__init__.py`
- Create `backend/app/auth.py`（本 Task 仅落 `limiter`，后续鉴权 Task 在同文件追加 `verify_password` / `create_access_token` / `decode_token` / `require_admin`）
- Create `backend/app/db.py`
- Create `backend/app/main.py`
- Test `backend/tests/conftest.py`（`client` fixture + `db_engine` fixture；`admin_token` fixture 由后续鉴权 Task 追加）
- Test `backend/tests/test_health.py`
- Test `backend/tests/test_db_pragma.py`

**Interfaces:**
- Consumes: 无（后端首个 Task）。但严格遵守共享契约的命名：`engine` / `get_session` / `limiter` / FastAPI `app` / API 路径 `GET /api/health`。
- Produces（后续 Task 依赖的精确名称与类型）：
  - `app.db.engine: sqlalchemy.engine.Engine`（已挂 connect 事件，强制 `foreign_keys=ON` / `journal_mode=WAL` / `busy_timeout=5000`）
  - `app.db.create_db_engine(url: str) -> Engine`（同样 PRAGMA；conftest 复用）
  - `app.db.get_session() -> Generator[Session, None, None]`（FastAPI 依赖；后续 CRUD 路由注入）
  - `app.auth.limiter: slowapi.Limiter`（`key_func=get_remote_address`；登录路由 `@limiter.limit("5/minute")` 复用）
  - `app.main.app: fastapi.FastAPI`（lifespan 内 `SQLModel.metadata.create_all(engine)`；后续 Task 在此挂 routers）
  - conftest `client` fixture（TestClient，临时文件 SQLite，应用同样 PRAGMA，override `get_session`）；`db_engine` fixture（测试用引擎）

---

- [ ] **Step 1: 创建 `pyproject.toml` + `app` 包并安装依赖**

`backend/pyproject.toml`：
```toml
[project]
name = "xjxz-backend"
version = "0.1.0"
description = "玄鉴仙族 character wiki backend"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110",
    "sqlmodel>=0.0.16",
    "uvicorn[standard]>=0.29",
    "pyjwt>=2.8",
    "passlib[bcrypt]>=1.7.4",
    "slowapi>=0.1.9",
    "python-multipart>=0.0.9",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "httpx>=0.27",
]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["."]
include = ["app*"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

`backend/app/__init__.py`：
```python
```
（空文件，标记 `app` 为包）

安装：
```bash
cd backend && pip install -e ".[dev]"
```

- [ ] **Step 2: 写失败测试（健康检查 + PRAGMA）**

`backend/tests/test_health.py`：
```python
def test_health_returns_ok(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

`backend/tests/test_db_pragma.py`：
```python
def test_foreign_keys_pragma_is_on(db_engine):
    # 每个新连接都应被 connect 事件强制开启外键，否则级联删除静默失效
    with db_engine.connect() as conn:
        foreign_keys = conn.exec_driver_sql("PRAGMA foreign_keys").scalar()
        journal_mode = conn.exec_driver_sql("PRAGMA journal_mode").scalar()
        busy_timeout = conn.exec_driver_sql("PRAGMA busy_timeout").scalar()
    assert foreign_keys == 1
    assert str(journal_mode).lower() == "wal"
    assert busy_timeout == 5000
```

- [ ] **Step 3: 跑测试确认失败**

```bash
cd backend && python -m pytest -v
```
期望：collection 阶段报错 `ModuleNotFoundError: No module named 'app.db'`（或 `app.main`），因为 `conftest.py` / `app` 实现尚未创建，pytest 以 ERROR 退出（非 0）。

- [ ] **Step 4: 写 `app/auth.py`（仅 limiter）**

`backend/app/auth.py`：
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

# 登录限流用；后续鉴权 Task 在本文件追加 verify_password / JWT / require_admin。
limiter = Limiter(key_func=get_remote_address)
```

- [ ] **Step 5: 写 `app/db.py`（engine + PRAGMA connect 事件 + get_session）**

`backend/app/db.py`：
```python
import os
from collections.abc import Generator

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, create_engine

# DB 文件名固定 xjxz.db；测试通过 XJXZ_DB_PATH 指向临时文件。
DB_PATH = os.environ.get("XJXZ_DB_PATH", "xjxz.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"


def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:
    """每个物理连接建立时强制 PRAGMA（默认 foreign_keys=OFF，必须显式开）。"""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA busy_timeout = 5000")
    cursor.close()


def create_db_engine(url: str) -> Engine:
    """构造引擎并挂 connect 事件；生产与测试共用，保证 PRAGMA 一致。"""
    new_engine = create_engine(url, connect_args={"check_same_thread": False})
    event.listen(new_engine, "connect", _set_sqlite_pragma)
    return new_engine


engine = create_db_engine(DATABASE_URL)


def get_session() -> Generator[Session, None, None]:
    """FastAPI 依赖：每请求一个 Session。"""
    with Session(engine) as session:
        yield session
```

- [ ] **Step 6: 写 `app/main.py`（FastAPI + lifespan create_all + 挂 limiter + /api/health）**

`backend/app/main.py`：
```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlmodel import SQLModel

from app.auth import limiter
from app.db import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # create_all 只建尚不存在的表；模型由后续 Task 导入后生效（schema 演进走 migrations/）。
    SQLModel.metadata.create_all(engine)
    yield


app = FastAPI(title="玄鉴仙族 character wiki", lifespan=lifespan)

# slowapi 接线：限流装饰器依赖 app.state.limiter + 异常处理器。
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 7: 写 `tests/conftest.py`（临时文件 SQLite + 同样 PRAGMA 的 TestClient）**

`backend/tests/conftest.py`：
```python
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
test_engine = create_db_engine(os.environ["XJXZ_DB_PATH"])


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
```

- [ ] **Step 8: 跑测试确认通过**

```bash
cd backend && python -m pytest -v
```
期望：`tests/test_db_pragma.py::test_foreign_keys_pragma_is_on PASSED` 与 `tests/test_health.py::test_health_returns_ok PASSED`，共 2 passed，退出码 0。

- [ ] **Step 9: 提交**

```bash
cd backend && git add pyproject.toml app/__init__.py app/auth.py app/db.py app/main.py tests/conftest.py tests/test_health.py tests/test_db_pragma.py
git commit -m "feat(backend): scaffold fastapi app with sqlite pragma engine and health check"
```

---

### Task 2: 数据模型 `app/models.py`(枚举 + Character + Relationship)

**Files:**
- Create: `/Users/rick/SourceLib/fishNotExist/xjxz/backend/app/models.py`
- Test: `/Users/rick/SourceLib/fishNotExist/xjxz/backend/tests/test_models.py`

**Interfaces:**
- **Consumes(来自 Task 1):**
  - `backend/pyproject.toml` 已声明依赖并 `pip install -e .`,使 `app` 包可导入;`sqlmodel`、`sqlalchemy`、`pytest` 已安装。
  - `backend/app/__init__.py` 已存在(空 `app` 包)。
  - SQLite `PRAGMA foreign_keys = ON` 的语义(Task 1 在 `app/db.py` 的 `connect` 事件里对每个连接执行);本 Task 的测试自建临时引擎并复刻同一 `connect` 事件以端到端验证级联。
- **Produces(后续 Task 依赖的精确名称与类型):**
  - 枚举(均为 `str, Enum`):`Gender(male|female|unknown)`、`Status(alive|dead|unknown)`、`RelType(parent|spouse|master|sibling)`、`ParentRole(father|mother|adoptive|unknown)`。
  - `Character(SQLModel, table=True)`:`__tablename__="characters"`;字段 `id, name, aliases, gender, generation, realm, affiliation, status, avatar_url, bio, notes, created_at, updated_at`。
  - `Relationship(SQLModel, table=True)`:`__tablename__="relationships"`;`__table_args__=(UniqueConstraint("from_id","to_id","type"),)`;`from_id`/`to_id` 为 `FK characters.id ON DELETE CASCADE` 且建索引;字段 `id, from_id, to_id, type, parent_role, note`。
  - 这些类型被 Task 3(`db.py` `create_all`)、Task 4+(schemas/routers)、`relations.py` 直接 `from app.models import ...`。

---

- [ ] **Step 1: 写失败测试**

  写入 `/Users/rick/SourceLib/fishNotExist/xjxz/backend/tests/test_models.py`:

  ```python
  from sqlalchemy import event
  from sqlalchemy.exc import IntegrityError
  from sqlmodel import Session, SQLModel, create_engine, select

  import pytest

  from app.models import (
      Character,
      Gender,
      ParentRole,
      RelType,
      Relationship,
      Status,
  )


  @pytest.fixture
  def engine(tmp_path):
      """临时文件 SQLite 引擎,复刻 db.py 的 PRAGMA foreign_keys=ON connect 事件,
      以便端到端验证 FK 级联删除。"""
      db_path = tmp_path / "test.db"
      eng = create_engine(f"sqlite:///{db_path}")

      @event.listens_for(eng, "connect")
      def _set_sqlite_pragma(dbapi_connection, _connection_record):
          cursor = dbapi_connection.cursor()
          cursor.execute("PRAGMA foreign_keys=ON")
          cursor.close()

      SQLModel.metadata.create_all(eng)
      return eng


  def test_create_character_applies_defaults(engine):
      c = Character(name="叶老魔")
      # 写入前的 Python 侧默认值
      assert c.aliases == []
      assert c.gender is Gender.unknown
      assert c.status is Status.alive
      assert c.created_at.tzinfo is not None  # tz-aware UTC
      assert c.updated_at.tzinfo is not None

      with Session(engine) as session:
          session.add(c)
          session.commit()
          session.refresh(c)
          assert c.id is not None
          assert c.name == "叶老魔"
          assert c.notes is None


  def test_create_relationship(engine):
      with Session(engine) as session:
          father = Character(name="父")
          child = Character(name="子")
          session.add(father)
          session.add(child)
          session.commit()

          rel = Relationship(
              from_id=father.id,
              to_id=child.id,
              type=RelType.parent,
              parent_role=ParentRole.father,
          )
          session.add(rel)
          session.commit()
          session.refresh(rel)

          assert rel.id is not None
          assert rel.from_id == father.id
          assert rel.to_id == child.id
          assert rel.type is RelType.parent
          assert rel.parent_role is ParentRole.father


  def test_duplicate_edge_raises_integrity_error(engine):
      with Session(engine) as session:
          a = Character(name="A")
          b = Character(name="B")
          session.add(a)
          session.add(b)
          session.commit()

          session.add(Relationship(from_id=a.id, to_id=b.id, type=RelType.spouse))
          session.commit()

          session.add(Relationship(from_id=a.id, to_id=b.id, type=RelType.spouse))
          with pytest.raises(IntegrityError):
              session.commit()


  def test_delete_character_cascades_relationships(engine):
      with Session(engine) as session:
          a = Character(name="A")
          b = Character(name="B")
          session.add(a)
          session.add(b)
          session.commit()

          session.add(Relationship(from_id=a.id, to_id=b.id, type=RelType.master))
          session.commit()

          # 无 ORM relationship() 映射:删除 a 仅向 DB 发 DELETE,
          # 关系行被清空 <=> FK pragma + ON DELETE CASCADE 生效。
          session.delete(a)
          session.commit()

          rows = session.exec(select(Relationship)).all()
          assert rows == []
          # b 仍在,确认只级联删了引用 a 的关系,没误删人物
          assert session.exec(select(Character).where(Character.name == "B")).first() is not None
  ```

- [ ] **Step 2: 跑测试确认失败**

  命令:
  ```bash
  cd /Users/rick/SourceLib/fishNotExist/xjxz/backend && python -m pytest tests/test_models.py -v
  ```
  期望:collection 阶段即报 `ModuleNotFoundError: No module named 'app.models'`(或 `ImportError: cannot import name 'Character'`),4 个用例全 error/fail。

- [ ] **Step 3: 写最小实现**

  写入 `/Users/rick/SourceLib/fishNotExist/xjxz/backend/app/models.py`:

  ```python
  """SQLModel 表模型:人物(characters)与关系(relationships)。

  对应设计文档 §4.1 / §4.2。枚举均为 str Enum,name==value,
  便于 SQLAlchemy Enum 列与 JSON/前端枚举值保持一致。
  """

  from datetime import datetime, timezone
  from enum import Enum

  from sqlalchemy import JSON, Column, ForeignKey, Integer, UniqueConstraint
  from sqlmodel import Field, SQLModel


  def _utcnow() -> datetime:
      """tz-aware 当前 UTC 时间。"""
      return datetime.now(timezone.utc)


  class Gender(str, Enum):
      male = "male"
      female = "female"
      unknown = "unknown"


  class Status(str, Enum):
      alive = "alive"
      dead = "dead"
      unknown = "unknown"


  class RelType(str, Enum):
      parent = "parent"
      spouse = "spouse"
      master = "master"
      sibling = "sibling"


  class ParentRole(str, Enum):
      father = "father"
      mother = "mother"
      adoptive = "adoptive"
      unknown = "unknown"


  class Character(SQLModel, table=True):
      __tablename__ = "characters"

      id: int | None = Field(default=None, primary_key=True)
      name: str = Field(index=True)
      aliases: list[str] = Field(default_factory=list, sa_column=Column(JSON))
      gender: Gender = Field(default=Gender.unknown)
      generation: str | None = None
      realm: str | None = None
      affiliation: str | None = None
      status: Status = Field(default=Status.alive)
      avatar_url: str | None = None
      bio: str | None = None
      notes: str | None = None
      created_at: datetime = Field(default_factory=_utcnow)
      updated_at: datetime = Field(
          default_factory=_utcnow,
          sa_column_kwargs={"onupdate": _utcnow},
      )


  class Relationship(SQLModel, table=True):
      __tablename__ = "relationships"
      __table_args__ = (UniqueConstraint("from_id", "to_id", "type"),)

      id: int | None = Field(default=None, primary_key=True)
      from_id: int = Field(
          sa_column=Column(
              "from_id",
              Integer,
              ForeignKey("characters.id", ondelete="CASCADE"),
              index=True,
              nullable=False,
          )
      )
      to_id: int = Field(
          sa_column=Column(
              "to_id",
              Integer,
              ForeignKey("characters.id", ondelete="CASCADE"),
              index=True,
              nullable=False,
          )
      )
      type: RelType
      parent_role: ParentRole | None = None
      note: str | None = None
  ```

- [ ] **Step 4: 跑测试确认通过**

  命令:
  ```bash
  cd /Users/rick/SourceLib/fishNotExist/xjxz/backend && python -m pytest tests/test_models.py -v
  ```
  期望:`4 passed`。特别是 `test_delete_character_cascades_relationships` 通过 ⇒ 临时引擎的 `PRAGMA foreign_keys=ON` 让 `ON DELETE CASCADE` 在 DB 层生效;`test_duplicate_edge_raises_integrity_error` 通过 ⇒ `UNIQUE(from_id,to_id,type)` 生效。

- [ ] **Step 5: 提交**

  ```bash
  cd /Users/rick/SourceLib/fishNotExist/xjxz/backend && git add app/models.py tests/test_models.py && git commit -m "feat(models): add character and relationship sqlmodel tables"
  ```

---

### Task 3: 鉴权基线 — config / auth / login 路由 + conftest 鉴权 fixture

**Files:**
- Create: `backend/app/config.py`
- Create: `backend/app/auth.py`
- Create: `backend/app/routers/auth.py`
- Create/Test: `backend/tests/conftest.py`
- Test: `backend/tests/test_auth.py`

**Interfaces:**

Consumes (来自 Task 1 项目骨架,精确名称):
- `backend/app/__init__.py`、`backend/app/routers/__init__.py`(空包文件,使 `app` / `app.routers` 可导入)
- `backend/pyproject.toml` 已声明依赖:`fastapi`, `pyjwt`, `passlib[bcrypt]`, `slowapi`, `python-multipart`, 测试 `pytest` + `httpx`,且 `[tool.pytest.ini_options] pythonpath = ["."]`(使 `import app` 在 `backend/` 下解析)

Produces(后续 Task 依赖的精确签名,改名即 bug):
- `app.config.Settings`(`JWT_SECRET: str`, `ADMIN_PASSWORD_HASH: str`)、`app.config.get_settings() -> Settings`(`lru_cache`,缺任一环境变量抛 `RuntimeError`)
- `app.auth.verify_password(plain: str, password_hash: str) -> bool`
- `app.auth.create_access_token() -> str`(HS256,payload `{"sub":"admin","exp":now+7d}`)
- `app.auth.decode_token(token: str) -> dict`(`algorithms=["HS256"]`,失败抛)
- `app.auth.require_admin(authorization: str = Header(None)) -> None`(无/非法 Bearer → `HTTPException(401)`)
- `app.auth.limiter`(`Limiter(key_func=get_remote_address)`,供登录路由 `@limiter.limit("5/minute")` 及 Task(main.py)挂载 `app.state.limiter` + 异常处理器)
- `app.routers.auth.router`(`APIRouter`,含 `POST /api/login`;由 main.py `include_router`)
- `tests/conftest.py` 暴露 fixture:`client`(挂载 auth 路由的 FastAPI TestClient)、`admin_token`(有效 JWT 字符串)、`admin_password`(测试明文口令);并在导入前注入 `JWT_SECRET` / `ADMIN_PASSWORD_HASH` 环境变量、提供 autouse 的限流重置

生成 `ADMIN_PASSWORD_HASH`(部署时,后端永不接触明文,原始口令 ≥16 位随机):
```bash
python -c "from passlib.hash import bcrypt; print(bcrypt.hash('你的密码'))"
```

---

- [ ] **Step 1: 写 config fail-fast 失败测试**

创建 `backend/tests/test_auth.py`:
```python
import importlib

import pytest


def test_get_settings_reads_env(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "x" * 32)
    monkeypatch.setenv("ADMIN_PASSWORD_HASH", "$2b$12$abcdefghijklmnopqrstuv")
    from app import config

    config.get_settings.cache_clear()
    settings = config.get_settings()
    assert settings.JWT_SECRET == "x" * 32
    assert settings.ADMIN_PASSWORD_HASH.startswith("$2b$")


def test_get_settings_fail_fast_when_missing(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD_HASH", raising=False)
    from app import config

    config.get_settings.cache_clear()
    with pytest.raises(RuntimeError):
        config.get_settings()
    config.get_settings.cache_clear()
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/backend && python -m pytest tests/test_auth.py -q
```
期望:`ModuleNotFoundError: No module named 'app.config'`(collection error)。

- [ ] **Step 3: 写 config 最小实现**

创建 `backend/app/config.py`:
```python
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
```

- [ ] **Step 4: 跑 config 测试确认通过**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/backend && python -m pytest tests/test_auth.py -q
```
期望:`2 passed`。

- [ ] **Step 5: 写 auth 函数失败测试**

在 `backend/tests/test_auth.py` 追加(`require_admin` 直接单元调用,不走 HTTP):
```python
from fastapi import HTTPException


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
```

注:`create_access_token` / `decode_token` 依赖 `get_settings()`,由下一步起的 `conftest.py` 在导入前注入环境变量;若此刻 conftest 未就绪,这些用例会因 `RuntimeError` 失败 —— 属预期红灯。

- [ ] **Step 6: 跑测试确认失败**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/backend && python -m pytest tests/test_auth.py -q
```
期望:新增用例报 `ModuleNotFoundError: No module named 'app.auth'`。

- [ ] **Step 7: 写 auth 最小实现**

创建 `backend/app/auth.py`:
```python
"""鉴权原语:bcrypt 校验 + JWT 签发/校验 + admin 依赖 + 登录限流器。"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Header, HTTPException, status
from passlib.context import CryptContext
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 登录限流器(单机内存计数);main.py 负责挂 app.state.limiter + 异常处理器。
limiter = Limiter(key_func=get_remote_address)

_TOKEN_TTL = timedelta(days=7)


def verify_password(plain: str, password_hash: str) -> bool:
    """bcrypt 校验明文口令是否匹配哈希。"""
    return _pwd_context.verify(plain, password_hash)


def create_access_token() -> str:
    """签发 HS256 JWT,payload {sub: admin, exp: now+7d}。"""
    settings = get_settings()
    payload = {
        "sub": "admin",
        "exp": datetime.now(timezone.utc) + _TOKEN_TTL,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    """解码并校验 JWT;无效/过期抛 jwt.PyJWTError 子类。"""
    settings = get_settings()
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])


def require_admin(authorization: str = Header(None)) -> None:
    """FastAPI 依赖:校验 Bearer JWT;缺失/非法/非 admin → 401。"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc
    if payload.get("sub") != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
```

- [ ] **Step 8: 写 conftest(注入环境 + fixture)**

创建 `backend/tests/conftest.py`(模块顶部在导入 `app.*` 前注入环境变量,故无法用 `monkeypatch`):
```python
"""测试夹具:注入鉴权环境变量,提供 client / admin_token / 限流重置。"""
from __future__ import annotations

import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from passlib.hash import bcrypt
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# 已知测试口令(≥16 位)及其 bcrypt 哈希,导入 app 之前注入环境。
TEST_PASSWORD = "test-admin-password-0123456789"
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-pytest-32bytes-minimum-xx")
os.environ.setdefault("ADMIN_PASSWORD_HASH", bcrypt.hash(TEST_PASSWORD))

from app import config  # noqa: E402
from app.auth import create_access_token, limiter  # noqa: E402
from app.routers import auth as auth_router  # noqa: E402

config.get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _reset_limiter() -> None:
    """每个用例前清空内存限流计数,避免跨用例污染。"""
    limiter.reset()


@pytest.fixture
def admin_password() -> str:
    return TEST_PASSWORD


@pytest.fixture
def app() -> FastAPI:
    """挂载 auth 路由 + 限流器的最小应用(供鉴权测试)。"""
    application = FastAPI()
    application.state.limiter = limiter
    application.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    application.include_router(auth_router.router)
    return application


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


@pytest.fixture
def admin_token() -> str:
    return create_access_token()
```

- [ ] **Step 9: 跑 auth 函数测试确认通过**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/backend && python -m pytest tests/test_auth.py -q
```
期望:此刻 `app.routers.auth` 仍缺失(conftest 第 `from app.routers import auth` 行导入失败)→ collection error `ModuleNotFoundError: No module named 'app.routers.auth'`。这是预期红灯,触发下一步实现路由。

- [ ] **Step 10: 写登录路由失败测试**

在 `backend/tests/test_auth.py` 追加:
```python
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
```

- [ ] **Step 11: 写登录路由最小实现**

创建 `backend/app/routers/auth.py`:
```python
"""登录路由:校验口令签发 JWT,按源 IP 限流 5/min。"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.auth import create_access_token, limiter, verify_password
from app.config import get_settings

router = APIRouter(prefix="/api", tags=["auth"])


class LoginRequest(BaseModel):
    password: str


class TokenResponse(BaseModel):
    token: str


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest) -> TokenResponse:
    """口令正确返回 JWT;失败统一 401(不区分原因)。"""
    settings = get_settings()
    if not verify_password(body.password, settings.ADMIN_PASSWORD_HASH):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    return TokenResponse(token=create_access_token())
```

注:`@limiter.limit` 要求被装路由含 `request: Request` 形参;`body: LoginRequest` 提供 `{"password": str}` 入参。

- [ ] **Step 12: 跑全部 auth 测试确认通过**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/backend && python -m pytest tests/test_auth.py -q
```
期望:全部用例 `passed`(config 2 + auth 函数 7 + 登录 3 = 12 passed)。

- [ ] **Step 13: 提交**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz && git add backend/app/config.py backend/app/auth.py backend/app/routers/auth.py backend/tests/conftest.py backend/tests/test_auth.py && git commit -m "feat(auth): add settings fail-fast, jwt/bcrypt auth and rate-limited login"
```

---

### Task 4: 人物 schema 与 CRUD 路由(公开读排除 notes,管理写需登录,删除级联清关系)

**Files:**
- Modify: `backend/app/schemas.py` (新增 `PublicCharacter`/`AdminCharacter`/`CharacterCreate`/`CharacterUpdate`/`RelationshipRead`/`CharacterDetail`)
- Create: `backend/app/routers/characters.py`
- Modify: `backend/app/main.py` (挂载 characters router)
- Test: `backend/tests/test_characters.py`

**Interfaces:**

Consumes(前序 Task 已产出,签名不可改):
- `app/models.py`: `Character`, `Relationship`(SQLModel table),枚举 `Gender/Status/RelType/ParentRole`
- `app/db.py`: `get_session`(FastAPI 依赖,`yield Session`)
- `app/auth.py`: `require_admin`(FastAPI 依赖,无/非法 Bearer → `HTTPException(401)`)
- `app/main.py`: 已存在 `app` 实例、`create_all`、已挂载 `auth` router、`limiter`
- `tests/conftest.py`: `client`(TestClient,临时 SQLite,应用同样 PRAGMA),`admin_token`(`str`,有效 Bearer token 值)

Produces(后续 Task 依赖,命名/类型锁定):
- `app/schemas.py::PublicCharacter` — 字段 `id,name,aliases,gender,generation,realm,affiliation,status,avatar_url,bio`(显式不含 `notes`)
- `app/schemas.py::AdminCharacter` — `PublicCharacter` 全部 + `notes,created_at,updated_at`
- `app/schemas.py::CharacterCreate` — `name` 必填,其余可选(含可选 `notes`)
- `app/schemas.py::CharacterUpdate` — 全部可选
- `app/schemas.py::RelationshipRead` — `id,from_id,to_id,type,parent_role,note`
- `app/schemas.py::CharacterDetail` — `PublicCharacter` 全部 + `relationships: list[RelationshipRead]`(公开,不含 notes)
- `app/routers/characters.py::router` — `APIRouter(prefix="/api")`,挂载于 `app/main.py`
- API:`GET /api/characters`、`GET /api/characters/{id}`、`POST /api/characters`、`PUT /api/characters/{id}`、`DELETE /api/characters/{id}`

---

- [ ] **Step 1: 写 schema 失败测试**

在 `backend/tests/test_characters.py` 写(先只写 schema 形状相关 + 路由行为的完整测试,后续步骤逐步转绿):

```python
# backend/tests/test_characters.py
from app.schemas import (
    PublicCharacter,
    AdminCharacter,
    CharacterCreate,
    CharacterUpdate,
    CharacterDetail,
    RelationshipRead,
)


def test_public_character_excludes_notes():
    fields = set(PublicCharacter.model_fields.keys())
    assert "notes" not in fields
    assert fields == {
        "id",
        "name",
        "aliases",
        "gender",
        "generation",
        "realm",
        "affiliation",
        "status",
        "avatar_url",
        "bio",
    }


def test_admin_character_includes_notes_and_timestamps():
    fields = set(AdminCharacter.model_fields.keys())
    assert "notes" in fields
    assert {"created_at", "updated_at"}.issubset(fields)


def test_character_create_requires_name_only():
    c = CharacterCreate(name="叶凡")
    assert c.name == "叶凡"
    assert c.aliases == []


def test_character_update_all_optional():
    u = CharacterUpdate()
    assert u.model_dump(exclude_unset=True) == {}


def test_character_detail_has_relationships():
    assert "relationships" in CharacterDetail.model_fields
    assert "notes" not in CharacterDetail.model_fields
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/backend && python -m pytest tests/test_characters.py -q
```

期望:`ImportError`/`AttributeError`，无法从 `app.schemas` 导入 `PublicCharacter` 等(collection error,0 passed)。

- [ ] **Step 3: 写 schema 实现**

在 `backend/app/schemas.py` 追加(沿用文件已有的 `from __future__ import annotations` / `datetime` / 枚举导入;若缺则补):

```python
# backend/app/schemas.py
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models import Gender, ParentRole, RelType, Status


class PublicCharacter(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    aliases: list[str]
    gender: Gender
    generation: str | None = None
    realm: str | None = None
    affiliation: str | None = None
    status: Status
    avatar_url: str | None = None
    bio: str | None = None


class AdminCharacter(PublicCharacter):
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class CharacterCreate(BaseModel):
    name: str
    aliases: list[str] = []
    gender: Gender = Gender.unknown
    generation: str | None = None
    realm: str | None = None
    affiliation: str | None = None
    status: Status = Status.alive
    avatar_url: str | None = None
    bio: str | None = None
    notes: str | None = None


class CharacterUpdate(BaseModel):
    name: str | None = None
    aliases: list[str] | None = None
    gender: Gender | None = None
    generation: str | None = None
    realm: str | None = None
    affiliation: str | None = None
    status: Status | None = None
    avatar_url: str | None = None
    bio: str | None = None
    notes: str | None = None


class RelationshipRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    from_id: int
    to_id: int
    type: RelType
    parent_role: ParentRole | None = None
    note: str | None = None


class CharacterDetail(PublicCharacter):
    relationships: list[RelationshipRead] = []
```

> 注:`RelationshipCreate`/`ImportPayload`/`ExportPayload` 由后续 Task(5/6)在同文件追加,本步不写,避免占位。

- [ ] **Step 4: 跑 schema 测试确认通过**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/backend && python -m pytest tests/test_characters.py -q
```

期望:5 个测试全 passed(路由测试本步尚未添加)。

- [ ] **Step 5: 写路由行为失败测试**

在 `backend/tests/test_characters.py` 追加:

```python
def _make(client, token, **over):
    body = {"name": "默认人物"}
    body.update(over)
    return client.post(
        "/api/characters",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
    )


def test_anonymous_get_detail_has_no_notes_key(client, admin_token):
    r = _make(client, admin_token, name="叶凡", notes="作者私密设定")
    assert r.status_code == 200
    cid = r.json()["id"]

    detail = client.get(f"/api/characters/{cid}")
    assert detail.status_code == 200
    data = detail.json()
    assert "notes" not in data
    assert data["name"] == "叶凡"
    assert data["relationships"] == []


def test_admin_create_returns_notes(client, admin_token):
    r = _make(client, admin_token, name="庞博", notes="隐藏剧情")
    assert r.status_code == 200
    body = r.json()
    assert body["notes"] == "隐藏剧情"
    assert "created_at" in body and "updated_at" in body


def test_unauthenticated_post_is_401(client):
    r = client.post("/api/characters", json={"name": "无权用户"})
    assert r.status_code == 401


def test_list_returns_public_shape(client, admin_token):
    _make(client, admin_token, name="李黑水")
    r = client.get("/api/characters")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert all("notes" not in it for it in items)


def test_update_refreshes_and_returns_admin(client, admin_token):
    cid = _make(client, admin_token, name="原名").json()["id"]
    r = client.put(
        f"/api/characters/{cid}",
        json={"name": "改名", "notes": "更新备注"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "改名"
    assert r.json()["notes"] == "更新备注"


def test_get_missing_returns_404(client):
    assert client.get("/api/characters/999999").status_code == 404


def test_delete_cascades_relationships(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    a = _make(client, admin_token, name="师父").json()["id"]
    b = _make(client, admin_token, name="徒弟").json()["id"]
    rel = client.post(
        "/api/relationships",
        json={"from_id": a, "to_id": b, "type": "master"},
        headers=h,
    )
    assert rel.status_code == 200

    d = client.delete(f"/api/characters/{a}", headers=h)
    assert d.status_code == 204

    remaining = client.get("/api/relationships").json()
    assert all(r["from_id"] != a and r["to_id"] != a for r in remaining)
```

> 该测试依赖 Task 5 的 `POST /api/relationships` 与 `GET /api/relationships`。若 Task 5 尚未实现,`test_delete_cascades_relationships` 暂会失败,标记为本任务的级联回归测试;其余 6 个路由测试本任务即可全绿。删除级联本身由本步实现保证(显式删关系行),与 Task 5 解耦。

- [ ] **Step 6: 跑测试确认路由测试失败**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/backend && python -m pytest tests/test_characters.py -q
```

期望:schema 5 个 passed;新增路由测试报 404(路由未注册,`POST /api/characters` 返回 404 而非 401/200),失败。

- [ ] **Step 7: 写路由实现**

创建 `backend/app/routers/characters.py`:

```python
# backend/app/routers/characters.py
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlmodel import Session, select

from app.auth import require_admin
from app.db import get_session
from app.models import Character, Relationship
from app.schemas import (
    AdminCharacter,
    CharacterCreate,
    CharacterDetail,
    CharacterUpdate,
    PublicCharacter,
    RelationshipRead,
)

router = APIRouter(prefix="/api", tags=["characters"])


def _get_or_404(session: Session, character_id: int) -> Character:
    character = session.get(Character, character_id)
    if character is None:
        raise HTTPException(status_code=404, detail="character not found")
    return character


@router.get("/characters", response_model=list[PublicCharacter])
def list_characters(
    limit: int = Query(500, ge=1, le=500),
    session: Session = Depends(get_session),
) -> list[Character]:
    return session.exec(select(Character).limit(limit)).all()


@router.get("/characters/{character_id}", response_model=CharacterDetail)
def get_character(
    character_id: int,
    session: Session = Depends(get_session),
) -> CharacterDetail:
    character = _get_or_404(session, character_id)
    rels = session.exec(
        select(Relationship).where(
            (Relationship.from_id == character_id)
            | (Relationship.to_id == character_id)
        )
    ).all()
    detail = CharacterDetail.model_validate(character)
    detail.relationships = [RelationshipRead.model_validate(r) for r in rels]
    return detail


@router.post(
    "/characters",
    response_model=AdminCharacter,
    dependencies=[Depends(require_admin)],
)
def create_character(
    payload: CharacterCreate,
    session: Session = Depends(get_session),
) -> Character:
    character = Character(**payload.model_dump())
    session.add(character)
    session.commit()
    session.refresh(character)
    return character


@router.put(
    "/characters/{character_id}",
    response_model=AdminCharacter,
    dependencies=[Depends(require_admin)],
)
def update_character(
    character_id: int,
    payload: CharacterUpdate,
    session: Session = Depends(get_session),
) -> Character:
    character = _get_or_404(session, character_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(character, field, value)
    character.updated_at = datetime.now(timezone.utc)
    session.add(character)
    session.commit()
    session.refresh(character)
    return character


@router.delete(
    "/characters/{character_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
def delete_character(
    character_id: int,
    session: Session = Depends(get_session),
) -> Response:
    character = _get_or_404(session, character_id)
    rels = session.exec(
        select(Relationship).where(
            (Relationship.from_id == character_id)
            | (Relationship.to_id == character_id)
        )
    ).all()
    for rel in rels:
        session.delete(rel)
    session.delete(character)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

> 删除显式删关系是双保险:即使建表时 `ondelete=CASCADE` 在某些连接未启用 `PRAGMA foreign_keys=ON`,关系仍被清,满足级联回归测试。

- [ ] **Step 8: 挂载 router 到 main**

在 `backend/app/main.py` 已有 router 挂载处追加(沿用现有 import 风格):

```python
# backend/app/main.py 中,与已有 auth router 并列
from app.routers import characters as characters_router

app.include_router(characters_router.router)
```

- [ ] **Step 9: 跑测试确认通过**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/backend && python -m pytest tests/test_characters.py -q
```

期望:除 `test_delete_cascades_relationships` 依赖 Task 5 的 `/api/relationships` 端点外,其余全部 passed。若 Task 5 已合入则该用例亦绿;否则它作为待 Task 5 接通的级联回归用例(本任务的 DELETE 实现已保证级联语义)。运行全量回归确认无破坏:

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/backend && python -m pytest -q
```

- [ ] **Step 10: 提交**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/backend && git add app/schemas.py app/routers/characters.py app/main.py tests/test_characters.py && git commit -m "feat(characters): add character schemas and CRUD routes with public notes exclusion"
```

期望:一个 commit 完成人物 schema + CRUD 路由 + 测试;`git diff --cached` 仅含上述四个文件,无无关改动。

---

### Task 5: 关系纯函数 (relations.py) + 关系 schema + 关系 CRUD 路由

**Files:**
- Create: `backend/app/relations.py`
- Modify: `backend/app/schemas.py` (只追加 `RelationshipCreate`;`RelationshipRead` 已由 Task 4 定义)
- Create: `backend/app/routers/relationships.py`
- Modify: `backend/app/main.py` (挂载 relationships router)
- Test: `backend/tests/test_relations.py`, `backend/tests/test_relationships.py`

**Interfaces:**
- Consumes(前序 Task):
  - `app/models.py`: `Relationship`(SQLModel table, 字段 `id/from_id/to_id/type/parent_role/note`, `UniqueConstraint("from_id","to_id","type")`)、`RelType`(`parent|spouse|master|sibling`)、`ParentRole`(`father|mother|adoptive|unknown`)、`Character`
  - `app/db.py`: `get_session`(FastAPI 依赖, yield `Session`,connect 事件已 `PRAGMA foreign_keys=ON`)
  - `app/auth.py`: `require_admin(authorization: str = Header(None)) -> None`(无/非法 Bearer → 401)
  - `app/main.py`: `app: FastAPI`(已 `create_all` + 挂载其他 routers)
  - `app/routers/characters.py`: `POST /api/characters`(返回 `AdminCharacter`, 200)、`GET /api/characters/{id}`(返回 `CharacterDetail`,`relationships` 走 `from_id=:id OR to_id=:id` 双向)
  - `tests/conftest.py`: `client`(TestClient, 临时文件 SQLite + 同样 PRAGMA)、`admin_token`(str)
- Produces(后续 Task 依赖):
  - `app/relations.py`: `normalize_symmetric(from_id:int, to_id:int, type:RelType) -> tuple[int,int]`；`would_create_cycle(session, from_id:int, to_id:int) -> bool`
  - `app/schemas.py`: `RelationshipCreate`(from_id,to_id,type,parent_role?,note?)。(`RelationshipRead` 由 Task 4 提供,本 Task 复用)
  - `app/routers/relationships.py`: `router: APIRouter`(被 io.py / main.py 复用响应模型；前端 `listRelationships/createRelationship/deleteRelationship` 对接)

---

- [ ] **Step 1: 写失败测试 — relations 纯函数单测**

创建 `backend/tests/test_relations.py`(自带内存 SQLite,不依赖 conftest,纯单测):

```python
from sqlmodel import Session, SQLModel, create_engine

from app.models import Relationship, RelType
from app.relations import normalize_symmetric, would_create_cycle


def _make_session() -> Session:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_normalize_symmetric_spouse_orders_min_max():
    assert normalize_symmetric(5, 2, RelType.spouse) == (2, 5)
    assert normalize_symmetric(2, 5, RelType.spouse) == (2, 5)


def test_normalize_symmetric_sibling_orders_min_max():
    assert normalize_symmetric(9, 3, RelType.sibling) == (3, 9)


def test_normalize_symmetric_parent_keeps_order():
    assert normalize_symmetric(7, 1, RelType.parent) == (7, 1)


def test_normalize_symmetric_master_keeps_order():
    assert normalize_symmetric(7, 1, RelType.master) == (7, 1)


def test_would_create_cycle_direct_edge():
    session = _make_session()
    # 1 是 2 的父
    session.add(Relationship(from_id=1, to_id=2, type=RelType.parent))
    session.commit()
    # 再加 2->1(2 当 1 的父)会成环
    assert would_create_cycle(session, 2, 1) is True
    # 1->3 无环
    assert would_create_cycle(session, 1, 3) is False


def test_would_create_cycle_transitive_chain():
    session = _make_session()
    session.add(Relationship(from_id=1, to_id=2, type=RelType.parent))
    session.add(Relationship(from_id=2, to_id=3, type=RelType.parent))
    session.commit()
    # 1->2->3,再加 3->1 闭环
    assert would_create_cycle(session, 3, 1) is True
    assert would_create_cycle(session, 1, 4) is False
```

- [ ] **Step 2: 跑测试确认失败**

命令:`cd backend && python -m pytest tests/test_relations.py -v`
期望:collection/import 阶段报错 `ModuleNotFoundError: No module named 'app.relations'`(red)。

- [ ] **Step 3: 写最小实现 — app/relations.py**

创建 `backend/app/relations.py`:

```python
"""关系纯函数:对称类型归一 + parent 成环检测。"""

from sqlmodel import Session, select

from app.models import Relationship, RelType

SYMMETRIC_TYPES: set[RelType] = {RelType.spouse, RelType.sibling}


def normalize_symmetric(from_id: int, to_id: int, type: RelType) -> tuple[int, int]:
    """对称类型(spouse/sibling)返回 (min, max);非对称原样返回。"""
    if type in SYMMETRIC_TYPES:
        return (min(from_id, to_id), max(from_id, to_id))
    return (from_id, to_id)


def would_create_cycle(session: Session, from_id: int, to_id: int) -> bool:
    """新增 parent 边 from_id->to_id(from_id 为 to_id 的父)是否会成环。

    成环条件:to_id 已是 from_id 的祖先。即从 to_id 出发,沿 parent 边向下
    (to_id 作为某条 parent 的 from_id)DFS,若可达 from_id 则成环。
    visited 去重防止既有脏数据中的环导致死循环。
    """
    stack: list[int] = [to_id]
    visited: set[int] = set()
    while stack:
        node = stack.pop()
        if node == from_id:
            return True
        if node in visited:
            continue
        visited.add(node)
        children = session.exec(
            select(Relationship.to_id).where(
                Relationship.from_id == node,
                Relationship.type == RelType.parent,
            )
        ).all()
        stack.extend(children)
    return False
```

- [ ] **Step 4: 跑测试确认通过**

命令:`cd backend && python -m pytest tests/test_relations.py -v`
期望:6 passed(green)。

- [ ] **Step 5: 提交**

```bash
cd backend && git add app/relations.py tests/test_relations.py
git commit -m "feat(relations): add normalize_symmetric and parent cycle detection"
```

---

- [ ] **Step 6: 追加 schema — RelationshipCreate**

> ⚠️ **接缝说明:`RelationshipRead` 已在 Task 4 定义**(`CharacterDetail.relationships` 依赖它,故前置到了 Task 4 的 `schemas.py`)。本步**只追加 `RelationshipCreate`,不要再定义 `RelationshipRead`**,否则会重复声明。

在 `backend/app/schemas.py` 末尾追加(文件顶部应已有 `from pydantic import BaseModel, ConfigDict` 与 `from app.models import RelType, ParentRole`,Task 4 已导入,无需重复):

```python
class RelationshipCreate(BaseModel):
    from_id: int
    to_id: int
    type: RelType
    parent_role: ParentRole | None = None
    note: str | None = None
```

- [ ] **Step 7: 写失败测试 — 关系路由集成测**

创建 `backend/tests/test_relationships.py`:

```python
def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_character(client, token: str, name: str) -> int:
    resp = client.post("/api/characters", json={"name": name}, headers=_auth(token))
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def test_post_relationship_requires_admin(client, admin_token):
    a = _create_character(client, admin_token, "甲")
    b = _create_character(client, admin_token, "乙")
    resp = client.post(
        "/api/relationships",
        json={"from_id": a, "to_id": b, "type": "master"},
    )
    assert resp.status_code == 401


def test_symmetric_relationship_normalized_to_min_max(client, admin_token):
    a = _create_character(client, admin_token, "夫")
    b = _create_character(client, admin_token, "妻")
    assert a < b
    # 故意 from=b(大)->to=a(小),应被归一为 (a, b)
    resp = client.post(
        "/api/relationships",
        json={"from_id": b, "to_id": a, "type": "spouse"},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["from_id"] == a
    assert body["to_id"] == b


def test_spouse_visible_from_both_characters(client, admin_token):
    a = _create_character(client, admin_token, "道侣甲")
    b = _create_character(client, admin_token, "道侣乙")
    resp = client.post(
        "/api/relationships",
        json={"from_id": a, "to_id": b, "type": "spouse"},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 200, resp.text
    for cid in (a, b):
        detail = client.get(f"/api/characters/{cid}").json()
        edges = {(r["from_id"], r["to_id"], r["type"]) for r in detail["relationships"]}
        assert (a, b, "spouse") in edges


def test_self_relationship_rejected(client, admin_token):
    a = _create_character(client, admin_token, "独行")
    resp = client.post(
        "/api/relationships",
        json={"from_id": a, "to_id": a, "type": "spouse"},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 400


def test_parent_cycle_rejected(client, admin_token):
    parent = _create_character(client, admin_token, "父")
    child = _create_character(client, admin_token, "子")
    r1 = client.post(
        "/api/relationships",
        json={"from_id": parent, "to_id": child, "type": "parent", "parent_role": "father"},
        headers=_auth(admin_token),
    )
    assert r1.status_code == 200, r1.text
    # child 反过来当 parent 的父 -> 成环
    r2 = client.post(
        "/api/relationships",
        json={"from_id": child, "to_id": parent, "type": "parent", "parent_role": "father"},
        headers=_auth(admin_token),
    )
    assert r2.status_code == 400


def test_duplicate_relationship_conflict(client, admin_token):
    a = _create_character(client, admin_token, "师")
    b = _create_character(client, admin_token, "徒")
    payload = {"from_id": a, "to_id": b, "type": "master"}
    r1 = client.post("/api/relationships", json=payload, headers=_auth(admin_token))
    assert r1.status_code == 200, r1.text
    r2 = client.post("/api/relationships", json=payload, headers=_auth(admin_token))
    assert r2.status_code == 409


def test_list_and_delete_relationship(client, admin_token):
    a = _create_character(client, admin_token, "兄")
    b = _create_character(client, admin_token, "弟")
    created = client.post(
        "/api/relationships",
        json={"from_id": a, "to_id": b, "type": "sibling"},
        headers=_auth(admin_token),
    ).json()
    listed = client.get("/api/relationships").json()
    assert any(r["id"] == created["id"] for r in listed)
    resp = client.delete(f"/api/relationships/{created['id']}", headers=_auth(admin_token))
    assert resp.status_code == 204
    assert client.get("/api/relationships").json() == []
```

- [ ] **Step 8: 跑测试确认失败**

命令:`cd backend && python -m pytest tests/test_relationships.py -v`
期望:报错 `ModuleNotFoundError: No module named 'app.routers.relationships'`(或 main.py 未挂载导致 404/全红)。

- [ ] **Step 9: 写最小实现 — relationships 路由 + 挂载**

创建 `backend/app/routers/relationships.py`:

```python
"""关系 CRUD:列表(公开)、新增/删除(需登录,走 §4.4 校验)。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.auth import require_admin
from app.db import get_session
from app.models import Relationship, RelType
from app.relations import normalize_symmetric, would_create_cycle
from app.schemas import RelationshipCreate, RelationshipRead

router = APIRouter(prefix="/api", tags=["relationships"])


@router.get("/relationships", response_model=list[RelationshipRead])
def list_relationships(session: Session = Depends(get_session)) -> list[Relationship]:
    return session.exec(select(Relationship)).all()


@router.post(
    "/relationships",
    response_model=RelationshipRead,
    dependencies=[Depends(require_admin)],
)
def create_relationship(
    payload: RelationshipCreate,
    session: Session = Depends(get_session),
) -> Relationship:
    if payload.from_id == payload.to_id:
        raise HTTPException(status_code=400, detail="from_id and to_id must differ")
    if payload.type == RelType.parent and would_create_cycle(
        session, payload.from_id, payload.to_id
    ):
        raise HTTPException(status_code=400, detail="relationship would create a parent cycle")

    from_id, to_id = normalize_symmetric(payload.from_id, payload.to_id, payload.type)
    rel = Relationship(
        from_id=from_id,
        to_id=to_id,
        type=payload.type,
        parent_role=payload.parent_role,
        note=payload.note,
    )
    session.add(rel)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="relationship already exists")
    session.refresh(rel)
    return rel


@router.delete(
    "/relationships/{rel_id}",
    status_code=204,
    dependencies=[Depends(require_admin)],
)
def delete_relationship(
    rel_id: int,
    session: Session = Depends(get_session),
) -> None:
    rel = session.get(Relationship, rel_id)
    if rel is None:
        raise HTTPException(status_code=404, detail="relationship not found")
    session.delete(rel)
    session.commit()
```

在 `backend/app/main.py` 挂载该 router(与已有 `include_router` 调用并列;确保导入与挂载都存在):

```python
from app.routers import relationships

app.include_router(relationships.router)
```

- [ ] **Step 10: 跑测试确认通过**

命令:`cd backend && python -m pytest tests/test_relationships.py -v`
期望:7 passed(green)。

- [ ] **Step 11: 跑受影响全量 + 提交**

命令:`cd backend && python -m pytest -q`
期望:全绿(含前序 CRUD/鉴权用例无回归)。

```bash
cd backend && git add app/schemas.py app/routers/relationships.py app/main.py tests/test_relationships.py
git commit -m "feat(relationships): add relationship CRUD with cycle, symmetry and unique guards"
```

---

### Task 6: 批量导入/导出(`io.py`:GET /api/export 与 POST /api/import)

**Files:**
- Modify: `backend/app/schemas.py`(追加 `CharacterImport` / `RelationshipImport` / `ImportPayload` / `ExportPayload`)
- Create: `backend/app/routers/io.py`
- Modify: `backend/app/main.py`(挂载 `io.router`)
- Test: `backend/tests/test_io.py`

**Interfaces:**
- **Consumes**(均为前序 Task 精确产物,不得改名):
  - `app/schemas.py`:`AdminCharacter`、`RelationshipRead`、`CharacterCreate`(已含可选 `notes`)
  - `app/models.py`:`Character`、`Relationship`、`RelType`、`ParentRole`
  - `app/db.py`:`get_session`(FastAPI 依赖,`Session`)
  - `app/auth.py`:`require_admin`(依赖,401 on 非法 Bearer)
  - `app/relations.py`:`normalize_symmetric(from_id:int, to_id:int, type:RelType) -> tuple[int,int]`
  - `tests/conftest.py`:`client`(TestClient,临时文件 SQLite + 同 PRAGMA)、`admin_token`(str)
- **Produces**(后续/前端 io Task 依赖):
  - `app/schemas.py`:`CharacterImport`、`RelationshipImport`、`ImportPayload(characters:list[CharacterImport], relationships:list[RelationshipImport])`、`ExportPayload(characters:list[AdminCharacter], relationships:list[RelationshipRead])`
  - `app/routers/io.py`:`router`(`APIRouter`,`prefix="/api"`),端点 `GET /api/export -> ExportPayload`、`POST /api/import -> {"imported_characters":int,"imported_relationships":int}`

---

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_io.py`:

```python
"""io 路由:导出/导入(spec §5/§11,往返等价 + 名字解析校验)。"""


def _seed_payload() -> dict:
    return {
        "characters": [
            {"name": "云霄子", "gender": "male", "realm": "金丹", "notes": "私密设定"},
            {"name": "叶清歌", "gender": "female", "realm": "筑基"},
        ],
        "relationships": [
            {
                "from_name": "云霄子",
                "to_name": "叶清歌",
                "type": "parent",
                "parent_role": "father",
            }
        ],
    }


def test_export_requires_admin(client):
    assert client.get("/api/export").status_code == 401


def test_import_requires_admin(client):
    assert client.post("/api/import", json={"characters": [], "relationships": []}).status_code == 401


def test_import_then_export_roundtrip(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}

    r = client.post("/api/import", json=_seed_payload(), headers=h)
    assert r.status_code == 200
    assert r.json() == {"imported_characters": 2, "imported_relationships": 1}

    exp = client.get("/api/export", headers=h).json()
    by_name = {c["name"]: c for c in exp["characters"]}
    assert set(by_name) == {"云霄子", "叶清歌"}
    assert by_name["云霄子"]["realm"] == "金丹"
    assert by_name["云霄子"]["notes"] == "私密设定"        # 导出含 notes(AdminCharacter)
    assert by_name["叶清歌"]["gender"] == "female"

    id_to_name = {c["id"]: c["name"] for c in exp["characters"]}
    rels = [
        (id_to_name[r["from_id"]], id_to_name[r["to_id"]], r["type"], r["parent_role"])
        for r in exp["relationships"]
    ]
    assert rels == [("云霄子", "叶清歌", "parent", "father")]


def test_import_unknown_relationship_name_returns_400(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "characters": [{"name": "甲"}],
        "relationships": [{"from_name": "甲", "to_name": "查无此人", "type": "spouse"}],
    }
    r = client.post("/api/import", json=payload, headers=h)
    assert r.status_code == 400
    # 校验先于写入:失败时不得有人物落库
    assert client.get("/api/characters").json() == []


def test_import_duplicate_names_returns_400(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    payload = {"characters": [{"name": "重名"}, {"name": "重名"}], "relationships": []}
    r = client.post("/api/import", json=payload, headers=h)
    assert r.status_code == 400
    assert client.get("/api/characters").json() == []
```

- [ ] **Step 2: 跑测试确认失败**

```bash
python -m pytest backend/tests/test_io.py -v
```

期望:全部失败。`/api/export`、`/api/import` 未挂载,返回 404(断言 401/200 失败);roundtrip/重名/未知名用例同样因 404 失败。

- [ ] **Step 3: 写最小实现(schemas)**

在 `backend/app/schemas.py` 末尾追加(沿用文件已有的 `SQLModel`/`Field` 导入与 `AdminCharacter`/`RelationshipRead`/`CharacterCreate`/`RelType`/`ParentRole`):

```python
class CharacterImport(CharacterCreate):
    """导入用人物:字段同 CharacterCreate(含可选 notes),按 name 引用。"""


class RelationshipImport(SQLModel):
    """导入用关系:用人物名引用,导入时解析为 id。"""

    from_name: str
    to_name: str
    type: RelType
    parent_role: ParentRole | None = None
    note: str | None = None


class ImportPayload(SQLModel):
    characters: list[CharacterImport] = Field(default_factory=list)
    relationships: list[RelationshipImport] = Field(default_factory=list)


class ExportPayload(SQLModel):
    characters: list[AdminCharacter] = Field(default_factory=list)
    relationships: list[RelationshipRead] = Field(default_factory=list)
```

- [ ] **Step 4: 写最小实现(路由)**

创建 `backend/app/routers/io.py`:

```python
"""批量导入/导出(spec §5/§11)。导出为 import 的逆对称,兼作人类可读二级备份。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.auth import require_admin
from app.db import get_session
from app.models import Character, Relationship
from app.relations import normalize_symmetric
from app.schemas import (
    AdminCharacter,
    ExportPayload,
    ImportPayload,
    RelationshipRead,
)

router = APIRouter(prefix="/api", tags=["io"])


@router.get(
    "/export",
    response_model=ExportPayload,
    dependencies=[Depends(require_admin)],
)
def export_data(session: Session = Depends(get_session)) -> ExportPayload:
    characters = session.exec(select(Character)).all()
    relationships = session.exec(select(Relationship)).all()
    return ExportPayload(
        characters=[AdminCharacter.model_validate(c) for c in characters],
        relationships=[RelationshipRead.model_validate(r) for r in relationships],
    )


@router.post("/import", dependencies=[Depends(require_admin)])
def import_data(
    payload: ImportPayload,
    session: Session = Depends(get_session),
) -> dict[str, int]:
    # 1) payload 内重名 → 400(名字是关系引用的主键,重名无法消歧)
    names = [c.name for c in payload.characters]
    seen: set[str] = set()
    duplicates: set[str] = set()
    for n in names:
        if n in seen:
            duplicates.add(n)
        seen.add(n)
    if duplicates:
        raise HTTPException(
            status_code=400,
            detail=f"duplicate character names in payload: {sorted(duplicates)}",
        )

    # 2) 关系引用必须落在本批人物内(先校验,后写入 → 失败零落库)
    name_set = set(names)
    for r in payload.relationships:
        missing = [x for x in (r.from_name, r.to_name) if x not in name_set]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"relationship references unknown character name(s): {missing}",
            )

    # 3) 插入人物,flush 取 id,建立 name -> id 映射
    name_to_id: dict[str, int] = {}
    for c in payload.characters:
        obj = Character(**c.model_dump(exclude_unset=True))
        session.add(obj)
        session.flush()  # 拿到自增 id,尚未提交
        name_to_id[c.name] = obj.id

    # 4) 插入关系:对称类型归一为 (min, max)
    imported_rel = 0
    for r in payload.relationships:
        from_id, to_id = normalize_symmetric(
            name_to_id[r.from_name], name_to_id[r.to_name], r.type
        )
        session.add(
            Relationship(
                from_id=from_id,
                to_id=to_id,
                type=r.type,
                parent_role=r.parent_role,
                note=r.note,
            )
        )
        imported_rel += 1

    session.commit()
    return {
        "imported_characters": len(payload.characters),
        "imported_relationships": imported_rel,
    }
```

在 `backend/app/main.py` 挂载路由(与已有 `characters`/`relationships`/`auth` 路由同一处 `include_router`):

```python
from app.routers import io

app.include_router(io.router)
```

- [ ] **Step 5: 跑测试确认通过**

```bash
python -m pytest backend/tests/test_io.py -v
```

期望:5 passed。`test_export_requires_admin` / `test_import_requires_admin` 得 401;`test_import_then_export_roundtrip` 断言导入计数 `{"imported_characters":2,"imported_relationships":1}`、导出含 `notes`、关系按名还原为 `("云霄子","叶清歌","parent","father")`;未知名 / 重名用例得 400 且 `/api/characters` 为空(零落库)。

回归确认未碰坏前序路由:

```bash
python -m pytest backend/tests -q
```

期望:全绿。

- [ ] **Step 6: 提交**

```bash
git add backend/app/schemas.py backend/app/routers/io.py backend/app/main.py backend/tests/test_io.py
git commit -m "feat(io): add import/export endpoints with name-to-id resolution"
```

---

### Task 7: 部署与运维落地（.env / 备份脚本 / systemd / nginx / 恢复演练）

**Files:**
- Create: `xjxz/backend/.env.example`
- Create: `xjxz/scripts/backup.sh`
- Create: `xjxz/deploy/xjxz.service`
- Create: `xjxz/deploy/nginx.conf`
- Create: `xjxz/docs/deploy.md`
- Test: `xjxz/backend/tests/test_backup.py`

**Interfaces:**
- **Consumes**（前序 Task 已产出的精确名称，本 Task 只引用不改名）：
  - `app/config.py` 的 `Settings` 环境变量名 `JWT_SECRET`、`ADMIN_PASSWORD_HASH`（缺任一启动抛 `RuntimeError` fail-fast）→ 由 `.env` 提供。
  - `app/auth.py` 的 bcrypt 哈希生成命令：`python -c "from passlib.hash import bcrypt; print(bcrypt.hash('你的密码'))"` → 写进 `.env.example` 注释。
  - `app/main.py` 的 ASGI 入口 `app.main:app` → systemd `ExecStart` 指向它。
  - DB 文件名 `xjxz.db`、部署约束 `uvicorn --workers 1`。
- **Produces**（运维资产，被运维者/CI 消费，无后续代码 Task 依赖其符号）：
  - `scripts/backup.sh`：`backup.sh [DB_PATH] [BACKUP_DIR]`，`sqlite3 .backup` 一致性快照 + 保留最近 7 份轮转 + 快照 `chmod 600`。
  - `deploy/xjxz.service`：systemd unit，`EnvironmentFile=…/.env`，`uvicorn … --workers 1`。
  - `deploy/nginx.conf`：静态 SPA（`try_files … /index.html`）+ `/api/` 反代到 `127.0.0.1:8000`。
  - `docs/deploy.md`：部署步骤 + 恢复演练（停服务 → 替换 db → 清 `-wal`/`-shm` → 重启）。

---

- [ ] **Step 1: 写失败测试**（`xjxz/backend/tests/test_backup.py`，验证脚本可执行性 + 快照有效性 + 7 份轮转）

```python
import os
import shutil
import sqlite3
import subprocess
import time
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "backup.sh"

needs_sqlite3 = pytest.mark.skipif(
    shutil.which("sqlite3") is None, reason="sqlite3 CLI not installed"
)


def _make_db(path: Path) -> None:
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)")
    conn.execute("INSERT INTO t (v) VALUES ('hi')")
    conn.commit()
    conn.close()


def test_backup_script_exists_and_executable():
    assert SCRIPT.is_file(), f"missing {SCRIPT}"
    assert os.access(SCRIPT, os.X_OK), "backup.sh must be chmod +x"


@needs_sqlite3
def test_backup_creates_consistent_snapshot(tmp_path):
    db = tmp_path / "xjxz.db"
    backups = tmp_path / "backups"
    _make_db(db)

    subprocess.run(["bash", str(SCRIPT), str(db), str(backups)], check=True)

    snaps = list(backups.glob("xjxz-*.db"))
    assert len(snaps) == 1
    conn = sqlite3.connect(snaps[0])
    assert conn.execute("SELECT v FROM t").fetchone()[0] == "hi"
    conn.close()
    assert oct(snaps[0].stat().st_mode)[-3:] == "600"


@needs_sqlite3
def test_backup_rotation_keeps_seven(tmp_path):
    db = tmp_path / "xjxz.db"
    backups = tmp_path / "backups"
    backups.mkdir()
    _make_db(db)

    # seed 9 older snapshots with strictly increasing mtimes
    for i in range(9):
        f = backups / f"xjxz-2026-01-{i + 1:02d}-000000.db"
        f.write_text("old")
        os.utime(f, (time.time() - (9 - i) * 86400,) * 2)

    subprocess.run(["bash", str(SCRIPT), str(db), str(backups)], check=True)

    snaps = list(backups.glob("xjxz-*.db"))
    assert len(snaps) == 7  # 9 old + 1 new = 10 -> keep newest 7


@needs_sqlite3
def test_backup_missing_db_fails_loudly(tmp_path):
    proc = subprocess.run(
        ["bash", str(SCRIPT), str(tmp_path / "nope.db"), str(tmp_path / "b")],
        capture_output=True,
        text=True,
    )
    assert proc.returncode != 0
    assert "not found" in proc.stderr
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz/backend && python -m pytest tests/test_backup.py -q
```
期望：`test_backup_script_exists_and_executable` 等用例 `FAILED`（`scripts/backup.sh` 不存在 / `AssertionError: missing …/scripts/backup.sh`）。

- [ ] **Step 3: 写 `xjxz/scripts/backup.sh`（最小实现，过 shellcheck）**

```bash
#!/usr/bin/env bash
set -euo pipefail

# xjxz SQLite consistency backup with 7-copy rotation.
# Usage: backup.sh [DB_PATH] [BACKUP_DIR]
#
# WAL mode is on, so a plain `cp` can copy a torn database file.
# `sqlite3 .backup` takes a consistent snapshot while the app keeps
# serving (deployment is uvicorn --workers 1, single writer).

DB_PATH="${1:-/srv/xjxz/backend/xjxz.db}"
BACKUP_DIR="${2:-/srv/xjxz/backups}"
KEEP=7

if [[ ! -f "$DB_PATH" ]]; then
  echo "backup.sh: database not found: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp="$(date +%F-%H%M%S)"
target="$BACKUP_DIR/xjxz-$timestamp.db"

# Consistent snapshot; sqlite3 exits non-zero on error and `set -e` aborts.
sqlite3 "$DB_PATH" ".backup '$target'"
chmod 600 "$target"

# Rotation: keep the newest $KEEP snapshots, delete the rest.
# Filenames are controlled (fixed xjxz-<ts>.db, no spaces/newlines), so
# parsing `ls -t` output is safe here.
# shellcheck disable=SC2012
mapfile -t old < <(ls -1t "$BACKUP_DIR"/xjxz-*.db 2>/dev/null | tail -n +$((KEEP + 1)))
if ((${#old[@]})); then
  rm -f "${old[@]}"
fi

kept="$(find "$BACKUP_DIR" -maxdepth 1 -name 'xjxz-*.db' | wc -l | tr -d ' ')"
echo "backup.sh: wrote $target (kept $kept snapshots)"

# Off-site copy (one snapshot must live off the box). Uncomment and set REMOTE:
#   REMOTE="user@offsite-host:/remote/xjxz-backups/"
#   rsync -az --delete "$BACKUP_DIR"/ "$REMOTE"
```

赋可执行位：
```bash
chmod +x /Users/rick/SourceLib/fishNotExist/xjxz/scripts/backup.sh
```

- [ ] **Step 4: shellcheck + bash 语法校验，再跑 pytest 确认通过**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz && shellcheck scripts/backup.sh && bash -n scripts/backup.sh && (cd backend && python -m pytest tests/test_backup.py -q)
```
期望：`shellcheck` 无输出（退出 0）；`bash -n` 无输出；pytest `4 passed`（若机器无 `sqlite3` CLI，3 个 `skipped` + 1 `passed`）。

- [ ] **Step 5: 写 `.env.example`、systemd、nginx 三个运维文件**

`xjxz/backend/.env.example`：
```bash
# xjxz backend environment — copy to `.env`, fill real values, NEVER commit `.env`.
# Loaded by systemd via EnvironmentFile; read by app/config.py Settings.
# Missing either var makes the process fail-fast on startup (RuntimeError).

# JWT signing secret: >= 32 random bytes, separate from the password hash.
# Generate:
#   python -c "import secrets; print(secrets.token_urlsafe(48))"
JWT_SECRET=replace-with-32plus-byte-random-secret

# Admin password bcrypt hash — backend never sees plaintext. Use a >= 16 char
# random password.
# Generate:
#   python -c "from passlib.hash import bcrypt; print(bcrypt.hash('your-strong-password'))"
ADMIN_PASSWORD_HASH=replace-with-bcrypt-hash
```

`xjxz/deploy/xjxz.service`：
```ini
[Unit]
Description=xjxz character wiki API (FastAPI/uvicorn)
After=network.target

[Service]
Type=simple
User=xjxz
Group=xjxz
WorkingDirectory=/srv/xjxz/backend
EnvironmentFile=/srv/xjxz/backend/.env
# Single worker: SQLite + WAL + busy_timeout assume one writer process.
ExecStart=/srv/xjxz/backend/.venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 --port 8000 --workers 1
Restart=on-failure
RestartSec=3

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

`xjxz/deploy/nginx.conf`：
```nginx
server {
    listen 80;
    server_name xjxz.example.com;

    # Static SPA build output (npm run build).
    root /srv/xjxz/frontend/dist;
    index index.html;

    # Client-side routes fall back to index.html.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse proxy to uvicorn (same origin -> no CORS needed).
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Headroom for import payloads.
    client_max_body_size 8m;
}
```

- [ ] **Step 6: 写 `xjxz/docs/deploy.md`（部署 + 恢复演练）**

```markdown
# 部署与恢复

## 首次部署

1. 后端
   ```bash
   cd /srv/xjxz/backend
   python -m venv .venv && .venv/bin/pip install -e .
   cp .env.example .env       # 填真实值，见文件内生成命令
   chmod 600 .env
   ```
2. 前端
   ```bash
   cd /srv/xjxz/frontend && npm ci && npm run build   # 产物在 dist/
   ```
3. 服务与反代
   ```bash
   sudo cp /srv/xjxz/deploy/xjxz.service /etc/systemd/system/xjxz.service
   sudo cp /srv/xjxz/deploy/nginx.conf /etc/nginx/sites-available/xjxz
   sudo ln -sf /etc/nginx/sites-available/xjxz /etc/nginx/sites-enabled/xjxz
   sudo systemctl daemon-reload && sudo systemctl enable --now xjxz
   sudo nginx -t && sudo systemctl reload nginx
   ```
4. 健康检查：`curl -s http://127.0.0.1:8000/api/health` 应返回 `{"status":"ok"}`。

## 备份

- 定时任务（每日 03:00）：
  ```cron
  0 3 * * * /srv/xjxz/scripts/backup.sh /srv/xjxz/backend/xjxz.db /srv/xjxz/backups >> /var/log/xjxz-backup.log 2>&1
  ```
- 保留最近 7 份；至少一份 `rsync` 异地（取消 `backup.sh` 末尾 rsync 注释并设置 `REMOTE`）。
- `xjxz.db` 是全项目唯一不在 git 的资产，备份是第一道防线。

## 恢复演练（停服务 → 替换 db → 清 WAL → 重启）

> WAL 模式下若只换 `xjxz.db` 而残留旧 `-wal`/`-shm`，会污染数据，必须一并删除。

```bash
# 1. 停服务（释放对 db 的写锁）
sudo systemctl stop xjxz

# 2. 备份当前现场（演练翻车也能回到操作前）
cp /srv/xjxz/backend/xjxz.db /srv/xjxz/backend/xjxz.db.prerestore 2>/dev/null || true

# 3. 用快照替换主库
cp /srv/xjxz/backups/xjxz-<YYYY-MM-DD-HHMMSS>.db /srv/xjxz/backend/xjxz.db

# 4. 清理旧 WAL/SHM 边车文件（关键）
rm -f /srv/xjxz/backend/xjxz.db-wal /srv/xjxz/backend/xjxz.db-shm

# 5. 完整性自检
sqlite3 /srv/xjxz/backend/xjxz.db "PRAGMA integrity_check;"   # 期望 ok

# 6. 重启并验证
sudo systemctl start xjxz
curl -s http://127.0.0.1:8000/api/health                     # {"status":"ok"}
```
确认数据正确后再删除 `xjxz.db.prerestore`。
```

- [ ] **Step 7: 校验全部运维文件语法**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz && shellcheck scripts/backup.sh && systemd-analyze verify deploy/xjxz.service 2>&1 || echo "(systemd-analyze 仅 Linux 可用，macOS 跳过)"; nginx -t -c "$PWD/deploy/nginx.conf" 2>&1 || echo "(nginx 未装/路径占位，跳过)"
```
期望：`shellcheck` 无输出；systemd/nginx 校验在装有对应工具的目标机上通过，本地缺失则打印跳过说明（不阻塞）。

- [ ] **Step 8: 提交**

```bash
cd /Users/rick/SourceLib/fishNotExist/xjxz && \
git add scripts/backup.sh deploy/xjxz.service deploy/nginx.conf backend/.env.example backend/tests/test_backup.py docs/deploy.md && \
git commit -m "chore(ops): add backup script, systemd/nginx units, .env example and recovery docs"
```
（提交前先 `git branch --show-current` 确认不在 main/master；`git diff --cached` 确认改动范围仅本 Task 文件。）
