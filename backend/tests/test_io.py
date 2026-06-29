"""io 路由:导出/导入(spec §5/§11,往返等价 + 名字解析校验)。"""


def _seed_payload() -> dict:
    return {
        "characters": [
            {"name": "云霄子", "gender": "male", "realm": "金丹", "notes": "私密设定"},
            {"name": "叶清歌", "gender": "female", "realm": "筑基"},
        ],
        "relationships": [
            {
                "from_name": "云霄子",
                "to_name": "叶清歌",
                "type": "parent",
                "parent_role": "father",
            }
        ],
    }


def test_export_requires_admin(client):
    assert client.get("/api/export").status_code == 401


def test_import_requires_admin(client):
    assert client.post("/api/import", json={"characters": [], "relationships": []}).status_code == 401


def test_import_then_export_roundtrip(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}

    r = client.post("/api/import", json=_seed_payload(), headers=h)
    assert r.status_code == 200
    assert r.json() == {"imported_characters": 2, "imported_relationships": 1}

    exp = client.get("/api/export", headers=h).json()
    by_name = {c["name"]: c for c in exp["characters"]}
    assert set(by_name) == {"云霄子", "叶清歌"}
    assert by_name["云霄子"]["realm"] == "金丹"
    assert by_name["云霄子"]["notes"] == "私密设定"        # 导出含 notes(AdminCharacter)
    assert by_name["叶清歌"]["gender"] == "female"

    id_to_name = {c["id"]: c["name"] for c in exp["characters"]}
    rels = [
        (id_to_name[r["from_id"]], id_to_name[r["to_id"]], r["type"], r["parent_role"])
        for r in exp["relationships"]
    ]
    assert rels == [("云霄子", "叶清歌", "parent", "father")]


def test_import_unknown_relationship_name_returns_400(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "characters": [{"name": "甲"}],
        "relationships": [{"from_name": "甲", "to_name": "查无此人", "type": "spouse"}],
    }
    r = client.post("/api/import", json=payload, headers=h)
    assert r.status_code == 400
    # 校验先于写入:失败时不得有人物落库
    assert client.get("/api/characters").json() == []


def test_import_duplicate_names_returns_400(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    payload = {"characters": [{"name": "重名"}, {"name": "重名"}], "relationships": []}
    r = client.post("/api/import", json=payload, headers=h)
    assert r.status_code == 400
    assert client.get("/api/characters").json() == []
