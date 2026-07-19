"""Παραγγελίες: δημιουργία, scheduled, ιστορικό, ακύρωση, πελάτες."""
import asyncio
import logging
import re
import uuid

import requests
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, ConfigDict

from core import (
    db,
    require_staff,
    require_owner,
    actor_name,
    require_owner_or_pin,
)
from routers.menu import MenuOption

router = APIRouter()
logger = logging.getLogger("orderdeck.orders")


# ============ MODELS ============
class OptionSelection(BaseModel):
    model_config = ConfigDict(extra="ignore")
    group_id: str
    group_name: str
    choices: List[MenuOption] = Field(default_factory=list)


class OrderItemCustomization(BaseModel):
    model_config = ConfigDict(extra="ignore")
    bread: Optional[str] = None
    extras: List[str] = Field(default_factory=list)
    sauces: List[str] = Field(default_factory=list)
    double_meat: bool = False
    selections: List[OptionSelection] = Field(default_factory=list)


class OrderItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    item_id: str
    name: str
    category: str
    unit_price: float
    quantity: int = 1
    line_total: float
    customization: Optional[OrderItemCustomization] = None


class DeliveryInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")
    delivery_type: Literal["delivery", "takeaway"]
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    floor: Optional[str] = None


class DiscountInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")
    type: Literal["percent", "amount"]
    value: float = Field(ge=0)   # 10 (%) or 2.50 (€)
    amount: float = Field(ge=0)  # computed € discount
    applied_by: Optional[str] = None  # profile name — set server-side
    applied_by_role: Optional[str] = None
    applied_at: Optional[str] = None


class TakenBy(BaseModel):
    model_config = ConfigDict(extra="ignore")
    profile_id: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None


class OrderCreate(BaseModel):
    order_number: int
    items: List[OrderItem]
    subtotal: float
    total: float
    source: Literal["Ταμείο", "Τηλέφωνο", "efood", "Box", "Τραπέζι"]
    note: Optional[str] = None
    delivery: Optional[DeliveryInfo] = None
    scheduled_at: Optional[str] = None  # ISO datetime — order fires later
    discount: Optional[DiscountInfo] = None
    table_name: Optional[str] = None  # set when the order came from a closed table tab
    # Offline mode (PWA): idempotency key + τοπική ώρα δημιουργίας από τη συσκευή
    client_id: Optional[str] = None
    client_created_at: Optional[str] = None  # ISO datetime — πότε γράφτηκε offline


class Order(OrderCreate):
    id: str
    user_id: str
    created_at: datetime
    cancelled: bool = False
    status: Literal["active", "scheduled"] = "active"
    cancelled_by: Optional[str] = None
    cancelled_by_role: Optional[str] = None
    cancelled_at: Optional[str] = None
    taken_by: Optional[TakenBy] = None


# ============ ORDER ROUTES ============
async def compute_next_order_number(user_id: str) -> int:
    today = datetime.now(timezone.utc).date().isoformat()
    docs = await db.orders.find(
        {
            "user_id": user_id,
            "created_at": {"$gte": f"{today}T00:00:00+00:00", "$lte": f"{today}T23:59:59+00:00"},
        },
        {"_id": 0, "order_number": 1},
    ).sort("order_number", -1).limit(1).to_list(1)
    return (docs[0]["order_number"] + 1) if docs else 1


@router.get("/orders/next-number")
async def next_order_number(user: dict = Depends(require_staff)):
    return {"next_order_number": await compute_next_order_number(user["id"])}


@router.post("/orders", response_model=Order)
async def create_order(body: OrderCreate, user: dict = Depends(require_staff)):
    # Offline sync: αν η παραγγελία έχει ήδη ανέβει (retry/διπλό sync), γύρνα την υπάρχουσα
    if body.client_id:
        existing = await db.orders.find_one(
            {"user_id": user["id"], "client_id": body.client_id}, {"_id": 0}
        )
        if existing:
            if isinstance(existing.get("created_at"), str):
                existing["created_at"] = datetime.fromisoformat(existing["created_at"])
            return existing
    oid = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    # Offline παραγγελίες κρατούν την τοπική ώρα δημιουργίας τους (σωστά στατιστικά)
    created_at = now
    if body.client_created_at:
        try:
            parsed = datetime.fromisoformat(body.client_created_at.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            if parsed <= now:  # ποτέ μελλοντική ώρα
                created_at = parsed
        except ValueError:
            pass
    doc = body.model_dump()
    doc.update({
        "id": oid,
        "user_id": user["id"],
        "created_at": created_at.isoformat(),
        "status": "scheduled" if body.scheduled_at else "active",
        "taken_by": {
            "profile_id": user.get("profile_id"),
            "name": actor_name(user),
            "role": user.get("role"),
        },
    })
    if doc.get("discount"):
        # audit trail: which profile applied the discount and when
        doc["discount"]["applied_by"] = actor_name(user)
        doc["discount"]["applied_by_role"] = user.get("role")
        doc["discount"]["applied_at"] = now.isoformat()
    await db.orders.insert_one(doc)
    if doc["status"] == "active":
        _warm_geocode(user, doc.get("delivery"))
    doc.pop("_id", None)
    doc["created_at"] = created_at
    return doc


@router.get("/orders/scheduled", response_model=List[Order])
async def list_scheduled_orders(user: dict = Depends(require_staff)):
    docs = await db.orders.find(
        {"user_id": user["id"], "status": "scheduled", "cancelled": {"$ne": True}},
        {"_id": 0},
    ).sort("scheduled_at", 1).to_list(500)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
    return docs


@router.get("/orders", response_model=List[Order])
async def list_orders(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    source: Optional[str] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 500,
    user: dict = Depends(require_staff),
):
    query = {"user_id": user["id"]}
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = f"{date_from}T00:00:00+00:00"
        if date_to:
            rng["$lte"] = f"{date_to}T23:59:59+00:00"
        query["created_at"] = rng
    if source:
        query["source"] = source
    if q and q.strip():
        term = q.strip()
        ors = [
            {"delivery.name": {"$regex": re.escape(term), "$options": "i"}},
            {"delivery.phone": {"$regex": re.escape(term)}},
        ]
        if term.isdigit():
            ors.append({"order_number": int(term)})
        query["$or"] = ors
    docs = (
        await db.orders.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(max(0, skip))
        .to_list(min(limit, 500))
    )
    for d in docs:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
    return docs


# ============ LIVE MAP ============
LIVE_MAP_WINDOW_MIN = 30       # παραγγελίες παράδοσης των τελευταίων 30' (από την εκτύπωση)
GEOCODE_MAX_NEW_PER_CALL = 5   # σεβασμός στο rate limit του Nominatim (1 req/s)


def _nominatim_lookup(query: str, viewbox: Optional[str] = None, bounded: bool = False):
    """Sync κλήση στο Nominatim — τρέχει σε thread για να μην μπλοκάρει το event loop."""
    params = {"format": "json", "limit": 1, "q": query, "countrycodes": "gr"}
    if viewbox:
        # Προτίμηση αποτελεσμάτων κοντά στο κατάστημα· bounded=1 = ΜΟΝΟ μέσα στο κουτί
        params["viewbox"] = viewbox
        if bounded:
            params["bounded"] = 1
    r = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params=params,
        headers={
            # Το Nominatim απαιτεί αναγνωρίσιμο User-Agent με στοιχεία επικοινωνίας
            "User-Agent": "OrderDeck-POS/1.0 (giannist1011@gmail.com)",
            "Accept-Language": "el",
        },
        timeout=8,
    )
    r.raise_for_status()
    results = r.json()
    if results:
        return float(results[0]["lat"]), float(results[0]["lon"])
    logger.info("geocode: no Nominatim result for %r (bounded=%s)", query, bounded)
    return None, None


def _store_viewbox(user: dict) -> Optional[str]:
    """~13km κουτί γύρω από τις συντεταγμένες του καταστήματος (αν έχουν οριστεί)."""
    lat, lng = user.get("store_lat"), user.get("store_lng")
    if lat is None or lng is None:
        return None
    d = 0.12
    return f"{lng - d},{lat + d},{lng + d},{lat - d}"


async def _geocode_cached(user: dict, address: str, budget: dict):
    """Επιστρέφει (lat, lng, status) όπου status: "ok" | "failed" | "pending".

    "failed" = η διεύθυνση γεωκωδικοποιήθηκε αλλά δεν βρέθηκε (cached μόνιμα)·
    "pending" = δεν έχει γίνει ακόμα lookup (budget/προσωρινό σφάλμα) — retry στο επόμενο poll.
    """
    user_id = user["id"]
    key = " ".join(address.strip().lower().split())
    cached = await db.geocode_cache.find_one({"user_id": user_id, "address": key})
    if cached:
        lat, lng = cached.get("lat"), cached.get("lng")
        return lat, lng, ("ok" if lat is not None else "failed")
    if budget["new"] >= GEOCODE_MAX_NEW_PER_CALL:
        return None, None, "pending"  # θα γίνει στο επόμενο poll
    budget["new"] += 1
    # Οι νέες παραγγελίες αποθηκεύουν ήδη πλήρη διεύθυνση (οδός, πόλη) — το lookup
    # τη χρησιμοποιεί ως έχει. Fallback: παλιές παραγγελίες χωρίς πόλη παίρνουν
    # την πόλη του μαγαζιού, αλλιώς το Nominatim γυρνάει ομώνυμο δρόμο αλλού.
    query = address.strip()
    city = (user.get("store_city") or "").strip()
    if city and city.lower() not in query.lower():
        query = f"{query}, {city}"
    viewbox = _store_viewbox(user)
    try:
        lat, lng = await asyncio.to_thread(_nominatim_lookup, query, viewbox)
        if lat is None and viewbox:
            # Fallback: σκέτη διεύθυνση, αυστηρά μέσα στο κουτί γύρω από το μαγαζί
            await asyncio.sleep(1)
            lat, lng = await asyncio.to_thread(_nominatim_lookup, address.strip(), viewbox, True)
    except Exception as e:
        logger.warning("geocode: lookup error for %r: %s", address, e)
        return None, None, "pending"  # προσωρινό σφάλμα — δεν κάνουμε cache, retry στο επόμενο poll
    await db.geocode_cache.update_one(
        {"user_id": user_id, "address": key},
        {"$set": {"lat": lat, "lng": lng, "q": query,
                  "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    await asyncio.sleep(1)  # Nominatim: max 1 αίτημα/δευτερόλεπτο
    return lat, lng, ("ok" if lat is not None else "failed")


def _warm_geocode(user: dict, delivery: Optional[dict]):
    """Fire-and-forget geocode μόλις αποθηκευτεί/εκτυπωθεί παραγγελία παράδοσης,
    ώστε το pin να εμφανίζεται αμέσως στο πρώτο poll του χάρτη."""
    addr = (delivery or {}).get("address")
    if (delivery or {}).get("delivery_type") != "delivery" or not (addr or "").strip():
        return

    async def run():
        try:
            await _geocode_cached(user, addr, {"new": 0})
        except Exception as e:
            logger.warning("geocode: warm-geocode failed for %r: %s", addr, e)

    asyncio.create_task(run())


@router.get("/orders/live-map")
async def live_map_orders(user: dict = Depends(require_staff)):
    """Παραγγελίες παράδοσης των τελευταίων 30' με συντεταγμένες για τον live χάρτη."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=LIVE_MAP_WINDOW_MIN)).isoformat()
    docs = await db.orders.find(
        {
            "user_id": user["id"],
            # ΟΛΕΣ οι εκτυπωμένες παραγγελίες (και όσες δεν έχουν καθόλου status
            # από παλαιότερες εκδόσεις) — εκτός των scheduled που δεν έχουν "φύγει"
            "status": {"$ne": "scheduled"},
            "cancelled": {"$ne": True},
            "delivery.delivery_type": "delivery",
            "delivery.address": {"$nin": [None, ""]},
            "$or": [
                {"activated_at": {"$gte": cutoff}},
                {"activated_at": {"$exists": False}, "created_at": {"$gte": cutoff}},
            ],
        },
        {"_id": 0, "id": 1, "order_number": 1, "created_at": 1, "activated_at": 1,
         "total": 1, "delivery": 1},
    ).sort("created_at", -1).to_list(100)

    cleared_at = user.get("live_map_cleared_at")
    budget = {"new": 0}
    out = []
    for d in docs:
        printed_at = d.get("activated_at") or d["created_at"]
        if cleared_at and printed_at <= cleared_at:
            continue  # χειροκίνητος καθαρισμός χάρτη — κρύψε ό,τι υπήρχε πριν
        addr = d["delivery"]["address"]
        lat, lng, geo_status = await _geocode_cached(user, addr, budget)
        out.append({
            "id": d["id"],
            "order_number": d["order_number"],
            "printed_at": printed_at,
            "address": addr,
            "floor": d["delivery"].get("floor"),
            "name": d["delivery"].get("name"),
            "total": d.get("total", 0),
            "lat": lat,
            "lng": lng,
            "geo_status": geo_status,
        })
    # Προσωρινό debug: πού σπάει η αλυσίδα query → geocode → pin
    counts = Counter(o["geo_status"] for o in out)
    logger.info(
        "live-map user=%s: query=%d shown=%d ok=%d failed=%d pending=%d",
        user["id"], len(docs), len(out),
        counts.get("ok", 0), counts.get("failed", 0), counts.get("pending", 0),
    )
    return out


@router.post("/orders/live-map/clear")
async def clear_live_map(user: dict = Depends(require_staff)):
    """Χειροκίνητος καθαρισμός: κρύβει από τον χάρτη όλες τις τρέχουσες παραγγελίες."""
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"id": user["id"]}, {"$set": {"live_map_cleared_at": now}})
    return {"cleared_at": now}


@router.get("/orders/{oid}", response_model=Order)
async def get_order(oid: str, user: dict = Depends(require_staff)):
    doc = await db.orders.find_one({"id": oid, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if isinstance(doc.get("created_at"), str):
        doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return doc


@router.post("/orders/{oid}/activate", response_model=Order)
async def activate_order(oid: str, user: dict = Depends(require_staff)):
    """Move a scheduled order to active (fired / printed)."""
    r = await db.orders.update_one(
        {"id": oid, "user_id": user["id"], "status": "scheduled"},
        {"$set": {"status": "active", "activated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.orders.find_one({"id": oid, "user_id": user["id"]}, {"_id": 0})
    _warm_geocode(user, doc.get("delivery"))
    if isinstance(doc.get("created_at"), str):
        doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return doc


class CancelOrderIn(BaseModel):
    pin: Optional[str] = None


@router.post("/orders/{oid}/cancel")
async def cancel_order(
    oid: str,
    body: Optional[CancelOrderIn] = None,
    user: dict = Depends(require_staff),
):
    order = await db.orders.find_one({"id": oid, "user_id": user["id"]}, {"_id": 0, "status": 1})
    if not order:
        raise HTTPException(404, "Not found")
    # scheduled orders may be cancelled by any profile;
    # fired orders need the owner profile or a valid owner PIN
    if order.get("status") != "scheduled":
        await require_owner_or_pin(user, body.pin if body else None)
    await db.orders.update_one(
        {"id": oid, "user_id": user["id"]},
        {"$set": {
            "cancelled": True,
            "cancelled_by": actor_name(user),
            "cancelled_by_role": user.get("role"),
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"ok": True, "id": oid, "cancelled": True}


@router.delete("/orders/{oid}")
async def delete_order(
    oid: str,
    pin: Optional[str] = None,
    user: dict = Depends(require_staff),
):
    await require_owner_or_pin(user, pin)
    r = await db.orders.delete_one({"id": oid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@router.get("/customers")
async def list_customers(user: dict = Depends(require_owner)):
    """Aggregate customers from phone/delivery orders, grouped by phone
    (falling back to name+address when no phone was recorded)."""
    docs = await db.orders.find(
        {
            "user_id": user["id"],
            "delivery": {"$ne": None},
            "cancelled": {"$ne": True},
            "status": {"$ne": "scheduled"},
        },
        {"_id": 0, "user_id": 0},
    ).sort("created_at", 1).to_list(50000)

    customers = {}
    for d in docs:
        dv = d.get("delivery") or {}
        phone = (dv.get("phone") or "").strip()
        name = (dv.get("name") or "").strip()
        address = (dv.get("address") or "").strip()
        if phone:
            key = f"tel:{phone}"
        elif name or address:
            key = f"na:{name.lower()}|{address.lower()}"
        else:
            continue  # no identifying info at all

        c = customers.setdefault(key, {
            "key": key,
            "name": "",
            "phone": "",
            "address": "",
            "floor": "",
            "orders_count": 0,
            "total_spent": 0.0,
            "last_order_at": None,
            "orders": [],
            "_items": Counter(),
        })
        # keep the latest non-empty contact details (docs are sorted oldest→newest)
        if name:
            c["name"] = name
        if phone:
            c["phone"] = phone
        if address:
            c["address"] = address
        if (dv.get("floor") or "").strip():
            c["floor"] = dv["floor"].strip()

        c["orders_count"] += 1
        c["total_spent"] += d.get("total", 0)
        c["last_order_at"] = d.get("created_at")
        c["orders"].append({
            "id": d["id"],
            "order_number": d.get("order_number"),
            "created_at": d.get("created_at"),
            "total": d.get("total", 0),
            "delivery_type": dv.get("delivery_type"),
            "source": d.get("source"),
        })
        for it in d.get("items", []):
            c["_items"][it.get("name", "")] += it.get("quantity", 1)

    out = []
    for c in customers.values():
        c["total_spent"] = round(c["total_spent"], 2)
        c["orders"] = list(reversed(c["orders"]))  # newest first
        c["top_items"] = [
            {"name": n, "quantity": q} for n, q in c.pop("_items").most_common(5) if n
        ]
        out.append(c)
    out.sort(key=lambda c: (-c["orders_count"], c["name"].lower()))
    return out
