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
