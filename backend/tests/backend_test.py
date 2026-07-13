"""Backend tests for OrderDeck multi-tenant POS SaaS (updated for profile enforcement)."""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@peinokio.gr"
DEMO_PASSWORD = "demo1234"


def _rand_email():
    return f"test_{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _auth_headers(token: str):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _login(http, email=DEMO_EMAIL, password=DEMO_PASSWORD):
    r = http.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _select_profile(http, token, profile="owner", pin="0000"):
    r = http.post(f"{API}/profile/select", json={"profile": profile, "pin": pin},
                  headers=_auth_headers(token))
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _register(http, tag="X"):
    """Register + return (email, no-profile token, owner token)."""
    email = _rand_email()
    r = http.post(f"{API}/auth/register",
                  json={"email": email, "password": "pass1234",
                        "restaurant_name": f"TEST_{tag}"})
    assert r.status_code == 200, r.text
    base_tok = r.json()["token"]
    owner_tok = _select_profile(http, base_tok, "owner", "0000")
    return email, base_tok, owner_tok


@pytest.fixture(scope="session")
def demo_token(http):
    return _login(http)


@pytest.fixture(scope="session")
def demo_owner_token(http, demo_token):
    return _select_profile(http, demo_token, "owner", "0000")


# --------- HEALTH ----------
def test_root(http):
    r = http.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ============================================================
# ITERATION 4: PROFILE / PIN
# ============================================================
def test_login_returns_null_profile(http):
    r = http.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200
    j = r.json()
    assert j["user"]["profile"] is None
    # token without profile cannot hit /analytics
    ra = http.get(f"{API}/analytics", headers=_auth_headers(j["token"]))
    assert ra.status_code == 403


def test_profile_select_owner_grants_analytics(http, demo_token):
    tok = _select_profile(http, demo_token, "owner", "0000")
    r = http.get(f"{API}/analytics", headers=_auth_headers(tok))
    assert r.status_code == 200


def test_profile_select_wrong_pin(http, demo_token):
    r = http.post(f"{API}/profile/select", json={"profile": "owner", "pin": "9999"},
                  headers=_auth_headers(demo_token))
    assert r.status_code == 401


def test_profile_employee_cannot_access_analytics_but_can_order(http, demo_token):
    emp_tok = _select_profile(http, demo_token, "employee", "0000")
    # analytics denied
    ra = http.get(f"{API}/analytics", headers=_auth_headers(emp_tok))
    assert ra.status_code == 403
    # order allowed
    n = http.get(f"{API}/orders/next-number", headers=_auth_headers(emp_tok)).json()["next_order_number"]
    order = {
        "order_number": n,
        "items": [{"item_id": "x", "name": "TEST_EmpOrder", "category": "orektika",
                   "unit_price": 1.0, "quantity": 1, "line_total": 1.0}],
        "subtotal": 1.0, "total": 1.0, "source": "Ταμείο",
    }
    ro = http.post(f"{API}/orders", json=order, headers=_auth_headers(emp_tok))
    assert ro.status_code == 200


def test_change_pin_requires_owner_and_updates(http):
    email, base_tok, owner_tok = _register(http, "PinChg")

    # employee token cannot change PIN
    emp_tok = _select_profile(http, base_tok, "employee", "0000")
    r = http.put(f"{API}/profile/pin", json={"target": "employee", "new_pin": "1111"},
                 headers=_auth_headers(emp_tok))
    assert r.status_code == 403

    # base (no profile) token cannot either
    r = http.put(f"{API}/profile/pin", json={"target": "employee", "new_pin": "1111"},
                 headers=_auth_headers(base_tok))
    assert r.status_code == 403

    # owner changes employee PIN
    r = http.put(f"{API}/profile/pin", json={"target": "employee", "new_pin": "1234"},
                 headers=_auth_headers(owner_tok))
    assert r.status_code == 200

    # old employee pin now rejected
    r = http.post(f"{API}/profile/select", json={"profile": "employee", "pin": "0000"},
                  headers=_auth_headers(base_tok))
    assert r.status_code == 401

    # new employee pin accepted
    r = http.post(f"{API}/profile/select", json={"profile": "employee", "pin": "1234"},
                  headers=_auth_headers(base_tok))
    assert r.status_code == 200

    # /auth/me should reflect employee_pin_set
    me = http.get(f"{API}/auth/me", headers=_auth_headers(base_tok)).json()
    assert me["employee_pin_set"] is True
    assert me["owner_pin_set"] is False


def test_profile_exit_clears_profile(http, demo_token):
    owner = _select_profile(http, demo_token, "owner", "0000")
    r = http.post(f"{API}/profile/exit", headers=_auth_headers(owner))
    assert r.status_code == 200
    new_tok = r.json()["token"]
    # new_tok has no profile → 403 on analytics
    ra = http.get(f"{API}/analytics", headers=_auth_headers(new_tok))
    assert ra.status_code == 403


# ============================================================
# MENU DELETE requires owner
# ============================================================
def test_menu_delete_requires_owner(http):
    _, base_tok, owner_tok = _register(http, "MenuDel")
    emp_tok = _select_profile(http, base_tok, "employee", "0000")
    # create item as owner
    cfg = http.get(f"{API}/menu/config", headers=_auth_headers(owner_tok)).json()
    cid = cfg["categories"][0]["id"]
    ri = http.post(f"{API}/menu/items",
                   json={"name": "TEST_DelItem", "price": 1.0, "category": cid},
                   headers=_auth_headers(owner_tok))
    assert ri.status_code == 200
    iid = ri.json()["id"]

    # employee delete → 403
    rd = http.delete(f"{API}/menu/items/{iid}", headers=_auth_headers(emp_tok))
    assert rd.status_code == 403

    # owner deletes → 200
    rd = http.delete(f"{API}/menu/items/{iid}", headers=_auth_headers(owner_tok))
    assert rd.status_code == 200

    # verify removed
    cfg2 = http.get(f"{API}/menu/config", headers=_auth_headers(owner_tok)).json()
    assert not any(i["id"] == iid for i in cfg2["items"])


# ============================================================
# OPTION GROUPS
# ============================================================
def test_option_groups_persist_and_update(http):
    _, _, owner_tok = _register(http, "Opts")
    hdr = _auth_headers(owner_tok)
    cfg = http.get(f"{API}/menu/config", headers=hdr).json()
    cid = cfg["categories"][0]["id"]

    payload = {
        "name": "TEST_OptItem", "price": 5.0, "category": cid,
        "option_groups": [{
            "id": "g1", "name": "Μέγεθος", "type": "single", "required": True,
            "options": [{"name": "Μικρό", "price": 0}, {"name": "Μεγάλο", "price": 1.5}],
        }, {
            "id": "g2", "name": "Έξτρα", "type": "multi", "required": False,
            "options": [{"name": "Τυρί", "price": 0.5}],
        }],
    }
    ri = http.post(f"{API}/menu/items", json=payload, headers=hdr)
    assert ri.status_code == 200, ri.text
    got = ri.json()
    assert len(got["option_groups"]) == 2
    assert got["option_groups"][0]["name"] == "Μέγεθος"
    assert got["option_groups"][0]["options"][1]["price"] == 1.5
    iid = got["id"]

    # GET returns option_groups
    cfg = http.get(f"{API}/menu/config", headers=hdr).json()
    it = next(i for i in cfg["items"] if i["id"] == iid)
    assert len(it["option_groups"]) == 2
    assert it["option_groups"][1]["type"] == "multi"

    # PUT updates option_groups
    payload["option_groups"] = [{
        "id": "g3", "name": "Ψήσιμο", "type": "single", "required": False,
        "options": [{"name": "Καλοψημένο", "price": 0}],
    }]
    ru = http.put(f"{API}/menu/items/{iid}", json=payload, headers=hdr)
    assert ru.status_code == 200
    cfg = http.get(f"{API}/menu/config", headers=hdr).json()
    it = next(i for i in cfg["items"] if i["id"] == iid)
    assert len(it["option_groups"]) == 1
    assert it["option_groups"][0]["name"] == "Ψήσιμο"


# ============================================================
# ORDER with DELIVERY
# ============================================================
def test_phone_order_with_delivery(http, demo_owner_token):
    hdr = _auth_headers(demo_owner_token)
    n = http.get(f"{API}/orders/next-number", headers=hdr).json()["next_order_number"]
    order = {
        "order_number": n,
        "items": [{"item_id": "x", "name": "TEST_Phone", "category": "orektika",
                   "unit_price": 5.0, "quantity": 1, "line_total": 5.0}],
        "subtotal": 5.0, "total": 5.0, "source": "Τηλέφωνο",
        "delivery": {"delivery_type": "delivery", "name": "Νίκος",
                     "phone": "6900000000", "address": "Οδός 1", "floor": "2ος"},
    }
    r = http.post(f"{API}/orders", json=order, headers=hdr)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["delivery"]["delivery_type"] == "delivery"
    assert d["delivery"]["address"] == "Οδός 1"
    assert d["delivery"]["floor"] == "2ος"

    # order without delivery still fine
    n2 = http.get(f"{API}/orders/next-number", headers=hdr).json()["next_order_number"]
    order2 = dict(order, order_number=n2, source="Ταμείο")
    order2.pop("delivery")
    r2 = http.post(f"{API}/orders", json=order2, headers=hdr)
    assert r2.status_code == 200
    assert r2.json().get("delivery") is None

    # takeaway
    n3 = http.get(f"{API}/orders/next-number", headers=hdr).json()["next_order_number"]
    order3 = dict(order, order_number=n3,
                  delivery={"delivery_type": "takeaway", "name": "Α", "phone": "69"})
    r3 = http.post(f"{API}/orders", json=order3, headers=hdr)
    assert r3.status_code == 200
    assert r3.json()["delivery"]["delivery_type"] == "takeaway"


# ============================================================
# LEGACY / REGRESSION TESTS (updated with owner tokens)
# ============================================================
def test_register_login_me_flow(http):
    email = _rand_email()
    payload = {"email": email, "password": "pass1234", "restaurant_name": "TEST_Resto_A"}
    r = http.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data
    assert data["user"]["email"] == email
    assert data["user"]["profile"] is None
    assert data["user"]["owner_pin_set"] is False
    token = data["token"]

    r2 = http.post(f"{API}/auth/register", json=payload)
    assert r2.status_code == 400

    r4 = http.get(f"{API}/auth/me", headers=_auth_headers(token))
    assert r4.status_code == 200
    assert r4.json()["email"] == email

    assert http.get(f"{API}/auth/me").status_code == 401

    r6 = http.post(f"{API}/auth/login", json={"email": email, "password": "wrong"})
    assert r6.status_code == 401


def test_demo_menu_seeded(http, demo_token):
    r = http.get(f"{API}/menu/config", headers=_auth_headers(demo_token))
    assert r.status_code == 200
    cfg = r.json()
    assert len(cfg["categories"]) >= 7
    assert len(cfg["items"]) >= 30


def test_tenancy_isolation(http):
    _, _, a_tok = _register(http, "IsoA")
    _, _, b_tok = _register(http, "IsoB")
    a, b = _auth_headers(a_tok), _auth_headers(b_tok)
    a_cfg = http.get(f"{API}/menu/config", headers=a).json()
    a_cat = a_cfg["categories"][0]["id"]
    ri = http.post(f"{API}/menu/items",
                   json={"name": "TEST_UniqueA", "price": 9.99, "category": a_cat},
                   headers=a)
    assert ri.status_code == 200
    a_item_id = ri.json()["id"]
    b_cfg = http.get(f"{API}/menu/config", headers=b).json()
    assert not any(i["id"] == a_item_id for i in b_cfg["items"])

    n = http.get(f"{API}/orders/next-number", headers=a).json()["next_order_number"]
    order = {"order_number": n,
             "items": [{"item_id": a_item_id, "name": "TEST_UniqueA", "category": a_cat,
                        "unit_price": 9.99, "quantity": 1, "line_total": 9.99}],
             "subtotal": 9.99, "total": 9.99, "source": "Ταμείο"}
    ro = http.post(f"{API}/orders", json=order, headers=a)
    assert ro.status_code == 200
    b_anal = http.get(f"{API}/analytics", headers=b).json()
    assert b_anal["total_orders"] == 0


def test_category_and_item_crud_and_cascade(http):
    _, _, tok = _register(http, "CRUD")
    hdr = _auth_headers(tok)
    rc = http.post(f"{API}/menu/categories",
                   json={"name": "TEST_Cat", "order": 99}, headers=hdr)
    assert rc.status_code == 200
    cid = rc.json()["id"]

    ri = http.post(f"{API}/menu/items",
                   json={"name": "TEST_Item", "price": 1.0, "category": cid},
                   headers=hdr)
    assert ri.status_code == 200
    iid = ri.json()["id"]

    rd = http.delete(f"{API}/menu/items/{iid}", headers=hdr)
    assert rd.status_code == 200
    # cascade
    ri2 = http.post(f"{API}/menu/items",
                    json={"name": "TEST_Cascade", "price": 1.0, "category": cid},
                    headers=hdr).json()
    rdc = http.delete(f"{API}/menu/categories/{cid}", headers=hdr)
    assert rdc.status_code == 200
    cfg2 = http.get(f"{API}/menu/config", headers=hdr).json()
    assert not any(i["id"] == ri2["id"] for i in cfg2["items"])


def test_orders_unauthenticated_401(http):
    assert http.get(f"{API}/orders").status_code == 401
    assert http.post(f"{API}/orders", json={}).status_code == 401


def test_shopping_requires_owner(http):
    _, base_tok, owner_tok = _register(http, "ShopOwn")
    emp_tok = _select_profile(http, base_tok, "employee", "0000")
    # employee cannot list
    assert http.get(f"{API}/shopping", headers=_auth_headers(emp_tok)).status_code == 403
    # owner can
    r = http.post(f"{API}/shopping", json={"text": "TEST_x"},
                  headers=_auth_headers(owner_tok))
    assert r.status_code == 200
    sid = r.json()["id"]
    http.delete(f"{API}/shopping/{sid}", headers=_auth_headers(owner_tok))


def test_employees_and_shifts_flow(http):
    _, _, tok = _register(http, "EmpFlow")
    hdr = _auth_headers(tok)
    r = http.post(f"{API}/employees", json={"name": "TEST_Emp"}, headers=hdr)
    assert r.status_code == 200
    eid = r.json()["id"]
    ws = "2026-01-05"
    r = http.put(f"{API}/shifts",
                 json={"employee_id": eid, "week_start": ws, "day": 0,
                       "start": "17:00", "end": "23:00"}, headers=hdr)
    assert r.status_code == 200
    lst = http.get(f"{API}/shifts", params={"week_start": ws}, headers=hdr).json()
    assert any(s["employee_id"] == eid for s in lst)
    http.delete(f"{API}/employees/{eid}", headers=hdr)


# ============================================================
# ITERATION 6: BULK MENU OPERATIONS
# ============================================================
def _create_items(http, hdr, cid, n=4, price=10.0, tag="Bulk"):
    ids = []
    for i in range(n):
        r = http.post(f"{API}/menu/items",
                      json={"name": f"TEST_{tag}_{i}", "price": price, "category": cid},
                      headers=hdr)
        assert r.status_code == 200, r.text
        ids.append(r.json()["id"])
    return ids


def test_bulk_set_price(http):
    _, _, tok = _register(http, "BulkSet")
    hdr = _auth_headers(tok)
    cfg = http.get(f"{API}/menu/config", headers=hdr).json()
    cid = cfg["categories"][0]["id"]
    ids = _create_items(http, hdr, cid, n=3, price=5.0)

    r = http.post(f"{API}/menu/items/bulk",
                  json={"ids": ids, "action": "set_price", "price": 7.5},
                  headers=hdr)
    assert r.status_code == 200, r.text
    assert r.json()["affected"] == 3

    cfg2 = http.get(f"{API}/menu/config", headers=hdr).json()
    for iid in ids:
        it = next(i for i in cfg2["items"] if i["id"] == iid)
        assert it["price"] == 7.5


def test_bulk_adjust_price_delta_clamped(http):
    _, _, tok = _register(http, "BulkAdj")
    hdr = _auth_headers(tok)
    cfg = http.get(f"{API}/menu/config", headers=hdr).json()
    cid = cfg["categories"][0]["id"]
    ids = _create_items(http, hdr, cid, n=2, price=0.1)

    # delta=+0.2 -> 0.3
    r = http.post(f"{API}/menu/items/bulk",
                  json={"ids": ids, "action": "adjust_price", "delta": 0.2},
                  headers=hdr)
    assert r.status_code == 200
    assert r.json()["affected"] == 2
    cfg2 = http.get(f"{API}/menu/config", headers=hdr).json()
    for iid in ids:
        assert next(i for i in cfg2["items"] if i["id"] == iid)["price"] == 0.3

    # delta=-5 clamped to 0
    r = http.post(f"{API}/menu/items/bulk",
                  json={"ids": ids, "action": "adjust_price", "delta": -5},
                  headers=hdr)
    assert r.status_code == 200
    cfg3 = http.get(f"{API}/menu/config", headers=hdr).json()
    for iid in ids:
        assert next(i for i in cfg3["items"] if i["id"] == iid)["price"] == 0.0


def test_bulk_adjust_price_pct(http):
    _, _, tok = _register(http, "BulkPct")
    hdr = _auth_headers(tok)
    cfg = http.get(f"{API}/menu/config", headers=hdr).json()
    cid = cfg["categories"][0]["id"]
    ids = _create_items(http, hdr, cid, n=2, price=10.0)

    r = http.post(f"{API}/menu/items/bulk",
                  json={"ids": ids, "action": "adjust_price_pct", "pct": 10},
                  headers=hdr)
    assert r.status_code == 200
    assert r.json()["affected"] == 2
    cfg2 = http.get(f"{API}/menu/config", headers=hdr).json()
    for iid in ids:
        assert next(i for i in cfg2["items"] if i["id"] == iid)["price"] == 11.0


def test_bulk_set_category_and_unknown_404(http):
    _, _, tok = _register(http, "BulkCat")
    hdr = _auth_headers(tok)
    cfg = http.get(f"{API}/menu/config", headers=hdr).json()
    cid1 = cfg["categories"][0]["id"]
    # create a second cat
    cid2 = http.post(f"{API}/menu/categories",
                     json={"name": "TEST_BulkCatB", "order": 99},
                     headers=hdr).json()["id"]
    ids = _create_items(http, hdr, cid1, n=2)

    r = http.post(f"{API}/menu/items/bulk",
                  json={"ids": ids, "action": "set_category", "category": cid2},
                  headers=hdr)
    assert r.status_code == 200
    assert r.json()["affected"] == 2
    cfg2 = http.get(f"{API}/menu/config", headers=hdr).json()
    for iid in ids:
        assert next(i for i in cfg2["items"] if i["id"] == iid)["category"] == cid2

    # unknown category -> 404
    r = http.post(f"{API}/menu/items/bulk",
                  json={"ids": ids, "action": "set_category", "category": "not-a-cat"},
                  headers=hdr)
    assert r.status_code == 404


def test_bulk_set_availability(http):
    _, _, tok = _register(http, "BulkAvail")
    hdr = _auth_headers(tok)
    cfg = http.get(f"{API}/menu/config", headers=hdr).json()
    cid = cfg["categories"][0]["id"]
    ids = _create_items(http, hdr, cid, n=2)

    r = http.post(f"{API}/menu/items/bulk",
                  json={"ids": ids, "action": "set_availability",
                        "available": False, "note": "TEST_out"},
                  headers=hdr)
    assert r.status_code == 200
    assert r.json()["affected"] == 2
    cfg2 = http.get(f"{API}/menu/config", headers=hdr).json()
    for iid in ids:
        it = next(i for i in cfg2["items"] if i["id"] == iid)
        assert it.get("available") is False
        assert it.get("unavailable_note") == "TEST_out"


def test_bulk_add_option_group(http):
    _, _, tok = _register(http, "BulkOpt")
    hdr = _auth_headers(tok)
    cfg = http.get(f"{API}/menu/config", headers=hdr).json()
    cid = cfg["categories"][0]["id"]
    ids = _create_items(http, hdr, cid, n=2)

    group = {"id": "gsize", "name": "Μέγεθος", "type": "single", "required": True,
             "options": [{"name": "Μικρό", "price": 0}, {"name": "Μεγάλο", "price": 1.5}]}
    r = http.post(f"{API}/menu/items/bulk",
                  json={"ids": ids, "action": "add_option_group", "group": group},
                  headers=hdr)
    assert r.status_code == 200
    assert r.json()["affected"] == 2
    cfg2 = http.get(f"{API}/menu/config", headers=hdr).json()
    for iid in ids:
        it = next(i for i in cfg2["items"] if i["id"] == iid)
        assert any(g.get("id") == "gsize" and g.get("name") == "Μέγεθος"
                   for g in it.get("option_groups", []))

    # re-apply same group id → overwrite (not duplicate)
    group2 = dict(group, name="Μέγεθος v2")
    r = http.post(f"{API}/menu/items/bulk",
                  json={"ids": ids, "action": "add_option_group", "group": group2},
                  headers=hdr)
    assert r.status_code == 200
    cfg3 = http.get(f"{API}/menu/config", headers=hdr).json()
    for iid in ids:
        it = next(i for i in cfg3["items"] if i["id"] == iid)
        groups = [g for g in it["option_groups"] if g["id"] == "gsize"]
        assert len(groups) == 1
        assert groups[0]["name"] == "Μέγεθος v2"


def test_bulk_delete(http):
    _, _, tok = _register(http, "BulkDel")
    hdr = _auth_headers(tok)
    cfg = http.get(f"{API}/menu/config", headers=hdr).json()
    cid = cfg["categories"][0]["id"]
    ids = _create_items(http, hdr, cid, n=3)

    r = http.post(f"{API}/menu/items/bulk",
                  json={"ids": ids, "action": "delete"},
                  headers=hdr)
    assert r.status_code == 200
    assert r.json()["affected"] == 3
    cfg2 = http.get(f"{API}/menu/config", headers=hdr).json()
    for iid in ids:
        assert not any(i["id"] == iid for i in cfg2["items"])


def test_bulk_employee_forbidden(http):
    _, base_tok, owner_tok = _register(http, "BulkEmp")
    ohdr = _auth_headers(owner_tok)
    cfg = http.get(f"{API}/menu/config", headers=ohdr).json()
    cid = cfg["categories"][0]["id"]
    ids = _create_items(http, ohdr, cid, n=1)

    emp_tok = _select_profile(http, base_tok, "employee", "0000")
    r = http.post(f"{API}/menu/items/bulk",
                  json={"ids": ids, "action": "set_price", "price": 1.0},
                  headers=_auth_headers(emp_tok))
    assert r.status_code == 403


def test_bulk_tenancy_isolation(http):
    _, _, a_tok = _register(http, "BulkTenA")
    _, _, b_tok = _register(http, "BulkTenB")
    a, b = _auth_headers(a_tok), _auth_headers(b_tok)
    a_cfg = http.get(f"{API}/menu/config", headers=a).json()
    a_cat = a_cfg["categories"][0]["id"]
    a_ids = _create_items(http, a, a_cat, n=2, price=3.0, tag="TenA")

    # B tries to bulk-update A's items
    r = http.post(f"{API}/menu/items/bulk",
                  json={"ids": a_ids, "action": "set_price", "price": 999.0},
                  headers=b)
    assert r.status_code == 200
    assert r.json()["affected"] == 0

    # verify A's items untouched
    a_cfg2 = http.get(f"{API}/menu/config", headers=a).json()
    for iid in a_ids:
        assert next(i for i in a_cfg2["items"] if i["id"] == iid)["price"] == 3.0

    # B tries to bulk-delete A's items
    r = http.post(f"{API}/menu/items/bulk",
                  json={"ids": a_ids, "action": "delete"},
                  headers=b)
    assert r.status_code == 200
    assert r.json()["affected"] == 0
    a_cfg3 = http.get(f"{API}/menu/config", headers=a).json()
    for iid in a_ids:
        assert any(i["id"] == iid for i in a_cfg3["items"])


# ============================================================
# CLEANUP: reset demo PINs at end of session
# ============================================================
@pytest.fixture(scope="session", autouse=True)
def restore_demo_pins(http):
    yield
    # After all tests: reset demo owner+employee PINs to 0000
    try:
        base = _login(http)
        owner = _select_profile(http, base, "owner", "0000")
        # Force reset via API (in case any test changed them)
        http.put(f"{API}/profile/pin",
                 json={"target": "owner", "new_pin": "0000"},
                 headers=_auth_headers(owner))
        http.put(f"{API}/profile/pin",
                 json={"target": "employee", "new_pin": "0000"},
                 headers=_auth_headers(owner))
    except Exception as e:
        print(f"Warning: could not restore demo PINs: {e}")
