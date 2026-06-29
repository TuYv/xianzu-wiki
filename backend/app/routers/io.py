"""批量导入/导出(spec §5/§11)。导出为 import 的逆对称,兼作人类可读二级备份。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
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
    # 零写入保证(400 校验路径)是隐式的、非结构性的:本函数对人物只做 session.flush()
    # 取自增 id、并不 commit;一旦后续关系校验抛 HTTPException,请求级 session(get_session
    # 的 with 块)退出时会连同未提交的 flush 一起回滚,故任何 400 都不会落库。
    # 若日后改动提交时机(如提前 commit),需重新评估此保证。
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

    # 2) 插入人物,flush 取 id,建立 name -> id 映射
    name_to_id: dict[str, int] = {}
    for c in payload.characters:
        obj = Character(**c.model_dump(exclude_unset=True))
        session.add(obj)
        session.flush()  # 拿到自增 id,尚未提交
        name_to_id[c.name] = obj.id

    # 3) 补全映射:关系中引用了 payload 外的已有人物名 → 从 DB 查
    all_rel_names = {n for r in payload.relationships for n in (r.from_name, r.to_name)}
    unresolved = all_rel_names - set(name_to_id)
    if unresolved:
        for ch in session.exec(
            select(Character).where(Character.name.in_(unresolved))
        ).all():
            name_to_id[ch.name] = ch.id

    # 4) 校验关系引用(payload + DB 均查不到 → 400)
    for r in payload.relationships:
        missing = [x for x in (r.from_name, r.to_name) if x not in name_to_id]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"relationship references unknown character name(s): {missing}",
            )

    # 5) 插入关系:对称类型归一为 (min, max)
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

    # 6) 提交;UNIQUE 冲突(归一后重复关系)→ 409
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="duplicate relationship in payload after normalization",
        )

    return {
        "imported_characters": len(payload.characters),
        "imported_relationships": len(payload.relationships),
    }
