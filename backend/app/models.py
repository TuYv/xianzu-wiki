"""SQLModel 表模型:人物(characters)与关系(relationships)。

对应设计文档 §4.1 / §4.2。枚举均为 str Enum,name==value,
便于 SQLAlchemy Enum 列与 JSON/前端枚举值保持一致。
"""

from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy import TypeDecorator
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    """tz-aware 当前 UTC 时间。"""
    return datetime.now(timezone.utc)


class TZDateTime(TypeDecorator):
    """DateTime 列,始终返回 tz-aware UTC datetime。

    SQLite 以无时区字符串存储日期,本 TypeDecorator 在读回时补充 UTC 时区信息,
    确保应用层无论何时都能拿到 tz-aware 值。
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


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
    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(TZDateTime, default=_utcnow),
    )
    updated_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(TZDateTime, default=_utcnow, onupdate=_utcnow),
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
