"""Παραγγελίες: δημιουργία, scheduled, ιστορικό, ακύρωση, επεξεργασία, πελάτες."""
import asyncio
import json
import logging
import os
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
    require_feature,
    profile_can,
    business_day_cutoff,
    business_day_range,
    business_today,
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
    # Όλες οι διαθέσιμες επιλογές της ομάδας τη στιγμή της παραγγελίας — η απόδειξη
    # τυπώνει «απ' όλα» / «απ' όλα χωρίς Χ» αντί για ολόκληρη τη λίστα υλικών
    pool: List[str] = Field(default_factory=list)


class OrderItemCustomization(BaseModel):
    model_config = ConfigDict(extra="ignore")
    bread: Optional[str] = None
    extras: List[str] = Field(default_factory=list)
    extras_pool: List[str] = Field(default_factory=list)
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
    source: Literal["Ταμείο", "Τηλέφωνο", "efood", "Box", "Wolt", "Τραπέζι"]
    note: Optional[str] = Field(default=None, max_length=300)
    # Χρέωση delivery (€) — προστίθεται αυτόματα στις παραγγελίες παράδοσης όταν έχει οριστεί
    delivery_fee: Optional[float] = Field(default=None, ge=0)
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
    # Επεξεργασία μετά τη δημιουργία: πότε άλλαξε τελευταία + change log (ποιος/πότε/τι)
    modified_at: Optional[str] = None
    edits: List[dict] = Field(default_factory=list)
    # Παραγγελία πλατφόρμας (efood/Box/Wolt): σήμανση για το banner της απόδειξης
    # και τον χρόνο παράδοσης που δείχνει countdown στη λίστα παραγγελιών
    platform: Optional[str] = None
    platform_ref: Optional[str] = None
    platform_order_id: Optional[str] = None
    platform_due_at: Optional[str] = None


# ============ ORDER ROUTES ============
async def compute_next_order_number(user: dict) -> int:
    """Η αρίθμηση μηδενίζει με την ΕΡΓΑΣΙΜΗ ημέρα — ίδιο όριο με το Z, ώστε μια
    νύχτα (π.χ. κλείσιμο 02:00) να μην έχει δύο φορές το #1."""
    cutoff = business_day_cutoff(user)
    utc_from, utc_to = business_day_range(business_today(cutoff), cutoff)
    docs = await db.orders.find(
        {
            "user_id": user["id"],
            "created_at": {"$gte": utc_from, "$lt": utc_to},
        },
        {"_id": 0, "order_number": 1},
    ).sort("order_number", -1).limit(1).to_list(1)
    return (docs[0]["order_number"] + 1) if docs else 1


@router.get("/orders/next-number")
async def next_order_number(user: dict = Depends(require_staff)):
    return {"next_order_number": await compute_next_order_number(user)}


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
        if not profile_can(user, "discounts"):
            raise HTTPException(403, "Το προφίλ σας δεν έχει δικαίωμα έκπτωσης")
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


# Πόση ώρα μένει ορατή στην περιοχή «Προγραμματισμένες» μια παραγγελία αφού
# έφτασε η ώρα της (υπενθύμιση «ΩΡΑ ΤΗΣ: τώρα» — επιβιώνει από refresh)
SCHEDULED_REMINDER_HOURS = 3


@router.get("/orders/scheduled", response_model=List[Order])
async def list_scheduled_orders(user: dict = Depends(require_staff)):
    """Εκκρεμείς προγραμματισμένες + όσες ενεργοποιήθηκαν τις τελευταίες
    SCHEDULED_REMINDER_HOURS ώρες (μένουν ως υπενθύμιση στη ροή παραγγελιών)."""
    cutoff = (
        datetime.now(timezone.utc) - timedelta(hours=SCHEDULED_REMINDER_HOURS)
    ).isoformat()
    docs = await db.orders.find(
        {
            "user_id": user["id"],
            "cancelled": {"$ne": True},
            "$or": [
                {"status": "scheduled"},
                # activated_at γράφεται server-side με το ίδιο ISO format → ασφαλής σύγκριση
                {"status": "active", "activated_at": {"$gte": cutoff}},
            ],
        },
        {"_id": 0},
    ).sort("scheduled_at", 1).to_list(500)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
    return docs


def _history_query(
    user: dict,
    date_from: Optional[str],
    date_to: Optional[str],
    source: Optional[str],
    q: Optional[str],
) -> dict:
    query = {"user_id": user["id"]}
    if date_from or date_to:
        # ΕΡΓΑΣΙΜΕΣ ημέρες (ωράριο μαγαζιού) → UTC όρια: η νύχτα μετά τα μεσάνυχτα
        # ανήκει στην ημέρα που άνοιξε, όπως ακριβώς και στο Z
        cutoff = business_day_cutoff(user)
        utc_from, _ = business_day_range(date_from or date_to, cutoff)
        _, utc_to = business_day_range(date_to or date_from, cutoff)
        rng = {}
        if date_from:
            rng["$gte"] = utc_from
        if date_to:
            rng["$lt"] = utc_to
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
    return query


@router.get("/orders", response_model=List[Order])
async def list_orders(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    source: Optional[str] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 500,
    user: dict = Depends(require_feature("history", require_staff)),
):
    query = _history_query(user, date_from, date_to, source, q)
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


@router.get("/orders/count")
async def count_orders(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    source: Optional[str] = None,
    q: Optional[str] = None,
    user: dict = Depends(require_feature("history", require_staff)),
):
    """Συνολικό πλήθος για τα φίλτρα του ιστορικού — το «Χ παραγγελίες» δίπλα στο εύρος."""
    query = _history_query(user, date_from, date_to, source, q)
    return {"count": await db.orders.count_documents(query)}


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
            "User-Agent": "OrderDeck-POS/1.0 ("
            + os.environ.get("GEOCODE_CONTACT", "contact@orderdeck.gr")
            + ")",
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


# Αριθμός σπιτιού στο τέλος της οδού: 1-4 ψηφία + προαιρετικό γράμμα («12», «12Β»)
HOUSE_NUM_RE = re.compile(r"\s+\d{1,4}\s*[A-Za-zΑ-Ωα-ωΆΈΉΊΌΎΏάέήίόύώ]?\.?$")


def _street_only(address: str) -> Optional[str]:
    """«Περγάμου 12, Κοζάνη» → «Περγάμου, Κοζάνη» — None αν δεν υπάρχει αριθμός.

    Οι ελληνικές επαρχιακές πόλεις σπάνια έχουν αριθμούς σπιτιών στο OSM: όταν
    αποτύχει η πλήρης διεύθυνση, το pin της ίδιας της οδού είναι αρκετό.
    """
    head, sep, tail = address.partition(",")
    stripped = HOUSE_NUM_RE.sub("", head.strip()).strip()
    if not stripped or stripped == head.strip():
        return None
    return (stripped + sep + tail).strip()


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
    # Οι νέες παραγγελίες αποθηκεύουν ήδη πλήρη διεύθυνση "οδός, πόλη" — το lookup
    # τη χρησιμοποιεί ως έχει. Fallback: παλιές παραγγελίες χωρίς πόλη παίρνουν
    # την πόλη του μαγαζιού, αλλιώς το Nominatim γυρνάει ομώνυμο δρόμο αλλού.
    # Αν όμως υπάρχει ήδη κόμμα, το frontend έχει βάλει πόλη (ίσως ΑΛΛΗ από του
    # μαγαζιού — παράδοση εκτός πόλης)· δεν προσθέτουμε δεύτερη.
    query = address.strip()
    city = (user.get("store_city") or "").strip()
    if city and "," not in query and city.lower() not in query.lower():
        query = f"{query}, {city}"
    viewbox = _store_viewbox(user)
    try:
        lat, lng = await asyncio.to_thread(_nominatim_lookup, query, viewbox)
        if lat is None and viewbox:
            # Fallback: σκέτη διεύθυνση, αυστηρά μέσα στο κουτί γύρω από το μαγαζί
            await asyncio.sleep(1)
            lat, lng = await asyncio.to_thread(_nominatim_lookup, address.strip(), viewbox, True)
        if lat is None:
            # Τελευταίο fallback: ΜΟΝΟ η οδός χωρίς αριθμό σπιτιού — ο αριθμός
            # λείπει από το OSM στις περισσότερες επαρχιακές πόλεις
            street = _street_only(query)
            if street:
                await asyncio.sleep(1)
                lat, lng = await asyncio.to_thread(_nominatim_lookup, street, viewbox)
                if lat is not None:
                    query = street
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


@router.get("/orders/address-book")
async def address_book(user: dict = Depends(require_staff)):
    """Γνωστές διευθύνσεις πελατών για autocomplete στη φόρμα παράδοσης του PDA —
    από τις πιο πρόσφατες παραγγελίες παράδοσης, dedup ανά διεύθυνση, με όνομα πελάτη."""
    docs = await db.orders.find(
        {
            "user_id": user["id"],
            "delivery.delivery_type": "delivery",
            "delivery.address": {"$nin": [None, ""]},
            "cancelled": {"$ne": True},
        },
        {"_id": 0, "delivery.name": 1, "delivery.address": 1},
    ).sort("created_at", -1).limit(1000).to_list(1000)
    seen, out = set(), []
    for d in docs:
        dv = d.get("delivery") or {}
        addr = (dv.get("address") or "").strip()
        key = addr.lower()
        if not addr or key in seen:
            continue
        seen.add(key)
        out.append({"address": addr, "name": (dv.get("name") or "").strip()})
        if len(out) >= 300:
            break
    # Συντεταγμένες από το geocode cache του live χάρτη (ίδιο κλειδί: normalized lower)
    # ώστε το autocomplete να φιλτράρει τις γνωστές διευθύνσεις με τη ζώνη διανομής
    cache_keys = [" ".join(e["address"].lower().split()) for e in out]
    if cache_keys:
        cached = await db.geocode_cache.find(
            {"user_id": user["id"], "address": {"$in": cache_keys}, "lat": {"$ne": None}},
            {"_id": 0, "address": 1, "lat": 1, "lng": 1},
        ).to_list(len(cache_keys))
        coords = {c["address"]: (c["lat"], c["lng"]) for c in cached}
        for e in out:
            k = " ".join(e["address"].lower().split())
            if k in coords:
                e["lat"], e["lng"] = coords[k]
    return out


@router.get("/orders/heatmap")
async def orders_heatmap(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(require_feature("analytics", require_owner)),
):
    """Heatmap διευθύνσεων παράδοσης για τα Στατιστικά: σημεία (lat/lng) με βάρος
    το πλήθος παραγγελιών ανά διεύθυνση. Μόνο ήδη γεωκωδικοποιημένες διευθύνσεις
    (από το geocode cache του live χάρτη) — δεν γίνεται νέο geocoding εδώ."""
    cutoff = business_day_cutoff(user)
    today = business_today(cutoff)
    df = date_from or today
    dt = date_to or today
    utc_from, utc_to = business_day_range(df, cutoff, dt)
    docs = await db.orders.find(
        {
            "user_id": user["id"],
            "created_at": {"$gte": utc_from, "$lt": utc_to},
            "cancelled": {"$ne": True},
            "status": {"$ne": "scheduled"},
            "delivery.delivery_type": "delivery",
            "delivery.address": {"$nin": [None, ""]},
        },
        {"_id": 0, "delivery.address": 1},
    ).to_list(50000)

    counts: dict = {}
    for d in docs:
        addr = ((d.get("delivery") or {}).get("address") or "").strip()
        if not addr:
            continue
        key = " ".join(addr.lower().split())  # ίδιο κλειδί με το geocode cache
        counts[key] = counts.get(key, 0) + 1

    points = []
    keys = list(counts.keys())
    for i in range(0, len(keys), 500):
        batch = keys[i:i + 500]
        cached = await db.geocode_cache.find(
            {"user_id": user["id"], "address": {"$in": batch}, "lat": {"$ne": None}},
            {"_id": 0, "address": 1, "lat": 1, "lng": 1},
        ).to_list(len(batch))
        for c in cached:
            points.append({"lat": c["lat"], "lng": c["lng"], "count": counts[c["address"]]})

    return {
        "date_from": df,
        "date_to": dt,
        "total_delivery_orders": len(docs),
        "located": sum(p["count"] for p in points),
        "points": points,
    }


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
    # fired orders need the owner profile or a valid owner PIN + per-profile δικαίωμα
    if order.get("status") != "scheduled":
        if not profile_can(user, "cancel_orders"):
            raise HTTPException(403, "Το προφίλ σας δεν έχει δικαίωμα ακύρωσης παραγγελιών")
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
    if not profile_can(user, "cancel_orders"):
        raise HTTPException(403, "Το προφίλ σας δεν έχει δικαίωμα διαγραφής παραγγελιών")
    await require_owner_or_pin(user, pin)
    r = await db.orders.delete_one({"id": oid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ============ ΕΠΕΞΕΡΓΑΣΙΑ ΠΑΡΑΓΓΕΛΙΑΣ ============
class OrderEditIn(BaseModel):
    items: List[OrderItem]
    subtotal: float
    total: float
    note: Optional[str] = Field(default=None, max_length=300)
    delivery_fee: Optional[float] = Field(default=None, ge=0)
    delivery: Optional[DeliveryInfo] = None
    discount: Optional[DiscountInfo] = None
    pin: Optional[str] = None  # PIN ιδιοκτήτη/υπευθύνου όταν αποθηκεύει υπάλληλος


def _eur(v) -> str:
    return f"{float(v or 0):.2f}".replace(".", ",") + " €"


def _item_key(it: dict) -> str:
    """Ταυτότητα γραμμής για το diff: είδος + τιμή + customization (όχι ποσότητα)."""
    return json.dumps(
        [
            it.get("item_id"),
            it.get("name"),
            round(float(it.get("unit_price") or 0), 2),
            it.get("customization") or None,
        ],
        sort_keys=True,
        ensure_ascii=False,
    )


def _diff_items(old_items: list, new_items: list):
    """(added, removed): γραμμές με τη ΔΙΑΦΟΡΑ ποσότητας ανά είδος+customization —
    π.χ. 1x → 3x δίνει added «2x» ώστε η κουζίνα να φτιάξει μόνο τα νέα."""
    old_c, new_c, rep = Counter(), Counter(), {}
    for it in old_items or []:
        k = _item_key(it)
        old_c[k] += int(it.get("quantity") or 1)
        rep.setdefault(k, it)
    for it in new_items or []:
        k = _item_key(it)
        new_c[k] += int(it.get("quantity") or 1)
        rep[k] = it
    added, removed = [], []
    for k in set(old_c) | set(new_c):
        d = new_c[k] - old_c[k]
        if d == 0:
            continue
        it = dict(rep[k])
        it["quantity"] = abs(d)
        it["line_total"] = round(float(it.get("unit_price") or 0) * abs(d), 2)
        (added if d > 0 else removed).append(it)
    return added, removed


async def _sync_fleet_order(user: dict, old_d: dict, new_d: dict, old_note: str, new_note: str) -> bool:
    """Αν η παραγγελία έχει ανέβει στο FleetDeck (ταύτιση με την παλιά διεύθυνση
    σε ανοιχτό fleet_order του καταστήματος), περνά τις αλλαγές διεύθυνσης/
    ορόφου/σημείωσης/τηλεφώνου και στέλνει στον οδηγό το «Η #Χ ενημερώθηκε».
    Αλλαγές ειδών ΔΕΝ ειδοποιούν — οι οδηγοί δεν βλέπουν είδη."""
    changed = {}
    if (new_d.get("address") or "").strip() != (old_d.get("address") or "").strip():
        changed["address"] = (new_d.get("address") or "").strip()
    if (new_d.get("floor") or "").strip() != (old_d.get("floor") or "").strip():
        changed["floor"] = (new_d.get("floor") or "").strip()
    if (new_d.get("phone") or "").strip() != (old_d.get("phone") or "").strip():
        changed["phone"] = (new_d.get("phone") or "").strip()
    if new_note != old_note:
        changed["notes"] = new_note
    old_addr = (old_d.get("address") or "").strip()
    if not changed or not old_addr:
        return False
    fo = await db.fleet_orders.find_one(
        {
            "store_user_id": user["id"],
            "address": old_addr,
            "status": {"$nin": ["delivered", "cancelled"]},
        },
        sort=[("created_at", -1)],
    )
    if not fo:
        return False
    from push import notify_push
    from routers.fleet import DRIVER_URL, EDIT_FIELD_LABELS, add_event

    update = dict(changed)
    if "address" in changed:
        # Νέα διεύθυνση → το παλιό pin δεν ισχύει (χωρίς νέο geocode εδώ)
        update["lat"] = None
        update["lng"] = None
    # Τηλέφωνο/όροφος ενημερώνονται σιωπηλά — ειδοποίηση μόνο για διεύθυνση/σημείωση
    notify_fields = [f for f in ("address", "notes") if f in changed]
    if fo.get("driver_id") and notify_fields:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        update["updated_fields"] = notify_fields
    await db.fleet_orders.update_one({"id": fo["id"]}, {"$set": update})
    if notify_fields and fo.get("number") is not None:
        labels = ", ".join(EDIT_FIELD_LABELS[f] for f in notify_fields)
        await add_event(fo["team_id"], f"Η #{fo['number']} ενημερώθηκε ({labels})")
        if fo.get("driver_id"):
            await notify_push(
                fo["team_id"], "driver",
                f"Η #{fo['number']} ενημερώθηκε",
                f"Άλλαξε: {labels}",
                DRIVER_URL,
                member_ids=[fo["driver_id"]],
            )
    return True


@router.put("/orders/{oid}")
async def edit_order(oid: str, body: OrderEditIn, user: dict = Depends(require_staff)):
    """Επεξεργασία takeaway/delivery παραγγελίας μετά τη δημιουργία: είδη,
    ποσότητες, σημείωση, στοιχεία παράδοσης. Κρατά αριθμό & ώρα δημιουργίας,
    γράφει change log. Ίδιο gate με την ακύρωση (per-profile + PIN)."""
    order = await db.orders.find_one({"id": oid, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Not found")
    if order.get("cancelled"):
        raise HTTPException(400, "Η παραγγελία είναι ακυρωμένη")
    if order.get("source") == "Τραπέζι" or order.get("table_name"):
        raise HTTPException(400, "Οι παραγγελίες τραπεζιών δεν επεξεργάζονται από εδώ")
    if not body.items:
        raise HTTPException(400, "Η παραγγελία δεν μπορεί να μείνει χωρίς είδη")
    if not profile_can(user, "cancel_orders"):
        raise HTTPException(403, "Το προφίλ σας δεν έχει δικαίωμα επεξεργασίας παραγγελιών")
    await require_owner_or_pin(user, body.pin)

    now = datetime.now(timezone.utc)
    new_items = [it.model_dump() for it in body.items]
    added, removed = _diff_items(order.get("items") or [], new_items)

    changes = [f"+{it['quantity']}x {it['name']}" for it in added]
    changes += [f"-{it['quantity']}x {it['name']}" for it in removed]

    old_note = (order.get("note") or "").strip()
    new_note = (body.note or "").strip()
    if new_note != old_note:
        changes.append("Σημείωση")

    old_d = order.get("delivery") or {}
    new_d = body.delivery.model_dump() if body.delivery else {}
    if (new_d.get("delivery_type") or None) != (old_d.get("delivery_type") or None):
        changes.append("Τύπος παραλαβής")
    for f, lbl in (
        ("address", "Διεύθυνση"), ("phone", "Τηλέφωνο"),
        ("name", "Όνομα πελάτη"), ("floor", "Όροφος"),
    ):
        if (new_d.get(f) or "").strip() != (old_d.get(f) or "").strip():
            changes.append(lbl)

    old_disc = round(float((order.get("discount") or {}).get("amount") or 0), 2)
    new_discount = body.discount.model_dump() if body.discount else None
    new_disc = round(float((new_discount or {}).get("amount") or 0), 2)
    if new_disc != old_disc:
        changes.append("Έκπτωση")
    if new_discount:
        if new_disc == old_disc and order.get("discount"):
            for k in ("applied_by", "applied_by_role", "applied_at"):
                new_discount[k] = order["discount"].get(k)
        else:
            new_discount["applied_by"] = actor_name(user)
            new_discount["applied_by_role"] = user.get("role")
            new_discount["applied_at"] = now.isoformat()

    if round(float(body.total), 2) != round(float(order.get("total") or 0), 2):
        changes.append(f"Σύνολο {_eur(order.get('total'))} → {_eur(body.total)}")

    if not changes:
        if isinstance(order.get("created_at"), str):
            order["created_at"] = datetime.fromisoformat(order["created_at"])
        return {"order": order, "added_items": [], "changed": [], "fleet_synced": False}

    entry = {
        "at": now.isoformat(),
        "by": actor_name(user),
        "by_role": user.get("role"),
        "changes": changes,
    }
    await db.orders.update_one(
        {"id": oid, "user_id": user["id"]},
        {
            "$set": {
                "items": new_items,
                "subtotal": body.subtotal,
                "total": body.total,
                "note": new_note or None,
                "delivery_fee": body.delivery_fee,
                "delivery": new_d or None,
                "discount": new_discount,
                "modified_at": now.isoformat(),
            },
            "$push": {"edits": entry},
        },
    )

    fleet_synced = False
    if old_d.get("delivery_type") == "delivery" and new_d.get("delivery_type") == "delivery":
        try:
            fleet_synced = await _sync_fleet_order(user, old_d, new_d, old_note, new_note)
        except Exception as e:
            logger.warning("fleet sync failed for order %s: %s", oid, e)
        if "Διεύθυνση" in changes and order.get("status") == "active":
            _warm_geocode(user, new_d)  # νέο pin στον live χάρτη

    doc = await db.orders.find_one({"id": oid, "user_id": user["id"]}, {"_id": 0})
    if isinstance(doc.get("created_at"), str):
        doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return {"order": doc, "added_items": added, "changed": changes, "fleet_synced": fleet_synced}


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
