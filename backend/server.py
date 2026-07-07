"""FastAPI server for Πεινώκιο multi-tenant POS SaaS."""
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
from collections import Counter, defaultdict
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

from seed_data import DEFAULT_CATEGORIES, DEFAULT_CUSTOMIZATION, DEFAULT_ITEMS

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


def create_token(user_id: str, email: str, profile: Optional[str] = None) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "profile": profile,
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
    user["profile"] = payload.get("profile")
    return user


async def require_owner(user: dict = Depends(get_current_user)) -> dict:
    if user.get("profile") != "owner":
        raise HTTPException(403, "Απαιτείται πρόσβαση ιδιοκτήτη")
    return user


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "restaurant_name": u["restaurant_name"],
        "created_at": u.get("created_at"),
        "profile": u.get("profile"),
        "owner_pin_set": bool(u.get("owner_pin_set", False)),
        "employee_pin_set": bool(u.get("employee_pin_set", False)),
    }


# ============ MODELS ============
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4)
    restaurant_name: str = Field(min_length=1, max_length=80)


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


class MenuItem(MenuItemIn):
    id: str


class AvailabilityIn(BaseModel):
    available: bool
    unavailable_note: str = ""


class CustomizationConfig(BaseModel):
    bread_options: List[str]
    extras_options: List[str]
    sauces_options: List[str]
    double_meat_price: float = Field(ge=0)


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


class OrderCreate(BaseModel):
    order_number: int
    items: List[OrderItem]
    subtotal: float
    total: float
    source: Literal["Ταμείο", "Τηλέφωνο", "efood", "Box"]
    note: Optional[str] = None
    delivery: Optional[DeliveryInfo] = None


class Order(OrderCreate):
    id: str
    user_id: str
    created_at: datetime


# ============ SEEDING ============
async def seed_user_menu(user_id: str):
    """Create default categories, customization config and menu items for a user."""
    # customization config on user document already; here we insert items & categories.
    await db.categories.insert_many([
        {"id": c["id"], "name": c["name"], "order": c["order"], "user_id": user_id}
        for c in DEFAULT_CATEGORIES
    ])
    docs = []
    for it in DEFAULT_ITEMS:
        docs.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "name": it["name"],
            "price": float(it["price"]),
            "category": it["category"],
            "customizable": it.get("customizable", False),
            "double_meat_eligible": it.get("double_meat_eligible", False),
            "available": True,
            "unavailable_note": "",
        })
    await db.items.insert_many(docs)


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
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_password(body.password),
        "restaurant_name": body.restaurant_name.strip(),
        "customization": DEFAULT_CUSTOMIZATION,
        "owner_pin_hash": hash_password("0000"),
        "employee_pin_hash": hash_password("0000"),
        "owner_pin_set": False,
        "employee_pin_set": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    # Seed starter menu (Πεινώκιο template) for convenience
    await seed_user_menu(uid)
    token = create_token(uid, email)
    return {"token": token, "user": public_user(doc)}


@api.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Λάθος email ή κωδικός")
    token = create_token(user["id"], email)
    return {"token": token, "user": public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ============ PROFILE / ROLES ============
class ProfileSelectIn(BaseModel):
    profile: Literal["owner", "employee"]
    pin: str = Field(min_length=4, max_length=4)


class ProfilePinIn(BaseModel):
    target: Literal["owner", "employee"]
    new_pin: str = Field(min_length=4, max_length=4)


@api.post("/profile/select")
async def profile_select(body: ProfileSelectIn, user: dict = Depends(get_current_user)):
    if not body.pin.isdigit():
        raise HTTPException(400, "Ο κωδικός πρέπει να είναι 4 ψηφία")
    full = await db.users.find_one({"id": user["id"]})
    pin_field = "owner_pin_hash" if body.profile == "owner" else "employee_pin_hash"
    stored = full.get(pin_field)
    if not stored or not verify_password(body.pin, stored):
        raise HTTPException(401, "Λάθος κωδικός")
    token = create_token(user["id"], user["email"], profile=body.profile)
    return {"token": token, "profile": body.profile}


@api.post("/profile/exit")
async def profile_exit(user: dict = Depends(get_current_user)):
    """Return a token with profile cleared (used for 'Αλλαγή προφίλ')."""
    token = create_token(user["id"], user["email"], profile=None)
    return {"token": token, "profile": None}


@api.put("/profile/pin")
async def change_pin(body: ProfilePinIn, user: dict = Depends(require_owner)):
    if not body.new_pin.isdigit():
        raise HTTPException(400, "Ο κωδικός πρέπει να είναι 4 ψηφία")
    field = "owner_pin_hash" if body.target == "owner" else "employee_pin_hash"
    set_flag = "owner_pin_set" if body.target == "owner" else "employee_pin_set"
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {field: hash_password(body.new_pin), set_flag: True}},
    )
    return {"ok": True, "target": body.target}


# ============ MENU ROUTES ============
@api.get("/menu/config")
async def get_menu_config(user: dict = Depends(get_current_user)):
    cats = await db.categories.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).sort("order", 1).to_list(500)
    items = await db.items.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).to_list(2000)
    # customization from user doc
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "customization": 1})
    return {
        "categories": cats,
        "items": items,
        "customization": u.get("customization") if u else DEFAULT_CUSTOMIZATION,
    }


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    order: int = 0


@api.post("/menu/categories")
async def create_category(body: CategoryIn, user: dict = Depends(require_owner)):
    # generate slug-ish id
    cid = str(uuid.uuid4())[:8]
    doc = {"id": cid, "name": body.name.strip(), "order": body.order, "user_id": user["id"]}
    await db.categories.insert_one(doc)
    return {"id": cid, "name": body.name.strip(), "order": body.order}


@api.put("/menu/categories/{cid}")
async def update_category(cid: str, body: CategoryIn, user: dict = Depends(get_current_user)):
    r = await db.categories.update_one(
        {"id": cid, "user_id": user["id"]},
        {"$set": {"name": body.name.strip(), "order": body.order}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": cid, "name": body.name.strip(), "order": body.order}


@api.delete("/menu/categories/{cid}")
async def delete_category(cid: str, user: dict = Depends(require_owner)):
    await db.items.delete_many({"user_id": user["id"], "category": cid})
    r = await db.categories.delete_one({"id": cid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.post("/menu/items")
async def create_item(body: MenuItemIn, user: dict = Depends(require_owner)):
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
    }
    await db.items.insert_one(doc)
    doc.pop("user_id", None)
    doc.pop("_id", None)
    return doc


@api.put("/menu/items/{iid}")
async def update_item(iid: str, body: MenuItemIn, user: dict = Depends(require_owner)):
    update = {
        "name": body.name.strip(),
        "price": float(body.price),
        "category": body.category,
        "customizable": bool(body.customizable),
        "double_meat_eligible": bool(body.double_meat_eligible),
        "available": bool(body.available),
        "unavailable_note": body.unavailable_note.strip(),
        "option_groups": [g.model_dump() for g in body.option_groups],
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
async def delete_item(iid: str, user: dict = Depends(require_owner)):
    r = await db.items.delete_one({"id": iid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.put("/menu/customization")
async def update_customization(body: CustomizationConfig, user: dict = Depends(require_owner)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"customization": body.model_dump()}},
    )
    return body.model_dump()


# ============ ORDER ROUTES ============
@api.get("/orders/next-number")
async def next_order_number(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    docs = await db.orders.find(
        {
            "user_id": user["id"],
            "created_at": {"$gte": f"{today}T00:00:00+00:00", "$lte": f"{today}T23:59:59+00:00"},
        },
        {"_id": 0, "order_number": 1},
    ).sort("order_number", -1).limit(1).to_list(1)
    next_num = (docs[0]["order_number"] + 1) if docs else 1
    return {"next_order_number": next_num}


@api.post("/orders", response_model=Order)
async def create_order(body: OrderCreate, user: dict = Depends(get_current_user)):
    oid = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    doc = body.model_dump()
    doc.update({
        "id": oid,
        "user_id": user["id"],
        "created_at": now.isoformat(),
    })
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    doc["created_at"] = now
    return doc


@api.get("/orders", response_model=List[Order])
async def list_orders(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
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
    docs = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
    return docs


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
    return {
        "date_from": df,
        "date_to": dt,
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "avg_order_value": avg_order,
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


@api.get("/shopping")
async def list_shopping(user: dict = Depends(require_owner)):
    docs = await db.shopping.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("created_at", 1).to_list(1000)
    return docs


@api.post("/shopping")
async def add_shopping(body: ShoppingItemIn, user: dict = Depends(require_owner)):
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
async def update_shopping(sid: str, body: ShoppingUpdateIn, user: dict = Depends(require_owner)):
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
async def delete_shopping(sid: str, user: dict = Depends(require_owner)):
    r = await db.shopping.delete_one({"id": sid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
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
async def create_employee(body: EmployeeIn, user: dict = Depends(require_owner)):
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
async def update_employee(eid: str, body: EmployeeIn, user: dict = Depends(require_owner)):
    r = await db.employees.update_one(
        {"id": eid, "user_id": user["id"]},
        {"$set": {"name": body.name.strip()}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": eid, "name": body.name.strip()}


@api.delete("/employees/{eid}")
async def delete_employee(eid: str, user: dict = Depends(require_owner)):
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
async def upsert_shift(body: ShiftIn, user: dict = Depends(require_owner)):
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
    user: dict = Depends(require_owner),
):
    r = await db.shifts.delete_one({
        "user_id": user["id"],
        "employee_id": employee_id,
        "week_start": week_start,
        "day": day,
    })
    return {"ok": True, "deleted": r.deleted_count}


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
    await db.employees.create_index([("user_id", 1), ("order", 1)])
    await db.shifts.create_index([("user_id", 1), ("week_start", 1)])
    await db.shifts.create_index(
        [("user_id", 1), ("employee_id", 1), ("week_start", 1), ("day", 1)],
        unique=True,
    )
    await ensure_demo_account()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
