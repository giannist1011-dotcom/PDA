"""Admin panel — Εταιρίες Delivery (OrderDeck Fleet) + demo λογαριασμοί.

Ίδιο admin password gate (X-Admin-Password) με το υπόλοιπο admin panel.
Οι εταιρείες διανομής είναι unified λογαριασμοί (users.account_type=fleet_company)
με fleet_team συνδεδεμένο μέσω owner_user_id. Οι demo λογαριασμοί (μαγαζί ή εταιρία)
δημιουργούνται από τον admin, σημαδεύονται is_demo (ΧΩΡΙΣ demo_expires_at — δεν τους
σβήνει το cron των demo επισκεπτών) και συνδέονται από το κανονικό unified login.
"""
import secrets
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from pydantic import BaseModel, Field

from admin.admins import (
    audit_subadmin,
    check_city,
    get_admin_ctx,
    require_manage,
    require_product,
    scope_city_match,
)
from shared.core import (
    ai_features_global,
    db,
    hash_password,
    purge_shared_user_data,
    purge_user_data,
)
from pos import api as pos_api
from admin.shops import fill_city, shop_status
from fleet import api as fleet_api
from admin.promo import require_admin

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

    # Μετρητές ανά ομάδα — το fleet domain τους δίνει μαζεμένους (όχι N+1).
    # Ο όγκος παραγγελιών μόνο για demo (δικοί μας λογαριασμοί) — οι επιδόσεις
    # των εταιρειών-πελατών δεν εμφανίζονται στο admin panel.
    counters = await fleet_api.team_counters_for_users(
        [c["id"] for c in companies], {c["id"] for c in companies if c.get("is_demo")}
    )
    for c in companies:
        c.update(counters.get(c["id"], {"drivers_count": 0}))
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
    # Όγκος παραγγελιών ΜΟΝΟ σε demo λογαριασμούς (δικοί μας)
    u.update(await fleet_api.team_detail_for_user(uid, with_totals=bool(u.get("is_demo"))))
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
        await fleet_api.set_team_disabled(uid, update["disabled"])
    return {"ok": True, **update}


async def purge_fleet_company(uid: str) -> None:
    await fleet_api.delete_team_for_user(uid)
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



async def _seed_store_profiles(uid: str, now_iso: str, include_waiter: bool = True) -> None:
    profiles = [
        {"id": str(uuid.uuid4())[:8], "user_id": uid, "name": "Ιδιοκτήτης", "role": "owner",
         "pin_hash": hash_password("0000"), "created_at": now_iso},
        {"id": str(uuid.uuid4())[:8], "user_id": uid, "name": "Υπάλληλος", "role": "employee",
         "pin_hash": hash_password("0000"), "created_at": now_iso},
    ]
    # Στο πλάνο «fleet» (FleetDeck καταστήματος) δεν υπάρχει POS/τραπέζια → χωρίς σερβιτόρο
    if include_waiter:
        profiles.append(
            {"id": str(uuid.uuid4())[:8], "user_id": uid, "name": "Σερβιτόρος", "role": "waiter",
             "pin_hash": hash_password("0000"), "created_at": now_iso}
        )
    await db.profiles.insert_many(profiles)


async def _create_fleet_company_demo(name: str, city: str) -> dict:
    """Demo εταιρεία διανομής (unified λογαριασμός + ομάδα + demo οδηγοί/παραγγελίες).
    Επιστρέφει credentials + team_id — καλείται από το admin demo και από το auto-link
    του FleetDeck store demo όταν δεν υπάρχει καμία demo εταιρεία."""
    now_iso = datetime.now(timezone.utc).isoformat()
    uid = str(uuid.uuid4())
    email = f"demo-{_rand(6)}@demo.orderdeck"
    password = _rand(8)
    doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_password(password),
        "restaurant_name": name.strip(),
        "full_name": "",
        "phone": "",
        "city": city.strip(),
        "store_city": city.strip(),
        "website": "",
        "owner_pin_hash": hash_password("0000"),
        "employee_pin_hash": hash_password("0000"),
        "owner_pin_set": True,
        "employee_pin_set": False,
        "is_demo": True,  # χωρίς demo_expires_at → δεν τον αγγίζει το cron cleanup
        "demo_credentials": {"email": email, "password": password},
        "ai_features_enabled": ai_features_global(),
        "account_type": "fleet_company",
        "plan": "fleet15",
        "tables_enabled": False,
        "customization": {},
        "created_at": now_iso,
    }
    await db.users.insert_one(doc)
    team = await fleet_api.ensure_team_for_user(doc, admin_name="Διαχειριστής")
    drivers = await fleet_api.seed_company_demo(team["id"])
    await set_demo_credentials(uid, {"drivers": drivers})
    return {"id": uid, "email": email, "password": password,
            "drivers": drivers, "team_id": team["id"], "team_name": team["name"]}


async def _demo_company_team(city: str) -> dict:
    """Η ομάδα μιας υπάρχουσας demo εταιρείας διανομής — αλλιώς φτιάχνεται νέα.
    Το περνάμε ως callback στο fleet domain: ο λογαριασμός users είναι δική μας
    δουλειά, η ομάδα δική του."""
    company = await db.users.find_one(
        {"is_demo": True, "account_type": "fleet_company", "disabled": {"$ne": True}},
        {"_id": 0, "id": 1},
    )
    if company:
        team = await fleet_api.team_for_user(company["id"])
        if team:
            return team
    created = await _create_fleet_company_demo("Demo Διανομές", city)
    return {"id": created["team_id"], "name": created["team_name"], "city": city}



class DemoCreateIn(BaseModel):
    type: Literal["store", "fleet"]
    name: str = Field(min_length=1, max_length=80)
    city: str = Field(default="", max_length=60)
    business_type: Literal["souvlaki", "cafe", "pizzeria", "burger"] = "souvlaki"
    # Πλάνο του store demo: OrderDeck (POS), FleetDeck (μόνο ανέβασμα σε εταιρείες),
    # OrderDeck Fleet (POS + δική του ομάδα — η ενιαία επιφάνεια ολοκληρώνεται)
    plan: Literal["orderdeck", "fleet", "orderdeck_fleet"] = "orderdeck"


@router.post("/admin/demos")
async def admin_create_demo(body: DemoCreateIn, x_admin_password: Optional[str] = Header(None)):
    """Demo λογαριασμός από τον admin — μαγαζί (με preset μενού) ή εταιρία delivery
    (με δείγμα οδηγών/παραγγελιών). Συνδέεται από το κανονικό login· τα credentials
    μένουν ανακτήσιμα στο demo_credentials (ΜΟΝΟ για is_demo — ποτέ σε κανονικούς)."""
    require_admin(x_admin_password)
    if body.type == "fleet":
        created = await _create_fleet_company_demo(body.name, body.city)
        return {
            "id": created["id"], "type": "fleet", "email": created["email"],
            "password": created["password"], "pin": "0000", "drivers": created["drivers"],
        }

    now_iso = datetime.now(timezone.utc).isoformat()
    uid = str(uuid.uuid4())
    email = f"demo-{_rand(6)}@demo.orderdeck"
    password = _rand(8)
    is_fleet_plan = body.plan == "fleet"
    preset = pos_api.preset_for(body.business_type)
    doc = {
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
        # κανόνας demo: AI features μόνο με ON τον global διακόπτη AI_FEATURES_GLOBAL
        "ai_features_enabled": ai_features_global(),
        "created_at": now_iso,
        "account_type": "store",
        "plan": body.plan,
        "business_type": body.business_type,
        # FleetDeck (πλάνο «fleet»): χωρίς POS → ούτε τραπέζια ούτε μενού από preset
        "tables_enabled": not is_fleet_plan,
        "customization": {} if is_fleet_plan else preset["customization"],
    }
    await db.users.insert_one(doc)
    partner = None
    if is_fleet_plan:
        await _seed_store_profiles(uid, now_iso, include_waiter=False)
        partner = await fleet_api.seed_store_demo(
            uid, doc["restaurant_name"], doc["store_city"], _demo_company_team
        )
    else:
        await pos_api.seed_account(uid, preset, has_tables=True)
        await _seed_store_profiles(uid, now_iso)
        # OrderDeck Fleet: δική του ομάδα διανομής (όπως στην κανονική εγγραφή)
        if body.plan == "orderdeck_fleet":
            await fleet_api.ensure_team_for_user(doc)
    return {
        "id": uid, "type": "store", "plan": body.plan, "email": email,
        "password": password, "pin": "0000", "partner_company": partner,
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
        team = await fleet_api.team_for_user(uid)
        if not team:
            raise HTTPException(404, "Η ομάδα του demo δεν βρέθηκε")
        await fleet_api.purge_team(team["id"])
        await fleet_api.add_demo_admin_member(
            team["id"], u.get("owner_pin_hash") or hash_password("0000")
        )
        drivers = await fleet_api.seed_company_demo(team["id"])
        await set_demo_credentials(uid, {"drivers": drivers})
        return {"ok": True, "type": "fleet", "drivers": drivers}

    await purge_shared_user_data(uid)
    await pos_api.purge_store_data(uid)
    # FleetDeck store demo (πλάνο «fleet»): καθάρισε τις ανεβασμένες παραγγελίες και
    # ξανασπείρε τα δείγματα — η ενεργή συνεργασία διατηρείται
    if u.get("plan") == "fleet":
        await fleet_api.purge_store_orders(uid)
        await _seed_store_profiles(uid, now_iso, include_waiter=False)
        partner = await fleet_api.seed_store_demo(
            uid, u.get("restaurant_name") or "Κατάστημα",
            u.get("store_city") or u.get("city") or "",
            _demo_company_team,
        )
        return {"ok": True, "type": "store", "partner_company": partner}
    preset = pos_api.preset_for(u.get("business_type"))
    await pos_api.seed_account(uid, preset, has_tables=True)
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
