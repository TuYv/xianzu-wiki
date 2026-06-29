"""关系路由集成测试。"""


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_character(client, token: str, name: str) -> int:
    resp = client.post("/api/characters", json={"name": name}, headers=_auth(token))
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def test_post_relationship_requires_admin(client, admin_token):
    a = _create_character(client, admin_token, "甲")
    b = _create_character(client, admin_token, "乙")
    resp = client.post(
        "/api/relationships",
        json={"from_id": a, "to_id": b, "type": "master"},
    )
    assert resp.status_code == 401


def test_delete_relationship_requires_admin(client, admin_token):
    a = _create_character(client, admin_token, "甲2")
    b = _create_character(client, admin_token, "乙2")
    created = client.post(
        "/api/relationships",
        json={"from_id": a, "to_id": b, "type": "master"},
        headers=_auth(admin_token),
    ).json()
    resp = client.delete(f"/api/relationships/{created['id']}")
    assert resp.status_code == 401


def test_symmetric_relationship_normalized_to_min_max(client, admin_token):
    a = _create_character(client, admin_token, "夫")
    b = _create_character(client, admin_token, "妻")
    assert a < b
    # 故意 from=b(大)->to=a(小),应被归一为 (a, b)
    resp = client.post(
        "/api/relationships",
        json={"from_id": b, "to_id": a, "type": "spouse"},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["from_id"] == a
    assert body["to_id"] == b


def test_spouse_visible_from_both_characters(client, admin_token):
    a = _create_character(client, admin_token, "道侣甲")
    b = _create_character(client, admin_token, "道侣乙")
    resp = client.post(
        "/api/relationships",
        json={"from_id": a, "to_id": b, "type": "spouse"},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 200, resp.text
    for cid in (a, b):
        detail = client.get(f"/api/characters/{cid}").json()
        edges = {(r["from_id"], r["to_id"], r["type"]) for r in detail["relationships"]}
        assert (a, b, "spouse") in edges


def test_self_relationship_rejected(client, admin_token):
    a = _create_character(client, admin_token, "独行")
    resp = client.post(
        "/api/relationships",
        json={"from_id": a, "to_id": a, "type": "spouse"},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 400


def test_parent_cycle_rejected(client, admin_token):
    parent = _create_character(client, admin_token, "父")
    child = _create_character(client, admin_token, "子")
    r1 = client.post(
        "/api/relationships",
        json={"from_id": parent, "to_id": child, "type": "parent", "parent_role": "father"},
        headers=_auth(admin_token),
    )
    assert r1.status_code == 200, r1.text
    # 子不能反过来当父的父(成环)
    r2 = client.post(
        "/api/relationships",
        json={"from_id": child, "to_id": parent, "type": "parent"},
        headers=_auth(admin_token),
    )
    assert r2.status_code == 400


def test_duplicate_relationship_rejected(client, admin_token):
    a = _create_character(client, admin_token, "大师")
    b = _create_character(client, admin_token, "弟子")
    payload = {"from_id": a, "to_id": b, "type": "master"}
    r1 = client.post("/api/relationships", json=payload, headers=_auth(admin_token))
    assert r1.status_code == 200
    r2 = client.post("/api/relationships", json=payload, headers=_auth(admin_token))
    assert r2.status_code == 409


def test_transitive_parent_cycle_rejected(client, admin_token):
    a = _create_character(client, admin_token, "曾祖")
    b = _create_character(client, admin_token, "祖")
    c = _create_character(client, admin_token, "父2")
    client.post(
        "/api/relationships",
        json={"from_id": a, "to_id": b, "type": "parent"},
        headers=_auth(admin_token),
    ).raise_for_status()
    client.post(
        "/api/relationships",
        json={"from_id": b, "to_id": c, "type": "parent"},
        headers=_auth(admin_token),
    ).raise_for_status()
    # c→a 闭合 3-hop 环,应被 DFS 检测拒绝
    r = client.post(
        "/api/relationships",
        json={"from_id": c, "to_id": a, "type": "parent"},
        headers=_auth(admin_token),
    )
    assert r.status_code == 400


def test_symmetric_cross_order_duplicate_rejected(client, admin_token):
    a = _create_character(client, admin_token, "道侣丙")
    b = _create_character(client, admin_token, "道侣丁")
    assert a < b
    r1 = client.post(
        "/api/relationships",
        json={"from_id": a, "to_id": b, "type": "spouse"},
        headers=_auth(admin_token),
    )
    assert r1.status_code == 200
    # 颠倒顺序:normalize_symmetric 应归一为同一行,UNIQUE 触发 409
    r2 = client.post(
        "/api/relationships",
        json={"from_id": b, "to_id": a, "type": "spouse"},
        headers=_auth(admin_token),
    )
    assert r2.status_code == 409


def test_delete_nonexistent_relationship_returns_404(client, admin_token):
    resp = client.delete("/api/relationships/99999", headers=_auth(admin_token))
    assert resp.status_code == 404


def test_list_and_delete_relationship(client, admin_token):
    a = _create_character(client, admin_token, "兄")
    b = _create_character(client, admin_token, "弟")
    created = client.post(
        "/api/relationships",
        json={"from_id": a, "to_id": b, "type": "sibling"},
        headers=_auth(admin_token),
    ).json()
    listed = client.get("/api/relationships").json()
    assert any(r["id"] == created["id"] for r in listed)
    resp = client.delete(f"/api/relationships/{created['id']}", headers=_auth(admin_token))
    assert resp.status_code == 204
    assert client.get("/api/relationships").json() == []
