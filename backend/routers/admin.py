"""Admin panel πλατφόρμας (διαχειριστής OrderDeck).

Όλα τα endpoints προστατεύονται με το ίδιο admin password gate (PROMO_ADMIN_PASSWORD,
header X-Admin-Password) — ΔΕΝ σχετίζονται με JWT λογαριασμών μαγαζιών.
"""
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field

from core import db, purge_user_data
from routers.onboarding import ONB_PROJECT, fetch_onboarding, onboarding_progress
from routers.promo import require_admin

router = APIRouter()

ATHENS = ZoneInfo("Europe/Athens")

PLANS = ("trial", "pro", "pro_deckpilot")
PAYMENT_STATUSES = ("paid", "pending", "expired")

# Whitelist πεδίων χρήστη που επιστρέφονται στο admin panel (ποτέ hashes/logo)
SHOP_FIELDS = {
    "_id": 0, "id": 1, "email": 1, "restaurant_name": 1, "full_name": 1,
    "phone": 1, "city": 1, "website": 1, "business_type": 1, "created_at": 1,
    "is_demo": 1, "demo_expires_at": 1, "disabled": 1, "admin_notes": 1,
    "promo": 1, "billing_note": 1, "plan": 1, "subscription_expires_at": 1,
    "payment_status": 1, "tables_enabled": 1, "public_slug": 1,
}


def shop_status(u: dict) -> str:
    if u.get("is_demo"):
        return "demo"
    if u.get("disabled"):
        return "disabled"
    return "active"


@router.get("/admin/ping")
async def admin_ping(x_admin_password: Optional[str] = Header(None)):
    """Ελαφρύς έλεγχος του admin password για το login gate του panel."""
    require_admin(x_admin_password)
    return {"ok": True}


# ============ ΕΠΙΣΚΟΠΗΣΗ ============
@router.get("/admin/overview")
async def admin_overview(x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    now = datetime.now(timezone.utc)
    today_start = now.astimezone(ATHENS).replace(hour=0, minute=0, second=0, microsecond=0)
    today_iso = today_start.astimezone(timezone.utc).isoformat()
    d7_iso = (now - timedelta(days=7)).isoformat()
    d30_iso = (now - timedelta(days=30)).isoformat()

    real = {"is_demo": {"$ne": True}}
    total = await db.users.count_documents(real)
    disabled = await db.users.count_documents({**real, "disabled": True})
    demo = await db.users.count_documents({"is_demo": True})

    regs_today = await db.users.count_documents({**real, "created_at": {"$gte": today_iso}})
    regs_7d = await db.users.count_documents({**real, "created_at": {"$gte": d7_iso}})
    regs_30d = await db.users.count_documents({**real, "created_at": {"$gte": d30_iso}})

    orders_total, revenue_total = 0, 0.0
    async for row in db.orders.aggregate([
        {"$group": {"_id": None, "n": {"$sum": 1}, "revenue": {"$sum": {"$ifNull": ["$total", 0]}}}},
    ]):
        orders_total, revenue_total = row["n"], row["revenue"]

    by_type = {}
    async for row in db.users.aggregate([
        {"$match": real},
        {"$group": {"_id": {"$ifNull": ["$business_type", "souvlaki"]}, "n": {"$sum": 1}}},
    ]):
        by_type[row["_id"]] = row["n"]

    deckpilot_ids = await db.ai_usage.distinct("user_id")
    deckpilot_shops = 0
    if deckpilot_ids:
        deckpilot_shops = await db.users.count_documents({**real, "id": {"$in": deckpilot_ids}})

    return {
        "shops": {"total": total, "active": total - disabled, "disabled": disabled, "demo": demo},
        "registrations": {"today": regs_today, "last_7d": regs_7d, "last_30d": regs_30d},
        "orders": {"total": orders_total, "revenue": round(revenue_total, 2)},
        "by_business_type": by_type,
        "deckpilot_shops": deckpilot_shops,
    }


# ============ ΜΑΓΑΖΙΑ ============
@router.get("/admin/shops")
async def admin_list_shops(
    x_admin_password: Optional[str] = Header(None),
    search: str = "",
    status: Literal["all", "active", "disabled", "demo"] = "all",
    business_type: str = "all",
    reg_from: str = "",  # ISO date (YYYY-MM-DD)
    reg_to: str = "",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    require_admin(x_admin_password)
    match: dict = {}
    if status == "demo":
        match["is_demo"] = True
    elif status == "disabled":
        match["is_demo"] = {"$ne": True}
        match["disabled"] = True
    elif status == "active":
        match["is_demo"] = {"$ne": True}
        match["disabled"] = {"$ne": True}
    if business_type != "all":
        match["business_type"] = business_type
    if search.strip():
        q = search.strip()
        match["$or"] = [
            {"restaurant_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    created: dict = {}
    if reg_from:
        created["$gte"] = reg_from
    if reg_to:
        created["$lte"] = reg_to + "T23:59:59.999999+00:00"
    if created:
        match["created_at"] = created

    total = await db.users.count_documents(match)
    pipeline = [
        {"$match": match},
        {"$sort": {"created_at": -1}},
        {"$skip": (page - 1) * limit},
        {"$limit": limit},
        # SHOP_FIELDS + υπολογιζόμενα πεδία onboarding (χωρίς να κατέβει το logo blob)
        {"$project": {**SHOP_FIELDS, **{k: v for k, v in ONB_PROJECT.items() if k != "_id"}}},
        {"$lookup": {
            "from": "orders",
            "let": {"uid": "$id"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$user_id", "$$uid"]}}},
                {"$group": {
                    "_id": None,
                    "n": {"$sum": 1},
                    "last": {"$max": "$created_at"},
                    "revenue": {"$sum": {"$ifNull": ["$total", 0]}},
                }},
            ],
            "as": "ostats",
        }},
    ]
    shops = []
    async for u in db.users.aggregate(pipeline):
        st = (u.pop("ostats") or [{}])[0] if u.get("ostats") else {}
        u.pop("ostats", None)
        u["orders_count"] = st.get("n", 0)
        u["orders_revenue"] = round(st.get("revenue", 0) or 0, 2)
        u["last_activity"] = st.get("last")
        u["status"] = shop_status(u)
        u["onboarding"] = onboarding_progress(u)
        for k in ONB_PROJECT:
            u.pop(k, None)
        shops.append(u)
    return {"total": total, "page": page, "limit": limit, "shops": shops}


@router.get("/admin/shops/{uid}")
async def admin_shop_detail(uid: str, x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    u = await db.users.find_one({"id": uid}, SHOP_FIELDS)
    if not u:
        raise HTTPException(404, "Το μαγαζί δεν βρέθηκε")
    u["status"] = shop_status(u)
    stats = {"orders_count": 0, "orders_revenue": 0, "last_activity": None}
    async for row in db.orders.aggregate([
        {"$match": {"user_id": uid}},
        {"$group": {
            "_id": None, "n": {"$sum": 1}, "last": {"$max": "$created_at"},
            "revenue": {"$sum": {"$ifNull": ["$total", 0]}},
        }},
    ]):
        stats = {
            "orders_count": row["n"],
            "orders_revenue": round(row["revenue"], 2),
            "last_activity": row["last"],
        }
    u.update(stats)
    u["profiles_count"] = await db.profiles.count_documents({"user_id": uid})
    u["items_count"] = await db.items.count_documents({"user_id": uid})
    u["uses_deckpilot"] = bool(await db.ai_usage.find_one({"user_id": uid}, {"_id": 1}))
    u["onboarding"] = await fetch_onboarding(uid)
    return u


class ShopUpdateIn(BaseModel):
    disabled: Optional[bool] = None
    admin_notes: Optional[str] = Field(default=None, max_length=5000)
    plan: Optional[Literal["trial", "pro", "pro_deckpilot"]] = None
    subscription_expires_at: Optional[str] = None  # ISO date, "" = καθαρισμός
    payment_status: Optional[Literal["paid", "pending", "expired"]] = None


@router.patch("/admin/shops/{uid}")
async def admin_update_shop(
    uid: str, body: ShopUpdateIn, x_admin_password: Optional[str] = Header(None)
):
    require_admin(x_admin_password)
    update = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not update:
        raise HTTPException(400, "Δεν δόθηκαν αλλαγές")
    if update.get("subscription_expires_at") == "":
        update["subscription_expires_at"] = None
    res = await db.users.update_one({"id": uid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Το μαγαζί δεν βρέθηκε")
    return {"ok": True, **update}


@router.delete("/admin/shops/{uid}")
async def admin_delete_shop(
    uid: str, confirm: str = "", x_admin_password: Optional[str] = Header(None)
):
    require_admin(x_admin_password)
    u = await db.users.find_one({"id": uid}, {"_id": 0, "restaurant_name": 1})
    if not u:
        raise HTTPException(404, "Το μαγαζί δεν βρέθηκε")
    if confirm.strip() != (u.get("restaurant_name") or "").strip():
        raise HTTPException(400, "Η επιβεβαίωση δεν ταιριάζει με το όνομα του μαγαζιού")
    await purge_user_data(uid)
    return {"ok": True}


# ============ ΣΥΝΔΡΟΜΕΣ ============
@router.get("/admin/subscriptions/expiring")
async def admin_expiring_subscriptions(x_admin_password: Optional[str] = Header(None)):
    """Συνδρομές/δοκιμές που λήγουν στις επόμενες 7 ημέρες (για follow-up)."""
    require_admin(x_admin_password)
    today = datetime.now(ATHENS).date().isoformat()
    in_7d = (datetime.now(ATHENS).date() + timedelta(days=7)).isoformat()
    shops = []
    cur = db.users.find(
        {
            "is_demo": {"$ne": True},
            "subscription_expires_at": {"$gte": today, "$lte": in_7d + "T23:59:59.999999+00:00"},
        },
        SHOP_FIELDS,
    ).sort("subscription_expires_at", 1)
    async for u in cur:
        u["status"] = shop_status(u)
        shops.append(u)
    return shops


# ============ LEADS (demo mode) ============
@router.get("/admin/leads")
async def admin_leads(
    x_admin_password: Optional[str] = Header(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
):
    require_admin(x_admin_password)
    total = await db.demo_leads.count_documents({})
    leads = await db.demo_leads.find({}, {"_id": 0}).sort("created_at", -1) \
        .skip((page - 1) * limit).to_list(limit)
    emails = list({l["email"] for l in leads})
    converted = set()
    if emails:
        async for u in db.users.find(
            {"email": {"$in": emails}, "is_demo": {"$ne": True}}, {"_id": 0, "email": 1}
        ):
            converted.add(u["email"])
    for l in leads:
        l["converted"] = l["email"] in converted
    return {"total": total, "page": page, "limit": limit, "leads": leads}
