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
