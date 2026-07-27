"""FleetDeck για ΚΑΤΑΣΤΗΜΑΤΑ (store πλάνο «fleet»): συνεργασίες με εταιρείες
διανομής + ανέβασμα παραγγελιών στους οδηγούς τους.

Auth: το ΕΝΙΑΙΟ store JWT (users + προφίλ Ιδιοκτήτης/Υπάλληλος) — όχι fleet token.
Οι παραγγελίες γράφονται στο fleet_orders της επιλεγμένης εταιρείας (team_id) με
store_user_id για το scoping του καταστήματος. Οι συνεργασίες ζουν στο
fleet_partnerships (pending/active/declined/ended).
"""
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import athens_today, db, get_current_user, local_day_range
from push import notify_push
from routers.fleet import (
    DISPATCH_URL,
    add_event,
    next_order_number,
    order_push_body,
    public_order,
    publish_due_scheduled,
    push_on_shift_drivers,
)

router = APIRouter()

# Επιτρεπτές καθυστερήσεις δημοσίευσης (λεπτά) — pills «Άμεσα / 5' / 10' / 20' / 25'»
PUBLISH_DELAYS = (0, 5, 10, 20, 25)


# ============ AUTH ============
async def get_fleet_store(user: dict = Depends(get_current_user)) -> dict:
    """Κατάστημα με πρόσβαση στο FleetDeck καταστήματος: πλάνο «fleet» ή ενεργό
    add-on fleet. Απαιτεί επιλεγμένο προφίλ (Ιδιοκτήτης/Υπάλληλος)."""
    if user.get("account_type") == "fleet_company":
        raise HTTPException(403, "Οι εταιρείες διανομής χρησιμοποιούν τον πίνακα FleetDeck")
    addons = user.get("addons") or {}
    if (user.get("plan") or "orderdeck") != "fleet" and not addons.get("fleet"):
        raise HTTPException(403, "Ο λογαριασμός σας δεν περιλαμβάνει το FleetDeck")
    if not user.get("role"):
        raise HTTPException(403, "Απαιτείται επιλογή προφίλ")
    return user


async def require_fleet_store_owner(user: dict = Depends(get_fleet_store)) -> dict:
    """Συνεργασίες & στατιστικά — μόνο Ιδιοκτήτης (όπως τα Στατιστικά του POS)."""
    if user.get("role") != "owner":
        raise HTTPException(403, "Απαιτείται πρόσβαση ιδιοκτήτη")
    return user


def store_name(user: dict) -> str:
    return (user.get("restaurant_name") or "").strip() or "Κατάστημα"


def public_partnership(p: dict) -> dict:
    return {k: v for k, v in p.items() if k != "_id"}


async def active_partnership(user_id: str, team_id: str) -> Optional[dict]:
    return await db.fleet_partnerships.find_one(
        {"store_user_id": user_id, "team_id": team_id, "status": "active"}, {"_id": 0}
    )


# ============ MODELS ============
class StoreOrderIn(BaseModel):
    team_id: str
    address: str = Field(min_length=1, max_length=160)
    phone: str = Field(default="", max_length=20)
    notes: str = Field(default="", max_length=300)
    urgent: bool = False
    # 0 = Άμεσα · αλλιώς προγραμματισμένη δημοσίευση σε 5'/10'/20'/25'
    delay_minutes: int = 0
    lat: Optional[float] = None
    lng: Optional[float] = None


# ============ ΣΥΝΕΡΓΑΣΙΕΣ ============
@router.get("/store/fleet/companies")
async def store_fleet_companies(user: dict = Depends(require_fleet_store_owner)):
    """Εταιρείες διανομής που καλύπτουν την πόλη του καταστήματος + η κατάσταση
    αιτήματος/συνεργασίας με την καθεμία. Χωρίς πόλη στο κατάστημα → όλες."""
    city = (user.get("store_city") or "").strip()
    q = {"disabled": {"$ne": True}}
    if city:
        q["city"] = {"$regex": f"^{re.escape(city)}$", "$options": "i"}
    teams = await db.fleet_teams.find(
        q, {"_id": 0, "id": 1, "name": 1, "city": 1}
    ).sort("name", 1).to_list(200)
    parts = await db.fleet_partnerships.find(
        {"store_user_id": user["id"]}, {"_id": 0}
    ).sort("requested_at", -1).to_list(200)
    # Τρέχουσα κατάσταση ανά εταιρεία: η πιο πρόσφατη μη-τερματισμένη εγγραφή
    status_by_team = {}
    for p in parts:
        if p["team_id"] not in status_by_team and p["status"] != "ended":
            status_by_team[p["team_id"]] = p["status"]
    return {
        "store_city": city,
        "companies": [
            {**t, "partnership_status": status_by_team.get(t["id"])} for t in teams
        ],
        "active": [public_partnership(p) for p in parts if p["status"] == "active"],
    }


@router.post("/store/fleet/partners/{team_id}/request")
async def store_fleet_request_partner(
    team_id: str, user: dict = Depends(require_fleet_store_owner)
):
    """Αίτημα συνεργασίας προς εταιρεία — ειδοποιείται η διαχείρισή της (push +
    ζωντανή ροή)· εγκρίνεται/απορρίπτεται από τον dispatcher της."""
    team = await db.fleet_teams.find_one(
        {"id": team_id, "disabled": {"$ne": True}}, {"_id": 0, "id": 1, "name": 1, "city": 1}
    )
    if not team:
        raise HTTPException(404, "Η εταιρεία δεν βρέθηκε")
    existing = await db.fleet_partnerships.find_one({
        "store_user_id": user["id"],
        "team_id": team_id,
        "status": {"$in": ["pending", "active"]},
    })
    if existing:
        raise HTTPException(
            400,
            "Υπάρχει ήδη ενεργή συνεργασία με αυτή την εταιρεία"
            if existing["status"] == "active"
            else "Υπάρχει ήδη αίτημα σε εκκρεμότητα προς αυτή την εταιρεία",
        )
    doc = {
        "id": str(uuid.uuid4()),
        "store_user_id": user["id"],
        "store_name": store_name(user),
        "store_city": (user.get("store_city") or "").strip(),
        "team_id": team["id"],
        "team_name": team["name"],
        "team_city": team.get("city") or "",
        "status": "pending",
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "responded_at": None,
        "ended_at": None,
    }
    await db.fleet_partnerships.insert_one(doc)
    await add_event(team["id"], f"🤝 Νέο αίτημα συνεργασίας από «{doc['store_name']}»")
    await notify_push(
        team["id"], "dispatcher",
        "🤝 Νέο αίτημα συνεργασίας",
        f"{doc['store_name']} — αποδοχή ή απόρριψη στον πίνακα",
        DISPATCH_URL,
    )
    return public_partnership(doc)


@router.post("/store/fleet/partnerships/{pid}/end")
async def store_fleet_end_partnership(
    pid: str, user: dict = Depends(require_fleet_store_owner)
):
    """Τερματισμός ενεργής συνεργασίας από το κατάστημα."""
    p = await db.fleet_partnerships.find_one(
        {"id": pid, "store_user_id": user["id"], "status": "active"}, {"_id": 0}
    )
    if not p:
        raise HTTPException(404, "Η συνεργασία δεν βρέθηκε")
    await db.fleet_partnerships.update_one(
        {"id": pid, "store_user_id": user["id"]},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}},
    )
    await add_event(p["team_id"], f"Η συνεργασία με «{p['store_name']}» τερματίστηκε")
    return {"ok": True}


# ============ ΠΙΝΑΚΑΣ & ΠΑΡΑΓΓΕΛΙΕΣ ============
@router.get("/store/fleet/board")
async def store_fleet_board(
    team_id: Optional[str] = None, user: dict = Depends(get_fleet_store)
):
    """Ο πίνακας του καταστήματος (ένα poll): ενεργές συνεργασίες, on-shift οδηγοί
    της επιλεγμένης εταιρείας, οι σημερινές παραγγελίες του καταστήματος (μαζί με
    τις προγραμματισμένες). Δημοσιεύει όσες προγραμματισμένες έφτασε η ώρα τους."""
    await publish_due_scheduled({"store_user_id": user["id"]})
    partnerships = await db.fleet_partnerships.find(
        {"store_user_id": user["id"], "status": "active"}, {"_id": 0}
    ).sort("requested_at", 1).to_list(50)
    drivers = []
    if team_id and any(p["team_id"] == team_id for p in partnerships):
        drivers = await db.fleet_members.find(
            {"team_id": team_id, "role": "driver", "on_shift": True},
            {"_id": 0, "id": 1, "name": 1},
        ).sort("created_at", 1).to_list(200)
    start, end = local_day_range(athens_today())
    orders = await db.fleet_orders.find(
        {
            "store_user_id": user["id"],
            "$or": [{"created_at": {"$gte": start, "$lt": end}}, {"status": "scheduled"}],
        },
        {"_id": 0, "team_id": 0},
    ).sort("created_at", -1).to_list(500)
    return {
        "store_name": store_name(user),
        "partnerships": [public_partnership(p) for p in partnerships],
        "drivers": drivers,
        "orders": orders,
    }


@router.post("/store/fleet/orders")
async def store_fleet_create_order(body: StoreOrderIn, user: dict = Depends(get_fleet_store)):
    """Ανέβασμα παραγγελίας στην επιλεγμένη εταιρεία: παραλαβή = το όνομα του
    καταστήματος. «Άμεσα» δημοσιεύει τώρα στους on-shift οδηγούς («Ελεύθερες» +
    push)· με καθυστέρηση μένει «Προγραμματισμένη» και δημοσιεύεται στην ώρα της
    (lazy στο polling — επιβιώνει από refresh/κλείσιμο)."""
    if body.delay_minutes not in PUBLISH_DELAYS:
        raise HTTPException(400, "Μη έγκυρος χρόνος δημοσίευσης")
    p = await active_partnership(user["id"], body.team_id)
    if not p:
        raise HTTPException(403, "Δεν υπάρχει ενεργή συνεργασία με αυτή την εταιρεία")
    now_dt = datetime.now(timezone.utc)
    scheduled = body.delay_minutes > 0
    doc = {
        "id": str(uuid.uuid4()),
        "team_id": p["team_id"],
        "team_name": p["team_name"],
        "store_user_id": user["id"],
        "number": None,
        "pickup_name": store_name(user),
        "address": body.address.strip(),
        "phone": body.phone.strip(),
        "notes": body.notes.strip(),
        "urgent": bool(body.urgent),
        "problem": None,
        "status": "scheduled" if scheduled else "waiting",
        "publish_at": (
            (now_dt + timedelta(minutes=body.delay_minutes)).isoformat() if scheduled else None
        ),
        "driver_id": None,
        "driver_name": None,
        "created_by": store_name(user),
        "lat": body.lat,
        "lng": body.lng,
        "created_at": now_dt.isoformat(),
        "claimed_at": None,
        "delivered_at": None,
    }
    if not scheduled:
        doc["number"] = await next_order_number(p["team_id"])
    await db.fleet_orders.insert_one(doc)
    if not scheduled:
        prefix = "⚡ Επείγουσα παραγγελία" if doc["urgent"] else "Νέα παραγγελία"
        await add_event(p["team_id"], f"{prefix} #{doc['number']} · {doc['pickup_name']}")
        await push_on_shift_drivers(
            p["team_id"], f"{prefix} #{doc['number']}", order_push_body(doc)
        )
    return public_order(doc)


@router.post("/store/fleet/orders/{oid}/cancel")
async def store_fleet_cancel_order(oid: str, user: dict = Depends(get_fleet_store)):
    """Ακύρωση από το κατάστημα. Προγραμματισμένη → διαγραφή πριν δημοσιευτεί·
    πριν το claim σιωπηλή αφαίρεση (φεύγει από τις «Ελεύθερες»)· μετά το claim
    ειδοποίηση οδηγού + διαχείρισης (ίδιοι κανόνες με την ακύρωση εταιρείας)."""
    o = await db.fleet_orders.find_one({"id": oid, "store_user_id": user["id"]})
    if not o:
        raise HTTPException(404, "Η παραγγελία δεν βρέθηκε")
    if o["status"] in ("delivered", "cancelled"):
        raise HTTPException(400, "Η παραγγελία έχει ολοκληρωθεί")
    if o["status"] == "scheduled":
        await db.fleet_orders.delete_one({"id": oid, "store_user_id": user["id"]})
        return {"ok": True}
    await db.fleet_orders.update_one(
        {"id": oid, "store_user_id": user["id"]}, {"$set": {"status": "cancelled"}}
    )
    await add_event(o["team_id"], f"Η #{o['number']} ακυρώθηκε από «{o['pickup_name']}»")
    if o.get("driver_id"):
        await notify_push(
            o["team_id"], "driver",
            f"Η #{o['number']} ακυρώθηκε",
            order_push_body(o),
            "/fleet/driver",
            member_ids=[o["driver_id"]],
        )
        await notify_push(
            o["team_id"], "dispatcher",
            f"Η #{o['number']} ακυρώθηκε",
            f"Από το κατάστημα «{o['pickup_name']}»",
            DISPATCH_URL,
        )
    return {"ok": True}


@router.get("/store/fleet/address-book")
async def store_fleet_address_book(user: dict = Depends(get_fleet_store)):
    """Πρόσφατες διευθύνσεις του καταστήματος για το AddressAutocomplete."""
    docs = await db.fleet_orders.find(
        {"store_user_id": user["id"]}, {"_id": 0, "address": 1, "lat": 1, "lng": 1}
    ).sort("created_at", -1).to_list(400)
    seen, out = set(), []
    for d in docs:
        a = (d.get("address") or "").strip()
        if a and a.lower() not in seen:
            seen.add(a.lower())
            out.append({"address": a, "name": None, "lat": d.get("lat"), "lng": d.get("lng")})
        if len(out) >= 200:
            break
    return out


# ============ ΣΤΑΤΙΣΤΙΚΑ ============
@router.get("/store/fleet/stats")
async def store_fleet_stats(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(require_fleet_store_owner),
):
    """Πλήθη ανεβασμένων παραγγελιών ανά εταιρεία και κατάσταση για την περίοδο —
    τίποτα οικονομικό (τα χρήματα είναι υπόθεση καταστήματος-εταιρείας)."""
    q = {"store_user_id": user["id"]}
    if date_from and date_to:
        start, end = local_day_range(date_from, date_to)
        q["created_at"] = {"$gte": start, "$lt": end}
    elif date_from:
        q["created_at"] = {"$gte": local_day_range(date_from)[0]}
    elif date_to:
        q["created_at"] = {"$lt": local_day_range(date_to)[1]}
    rows = await db.fleet_orders.aggregate([
        {"$match": q},
        {"$group": {
            "_id": {"team_id": "$team_id", "team_name": "$team_name", "status": "$status"},
            "count": {"$sum": 1},
        }},
    ]).to_list(500)
    companies = {}
    total = 0
    by_status_total = {}
    for r in rows:
        key = r["_id"].get("team_id")
        c = companies.setdefault(
            key,
            {"team_id": key, "team_name": r["_id"].get("team_name") or "—",
             "total": 0, "by_status": {}},
        )
        st = r["_id"].get("status") or "waiting"
        c["by_status"][st] = c["by_status"].get(st, 0) + r["count"]
        c["total"] += r["count"]
        by_status_total[st] = by_status_total.get(st, 0) + r["count"]
        total += r["count"]
    out = sorted(companies.values(), key=lambda c: -c["total"])
    return {"total": total, "by_status": by_status_total, "companies": out}
