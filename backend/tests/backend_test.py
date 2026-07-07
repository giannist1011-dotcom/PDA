"""Backend tests for Peinokio multi-tenant POS SaaS."""
import os
import uuid
import time
from datetime import datetime, timezone

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


@pytest.fixture(scope="session")
def demo_token(http):
    r = http.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, f"Demo login failed: {r.text}"
    return r.json()["token"]


# --------- HEALTH ----------
def test_root(http):
    r = http.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# --------- AUTH ----------
def test_register_login_me_flow(http):
    email = _rand_email()
    payload = {"email": email, "password": "pass1234", "restaurant_name": "TEST_Resto_A"}
    r = http.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and isinstance(data["token"], str)
    assert data["user"]["email"] == email
    assert data["user"]["restaurant_name"] == "TEST_Resto_A"
    token = data["token"]

    # duplicate email should fail
    r2 = http.post(f"{API}/auth/register", json=payload)
    assert r2.status_code == 400

    # login
    r3 = http.post(f"{API}/auth/login", json={"email": email, "password": "pass1234"})
    assert r3.status_code == 200
    assert "token" in r3.json()

    # /me
    r4 = http.get(f"{API}/auth/me", headers=_auth_headers(token))
    assert r4.status_code == 200
    assert r4.json()["email"] == email

    # missing token
    r5 = http.get(f"{API}/auth/me")
    assert r5.status_code == 401

    # bad password
    r6 = http.post(f"{API}/auth/login", json={"email": email, "password": "wrong"})
    assert r6.status_code == 401


# --------- SEEDING ----------
def test_demo_menu_seeded(http, demo_token):
    r = http.get(f"{API}/menu/config", headers=_auth_headers(demo_token))
    assert r.status_code == 200
    cfg = r.json()
    assert len(cfg["categories"]) == 7
    assert len(cfg["items"]) == 39
    c = cfg["customization"]
    assert c["double_meat_price"] == 1.5
    assert "Πίτα" in c["bread_options"]
    assert "Διπλή πίτα" in c["bread_options"]
    assert "Ψωμάκι" in c["bread_options"]


def test_new_user_gets_starter_menu(http):
    email = _rand_email()
    r = http.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "restaurant_name": "TEST_Starter"})
    assert r.status_code == 200
    token = r.json()["token"]
    cfg = http.get(f"{API}/menu/config", headers=_auth_headers(token)).json()
    assert len(cfg["categories"]) == 7
    assert len(cfg["items"]) == 39


# --------- TENANCY ISOLATION ----------
def test_tenancy_isolation(http):
    # User A
    a_email = _rand_email()
    ra = http.post(f"{API}/auth/register", json={"email": a_email, "password": "pass1234", "restaurant_name": "TEST_A"})
    assert ra.status_code == 200
    a_token = ra.json()["token"]
    a_hdr = _auth_headers(a_token)

    # User B
    b_email = _rand_email()
    rb = http.post(f"{API}/auth/register", json={"email": b_email, "password": "pass1234", "restaurant_name": "TEST_B"})
    assert rb.status_code == 200
    b_token = rb.json()["token"]
    b_hdr = _auth_headers(b_token)

    # A creates a menu item
    a_cfg = http.get(f"{API}/menu/config", headers=a_hdr).json()
    a_cat = a_cfg["categories"][0]["id"]
    new_item = {"name": "TEST_UniqueItem_A", "price": 9.99, "category": a_cat,
                "customizable": False, "double_meat_eligible": False}
    ri = http.post(f"{API}/menu/items", json=new_item, headers=a_hdr)
    assert ri.status_code == 200
    a_item_id = ri.json()["id"]

    # B doesn't see A's item
    b_cfg = http.get(f"{API}/menu/config", headers=b_hdr).json()
    assert not any(i["id"] == a_item_id for i in b_cfg["items"])
    assert not any(i["name"] == "TEST_UniqueItem_A" for i in b_cfg["items"])

    # A places an order
    n_a = http.get(f"{API}/orders/next-number", headers=a_hdr).json()["next_order_number"]
    order = {
        "order_number": n_a,
        "items": [{"item_id": a_item_id, "name": "TEST_UniqueItem_A", "category": a_cat,
                   "unit_price": 9.99, "quantity": 1, "line_total": 9.99, "customization": None}],
        "subtotal": 9.99, "total": 9.99, "source": "Ταμείο", "note": "TEST"
    }
    ro = http.post(f"{API}/orders", json=order, headers=a_hdr)
    assert ro.status_code == 200
    a_order_id = ro.json()["id"]

    # B's orders list does NOT include A's
    b_orders = http.get(f"{API}/orders", headers=b_hdr).json()
    assert not any(o["id"] == a_order_id for o in b_orders)

    # B analytics is 0
    b_anal = http.get(f"{API}/analytics", headers=b_hdr).json()
    assert b_anal["total_orders"] == 0
    assert b_anal["total_revenue"] == 0

    # A analytics has the order
    a_anal = http.get(f"{API}/analytics", headers=a_hdr).json()
    assert a_anal["total_orders"] >= 1
    assert a_anal["total_revenue"] >= 9.99


# --------- MENU CRUD ----------
def test_category_and_item_crud_and_cascade(http):
    email = _rand_email()
    r = http.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "restaurant_name": "TEST_CRUD"})
    tok = r.json()["token"]
    hdr = _auth_headers(tok)

    # create category
    rc = http.post(f"{API}/menu/categories", json={"name": "TEST_Cat", "order": 99}, headers=hdr)
    assert rc.status_code == 200
    cid = rc.json()["id"]

    # update category
    ru = http.put(f"{API}/menu/categories/{cid}", json={"name": "TEST_Cat2", "order": 100}, headers=hdr)
    assert ru.status_code == 200
    assert ru.json()["name"] == "TEST_Cat2"

    # create item in this category
    ri = http.post(f"{API}/menu/items", json={
        "name": "TEST_Item", "price": 1.0, "category": cid,
        "customizable": True, "double_meat_eligible": True
    }, headers=hdr)
    assert ri.status_code == 200
    iid = ri.json()["id"]

    # update item
    rui = http.put(f"{API}/menu/items/{iid}", json={
        "name": "TEST_Item2", "price": 2.5, "category": cid,
        "customizable": False, "double_meat_eligible": False
    }, headers=hdr)
    assert rui.status_code == 200
    assert rui.json()["price"] == 2.5

    # verify via GET
    cfg = http.get(f"{API}/menu/config", headers=hdr).json()
    assert any(i["id"] == iid and i["name"] == "TEST_Item2" for i in cfg["items"])

    # delete item
    rd = http.delete(f"{API}/menu/items/{iid}", headers=hdr)
    assert rd.status_code == 200

    # recreate item then delete category to test cascade
    ri2 = http.post(f"{API}/menu/items", json={
        "name": "TEST_Cascade", "price": 1.0, "category": cid,
        "customizable": False, "double_meat_eligible": False
    }, headers=hdr).json()
    iid2 = ri2["id"]
    rdc = http.delete(f"{API}/menu/categories/{cid}", headers=hdr)
    assert rdc.status_code == 200
    cfg2 = http.get(f"{API}/menu/config", headers=hdr).json()
    assert not any(c["id"] == cid for c in cfg2["categories"])
    assert not any(i["id"] == iid2 for i in cfg2["items"]), "Item should cascade-delete"


def test_customization_update(http):
    email = _rand_email()
    r = http.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "restaurant_name": "TEST_Cust"})
    tok = r.json()["token"]
    hdr = _auth_headers(tok)
    new_cust = {
        "bread_options": ["Πίτα", "Ψωμί"],
        "extras_options": ["τυρί"],
        "sauces_options": ["μαγιονέζα"],
        "double_meat_price": 2.0,
    }
    rp = http.put(f"{API}/menu/customization", json=new_cust, headers=hdr)
    assert rp.status_code == 200
    cfg = http.get(f"{API}/menu/config", headers=hdr).json()
    assert cfg["customization"]["double_meat_price"] == 2.0
    assert cfg["customization"]["extras_options"] == ["τυρί"]


# --------- ORDERS/ANALYTICS with auth ----------
def test_orders_unauthenticated_401(http):
    r = http.get(f"{API}/orders")
    assert r.status_code == 401
    r2 = http.post(f"{API}/orders", json={})
    assert r2.status_code == 401


def test_order_next_number_per_user(http, demo_token):
    hdr = _auth_headers(demo_token)
    n1 = http.get(f"{API}/orders/next-number", headers=hdr).json()["next_order_number"]
    order = {
        "order_number": n1,
        "items": [{"item_id": "x", "name": "TEST_Order", "category": "orektika",
                   "unit_price": 1.0, "quantity": 1, "line_total": 1.0, "customization": None}],
        "subtotal": 1.0, "total": 1.0, "source": "Ταμείο", "note": "TEST",
    }
    ro = http.post(f"{API}/orders", json=order, headers=hdr)
    assert ro.status_code == 200
    n2 = http.get(f"{API}/orders/next-number", headers=hdr).json()["next_order_number"]
    assert n2 == n1 + 1


def test_analytics_date_filter_scoped(http, demo_token):
    hdr = _auth_headers(demo_token)
    r = http.get(f"{API}/analytics", params={"date_from": "2000-01-01", "date_to": "2000-01-02"}, headers=hdr)
    assert r.status_code == 200
    d = r.json()
    assert d["total_orders"] == 0
    assert d["total_revenue"] == 0
    assert len(d["hourly"]) == 24
