"""relations.py 纯函数单测 — 自带内存 SQLite,不依赖 conftest。"""

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
