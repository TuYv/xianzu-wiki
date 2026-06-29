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
