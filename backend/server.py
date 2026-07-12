"""FastAPI server for Πεινώκιο multi-tenant POS SaaS."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from collections import Counter, defaultdict
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

from seed_data import DEFAULT_CATEGORIES, DEFAULT_CUSTOMIZATION, DEFAULT_ITEMS
from presets import PRESETS, DEFAULT_TABLE_NAMES

logger = logging.getLogger("peinokio")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
JWT_TTL_HOURS = 24 * 30  # 30 days for POS convenience

# Mongo
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Peinokio POS SaaS")
api = APIRouter(prefix="/api")

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
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
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
    }


# ============ MODELS ============
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4)
    restaurant_name: str = Field(min_length=1, max_length=80)
    full_name: str = Field(default="", max_length=80)
    phone: str = Field(default="", max_length=20)
    city: str = Field(default="", max_length=60)
    website: str = Field(default="", max_length=120)
    business_type: Literal["souvlaki", "cafe", "pizzeria", "burger"] = "souvlaki"
    has_tables: bool = False
    has_waiters: bool = False
    owner_pin: Optional[str] = None  # 4 digits — the wizard always sends it


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    token: str
    user: dict


class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    order: int = 0


class MenuOption(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    price: float = 0.0


class MenuOptionGroup(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    type: Literal["single", "multi"] = "single"
    required: bool = False
    price_mode: Literal["add", "replace"] = "add"
    options: List[MenuOption] = Field(default_factory=list)


class MenuItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    price: float = Field(ge=0)
    category: str
    customizable: bool = False
    double_meat_eligible: bool = False
    available: bool = True
    unavailable_note: str = ""
    option_groups: List[MenuOptionGroup] = Field(default_factory=list)
    photo_id: Optional[str] = None


class MenuItem(MenuItemIn):
    id: str


class AvailabilityIn(BaseModel):
    available: bool
    unavailable_note: str = ""


class NamedPricedOption(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    price: float = 0.0


class CustomizationConfig(BaseModel):
    bread_options: List[NamedPricedOption] = Field(default_factory=list)
    extras_options: List[NamedPricedOption] = Field(default_factory=list)
    sauces_options: List[NamedPricedOption] = Field(default_factory=list)
    double_meat_price: float = Field(ge=0)


def _coerce_named_priced(items):
    """Backwards-compat: turn plain string option into {name, price:0}."""
    out = []
    for x in items or []:
        if isinstance(x, str):
            out.append({"name": x, "price": 0.0})
        elif isinstance(x, dict) and "name" in x:
            out.append({"name": x["name"], "price": float(x.get("price", 0) or 0)})
    return out


def _normalize_customization(cust: dict) -> dict:
    """Ensure stored customization matches new schema (all option lists as {name, price} dicts)."""
    if not cust:
        return cust
    cust = dict(cust)
    cust["bread_options"] = _coerce_named_priced(cust.get("bread_options"))
    cust["extras_options"] = _coerce_named_priced(cust.get("extras_options"))
    cust["sauces_options"] = _coerce_named_priced(cust.get("sauces_options"))
    return cust


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
    for it in preset["items"]:
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


# ============ AUTH ROUTES ============
@api.post("/auth/register", response_model=TokenOut)
async def register(body: RegisterIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Το email χρησιμοποιείται ήδη")
    if body.owner_pin is not None and not (body.owner_pin.isdigit() and len(body.owner_pin) == 4):
        raise HTTPException(400, "Το PIN ιδιοκτήτη πρέπει να είναι 4 ψηφία")
    preset = PRESETS.get(body.business_type, PRESETS["souvlaki"])
    owner_pin = body.owner_pin or "0000"
    now = datetime.now(timezone.utc).isoformat()
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_password(body.password),
        "restaurant_name": body.restaurant_name.strip(),
        "full_name": body.full_name.strip(),
        "phone": body.phone.strip(),
        "city": body.city.strip(),
        "website": body.website.strip(),
        "business_type": body.business_type,
        "tables_enabled": bool(body.has_tables),
        "customization": preset["customization"],
        "owner_pin_hash": hash_password(owner_pin),
        "employee_pin_hash": hash_password("0000"),
        "owner_pin_set": bool(body.owner_pin),
        "employee_pin_set": False,
        "created_at": now,
    }
    await db.users.insert_one(doc)
    # Seed menu + stock categories + default tables from the chosen preset
    await seed_account_from_preset(uid, preset, body.has_tables)
    # Profiles: owner with the chosen PIN, a default employee, waiter if requested
    profiles = [
        {
            "id": str(uuid.uuid4())[:8],
            "user_id": uid,
            "name": "Ιδιοκτήτης",
            "role": "owner",
            "pin_hash": hash_password(owner_pin),
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4())[:8],
            "user_id": uid,
            "name": "Υπάλληλος",
            "role": "employee",
            "pin_hash": hash_password("0000"),
            "created_at": now,
        },
    ]
    if body.has_waiters:
        profiles.append({
            "id": str(uuid.uuid4())[:8],
            "user_id": uid,
            "name": "Σερβιτόρος",
            "role": "waiter",
            "pin_hash": hash_password("0000"),
            "created_at": now,
        })
    await db.profiles.insert_many(profiles)
    token = create_token(uid, email)
    return {"token": token, "user": public_user(doc)}


@api.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Λάθος email ή κωδικός")
    await ensure_profiles_migrated(user["id"])
    token = create_token(user["id"], email)
    return {"token": token, "user": public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ============ PROFILES (dynamic, per-account) ============
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


def public_profile(p: dict) -> dict:
    return {k: v for k, v in p.items() if k not in ("_id", "user_id", "pin_hash")}


def can_manage_profile(actor_role: str, target_role: str) -> bool:
    if actor_role == "owner":
        return True
    if actor_role == "manager":
        return target_role == "waiter"
    return False


class ProfileSelectIn(BaseModel):
    profile_id: str
    pin: str = Field(min_length=4, max_length=4)


class ProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    role: Literal["owner", "manager", "employee", "waiter"]
    pin: Optional[str] = None  # 4 digits — required on create, optional on update


@api.get("/profiles")
async def list_profiles(user: dict = Depends(get_current_user)):
    await ensure_profiles_migrated(user["id"])
    docs = await db.profiles.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0, "pin_hash": 0}
    ).sort("created_at", 1).to_list(100)
    return docs


@api.post("/profiles")
async def create_profile(body: ProfileIn, user: dict = Depends(require_manager)):
    if not can_manage_profile(user["role"], body.role):
        raise HTTPException(403, "Δεν επιτρέπεται η δημιουργία προφίλ αυτού του ρόλου")
    if not body.pin or not (body.pin.isdigit() and len(body.pin) == 4):
        raise HTTPException(400, "Απαιτείται 4-ψήφιο PIN")
    doc = {
        "id": str(uuid.uuid4())[:8],
        "user_id": user["id"],
        "name": body.name.strip(),
        "role": body.role,
        "pin_hash": hash_password(body.pin),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.profiles.insert_one(doc)
    return public_profile(doc)


@api.put("/profiles/{pid}")
async def update_profile(pid: str, body: ProfileIn, user: dict = Depends(require_manager)):
    target = await db.profiles.find_one({"id": pid, "user_id": user["id"]})
    if not target:
        raise HTTPException(404, "Το προφίλ δεν βρέθηκε")
    if not can_manage_profile(user["role"], target["role"]) or not can_manage_profile(user["role"], body.role):
        raise HTTPException(403, "Δεν επιτρέπεται η διαχείριση αυτού του προφίλ")
    if target["role"] == "owner" and body.role != "owner":
        owners = await db.profiles.count_documents({"user_id": user["id"], "role": "owner"})
        if owners <= 1:
            raise HTTPException(400, "Πρέπει να υπάρχει τουλάχιστον ένα προφίλ Ιδιοκτήτη")
    update = {"name": body.name.strip(), "role": body.role}
    if body.pin:
        if not (body.pin.isdigit() and len(body.pin) == 4):
            raise HTTPException(400, "Ο κωδικός πρέπει να είναι 4 ψηφία")
        update["pin_hash"] = hash_password(body.pin)
    await db.profiles.update_one({"id": pid, "user_id": user["id"]}, {"$set": update})
    return {"id": pid, "name": update["name"], "role": update["role"]}


@api.delete("/profiles/{pid}")
async def delete_profile(pid: str, user: dict = Depends(require_manager)):
    target = await db.profiles.find_one({"id": pid, "user_id": user["id"]})
    if not target:
        raise HTTPException(404, "Το προφίλ δεν βρέθηκε")
    if not can_manage_profile(user["role"], target["role"]):
        raise HTTPException(403, "Δεν επιτρέπεται η διαγραφή αυτού του προφίλ")
    if target["role"] == "owner":
        owners = await db.profiles.count_documents({"user_id": user["id"], "role": "owner"})
        if owners <= 1:
            raise HTTPException(400, "Δεν μπορεί να διαγραφεί το τελευταίο προφίλ Ιδιοκτήτη")
    if target["id"] == user.get("profile_id"):
        raise HTTPException(400, "Δεν μπορείτε να διαγράψετε το ενεργό σας προφίλ")
    await db.profiles.delete_one({"id": pid, "user_id": user["id"]})
    return {"ok": True}


@api.post("/profile/select")
async def profile_select(body: ProfileSelectIn, user: dict = Depends(get_current_user)):
    if not body.pin.isdigit():
        raise HTTPException(400, "Ο κωδικός πρέπει να είναι 4 ψηφία")
    prof = await db.profiles.find_one({"id": body.profile_id, "user_id": user["id"]})
    if not prof:
        raise HTTPException(404, "Το προφίλ δεν βρέθηκε")
    if not verify_password(body.pin, prof.get("pin_hash", "")):
        raise HTTPException(401, "Λάθος κωδικός")
    token = create_token(
        user["id"], user["email"],
        profile_id=prof["id"], role=prof["role"], profile_name=prof["name"],
    )
    return {"token": token, "profile": prof["role"], "profile_id": prof["id"], "profile_name": prof["name"]}


@api.post("/profile/exit")
async def profile_exit(user: dict = Depends(get_current_user)):
    """Return a token with profile cleared (used for 'Αλλαγή προφίλ')."""
    token = create_token(user["id"], user["email"])
    return {"token": token, "profile": None}


# ============ OWNER PIN GATE (sensitive actions) ============
PIN_MAX_FAILS = 5
PIN_LOCK_SECONDS = 300  # 5 minutes


class PinVerifyIn(BaseModel):
    pin: str = Field(min_length=1, max_length=20)


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


@api.post("/auth/verify-owner-pin")
async def verify_owner_pin(body: PinVerifyIn, user: dict = Depends(get_current_user)):
    return await check_owner_pin(user["id"], body.pin)


async def require_owner_or_pin(user: dict, pin: Optional[str]):
    """Owner/manager roles act directly; other roles need a valid owner/manager PIN."""
    if user.get("role") in ("owner", "manager"):
        return
    res = await check_owner_pin(user["id"], pin or "")
    if not res.get("ok"):
        if res.get("locked_for"):
            raise HTTPException(423, f"Κλειδωμένο για {res['locked_for']} δευτερόλεπτα")
        raise HTTPException(403, "Απαιτείται PIN ιδιοκτήτη ή υπευθύνου")


# ============ MENU ROUTES ============
@api.get("/menu/config")
async def get_menu_config(user: dict = Depends(get_current_user)):
    cats = await db.categories.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).sort("order", 1).to_list(500)
    items = await db.items.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).to_list(2000)
    # attach photo_url for items with photo_id
    photo_ids = list({i.get("photo_id") for i in items if i.get("photo_id")})
    photo_map = {}
    if photo_ids:
        async for p in db.photos.find(
            {"user_id": user["id"], "id": {"$in": photo_ids}}, {"_id": 0, "id": 1, "data_url": 1}
        ):
            photo_map[p["id"]] = p["data_url"]
    for it in items:
        if it.get("photo_id") and photo_map.get(it["photo_id"]):
            it["photo_url"] = photo_map[it["photo_id"]]
    # customization from user doc, normalized
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "customization": 1})
    cust = u.get("customization") if u else DEFAULT_CUSTOMIZATION
    return {
        "categories": cats,
        "items": items,
        "customization": _normalize_customization(cust) if cust else DEFAULT_CUSTOMIZATION,
    }


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    order: int = 0


@api.post("/menu/categories")
async def create_category(body: CategoryIn, user: dict = Depends(require_manager)):
    # generate slug-ish id
    cid = str(uuid.uuid4())[:8]
    doc = {"id": cid, "name": body.name.strip(), "order": body.order, "user_id": user["id"]}
    await db.categories.insert_one(doc)
    return {"id": cid, "name": body.name.strip(), "order": body.order}


@api.put("/menu/categories/{cid}")
async def update_category(cid: str, body: CategoryIn, user: dict = Depends(require_manager)):
    r = await db.categories.update_one(
        {"id": cid, "user_id": user["id"]},
        {"$set": {"name": body.name.strip(), "order": body.order}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": cid, "name": body.name.strip(), "order": body.order}


@api.delete("/menu/categories/{cid}")
async def delete_category(cid: str, user: dict = Depends(require_manager)):
    await db.items.delete_many({"user_id": user["id"], "category": cid})
    r = await db.categories.delete_one({"id": cid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.post("/menu/items")
async def create_item(body: MenuItemIn, user: dict = Depends(require_manager)):
    iid = str(uuid.uuid4())
    doc = {
        "id": iid,
        "user_id": user["id"],
        "name": body.name.strip(),
        "price": float(body.price),
        "category": body.category,
        "customizable": bool(body.customizable),
        "double_meat_eligible": bool(body.double_meat_eligible),
        "available": bool(body.available),
        "unavailable_note": body.unavailable_note.strip(),
        "option_groups": [g.model_dump() for g in body.option_groups],
        "photo_id": body.photo_id,
    }
    await db.items.insert_one(doc)
    doc.pop("user_id", None)
    doc.pop("_id", None)
    return doc


@api.put("/menu/items/{iid}")
async def update_item(iid: str, body: MenuItemIn, user: dict = Depends(require_manager)):
    update = {
        "name": body.name.strip(),
        "price": float(body.price),
        "category": body.category,
        "customizable": bool(body.customizable),
        "double_meat_eligible": bool(body.double_meat_eligible),
        "available": bool(body.available),
        "unavailable_note": body.unavailable_note.strip(),
        "option_groups": [g.model_dump() for g in body.option_groups],
        "photo_id": body.photo_id,
    }
    r = await db.items.update_one({"id": iid, "user_id": user["id"]}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": iid, **update}


@api.patch("/menu/items/{iid}/availability")
async def set_item_availability(iid: str, body: AvailabilityIn, user: dict = Depends(get_current_user)):
    r = await db.items.update_one(
        {"id": iid, "user_id": user["id"]},
        {"$set": {"available": bool(body.available), "unavailable_note": body.unavailable_note.strip()}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": iid, "available": body.available, "unavailable_note": body.unavailable_note.strip()}

@api.delete("/menu/items/{iid}")
async def delete_item(iid: str, user: dict = Depends(require_manager)):
    r = await db.items.delete_one({"id": iid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ---------- Bulk item operations ----------
class BulkItemsIn(BaseModel):
    ids: List[str] = Field(min_length=1)
    action: Literal[
        "set_price",
        "adjust_price",
        "adjust_price_pct",
        "set_category",
        "set_availability",
        "add_option_group",
        "delete",
    ]
    price: Optional[float] = None
    delta: Optional[float] = None
    pct: Optional[float] = None
    category: Optional[str] = None
    available: Optional[bool] = None
    note: Optional[str] = ""
    group: Optional[MenuOptionGroup] = None


@api.post("/menu/items/bulk")
async def bulk_items(body: BulkItemsIn, user: dict = Depends(require_manager)):
    q = {"user_id": user["id"], "id": {"$in": body.ids}}

    if body.action == "delete":
        r = await db.items.delete_many(q)
        return {"ok": True, "affected": r.deleted_count}

    if body.action == "set_price":
        if body.price is None or body.price < 0:
            raise HTTPException(400, "Άκυρη τιμή")
        r = await db.items.update_many(q, {"$set": {"price": float(body.price)}})
        return {"ok": True, "affected": r.modified_count}

    if body.action == "adjust_price":
        if body.delta is None:
            raise HTTPException(400, "Άκυρη μεταβολή")
        docs = await db.items.find(q, {"_id": 0, "id": 1, "price": 1}).to_list(2000)
        affected = 0
        for d in docs:
            new_price = round(max(0.0, float(d.get("price", 0)) + float(body.delta)), 2)
            await db.items.update_one(
                {"id": d["id"], "user_id": user["id"]},
                {"$set": {"price": new_price}},
            )
            affected += 1
        return {"ok": True, "affected": affected}

    if body.action == "adjust_price_pct":
        if body.pct is None:
            raise HTTPException(400, "Άκυρο ποσοστό")
        docs = await db.items.find(q, {"_id": 0, "id": 1, "price": 1}).to_list(2000)
        affected = 0
        factor = 1 + float(body.pct) / 100.0
        for d in docs:
            new_price = round(max(0.0, float(d.get("price", 0)) * factor), 2)
            await db.items.update_one(
                {"id": d["id"], "user_id": user["id"]},
                {"$set": {"price": new_price}},
            )
            affected += 1
        return {"ok": True, "affected": affected}

    if body.action == "set_category":
        if not body.category:
            raise HTTPException(400, "Άκυρη κατηγορία")
        cat = await db.categories.find_one({"id": body.category, "user_id": user["id"]})
        if not cat:
            raise HTTPException(404, "Η κατηγορία δεν βρέθηκε")
        r = await db.items.update_many(q, {"$set": {"category": body.category}})
        return {"ok": True, "affected": r.modified_count}

    if body.action == "set_availability":
        if body.available is None:
            raise HTTPException(400, "Άκυρη τιμή διαθεσιμότητας")
        r = await db.items.update_many(
            q,
            {"$set": {"available": bool(body.available), "unavailable_note": (body.note or "").strip()}},
        )
        return {"ok": True, "affected": r.modified_count}

    if body.action == "add_option_group":
        if body.group is None:
            raise HTTPException(400, "Απαιτείται ομάδα")
        group_doc = body.group.model_dump()
        docs = await db.items.find(q, {"_id": 0, "id": 1, "option_groups": 1}).to_list(2000)
        affected = 0
        for d in docs:
            existing = d.get("option_groups", []) or []
            others = [g for g in existing if g.get("id") != group_doc["id"]]
            new_groups = others + [group_doc]
            await db.items.update_one(
                {"id": d["id"], "user_id": user["id"]},
                {"$set": {"option_groups": new_groups}},
            )
            affected += 1
        return {"ok": True, "affected": affected}

    raise HTTPException(400, "Άκυρη ενέργεια")


@api.put("/menu/customization")
async def update_customization(body: CustomizationConfig, user: dict = Depends(require_manager)):
    payload = body.model_dump()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"customization": payload}},
    )
    return payload


# ============ PHOTO LIBRARY ============
class PhotoIn(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    data_url: str = Field(min_length=10, max_length=6_000_000)  # cap ~6MB base64


@api.get("/photos")
async def list_photos(user: dict = Depends(get_current_user)):
    docs = await db.photos.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("created_at", -1).to_list(500)
    return docs


@api.post("/photos")
async def create_photo(body: PhotoIn, user: dict = Depends(require_manager)):
    if not body.data_url.startswith("data:image/"):
        raise HTTPException(400, "Δεν είναι εικόνα (data URL)")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "filename": body.filename.strip(),
        "data_url": body.data_url,
        "size_bytes": len(body.data_url),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.photos.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@api.delete("/photos/{pid}")
async def delete_photo(pid: str, user: dict = Depends(require_manager)):
    r = await db.photos.delete_one({"id": pid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    # unlink from any items
    await db.items.update_many(
        {"user_id": user["id"], "photo_id": pid},
        {"$set": {"photo_id": None}},
    )
    return {"ok": True}


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


@api.get("/orders/next-number")
async def next_order_number(user: dict = Depends(get_current_user)):
    return {"next_order_number": await compute_next_order_number(user["id"])}


@api.post("/orders", response_model=Order)
async def create_order(body: OrderCreate, user: dict = Depends(get_current_user)):
    oid = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    doc = body.model_dump()
    doc.update({
        "id": oid,
        "user_id": user["id"],
        "created_at": now.isoformat(),
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
    doc.pop("_id", None)
    doc["created_at"] = now
    return doc


@api.get("/orders/scheduled", response_model=List[Order])
async def list_scheduled_orders(user: dict = Depends(get_current_user)):
    docs = await db.orders.find(
        {"user_id": user["id"], "status": "scheduled", "cancelled": {"$ne": True}},
        {"_id": 0},
    ).sort("scheduled_at", 1).to_list(500)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
    return docs


@api.get("/orders", response_model=List[Order])
async def list_orders(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    source: Optional[str] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 500,
    user: dict = Depends(get_current_user),
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


@api.get("/orders/{oid}", response_model=Order)
async def get_order(oid: str, user: dict = Depends(get_current_user)):
    doc = await db.orders.find_one({"id": oid, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if isinstance(doc.get("created_at"), str):
        doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return doc


@api.post("/orders/{oid}/activate", response_model=Order)
async def activate_order(oid: str, user: dict = Depends(get_current_user)):
    """Move a scheduled order to active (fired / printed)."""
    r = await db.orders.update_one(
        {"id": oid, "user_id": user["id"], "status": "scheduled"},
        {"$set": {"status": "active"}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.orders.find_one({"id": oid, "user_id": user["id"]}, {"_id": 0})
    if isinstance(doc.get("created_at"), str):
        doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return doc


class CancelOrderIn(BaseModel):
    pin: Optional[str] = None


@api.post("/orders/{oid}/cancel")
async def cancel_order(
    oid: str,
    body: Optional[CancelOrderIn] = None,
    user: dict = Depends(get_current_user),
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


@api.delete("/orders/{oid}")
async def delete_order(
    oid: str,
    pin: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    await require_owner_or_pin(user, pin)
    r = await db.orders.delete_one({"id": oid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.get("/customers")
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


# ============ ANALYTICS ============
@api.get("/analytics")
async def analytics(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(require_owner),
):
    today = datetime.now(timezone.utc).date().isoformat()
    df = date_from or today
    dt = date_to or today
    query = {
        "user_id": user["id"],
        "created_at": {"$gte": f"{df}T00:00:00+00:00", "$lte": f"{dt}T23:59:59+00:00"},
        "cancelled": {"$ne": True},
        "status": {"$ne": "scheduled"},  # not fired yet → no revenue
    }
    docs = await db.orders.find(query, {"_id": 0}).to_list(50000)
    total_orders = len(docs)
    total_revenue = round(sum(d.get("total", 0) for d in docs), 2)
    avg_order = round(total_revenue / total_orders, 2) if total_orders else 0.0
    by_source = defaultdict(lambda: {"count": 0, "revenue": 0.0})
    hourly = defaultdict(lambda: {"orders": 0, "revenue": 0.0})
    item_counter = Counter()
    item_revenue = defaultdict(float)
    for d in docs:
        src = d.get("source", "Ταμείο")
        by_source[src]["count"] += 1
        by_source[src]["revenue"] += d.get("total", 0)
        try:
            dt_obj = datetime.fromisoformat(d["created_at"])
            hr = dt_obj.hour
            hourly[hr]["orders"] += 1
            hourly[hr]["revenue"] += d.get("total", 0)
        except Exception:
            pass
        for item in d.get("items", []):
            k = item["name"]
            item_counter[k] += item.get("quantity", 1)
            item_revenue[k] += item.get("line_total", 0)

    hourly_list = [
        {"hour": h, "label": f"{h:02d}:00",
         "orders": hourly[h]["orders"], "revenue": round(hourly[h]["revenue"], 2)}
        for h in range(24)
    ]
    popular = [
        {"name": n, "quantity": q, "revenue": round(item_revenue[n], 2)}
        for n, q in item_counter.most_common(10)
    ]
    sources_list = [
        {"source": s, "count": v["count"], "revenue": round(v["revenue"], 2)}
        for s, v in by_source.items()
    ]
    exp_docs = await db.expenses.find(
        {"user_id": user["id"], "date": {"$gte": df, "$lte": dt}},
        {"_id": 0, "amount": 1},
    ).to_list(50000)
    total_expenses = round(sum(d.get("amount", 0) for d in exp_docs), 2)
    return {
        "date_from": df,
        "date_to": dt,
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "avg_order_value": avg_order,
        "total_expenses": total_expenses,
        "net_result": round(total_revenue - total_expenses, 2),
        "by_source": sources_list,
        "popular_items": popular,
        "hourly": hourly_list,
    }


@api.get("/")
async def root():
    return {"status": "ok", "service": "Peinokio POS SaaS"}


# ============ SHOPPING LIST ============
class ShoppingItemIn(BaseModel):
    text: str = Field(min_length=1, max_length=200)


# ============ STOCK (INDEPENDENT INVENTORY) ============
class StockCategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    order: int = 0


class StockItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category_id: str
    available: bool = True
    note: str = ""


class StockItemPatchIn(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
    available: Optional[bool] = None
    note: Optional[str] = None


@api.get("/stock/config")
async def stock_config(user: dict = Depends(get_current_user)):
    cats = await db.stock_categories.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("order", 1).to_list(500)
    items = await db.stock_items.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("created_at", 1).to_list(2000)
    return {"categories": cats, "items": items}


@api.post("/stock/categories")
async def create_stock_category(body: StockCategoryIn, user: dict = Depends(require_manager)):
    count = await db.stock_categories.count_documents({"user_id": user["id"]})
    doc = {
        "id": str(uuid.uuid4())[:8],
        "user_id": user["id"],
        "name": body.name.strip(),
        "order": body.order if body.order else count,
    }
    await db.stock_categories.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@api.put("/stock/categories/{cid}")
async def update_stock_category(cid: str, body: StockCategoryIn, user: dict = Depends(require_manager)):
    r = await db.stock_categories.update_one(
        {"id": cid, "user_id": user["id"]},
        {"$set": {"name": body.name.strip(), "order": body.order}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": cid, "name": body.name.strip(), "order": body.order}


@api.delete("/stock/categories/{cid}")
async def delete_stock_category(cid: str, user: dict = Depends(require_manager)):
    # cascade: remove shopping entries created from items in this category
    stock_ids = [
        d["id"] async for d in db.stock_items.find(
            {"user_id": user["id"], "category_id": cid}, {"_id": 0, "id": 1}
        )
    ]
    if stock_ids:
        await db.shopping.delete_many({"user_id": user["id"], "source_stock_id": {"$in": stock_ids}})
    await db.stock_items.delete_many({"user_id": user["id"], "category_id": cid})
    r = await db.stock_categories.delete_one({"id": cid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.post("/stock/items")
async def create_stock_item(body: StockItemIn, user: dict = Depends(require_manager)):
    cat = await db.stock_categories.find_one({"id": body.category_id, "user_id": user["id"]})
    if not cat:
        raise HTTPException(404, "Η κατηγορία δεν βρέθηκε")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": body.name.strip(),
        "category_id": body.category_id,
        "available": bool(body.available),
        "note": body.note.strip(),
        "shopping_item_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.stock_items.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@api.patch("/stock/items/{iid}")
async def update_stock_item(iid: str, body: StockItemPatchIn, user: dict = Depends(get_current_user)):
    update = {}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.category_id is not None:
        cat = await db.stock_categories.find_one({"id": body.category_id, "user_id": user["id"]})
        if not cat:
            raise HTTPException(404, "Η κατηγορία δεν βρέθηκε")
        update["category_id"] = body.category_id
    if body.available is not None:
        update["available"] = bool(body.available)
    if body.note is not None:
        update["note"] = body.note.strip()
    if not update:
        raise HTTPException(400, "Nothing to update")
    r = await db.stock_items.update_one({"id": iid, "user_id": user["id"]}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    # keep linked shopping text in sync on rename
    if "name" in update:
        item = await db.stock_items.find_one({"id": iid, "user_id": user["id"]}, {"_id": 0, "shopping_item_id": 1})
        sid = item.get("shopping_item_id") if item else None
        if sid:
            await db.shopping.update_one(
                {"id": sid, "user_id": user["id"]},
                {"$set": {"text": update["name"]}},
            )
    return {"id": iid, **update}


class StockShoppingIn(BaseModel):
    needs: bool


@api.post("/stock/items/{iid}/shopping")
async def toggle_stock_item_shopping(
    iid: str, body: StockShoppingIn, user: dict = Depends(get_current_user)
):
    item = await db.stock_items.find_one({"id": iid, "user_id": user["id"]})
    if not item:
        raise HTTPException(404, "Not found")
    existing_id = item.get("shopping_item_id")
    if body.needs:
        if existing_id:
            existing = await db.shopping.find_one({"id": existing_id, "user_id": user["id"]}, {"_id": 0, "user_id": 0})
            if existing:
                return {"item_id": iid, "shopping_item_id": existing_id, "shopping_item": existing}
        sid = str(uuid.uuid4())
        shopping_doc = {
            "id": sid,
            "user_id": user["id"],
            "text": item["name"],
            "bought": False,
            "source_stock_id": iid,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.shopping.insert_one(shopping_doc)
        await db.stock_items.update_one(
            {"id": iid, "user_id": user["id"]}, {"$set": {"shopping_item_id": sid}}
        )
        return {
            "item_id": iid,
            "shopping_item_id": sid,
            "shopping_item": {k: v for k, v in shopping_doc.items() if k not in ("_id", "user_id")},
        }
    # needs=false → remove linked shopping entry
    if existing_id:
        await db.shopping.delete_one({"id": existing_id, "user_id": user["id"]})
        await db.stock_items.update_one(
            {"id": iid, "user_id": user["id"]}, {"$set": {"shopping_item_id": None}}
        )
    return {"item_id": iid, "shopping_item_id": None}



@api.delete("/stock/items/{iid}")
async def delete_stock_item(iid: str, user: dict = Depends(require_manager)):
    item = await db.stock_items.find_one({"id": iid, "user_id": user["id"]}, {"_id": 0, "shopping_item_id": 1})
    if item and item.get("shopping_item_id"):
        await db.shopping.delete_one({"id": item["shopping_item_id"], "user_id": user["id"]})
    r = await db.stock_items.delete_one({"id": iid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.get("/shopping")
async def list_shopping(user: dict = Depends(get_current_user)):
    docs = await db.shopping.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("created_at", 1).to_list(1000)
    return docs


@api.post("/shopping/reset")
async def reset_shopping(user: dict = Depends(get_current_user)):
    """Wipe entire shopping list and clear shopping_item_id on all stock items."""
    result = await db.shopping.delete_many({"user_id": user["id"]})
    await db.stock_items.update_many(
        {"user_id": user["id"], "shopping_item_id": {"$ne": None}},
        {"$set": {"shopping_item_id": None}},
    )
    return {"ok": True, "deleted": result.deleted_count}


@api.post("/shopping")
async def add_shopping(body: ShoppingItemIn, user: dict = Depends(require_manager)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "text": body.text.strip(),
        "bought": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.shopping.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


class ShoppingUpdateIn(BaseModel):
    text: Optional[str] = None
    bought: Optional[bool] = None


@api.put("/shopping/{sid}")
async def update_shopping(sid: str, body: ShoppingUpdateIn, user: dict = Depends(require_manager)):
    update = {}
    if body.text is not None:
        update["text"] = body.text.strip()
    if body.bought is not None:
        update["bought"] = bool(body.bought)
    if not update:
        raise HTTPException(400, "Nothing to update")
    r = await db.shopping.update_one({"id": sid, "user_id": user["id"]}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": sid, **update}


@api.delete("/shopping/{sid}")
async def delete_shopping(sid: str, user: dict = Depends(require_manager)):
    r = await db.shopping.delete_one({"id": sid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    # if this shopping entry was linked from a stock item, clear the link
    await db.stock_items.update_many(
        {"user_id": user["id"], "shopping_item_id": sid},
        {"$set": {"shopping_item_id": None}},
    )
    return {"ok": True}


# ============ EMPLOYEES ============
class EmployeeIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)


@api.get("/employees")
async def list_employees(user: dict = Depends(get_current_user)):
    docs = await db.employees.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("order", 1).to_list(500)
    return docs


@api.post("/employees")
async def create_employee(body: EmployeeIn, user: dict = Depends(require_manager)):
    count = await db.employees.count_documents({"user_id": user["id"]})
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": body.name.strip(),
        "order": count,
    }
    await db.employees.insert_one(doc)
    return {"id": doc["id"], "name": doc["name"], "order": doc["order"]}


@api.put("/employees/{eid}")
async def update_employee(eid: str, body: EmployeeIn, user: dict = Depends(require_manager)):
    r = await db.employees.update_one(
        {"id": eid, "user_id": user["id"]},
        {"$set": {"name": body.name.strip()}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": eid, "name": body.name.strip()}


@api.delete("/employees/{eid}")
async def delete_employee(eid: str, user: dict = Depends(require_manager)):
    await db.shifts.delete_many({"user_id": user["id"], "employee_id": eid})
    r = await db.employees.delete_one({"id": eid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ============ SHIFTS ============
class ShiftIn(BaseModel):
    employee_id: str
    week_start: str  # YYYY-MM-DD (Monday)
    day: int = Field(ge=0, le=6)  # 0=Mon .. 6=Sun
    start: str  # HH:MM
    end: str    # HH:MM


@api.get("/shifts")
async def list_shifts(week_start: str, user: dict = Depends(get_current_user)):
    docs = await db.shifts.find(
        {"user_id": user["id"], "week_start": week_start},
        {"_id": 0, "user_id": 0},
    ).to_list(1000)
    return docs


@api.put("/shifts")
async def upsert_shift(body: ShiftIn, user: dict = Depends(require_manager)):
    # ensure employee belongs to this user
    emp = await db.employees.find_one({"id": body.employee_id, "user_id": user["id"]})
    if not emp:
        raise HTTPException(404, "Employee not found")
    key = {
        "user_id": user["id"],
        "employee_id": body.employee_id,
        "week_start": body.week_start,
        "day": body.day,
    }
    update = {
        "$set": {"start": body.start.strip(), "end": body.end.strip()},
        "$setOnInsert": {"id": str(uuid.uuid4()), **key},
    }
    await db.shifts.update_one(key, update, upsert=True)
    doc = await db.shifts.find_one(key, {"_id": 0, "user_id": 0})
    return doc


@api.delete("/shifts")
async def delete_shift(
    employee_id: str,
    week_start: str,
    day: int,
    user: dict = Depends(require_manager),
):
    r = await db.shifts.delete_one({
        "user_id": user["id"],
        "employee_id": employee_id,
        "week_start": week_start,
        "day": day,
    })
    return {"ok": True, "deleted": r.deleted_count}


# ============ EXPENSES ============
DEFAULT_EXPENSE_CATEGORIES = [
    "Προμηθευτές",
    "Μισθοδοσία",
    "Ενοίκιο",
    "Λογαριασμοί (ΔΕΗ/νερό/ίντερνετ)",
    "Εξοπλισμός",
    "Συσκευασίες",
    "Λοιπά",
]


class ExpenseCategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    order: int = 0


class ExpenseIn(BaseModel):
    amount: float = Field(gt=0)
    description: str = Field(default="", max_length=300)
    category_id: Optional[str] = None
    date: str  # YYYY-MM-DD


def validate_expense_date(s: str):
    try:
        datetime.strptime(s, "%Y-%m-%d")
    except (ValueError, TypeError):
        raise HTTPException(422, "Μη έγκυρη ημερομηνία (μορφή YYYY-MM-DD)")


async def ensure_expense_categories(user_id: str):
    """Seed the default expense categories the first time an account uses expenses."""
    count = await db.expense_categories.count_documents({"user_id": user_id})
    if count == 0:
        docs = [
            {"id": str(uuid.uuid4())[:8], "user_id": user_id, "name": n, "order": i}
            for i, n in enumerate(DEFAULT_EXPENSE_CATEGORIES)
        ]
        await db.expense_categories.insert_many(docs)


@api.get("/expenses/categories")
async def list_expense_categories(user: dict = Depends(require_owner)):
    await ensure_expense_categories(user["id"])
    return await db.expense_categories.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("order", 1).to_list(500)


@api.post("/expenses/categories")
async def create_expense_category(body: ExpenseCategoryIn, user: dict = Depends(require_owner)):
    count = await db.expense_categories.count_documents({"user_id": user["id"]})
    doc = {
        "id": str(uuid.uuid4())[:8],
        "user_id": user["id"],
        "name": body.name.strip(),
        "order": body.order if body.order else count,
    }
    await db.expense_categories.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@api.put("/expenses/categories/{cid}")
async def update_expense_category(cid: str, body: ExpenseCategoryIn, user: dict = Depends(require_owner)):
    r = await db.expense_categories.update_one(
        {"id": cid, "user_id": user["id"]},
        {"$set": {"name": body.name.strip(), "order": body.order}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": cid, "name": body.name.strip(), "order": body.order}


@api.delete("/expenses/categories/{cid}")
async def delete_expense_category(cid: str, user: dict = Depends(require_owner)):
    r = await db.expense_categories.delete_one({"id": cid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    # expenses in this category become uncategorized
    await db.expenses.update_many(
        {"user_id": user["id"], "category_id": cid},
        {"$set": {"category_id": None}},
    )
    return {"ok": True}


@api.get("/expenses")
async def list_expenses(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    category_id: Optional[str] = None,
    user: dict = Depends(require_owner),
):
    query = {"user_id": user["id"]}
    rng = {}
    if date_from:
        rng["$gte"] = date_from
    if date_to:
        rng["$lte"] = date_to
    if rng:
        query["date"] = rng
    if category_id:
        query["category_id"] = category_id
    docs = await db.expenses.find(
        query, {"_id": 0, "user_id": 0}
    ).sort([("date", -1), ("created_at", -1)]).to_list(5000)
    return docs


@api.post("/expenses")
async def create_expense(body: ExpenseIn, user: dict = Depends(require_owner)):
    validate_expense_date(body.date)
    if body.category_id:
        cat = await db.expense_categories.find_one(
            {"id": body.category_id, "user_id": user["id"]}
        )
        if not cat:
            raise HTTPException(404, "Η κατηγορία δεν βρέθηκε")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "amount": round(float(body.amount), 2),
        "description": body.description.strip(),
        "category_id": body.category_id,
        "date": body.date,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.expenses.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@api.put("/expenses/{eid}")
async def update_expense(eid: str, body: ExpenseIn, user: dict = Depends(require_owner)):
    validate_expense_date(body.date)
    if body.category_id:
        cat = await db.expense_categories.find_one(
            {"id": body.category_id, "user_id": user["id"]}
        )
        if not cat:
            raise HTTPException(404, "Η κατηγορία δεν βρέθηκε")
    update = {
        "amount": round(float(body.amount), 2),
        "description": body.description.strip(),
        "category_id": body.category_id,
        "date": body.date,
    }
    r = await db.expenses.update_one(
        {"id": eid, "user_id": user["id"]}, {"$set": update}
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": eid, **update}


@api.delete("/expenses/{eid}")
async def delete_expense(eid: str, user: dict = Depends(require_owner)):
    r = await db.expenses.delete_one({"id": eid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ============ DAY CLOSE (Z-REPORT) ============
async def compute_day_summary(user_id: str, day: str) -> dict:
    """Aggregate a single day's orders + expenses into a Z-report summary."""
    docs = await db.orders.find(
        {
            "user_id": user_id,
            "created_at": {"$gte": f"{day}T00:00:00+00:00", "$lte": f"{day}T23:59:59+00:00"},
        },
        {"_id": 0},
    ).to_list(50000)

    counted = [
        d for d in docs
        if not d.get("cancelled") and d.get("status") != "scheduled"
    ]
    cancelled_count = sum(1 for d in docs if d.get("cancelled"))
    scheduled_pending = sum(
        1 for d in docs if d.get("status") == "scheduled" and not d.get("cancelled")
    )

    by_source = defaultdict(lambda: {"count": 0, "revenue": 0.0})
    by_type = defaultdict(lambda: {"count": 0, "revenue": 0.0})
    total_discounts = 0.0
    for d in counted:
        src = d.get("source", "Ταμείο")
        by_source[src]["count"] += 1
        by_source[src]["revenue"] += d.get("total", 0)
        dt_key = (d.get("delivery") or {}).get("delivery_type") or "store"
        by_type[dt_key]["count"] += 1
        by_type[dt_key]["revenue"] += d.get("total", 0)
        disc = d.get("discount") or {}
        total_discounts += disc.get("amount", 0) or 0

    exp_docs = await db.expenses.find(
        {"user_id": user_id, "date": day}, {"_id": 0, "amount": 1}
    ).to_list(50000)
    total_expenses = round(sum(e.get("amount", 0) for e in exp_docs), 2)
    total_revenue = round(sum(d.get("total", 0) for d in counted), 2)

    return {
        "date": day,
        "total_orders": len(counted),
        "total_revenue": total_revenue,
        "by_source": [
            {"source": s, "count": v["count"], "revenue": round(v["revenue"], 2)}
            for s, v in by_source.items()
        ],
        "by_type": [
            {"type": t, "count": v["count"], "revenue": round(v["revenue"], 2)}
            for t, v in by_type.items()
        ],
        "total_discounts": round(total_discounts, 2),
        "cancelled_count": cancelled_count,
        "scheduled_pending": scheduled_pending,
        "total_expenses": total_expenses,
        "net_result": round(total_revenue - total_expenses, 2),
    }


@api.get("/reports/day-summary")
async def day_summary(date: Optional[str] = None, user: dict = Depends(get_current_user)):
    day = date or datetime.now(timezone.utc).date().isoformat()
    return await compute_day_summary(user["id"], day)


class DayCloseIn(BaseModel):
    date: Optional[str] = None


@api.post("/reports/day-close")
async def close_day(body: Optional[DayCloseIn] = None, user: dict = Depends(get_current_user)):
    day = (body.date if body and body.date else None) or datetime.now(timezone.utc).date().isoformat()
    summary = await compute_day_summary(user["id"], day)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "closed_at": datetime.now(timezone.utc).isoformat(),
        "closed_by": user.get("profile"),
        **summary,
    }
    await db.day_reports.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@api.get("/reports/day")
async def list_day_reports(user: dict = Depends(require_manager)):
    return await db.day_reports.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("closed_at", -1).to_list(365)


# ============ TABLES (dine-in tabs) ============
class TableIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    order: int = 0


class TablesToggleIn(BaseModel):
    enabled: bool


class TablesReorderIn(BaseModel):
    ids: List[str] = Field(min_length=1)


class TabRoundIn(BaseModel):
    items: List[OrderItem] = Field(min_length=1)


class TabTransferIn(BaseModel):
    table_id: str


def tab_total(tab: dict) -> float:
    return round(
        sum(
            it.get("line_total", 0)
            for r in tab.get("rounds", [])
            for it in r.get("items", [])
        ),
        2,
    )


class BusinessTypeIn(BaseModel):
    business_type: Literal["souvlaki", "cafe", "pizzeria", "burger"]


@api.put("/settings/business")
async def update_business_type(body: BusinessTypeIn, user: dict = Depends(require_owner)):
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"business_type": body.business_type}}
    )
    return {"business_type": body.business_type}


@api.put("/settings/tables")
async def toggle_tables(body: TablesToggleIn, user: dict = Depends(require_owner)):
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"tables_enabled": bool(body.enabled)}}
    )
    return {"enabled": bool(body.enabled)}


@api.get("/tables/state")
async def tables_state(user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "tables_enabled": 1})
    enabled = bool(u.get("tables_enabled", False)) if u else False
    tables = await db.tables.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("order", 1).to_list(200)
    tabs = await db.table_tabs.find(
        {"user_id": user["id"], "status": "open"}, {"_id": 0, "user_id": 0}
    ).to_list(200)
    by_table = {}
    for t in tabs:
        by_table[t["table_id"]] = {
            "tab_id": t["id"],
            "total": tab_total(t),
            "rounds_count": len(t.get("rounds", [])),
            "opened_at": t.get("opened_at"),
        }
    for tbl in tables:
        tbl["tab"] = by_table.get(tbl["id"])
    return {"enabled": enabled, "tables": tables}


@api.post("/tables")
async def create_table(body: TableIn, user: dict = Depends(require_manager)):
    count = await db.tables.count_documents({"user_id": user["id"]})
    doc = {
        "id": str(uuid.uuid4())[:8],
        "user_id": user["id"],
        "name": body.name.strip(),
        "order": body.order if body.order else count,
    }
    await db.tables.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@api.post("/tables/reorder")
async def reorder_tables(body: TablesReorderIn, user: dict = Depends(require_manager)):
    for idx, tid in enumerate(body.ids):
        await db.tables.update_one(
            {"id": tid, "user_id": user["id"]}, {"$set": {"order": idx}}
        )
    return {"ok": True}


@api.put("/tables/{tid}")
async def update_table(tid: str, body: TableIn, user: dict = Depends(require_manager)):
    r = await db.tables.update_one(
        {"id": tid, "user_id": user["id"]},
        {"$set": {"name": body.name.strip(), "order": body.order}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": tid, "name": body.name.strip(), "order": body.order}


@api.delete("/tables/{tid}")
async def delete_table(tid: str, user: dict = Depends(require_manager)):
    open_tab = await db.table_tabs.find_one(
        {"user_id": user["id"], "table_id": tid, "status": "open"}
    )
    if open_tab:
        raise HTTPException(400, "Το τραπέζι έχει ανοιχτή καρτέλα — κλείστε την πρώτα")
    r = await db.tables.delete_one({"id": tid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.get("/tables/{tid}/tab")
async def get_table_tab(tid: str, user: dict = Depends(get_current_user)):
    table = await db.tables.find_one(
        {"id": tid, "user_id": user["id"]}, {"_id": 0, "user_id": 0}
    )
    if not table:
        raise HTTPException(404, "Το τραπέζι δεν βρέθηκε")
    tab = await db.table_tabs.find_one(
        {"user_id": user["id"], "table_id": tid, "status": "open"},
        {"_id": 0, "user_id": 0},
    )
    if tab:
        tab["total"] = tab_total(tab)
    return {"table": table, "tab": tab}


@api.post("/tables/{tid}/rounds")
async def send_round(tid: str, body: TabRoundIn, user: dict = Depends(get_current_user)):
    """Αποστολή: append a round to the table's open tab (create the tab if needed)."""
    table = await db.tables.find_one({"id": tid, "user_id": user["id"]})
    if not table:
        raise HTTPException(404, "Το τραπέζι δεν βρέθηκε")
    now = datetime.now(timezone.utc).isoformat()
    tab = await db.table_tabs.find_one(
        {"user_id": user["id"], "table_id": tid, "status": "open"}
    )
    if not tab:
        tab = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "table_id": tid,
            "status": "open",
            "opened_at": now,
            "opened_by": {"name": actor_name(user), "role": user.get("role")},
            "rounds": [],
        }
        await db.table_tabs.insert_one(tab)
    round_doc = {
        "round_no": len(tab.get("rounds", [])) + 1,
        "items": [it.model_dump() for it in body.items],
        "sent_at": now,
        "sent_by": {"name": actor_name(user), "role": user.get("role")},
    }
    await db.table_tabs.update_one(
        {"id": tab["id"], "user_id": user["id"]}, {"$push": {"rounds": round_doc}}
    )
    fresh = await db.table_tabs.find_one(
        {"id": tab["id"], "user_id": user["id"]}, {"_id": 0, "user_id": 0}
    )
    fresh["total"] = tab_total(fresh)
    return {"tab": fresh, "round": round_doc, "table": {"id": table["id"], "name": table["name"]}}


@api.post("/tabs/{tab_id}/close", response_model=Order)
async def close_tab(tab_id: str, user: dict = Depends(get_current_user)):
    """Κλείσιμο τραπεζιού: turn the tab into a normal completed order and free the table."""
    tab = await db.table_tabs.find_one(
        {"id": tab_id, "user_id": user["id"], "status": "open"}
    )
    if not tab:
        raise HTTPException(404, "Η καρτέλα δεν βρέθηκε")
    table = await db.tables.find_one({"id": tab["table_id"], "user_id": user["id"]})
    table_name = table["name"] if table else "Τραπέζι"
    items = [it for r in tab.get("rounds", []) for it in r.get("items", [])]
    if not items:
        raise HTTPException(400, "Η καρτέλα είναι άδεια")
    total = tab_total(tab)
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "order_number": await compute_next_order_number(user["id"]),
        "items": items,
        "subtotal": total,
        "total": total,
        "source": "Τραπέζι",
        "table_name": table_name,
        "note": None,
        "delivery": None,
        "scheduled_at": None,
        "discount": None,
        "created_at": now.isoformat(),
        "status": "active",
        "taken_by": {
            "profile_id": user.get("profile_id"),
            "name": actor_name(user),
            "role": user.get("role"),
        },
    }
    await db.orders.insert_one(doc)
    await db.table_tabs.delete_one({"id": tab_id, "user_id": user["id"]})
    doc.pop("_id", None)
    doc["created_at"] = now
    return doc


@api.post("/tabs/{tab_id}/transfer")
async def transfer_tab(tab_id: str, body: TabTransferIn, user: dict = Depends(get_current_user)):
    tab = await db.table_tabs.find_one(
        {"id": tab_id, "user_id": user["id"], "status": "open"}
    )
    if not tab:
        raise HTTPException(404, "Η καρτέλα δεν βρέθηκε")
    target = await db.tables.find_one({"id": body.table_id, "user_id": user["id"]})
    if not target:
        raise HTTPException(404, "Το τραπέζι δεν βρέθηκε")
    occupied = await db.table_tabs.find_one(
        {"user_id": user["id"], "table_id": body.table_id, "status": "open"}
    )
    if occupied:
        raise HTTPException(400, "Το τραπέζι προορισμού έχει ήδη ανοιχτή καρτέλα")
    await db.table_tabs.update_one(
        {"id": tab_id, "user_id": user["id"]}, {"$set": {"table_id": body.table_id}}
    )
    return {"ok": True, "table_id": body.table_id, "table_name": target["name"]}


# ============ APP SETUP ============
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.categories.create_index([("user_id", 1)])
    await db.items.create_index([("user_id", 1)])
    await db.orders.create_index([("user_id", 1), ("created_at", -1)])
    await db.shopping.create_index([("user_id", 1), ("created_at", 1)])
    await db.stock_categories.create_index([("user_id", 1), ("order", 1)])
    await db.stock_items.create_index([("user_id", 1), ("category_id", 1)])
    await db.photos.create_index([("user_id", 1), ("created_at", -1)])
    await db.employees.create_index([("user_id", 1), ("order", 1)])
    await db.shifts.create_index([("user_id", 1), ("week_start", 1)])
    await db.shifts.create_index(
        [("user_id", 1), ("employee_id", 1), ("week_start", 1), ("day", 1)],
        unique=True,
    )
    await db.expense_categories.create_index([("user_id", 1), ("order", 1)])
    await db.expenses.create_index([("user_id", 1), ("date", -1)])
    await db.day_reports.create_index([("user_id", 1), ("closed_at", -1)])
    await db.profiles.create_index([("user_id", 1), ("created_at", 1)])
    await db.tables.create_index([("user_id", 1), ("order", 1)])
    await db.table_tabs.create_index([("user_id", 1), ("table_id", 1), ("status", 1)])
    await ensure_demo_account()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
