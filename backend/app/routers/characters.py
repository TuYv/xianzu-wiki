# backend/app/routers/characters.py
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete as sql_delete
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


def _fetch_relationships(session: Session, character_id: int) -> list[Relationship]:
    return session.exec(
        select(Relationship).where(
            (Relationship.from_id == character_id)
            | (Relationship.to_id == character_id)
        )
    ).all()


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
    rels = _fetch_relationships(session, character_id)
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
    # Bulk-delete matching relationships before the character row to avoid FK
    # constraint conflicts when PRAGMA foreign_keys is OFF, and to prevent
    # the ORM double-delete warning that arises when FK cascade also fires.
    session.exec(
        sql_delete(Relationship).where(
            (Relationship.from_id == character_id)
            | (Relationship.to_id == character_id)
        )
    )
    session.delete(character)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
