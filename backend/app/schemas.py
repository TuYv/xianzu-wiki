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
