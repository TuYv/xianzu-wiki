# backend/tests/test_characters.py
from app.schemas import (
    AdminCharacter,
    CharacterCreate,
    CharacterDetail,
    CharacterUpdate,
    PublicCharacter,
    RelationshipRead,
)


def test_public_character_excludes_notes():
    fields = set(PublicCharacter.model_fields.keys())
    assert "notes" not in fields
    assert fields == {
        "id",
        "name",
        "aliases",
        "gender",
        "generation",
        "realm",
        "affiliation",
        "status",
        "avatar_url",
        "bio",
    }


def test_admin_character_includes_notes_and_timestamps():
    fields = set(AdminCharacter.model_fields.keys())
    assert "notes" in fields
    assert {"created_at", "updated_at"}.issubset(fields)


def test_character_create_requires_name_only():
    c = CharacterCreate(name="叶凡")
    assert c.name == "叶凡"
    assert c.aliases == []


def test_character_update_all_optional():
    u = CharacterUpdate()
    assert u.model_dump(exclude_unset=True) == {}


def test_character_detail_has_relationships():
    assert "relationships" in CharacterDetail.model_fields
    assert "notes" not in CharacterDetail.model_fields


def _make(client, token, **over):
    body = {"name": "默认人物"}
    body.update(over)
    return client.post(
        "/api/characters",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
    )


def test_anonymous_get_detail_has_no_notes_key(client, admin_token):
    r = _make(client, admin_token, name="叶凡", notes="作者私密设定")
    assert r.status_code == 200
    cid = r.json()["id"]

    detail = client.get(f"/api/characters/{cid}")
    assert detail.status_code == 200
    data = detail.json()
    assert "notes" not in data
    assert data["name"] == "叶凡"
    assert data["relationships"] == []


def test_admin_create_returns_notes(client, admin_token):
    r = _make(client, admin_token, name="庞博", notes="隐藏剧情")
    assert r.status_code == 200
    body = r.json()
    assert body["notes"] == "隐藏剧情"
    assert "created_at" in body and "updated_at" in body


def test_unauthenticated_post_is_401(client):
    r = client.post("/api/characters", json={"name": "无权用户"})
    assert r.status_code == 401


def test_list_returns_public_shape(client, admin_token):
    _make(client, admin_token, name="李黑水")
    r = client.get("/api/characters")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert all("notes" not in it for it in items)


def test_update_refreshes_and_returns_admin(client, admin_token):
    cid = _make(client, admin_token, name="原名").json()["id"]
    r = client.put(
        f"/api/characters/{cid}",
        json={"name": "改名", "notes": "更新备注"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["name"] == "改名"
    assert r.json()["notes"] == "更新备注"


def test_get_missing_returns_404(client):
    assert client.get("/api/characters/999999").status_code == 404


def test_delete_cascades_relationships(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    a = _make(client, admin_token, name="师父").json()["id"]
    b = _make(client, admin_token, name="徒弟").json()["id"]
    rel = client.post(
        "/api/relationships",
        json={"from_id": a, "to_id": b, "type": "master"},
        headers=h,
    )
    assert rel.status_code == 200

    d = client.delete(f"/api/characters/{a}", headers=h)
    assert d.status_code == 204

    remaining = client.get("/api/relationships").json()
    assert all(r["from_id"] != a and r["to_id"] != a for r in remaining)
