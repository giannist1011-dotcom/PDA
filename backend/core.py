"""Shared core for OrderDeck: db client, auth helpers, common dependencies, seeding."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException, Depends, Header
from motor.motor_asyncio import AsyncIOMotorClient

from seed_data import DEFAULT_CUSTOMIZATION
from presets import PRESETS, DEFAULT_TABLE_NAMES

logger = logging.getLogger("orderdeck")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
JWT_TTL_HOURS = 24 * 30  # 30 days for POS convenience

# Mongo
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]


# ============ HELPERS ============
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))


PROFILE_ROLES = ["owner", "manager", "employee", "waiter"]
LEGACY_ROLE_NAMES = {"owner": "Ιδιοκτήτης", "employee": "Υπάλληλος"}


def create_token(
    user_id: str,
    email: str,
    profile_id: Optional[str] = None,
    role: Optional[str] = None,
    profile_name: Optional[str] = None,
) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "profile": role,  # legacy claim name — carries the role
        "profile_id": profile_id,
        "profile_name": profile_name,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_TTL_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    # store_logo can be a ~2MB base64 blob — never load it on every authed request
    user = await db.users.find_one(
        {"id": payload["sub"]}, {"_id": 0, "password_hash": 0, "store_logo": 0}
    )
    if not user:
        raise HTTPException(401, "User not found")
    role = payload.get("profile")  # legacy tokens carry "owner"/"employee" here
    profile_id = payload.get("profile_id")
    profile_name = payload.get("profile_name")
    if profile_id:
        prof = await db.profiles.find_one(
            {"id": profile_id, "user_id": user["id"]}, {"_id": 0}
        )
        if prof:
            role = prof["role"]
            profile_name = prof["name"]
        else:
            # profile deleted while the token was live → force re-selection
            role = None
            profile_id = None
            profile_name = None
    user["profile"] = role  # legacy key: pages check "owner"
    user["role"] = role
    user["profile_id"] = profile_id
    user["profile_name"] = profile_name
    return user


async def require_owner(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "owner":
        raise HTTPException(403, "Απαιτείται πρόσβαση ιδιοκτήτη")
    return user


async def require_manager(user: dict = Depends(get_current_user)) -> dict:
    """Owner or manager (Υπεύθυνος)."""
    if user.get("role") not in ("owner", "manager"):
        raise HTTPException(403, "Απαιτείται πρόσβαση ιδιοκτήτη ή υπευθύνου")
    return user


async def require_staff(user: dict = Depends(get_current_user)) -> dict:
    """Όλοι εκτός σερβιτόρου (ο σερβιτόρος έχει μόνο Τραπέζια)."""
    if user.get("role") not in ("owner", "manager", "employee"):
        raise HTTPException(403, "Δεν επιτρέπεται για αυτόν τον ρόλο")
    return user


def actor_name(user: dict) -> str:
    return user.get("profile_name") or LEGACY_ROLE_NAMES.get(user.get("role"), "") or "—"


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "restaurant_name": u["restaurant_name"],
        "created_at": u.get("created_at"),
        "profile": u.get("profile"),  # role (legacy key)
        "role": u.get("role") or u.get("profile"),
        "profile_id": u.get("profile_id"),
        "profile_name": u.get("profile_name"),
        "owner_pin_set": bool(u.get("owner_pin_set", False)),
        "employee_pin_set": bool(u.get("employee_pin_set", False)),
        "tables_enabled": bool(u.get("tables_enabled", False)),
        "business_type": u.get("business_type") or "souvlaki",
        "is_demo": bool(u.get("is_demo", False)),
        "demo_expires_at": u.get("demo_expires_at"),
    }


# ============ PROFILES MIGRATION ============
async def ensure_profiles_migrated(user_id: str):
    """Legacy accounts had two fixed PINs — turn them into real profiles once."""
    count = await db.profiles.count_documents({"user_id": user_id})
    if count > 0:
        return
    u = await db.users.find_one({"id": user_id})
    if not u:
        return
    now = datetime.now(timezone.utc).isoformat()
    await db.profiles.insert_many([
        {
            "id": str(uuid.uuid4())[:8],
            "user_id": user_id,
            "name": "Ιδιοκτήτης",
            "role": "owner",
            "pin_hash": u.get("owner_pin_hash") or hash_password("0000"),
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4())[:8],
            "user_id": user_id,
            "name": "Υπάλληλος",
            "role": "employee",
            "pin_hash": u.get("employee_pin_hash") or hash_password("0000"),
            "created_at": now,
        },
    ])


# ============ OWNER PIN GATE (sensitive actions) ============
PIN_MAX_FAILS = 5
PIN_LOCK_SECONDS = 300  # 5 minutes


async def check_owner_pin(user_id: str, pin: str) -> dict:
    """Verify an owner/manager profile PIN with a 5-fail / 5-minute lockout, per account."""
    u = await db.users.find_one({"id": user_id})
    if not u:
        return {"ok": False, "attempts_left": 0}
    now = datetime.now(timezone.utc)
    lock_until = u.get("pin_lock_until")
    if lock_until:
        try:
            lu = datetime.fromisoformat(lock_until)
        except (ValueError, TypeError):
            lu = None
        if lu and lu > now:
            return {"ok": False, "locked_for": int((lu - now).total_seconds())}
    await ensure_profiles_migrated(user_id)
    supervisors = await db.profiles.find(
        {"user_id": user_id, "role": {"$in": ["owner", "manager"]}}
    ).to_list(100)
    matched = pin and any(
        verify_password(pin, p.get("pin_hash", "")) for p in supervisors
    )
    if matched:
        await db.users.update_one(
            {"id": user_id}, {"$set": {"pin_fail_count": 0, "pin_lock_until": None}}
        )
        return {"ok": True}
    fails = int(u.get("pin_fail_count") or 0) + 1
    if fails >= PIN_MAX_FAILS:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "pin_fail_count": 0,
                "pin_lock_until": (now + timedelta(seconds=PIN_LOCK_SECONDS)).isoformat(),
            }},
        )
        return {"ok": False, "locked_for": PIN_LOCK_SECONDS}
    await db.users.update_one({"id": user_id}, {"$set": {"pin_fail_count": fails}})
    return {"ok": False, "attempts_left": PIN_MAX_FAILS - fails}


async def require_owner_or_pin(user: dict, pin: Optional[str]):
    """Owner/manager roles act directly; other roles need a valid owner/manager PIN."""
    if user.get("role") in ("owner", "manager"):
        return
    res = await check_owner_pin(user["id"], pin or "")
    if not res.get("ok"):
        if res.get("locked_for"):
            raise HTTPException(423, f"Κλειδωμένο για {res['locked_for']} δευτερόλεπτα")
        raise HTTPException(403, "Απαιτείται PIN ιδιοκτήτη ή υπευθύνου")


# ============ MIGRATIONS ============
async def migrate_items_sort_order():
    """Backfill sort_order σε υπάρχοντα προϊόντα: σειρά εισαγωγής ανά (χρήστη, κατηγορία).

    Idempotent — αγγίζει μόνο docs χωρίς sort_order· μετά το πρώτο deploy δεν κάνει τίποτα.
    """
    counters = {}
    async for it in db.items.find(
        {"sort_order": {"$exists": False}}, {"_id": 1, "user_id": 1, "category": 1}
    ).sort("_id", 1):
        key = (it["user_id"], it.get("category"))
        order = counters.get(key, 0)
        counters[key] = order + 1
        await db.items.update_one({"_id": it["_id"]}, {"$set": {"sort_order": order}})


# ============ SEEDING ============
async def seed_user_menu(user_id: str, preset: Optional[dict] = None):
    """Create default categories, customization config and menu items for a user."""
    # customization config on user document already; here we insert items & categories.
    preset = preset or PRESETS["souvlaki"]
    await db.categories.insert_many([
        {"id": c["id"], "name": c["name"], "order": c["order"], "user_id": user_id}
        for c in preset["categories"]
    ])
    docs = []
    cat_counters = {}  # sort_order ανά κατηγορία, με τη σειρά του preset
    for it in preset["items"]:
        order = cat_counters.get(it["category"], 0)
        cat_counters[it["category"]] = order + 1
        docs.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "name": it["name"],
            "price": float(it["price"]),
            "category": it["category"],
            "customizable": it.get("customizable", False),
            "double_meat_eligible": it.get("double_meat_eligible", False),
            "option_groups": it.get("option_groups", []),
            "photo_id": None,
            "available": True,
            "unavailable_note": "",
            "sort_order": order,
        })
    await db.items.insert_many(docs)


async def seed_account_from_preset(user_id: str, preset: dict, has_tables: bool):
    """Menu, stock categories and default tables for a freshly registered account."""
    await seed_user_menu(user_id, preset)
    stock_names = preset.get("stock_categories") or []
    if stock_names:
        await db.stock_categories.insert_many([
            {"id": str(uuid.uuid4())[:8], "user_id": user_id, "name": n, "order": i}
            for i, n in enumerate(stock_names)
        ])
    if has_tables:
        await db.tables.insert_many([
            {"id": str(uuid.uuid4())[:8], "user_id": user_id, "name": n, "order": i}
            for i, n in enumerate(DEFAULT_TABLE_NAMES)
        ])


async def ensure_demo_account():
    demo_email = os.environ.get("DEMO_EMAIL", "demo@peinokio.gr").lower()
    demo_pw = os.environ.get("DEMO_PASSWORD", "demo1234")
    existing = await db.users.find_one({"email": demo_email})
    if existing:
        # Update password if changed
        if not verify_password(demo_pw, existing.get("password_hash", "")):
            await db.users.update_one(
                {"email": demo_email},
                {"$set": {"password_hash": hash_password(demo_pw)}},
            )
        # Backfill default PINs if missing
        if "owner_pin_hash" not in existing:
            await db.users.update_one(
                {"email": demo_email},
                {"$set": {
                    "owner_pin_hash": hash_password("0000"),
                    "employee_pin_hash": hash_password("0000"),
                    "owner_pin_set": False,
                    "employee_pin_set": False,
                }},
            )
        return
    uid = str(uuid.uuid4())
    user_doc = {
        "id": uid,
        "email": demo_email,
        "password_hash": hash_password(demo_pw),
        "restaurant_name": "Πεινώκιο",
        "customization": DEFAULT_CUSTOMIZATION,
        "owner_pin_hash": hash_password("0000"),
        "employee_pin_hash": hash_password("0000"),
        "owner_pin_set": False,
        "employee_pin_set": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    await seed_user_menu(uid)
    logger.info("Seeded demo Πεινώκιο account: %s", demo_email)


# ============ DEMO ACCOUNTS (per-visitor, auto-expiring) ============
DEMO_TTL_HOURS = 3

# Όλες οι per-user collections — για ΠΛΗΡΗ διαγραφή ενός λογαριασμού.
# (Το promo_codes είναι global, το demo_leads κρατιέται σκόπιμα για follow-up.)
PER_USER_COLLECTIONS = [
    "profiles", "categories", "items", "orders", "shopping",
    "stock_categories", "stock_items", "photos", "employees", "shifts",
    "expense_categories", "expenses", "day_reports", "tables", "table_tabs",
]


async def purge_user_data(user_id: str) -> None:
    """Διαγράφει ΟΛΑ τα δεδομένα ενός λογαριασμού από όλα τα collections + τον ίδιο τον χρήστη."""
    for coll in PER_USER_COLLECTIONS:
        await db[coll].delete_many({"user_id": user_id})
    await db.users.delete_one({"id": user_id})


async def cleanup_expired_demos() -> int:
    """Βρίσκει demo λογαριασμούς με demo_expires_at < τώρα και τους διαγράφει ολοκληρωτικά."""
    now_iso = datetime.now(timezone.utc).isoformat()
    expired = await db.users.find(
        {"is_demo": True, "demo_expires_at": {"$lt": now_iso}}, {"id": 1}
    ).to_list(1000)
    for u in expired:
        await purge_user_data(u["id"])
    if expired:
        logger.info("Purged %d expired demo account(s)", len(expired))
    return len(expired)
