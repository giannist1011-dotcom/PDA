"""Backend tests for Peinokio POS API."""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback read from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session", autouse=True)
def cleanup_today(client):
    """Purge today's TEST orders isn't supported by API. We rely on unique high order_numbers."""
    yield


def _make_order_payload(order_number: int, source: str = "Ταμείο"):
    return {
        "order_number": order_number,
        "items": [
            {
                "item_id": "test-pita",
                "name": "TEST_Πίτα",
                "category": "pites",
                "unit_price": 3.50,
                "quantity": 2,
                "line_total": 7.00,
                "customization": None,
            }
        ],
        "subtotal": 7.00,
        "total": 7.00,
        "source": source,
        "note": "TEST_note",
    }


# Health / Root
def test_root(client):
    r = client.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# Next order number
def test_next_order_number_returns_int(client):
    r = client.get(f"{API}/orders/next-number")
    assert r.status_code == 200
    data = r.json()
    assert "next_order_number" in data
    assert isinstance(data["next_order_number"], int)
    assert data["next_order_number"] >= 1


# Create order and verify persistence
def test_create_order_and_persist(client):
    # get current next number to avoid clashing with existing today's data
    next_num = client.get(f"{API}/orders/next-number").json()["next_order_number"]
    payload = _make_order_payload(next_num)
    r = client.post(f"{API}/orders", json=payload)
    assert r.status_code == 200, r.text
    order = r.json()
    assert "id" in order and isinstance(order["id"], str)
    # id should be a valid uuid
    uuid.UUID(order["id"])
    assert "created_at" in order
    assert order["order_number"] == next_num
    assert order["total"] == 7.00
    assert order["source"] == "Ταμείο"

    # Auto-increment: next number should now be next_num + 1
    r2 = client.get(f"{API}/orders/next-number")
    assert r2.status_code == 200
    assert r2.json()["next_order_number"] == next_num + 1

    # GET /api/orders should include this order sorted desc
    today = datetime.now(timezone.utc).date().isoformat()
    r3 = client.get(f"{API}/orders", params={"date_from": today, "date_to": today})
    assert r3.status_code == 200
    orders = r3.json()
    assert any(o["id"] == order["id"] for o in orders)
    # Verify sort desc by created_at
    if len(orders) >= 2:
        assert orders[0]["created_at"] >= orders[1]["created_at"]


def test_list_orders_date_filter_empty(client):
    r = client.get(f"{API}/orders", params={"date_from": "2000-01-01", "date_to": "2000-01-02"})
    assert r.status_code == 200
    assert r.json() == []


def test_analytics_defaults_today(client):
    r = client.get(f"{API}/analytics")
    assert r.status_code == 200
    d = r.json()
    for k in ["total_orders", "total_revenue", "avg_order_value", "by_source", "popular_items", "hourly"]:
        assert k in d
    assert isinstance(d["hourly"], list) and len(d["hourly"]) == 24
    assert d["total_orders"] >= 1  # we created one above


def test_analytics_date_filter(client):
    r = client.get(f"{API}/analytics", params={"date_from": "2000-01-01", "date_to": "2000-01-02"})
    assert r.status_code == 200
    d = r.json()
    assert d["total_orders"] == 0
    assert d["total_revenue"] == 0
    assert d["avg_order_value"] == 0
    assert len(d["hourly"]) == 24
    assert d["popular_items"] == []


def test_create_order_multiple_sources(client):
    for src in ["Τηλέφωνο", "efood", "Box"]:
        n = client.get(f"{API}/orders/next-number").json()["next_order_number"]
        r = client.post(f"{API}/orders", json=_make_order_payload(n, src))
        assert r.status_code == 200, r.text
        assert r.json()["source"] == src


def test_create_order_with_customization(client):
    n = client.get(f"{API}/orders/next-number").json()["next_order_number"]
    payload = _make_order_payload(n)
    payload["items"][0].update({
        "item_id": "sw-xoirino",
        "name": "TEST_Σάντουιτς Χοιρινό",
        "category": "sandwich",
        "customization": {
            "bread": "λευκό",
            "extras": ["τυρί", "μπέικον"],
            "sauces": ["μαγιονέζα"],
            "double_meat": True,
        },
    })
    r = client.post(f"{API}/orders", json=payload)
    assert r.status_code == 200, r.text
    o = r.json()
    assert o["items"][0]["customization"]["double_meat"] is True
    assert "τυρί" in o["items"][0]["customization"]["extras"]
