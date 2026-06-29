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
