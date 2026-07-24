"""Admin panel — Εταιρίες Delivery (OrderDeck Fleet) + demo λογαριασμοί.

Ίδιο admin password gate (X-Admin-Password) με το υπόλοιπο admin panel.
Οι εταιρείες διανομής είναι unified λογαριασμοί (users.account_type=fleet_company)
με fleet_team συνδεδεμένο μέσω owner_user_id. Οι demo λογαριασμοί (μαγαζί ή εταιρία)
δημιουργούνται από τον admin, σημαδεύονται is_demo (ΧΩΡΙΣ demo_expires_at — δεν τους
σβήνει το cron των demo επισκεπτών) και συνδέονται από το κανονικό unified login.
"""
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from pydantic import BaseModel, Field

from routers.admin_admins import (
    audit_subadmin,
    check_city,
    get_admin_ctx,
    require_manage,
    require_product,
    scope_city_match,
)
from core import (
    PER_USER_COLLECTIONS,
    athens_today,
    db,
    hash_password,
    purge_user_data,
    seed_account_from_preset,
)
from presets import PRESETS
from routers.admin import fill_city, shop_status
from routers.fleet import ensure_fleet_team_for_user
from routers.promo import require_admin

router = APIRouter()

# Whitelist πεδίων εταιρείας που επιστρέφονται στο admin panel (ποτέ hashes)
FLEET_FIELDS = {
    "_id": 0, "id": 1, "email": 1, "restaurant_name": 1, "full_name": 1,
    "phone": 1, "city": 1, "store_city": 1, "created_at": 1,
    "is_demo": 1, "disabled": 1, "admin_notes": 1,
    "plan": 1, "subscription_expires_at": 1, "payment_status": 1,
    "billing_request": 1,
}


# ============ ΕΤΑΙΡΙΕΣ DELIVERY ============
@router.get("/admin/fleet")
async def admin_list_fleet(
    ctx: dict = Depends(get_admin_ctx),
    search: str = "",
    status: Literal["all", "active", "disabled", "demo"] = "all",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    require_product(ctx, "fleet")
    match: dict = {"account_type": "fleet_company"}
    if status == "demo":
        match["is_demo"] = True
    elif status == "disabled":
        match["is_demo"] = {"$ne": True}
        match["disabled"] = True
    elif status == "active":
        match["is_demo"] = {"$ne": True}
        match["disabled"] = {"$ne": True}
    if search.strip():
        q = search.strip()
        match["$or"] = [
            {"restaurant_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    # Scope sub-admin: μόνο εταιρίες στις πόλεις ευθύνης του
    city_scope = scope_city_match(ctx)
    if city_scope:
        match = {"$and": [match, city_scope]}
    total = await db.users.count_documents(match)
    companies = await db.users.find(match, FLEET_FIELDS).sort("created_at", -1) \
        .skip((page - 1) * limit).to_list(limit)

    # Μετρητές ανά ομάδα (3 queries συνολικά — όχι N+1)
    uids = [c["id"] for c in companies]
    team_by_uid: dict = {}
    if uids:
        async for t in db.fleet_teams.find(
            {"owner_user_id": {"$in": uids}}, {"_id": 0, "id": 1, "owner_user_id": 1}
        ):
            team_by_uid[t["owner_user_id"]] = t["id"]
    tids = list(team_by_uid.values())
    drivers_by_team: dict = {}
    orders_by_team: dict = {}
    if tids:
        async for r in db.fleet_members.aggregate([
            {"$match": {"team_id": {"$in": tids}, "role": "driver"}},
            {"$group": {"_id": "$team_id", "n": {"$sum": 1}}},
        ]):
            drivers_by_team[r["_id"]] = r["n"]
        d30_iso = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        async for r in db.fleet_orders.aggregate([
            {"$match": {"team_id": {"$in": tids}, "created_at": {"$gte": d30_iso}}},
            {"$group": {"_id": "$team_id", "n": {"$sum": 1}}},
        ]):
            orders_by_team[r["_id"]] = r["n"]

    for c in companies:
        tid = team_by_uid.get(c["id"])
        c["drivers_count"] = drivers_by_team.get(tid, 0)
        c["orders_30d"] = orders_by_team.get(tid, 0)
        c["status"] = shop_status(c)
        fill_city(c)
    return {"total": total, "page": page, "limit": limit, "companies": companies}


@router.get("/admin/fleet/{uid}")
async def admin_fleet_detail(uid: str, ctx: dict = Depends(get_admin_ctx)):
    require_product(ctx, "fleet")
    u = await db.users.find_one({"id": uid, "account_type": "fleet_company"}, FLEET_FIELDS)
    if not u:
        raise HTTPException(404, "Η εταιρεία δεν βρέθηκε")
    check_city(ctx, u)
    u["status"] = shop_status(u)
    fill_city(u)
    team = await db.fleet_teams.find_one(
        {"owner_user_id": uid}, {"_id": 0, "id": 1, "name": 1, "invite_code": 1}
    )
    u["team"] = team
    u["members"] = []
    u["orders_total"] = 0
    u["orders_30d"] = 0
    u["last_activity"] = None
    if team:
        u["members"] = await db.fleet_members.find(
            {"team_id": team["id"]},
            {"_id": 0, "id": 1, "name": 1, "role": 1, "identifier": 1, "created_at": 1},
        ).sort("created_at", 1).to_list(200)
        d30_iso = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        async for r in db.fleet_orders.aggregate([
            {"$match": {"team_id": team["id"]}},
            {"$group": {
                "_id": None,
                "n": {"$sum": 1},
                "last": {"$max": "$created_at"},
                "n30": {"$sum": {"$cond": [{"$gte": ["$created_at", d30_iso]}, 1, 0]}},
            }},
        ]):
            u["orders_total"] = r["n"]
            u["orders_30d"] = r["n30"]
            u["last_activity"] = r["last"]
    u["drivers_count"] = sum(1 for m in u["members"] if m["role"] == "driver")
    # Στοιχεία σύνδεσης demo — ΜΟΝΟ demo λογαριασμοί και ΜΟΝΟ master/manage
    # (τα view-only sub-admins δεν βλέπουν ποτέ κωδικούς)
    if u.get("is_demo") and (ctx["is_master"] or ctx["rights"] == "manage"):
        creds = await db.users.find_one(
            {"id": uid, "is_demo": True}, {"_id": 0, "demo_credentials": 1}
        )
        u["demo_credentials"] = (creds or {}).get("demo_credentials")
    return u


class FleetUpdateIn(BaseModel):
    disabled: Optional[bool] = None
    admin_notes: Optional[str] = Field(default=None, max_length=5000)
    plan: Optional[Literal["fleet15", "fleet30"]] = None
    subscription_expires_at: Optional[str] = None  # ISO date, "" = καθαρισμός
    payment_status: Optional[Literal["paid", "pending", "expired"]] = None
    clear_billing_request: Optional[bool] = None


# Sub-admin με rights=manage: ΜΟΝΟ ενεργοποίηση/απενεργοποίηση + σημειώσεις (όχι πλάνα/τιμές)
SUBADMIN_FLEET_FIELDS = {"disabled", "admin_notes"}


@router.patch("/admin/fleet/{uid}")
async def admin_update_fleet(
    uid: str, body: FleetUpdateIn, ctx: dict = Depends(get_admin_ctx)
):
    require_product(ctx, "fleet")
    update = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not update:
        raise HTTPException(400, "Δεν δόθηκαν αλλαγές")
    if not ctx["is_master"]:
        require_manage(ctx)
        if set(update) - SUBADMIN_FLEET_FIELDS:
            raise HTTPException(403, "Δεν έχετε δικαίωμα αλλαγής πλάνων/συνδρομών")
        target = await db.users.find_one(
            {"id": uid, "account_type": "fleet_company"},
            {"_id": 0, "restaurant_name": 1, "store_city": 1, "city": 1},
        )
        if not target:
            raise HTTPException(404, "Η εταιρεία δεν βρέθηκε")
        check_city(ctx, target)
        await audit_subadmin(
            ctx, "update_fleet", uid, target.get("restaurant_name") or "",
            ", ".join(f"{k}={v!r}" for k, v in update.items()),
        )
    if update.get("subscription_expires_at") == "":
        update["subscription_expires_at"] = None
    if update.pop("clear_billing_request", None):
        update["billing_request"] = None
    if not update:
        raise HTTPException(400, "Δεν δόθηκαν αλλαγές")
    res = await db.users.update_one(
        {"id": uid, "account_type": "fleet_company"}, {"$set": update}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Η εταιρεία δεν βρέθηκε")
    # Το disabled κόβει και τα fleet tokens/είσοδο οδηγών — συγχρονισμός στην ομάδα
    if "disabled" in update:
        await db.fleet_teams.update_one(
            {"owner_user_id": uid}, {"$set": {"disabled": update["disabled"]}}
        )
    return {"ok": True, **update}


async def purge_fleet_team(team_id: str) -> None:
    """Σβήνει μέλη/παραγγελίες/γεγονότα/μετρητές μιας ομάδας (όχι το team doc).
    Λογαριασμοί οδηγών σβήνονται μόνο αν δεν ανήκουν και σε άλλη εταιρεία."""
    members = await db.fleet_members.find({"team_id": team_id}).to_list(500)
    for m in members:
        aid = m.get("account_id")
        if not aid:
            continue
        elsewhere = await db.fleet_members.count_documents(
            {"account_id": aid, "team_id": {"$ne": team_id}}
        )
        if elsewhere == 0:
            await db.fleet_accounts.delete_one({"id": aid})
    await db.fleet_members.delete_many({"team_id": team_id})
    for coll in ("fleet_orders", "fleet_events", "fleet_counters"):
        await db[coll].delete_many({"team_id": team_id})


async def purge_fleet_company(uid: str) -> None:
    team = await db.fleet_teams.find_one({"owner_user_id": uid}, {"id": 1})
    if team:
        await purge_fleet_team(team["id"])
        await db.fleet_teams.delete_one({"id": team["id"]})
    await purge_user_data(uid)


@router.delete("/admin/fleet/{uid}")
async def admin_delete_fleet(
    uid: str, confirm: str = "", x_admin_password: Optional[str] = Header(None)
):
    require_admin(x_admin_password)
    u = await db.users.find_one(
        {"id": uid, "account_type": "fleet_company"}, {"_id": 0, "restaurant_name": 1}
    )
    if not u:
        raise HTTPException(404, "Η εταιρεία δεν βρέθηκε")
    if confirm.strip() != (u.get("restaurant_name") or "").strip():
        raise HTTPException(400, "Η επιβεβαίωση δεν ταιριάζει με το όνομα της εταιρείας")
    await purge_fleet_company(uid)
    return {"ok": True}


# ============ DEMO ΛΟΓΑΡΙΑΣΜΟΙ (admin-created, μόνιμοι μέχρι διαγραφή) ============
# Χωρίς διφορούμενους χαρακτήρες — τα credentials πληκτρολογούνται σε παρουσιάσεις
CRED_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


def _rand(n: int) -> str:
    return "".join(secrets.choice(CRED_ALPHABET) for _ in range(n))


async def set_demo_credentials(uid: str, fields: dict) -> None:
    """Αποθήκευση ανακτήσιμων credentials στο demo_credentials. ΣΚΛΗΡΟΣ ΚΑΝΟΝΑΣ:
    γράφεται ΜΟΝΟ σε demo λογαριασμούς — το φίλτρο is_demo=True το επιβάλλει στη
    βάση, οπότε για κανονικό λογαριασμό το update δεν ταιριάζει ποτέ."""
    await db.users.update_one(
        {"id": uid, "is_demo": True},
        {"$set": {f"demo_credentials.{k}": v for k, v in fields.items()}},
    )


DEMO_DRIVERS = ["Γιώργος Κ.", "Μαρία Π.", "Νίκος Δ."]

# (κατάστημα παραλαβής, διεύθυνση, ποσό, πληρωμή, κατάσταση, index οδηγού|None, πριν από λεπτά)
DEMO_SAMPLE_ORDERS = [
    ("Πεινώκιο", "Ερμού 12", 12.50, "cash", "delivered", 0, 110),
    ("Pizza Roma", "Αγ. Δημητρίου 45", 18.90, "card", "delivered", 1, 95),
    ("Burger Bros", "Παπάφη 3", 9.80, "cash", "delivered", 0, 70),
    ("Πεινώκιο", "Τσιμισκή 88", 15.40, "paid", "cancelled", None, 60),
    ("Cafe Central", "Βενιζέλου 21", 7.20, "cash", "enroute", 1, 25),
    ("Pizza Roma", "Ολύμπου 65", 22.00, "card", "pickup", 2, 15),
    ("Burger Bros", "Καρόλου Ντηλ 9", 11.60, "cash", "waiting", None, 8),
    ("Πεινώκιο", "Μητροπόλεως 33", 14.30, "cash", "waiting", None, 3),
]

STATUS_EVENT = {
    "waiting": "Νέα παραγγελία #{n} · {pickup}",
    "pickup": "Ο/Η {driver} πήρε την #{n}",
    "enroute": "Η #{n} σε διαδρομή ({driver})",
    "delivered": "Η #{n} παραδόθηκε ({driver})",
    "cancelled": "Η #{n} ακυρώθηκε",
}


async def _unique_demo_phone() -> str:
    while True:
        phone = "69" + "".join(secrets.choice("0123456789") for _ in range(8))
        if not await db.fleet_accounts.find_one({"phone": phone}, {"_id": 1}):
            return phone


async def seed_fleet_demo(team_id: str) -> list:
    """Δείγμα οδηγών + παραγγελιών/γεγονότων ώστε πίνακας συντονιστή και οθόνη οδηγού
    να δείχνουν ζωντανά. Επιστρέφει τα credentials των demo οδηγών (ο καλών τα
    αποθηκεύει στο demo_credentials ώστε να φαίνονται και στην καρτέλα του demo)."""
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    driver_creds, driver_members = [], []
    for name in DEMO_DRIVERS:
        phone = await _unique_demo_phone()
        password = _rand(6)
        account = {
            "id": str(uuid.uuid4()),
            "account_type": "driver",
            "phone": phone,
            "name": name,
            "password_hash": hash_password(password),
            "must_change_password": False,
            "is_demo": True,
            "created_at": now_iso,
        }
        await db.fleet_accounts.insert_one(account)
        member = {
            "id": str(uuid.uuid4())[:8],
            "team_id": team_id,
            "name": name,
            "role": "driver",
            "account_id": account["id"],
            "identifier": phone,
            "created_at": now_iso,
        }
        await db.fleet_members.insert_one(member)
        driver_members.append(member)
        driver_creds.append({"name": name, "phone": phone, "password": password})

    for i, (pickup, address, amount, payment, status, didx, mins) in enumerate(DEMO_SAMPLE_ORDERS):
        created = (now - timedelta(minutes=mins)).isoformat()
        driver = driver_members[didx] if didx is not None else None
        order = {
            "id": str(uuid.uuid4()),
            "team_id": team_id,
            "number": i + 1,
            "pickup_name": pickup,
            "address": address,
            "amount": amount,
            "payment": payment,
            "notes": "",
            "status": status,
            "driver_id": driver["id"] if driver else None,
            "driver_name": driver["name"] if driver else None,
            "created_by": "Συντονιστής",
            "created_at": created,
            "claimed_at": created if driver else None,
            "delivered_at": (now - timedelta(minutes=max(mins - 20, 1))).isoformat()
            if status == "delivered" else None,
        }
        await db.fleet_orders.insert_one(order)
        await db.fleet_events.insert_one({
            "id": str(uuid.uuid4()),
            "team_id": team_id,
            "text": STATUS_EVENT[status].format(
                n=order["number"], pickup=pickup, driver=driver["name"] if driver else ""
            ),
            "created_at": created,
        })
    # Ο μετρητής συνεχίζει από τα seeded νούμερα για νέες παραγγελίες της ημέρας
    await db.fleet_counters.update_one(
        {"team_id": team_id, "day": athens_today()},
        {"$set": {"seq": len(DEMO_SAMPLE_ORDERS)}},
        upsert=True,
    )
    return driver_creds


async def _seed_store_profiles(uid: str, now_iso: str) -> None:
    await db.profiles.insert_many([
        {"id": str(uuid.uuid4())[:8], "user_id": uid, "name": "Ιδιοκτήτης", "role": "owner",
         "pin_hash": hash_password("0000"), "created_at": now_iso},
        {"id": str(uuid.uuid4())[:8], "user_id": uid, "name": "Υπάλληλος", "role": "employee",
         "pin_hash": hash_password("0000"), "created_at": now_iso},
        {"id": str(uuid.uuid4())[:8], "user_id": uid, "name": "Σερβιτόρος", "role": "waiter",
         "pin_hash": hash_password("0000"), "created_at": now_iso},
    ])


class DemoCreateIn(BaseModel):
    type: Literal["store", "fleet"]
    name: str = Field(min_length=1, max_length=80)
    city: str = Field(default="", max_length=60)
    business_type: Literal["souvlaki", "cafe", "pizzeria", "burger"] = "souvlaki"


@router.post("/admin/demos")
async def admin_create_demo(body: DemoCreateIn, x_admin_password: Optional[str] = Header(None)):
    """Demo λογαριασμός από τον admin — μαγαζί (με preset μενού) ή εταιρία delivery
    (με δείγμα οδηγών/παραγγελιών). Συνδέεται από το κανονικό login· τα credentials
    μένουν ανακτήσιμα στο demo_credentials (ΜΟΝΟ για is_demo — ποτέ σε κανονικούς)."""
    require_admin(x_admin_password)
    now_iso = datetime.now(timezone.utc).isoformat()
    uid = str(uuid.uuid4())
    email = f"demo-{_rand(6)}@demo.orderdeck"
    password = _rand(8)
    base = {
        "id": uid,
        "email": email,
        "password_hash": hash_password(password),
        "restaurant_name": body.name.strip(),
        "full_name": "",
        "phone": "",
        "city": body.city.strip(),
        "store_city": body.city.strip(),
        "website": "",
        "owner_pin_hash": hash_password("0000"),
        "employee_pin_hash": hash_password("0000"),
        "owner_pin_set": True,
        "employee_pin_set": False,
        "is_demo": True,  # χωρίς demo_expires_at → δεν τον αγγίζει το cron cleanup
        # Ανακτήσιμα credentials — επιτρέπονται ΜΟΝΟ επειδή is_demo=True στο ίδιο doc
        "demo_credentials": {"email": email, "password": password},
        "ai_features_enabled": True,  # κανόνας demo: τα AI features πάντα ενεργά
        "created_at": now_iso,
    }
    if body.type == "store":
        preset = PRESETS.get(body.business_type, PRESETS["souvlaki"])
        doc = {
            **base,
            "business_type": body.business_type,
            "tables_enabled": True,
            "customization": preset["customization"],
        }
        await db.users.insert_one(doc)
        await seed_account_from_preset(uid, preset, has_tables=True)
        await _seed_store_profiles(uid, now_iso)
        return {"id": uid, "type": "store", "email": email, "password": password, "pin": "0000"}

    doc = {
        **base,
        "account_type": "fleet_company",
        "plan": "fleet15",
        "tables_enabled": False,
        "customization": {},
    }
    await db.users.insert_one(doc)
    team = await ensure_fleet_team_for_user(doc, admin_name="Συντονιστής")
    drivers = await seed_fleet_demo(team["id"])
    await set_demo_credentials(uid, {"drivers": drivers})
    return {
        "id": uid, "type": "fleet", "email": email, "password": password,
        "pin": "0000", "drivers": drivers,
    }


@router.post("/admin/demos/{uid}/reset")
async def admin_reset_demo(uid: str, x_admin_password: Optional[str] = Header(None)):
    """Επαναφορά demo στην αρχική seeded κατάσταση — τα στοιχεία σύνδεσης δεν αλλάζουν.
    Σε fleet demo οι οδηγοί ξαναδημιουργούνται (επιστρέφονται νέα credentials)."""
    require_admin(x_admin_password)
    u = await db.users.find_one({"id": uid})
    if not u or not u.get("is_demo"):
        raise HTTPException(404, "Ο demo λογαριασμός δεν βρέθηκε")
    now_iso = datetime.now(timezone.utc).isoformat()
    if u.get("account_type") == "fleet_company":
        team = await db.fleet_teams.find_one({"owner_user_id": uid}, {"id": 1})
        if not team:
            raise HTTPException(404, "Η ομάδα του demo δεν βρέθηκε")
        await purge_fleet_team(team["id"])
        await db.fleet_members.insert_one({
            "id": str(uuid.uuid4())[:8],
            "team_id": team["id"],
            "name": "Συντονιστής",
            "role": "fleet_admin",
            "pin_hash": u.get("owner_pin_hash") or hash_password("0000"),
            "created_at": now_iso,
        })
        drivers = await seed_fleet_demo(team["id"])
        await set_demo_credentials(uid, {"drivers": drivers})
        return {"ok": True, "type": "fleet", "drivers": drivers}

    preset = PRESETS.get(u.get("business_type"), PRESETS["souvlaki"])
    for coll in PER_USER_COLLECTIONS:
        await db[coll].delete_many({"user_id": uid})
    await seed_account_from_preset(uid, preset, has_tables=True)
    await _seed_store_profiles(uid, now_iso)
    return {"ok": True, "type": "store"}


@router.post("/admin/demos/{uid}/reset-password")
async def admin_reset_demo_password(uid: str, ctx: dict = Depends(get_admin_ctx)):
    """Νέος κωδικός demo λογαριασμού: ενημερώνει το hash ΚΑΙ το ορατό demo_credentials.
    Επιτρέπεται σε master και sub-admin με rights=manage (μέσα στο scope του) —
    λειτουργεί ΜΟΝΟ σε is_demo λογαριασμούς."""
    require_manage(ctx)
    u = await db.users.find_one(
        {"id": uid},
        {"_id": 0, "id": 1, "is_demo": 1, "account_type": 1,
         "restaurant_name": 1, "store_city": 1, "city": 1},
    )
    if not u or not u.get("is_demo"):
        raise HTTPException(404, "Ο demo λογαριασμός δεν βρέθηκε")
    require_product(ctx, "fleet" if u.get("account_type") == "fleet_company" else "orderdeck")
    check_city(ctx, u)
    password = _rand(8)
    await db.users.update_one(
        {"id": uid, "is_demo": True},
        {"$set": {"password_hash": hash_password(password)}},
    )
    await set_demo_credentials(uid, {"password": password})
    await audit_subadmin(ctx, "reset_demo_password", uid, u.get("restaurant_name") or "")
    return {"ok": True, "password": password}


@router.delete("/admin/demos/{uid}")
async def admin_delete_demo(uid: str, x_admin_password: Optional[str] = Header(None)):
    """Οριστική διαγραφή demo λογαριασμού (χωρίς επιβεβαίωση ονόματος — είναι demo)."""
    require_admin(x_admin_password)
    u = await db.users.find_one({"id": uid}, {"_id": 0, "id": 1, "is_demo": 1, "account_type": 1})
    if not u or not u.get("is_demo"):
        raise HTTPException(404, "Ο demo λογαριασμός δεν βρέθηκε")
    if u.get("account_type") == "fleet_company":
        await purge_fleet_company(uid)
    else:
        await purge_user_data(uid)
    return {"ok": True}
