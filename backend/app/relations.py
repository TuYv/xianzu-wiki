"""关系纯函数:对称类型归一 + parent 成环检测。"""

from sqlmodel import Session, select

from app.models import Relationship, RelType

SYMMETRIC_TYPES: set[RelType] = {RelType.spouse, RelType.sibling}


def normalize_symmetric(from_id: int, to_id: int, type: RelType) -> tuple[int, int]:
    """对称类型(spouse/sibling)归一为 (min, max);方向类型保持不变。"""
    if type in SYMMETRIC_TYPES:
        return (min(from_id, to_id), max(from_id, to_id))
    return (from_id, to_id)


def would_create_cycle(session: Session, from_id: int, to_id: int) -> bool:
    """检测向 parent DAG 添加 from_id→to_id 边是否成环。

    DFS 从 to_id 出发,沿已有 parent 边向下(找 to_id 的后代),
    若能抵达 from_id 则成环。用 visited 集合防止无限循环。
    """
    visited: set[int] = set()
    stack = [to_id]
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
