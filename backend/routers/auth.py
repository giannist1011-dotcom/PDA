"""Auth: register/login, προφίλ, επιλογή προφίλ με PIN, owner-PIN gate, demo mode."""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field, EmailStr

from core import (
    db,
    hash_password,
    verify_password,
    create_token,
    get_current_user,
    require_manager,
    public_user,
    ensure_profiles_migrated,
    check_owner_pin,
    seed_account_from_preset,
    cleanup_expired_demos,
    DEMO_TTL_HOURS,
)
from presets import PRESETS
from routers.promo import redeem_promo, promo_description, require_admin

router = APIRouter()


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
    promo_code: Optional[str] = Field(default=None, max_length=40)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class DemoIn(BaseModel):
    email: EmailStr
    business_name: str = Field(min_length=1, max_length=80)
    business_type: Literal["souvlaki", "cafe", "pizzeria", "burger"] = "souvlaki"


class TokenOut(BaseModel):
    token: str
    user: dict


# ============ AUTH ROUTES ============
@router.post("/auth/register", response_model=TokenOut)
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
    # Εκπτωτικός κωδικός: validate + ατομική δέσμευση χρήσης πριν δημιουργηθεί ο λογαριασμός
    promo = None
    billing_note = ""
    if body.promo_code and body.promo_code.strip():
        claimed = await redeem_promo(body.promo_code)
        promo = {
            "code": claimed["code"],
            "type": claimed["type"],
            "value": claimed["value"],
            "duration": claimed["duration"],
            "applied_at": now,
        }
        billing_note = f"Κωδικός {claimed['code']}: {promo_description(claimed)}"
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
        "promo": promo,
        "billing_note": billing_note,
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


@router.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Λάθος email ή κωδικός")
    await ensure_profiles_migrated(user["id"])
    token = create_token(user["id"], email)
    return {"token": token, "user": public_user(user)}


# ============ DEMO MODE (per-visitor, auto-expiring, auto-login) ============
@router.post("/auth/demo", response_model=TokenOut)
async def start_demo(body: DemoIn):
    """Δημιουργεί δοκιμαστικό λογαριασμό που λήγει σε 3 ώρες και επιστρέφει JWT
    με ήδη επιλεγμένο προφίλ Ιδιοκτήτη → ο επισκέπτης μπαίνει κατευθείαν, χωρίς login/PIN."""
    # Ευκαιριακό καθάρισμα τυχόν ληγμένων demo (best-effort — δεν μπλοκάρει το request)
    try:
        await cleanup_expired_demos()
    except Exception:  # pragma: no cover
        pass

    preset = PRESETS.get(body.business_type, PRESETS["souvlaki"])
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    expires_iso = (now + timedelta(hours=DEMO_TTL_HOURS)).isoformat()
    uid = str(uuid.uuid4())
    # Συνθετικό μοναδικό email στον χρήστη (unique index) — το πραγματικό μένει στα demo_leads
    account_email = f"demo-{uid}@demo.orderdeck"
    owner_id = str(uuid.uuid4())[:8]
    doc = {
        "id": uid,
        "email": account_email,
        "password_hash": hash_password(uuid.uuid4().hex),  # μη-χρησιμοποιήσιμος κωδικός
        "restaurant_name": body.business_name.strip(),
        "full_name": "",
        "phone": "",
        "city": "",
        "website": "",
        "business_type": body.business_type,
        "tables_enabled": True,
        "customization": preset["customization"],
        "owner_pin_hash": hash_password("0000"),
        "employee_pin_hash": hash_password("0000"),
        "owner_pin_set": False,
        "employee_pin_set": False,
        "is_demo": True,
        "demo_expires_at": expires_iso,
        "created_at": now_iso,
    }
    await db.users.insert_one(doc)
    # Seed μενού + ελλείψεις + default τραπέζια από το preset
    await seed_account_from_preset(uid, preset, has_tables=True)
    # Έτοιμα προφίλ (όλα με PIN 0000 — δεν χρειάζεται αλλαγή σε demo)
    await db.profiles.insert_many([
        {"id": owner_id, "user_id": uid, "name": "Ιδιοκτήτης", "role": "owner",
         "pin_hash": hash_password("0000"), "created_at": now_iso},
        {"id": str(uuid.uuid4())[:8], "user_id": uid, "name": "Υπάλληλος", "role": "employee",
         "pin_hash": hash_password("0000"), "created_at": now_iso},
        {"id": str(uuid.uuid4())[:8], "user_id": uid, "name": "Σερβιτόρος", "role": "waiter",
         "pin_hash": hash_password("0000"), "created_at": now_iso},
    ])
    # Lead capture — ξεχωριστό collection, διατηρείται και μετά τη διαγραφή του demo
    await db.demo_leads.insert_one({
        "id": str(uuid.uuid4()),
        "email": body.email.lower(),
        "business_name": body.business_name.strip(),
        "business_type": body.business_type,
        "created_at": now_iso,
    })
    # Auto-login: token με επιλεγμένο προφίλ Ιδιοκτήτη
    token = create_token(
        uid, account_email, profile_id=owner_id, role="owner", profile_name="Ιδιοκτήτης",
    )
    doc["role"] = "owner"
    doc["profile_id"] = owner_id
    doc["profile_name"] = "Ιδιοκτήτης"
    return {"token": token, "user": public_user(doc)}


@router.post("/admin/demo/cleanup")
async def admin_demo_cleanup(x_admin_password: Optional[str] = Header(None)):
    """Καθαρισμός ληγμένων demo λογαριασμών — καλείται από cron (GitHub Actions) κάθε 30'."""
    require_admin(x_admin_password)
    deleted = await cleanup_expired_demos()
    return {"deleted": deleted}


@router.get("/auth/offline-profiles")
async def offline_profiles(user: dict = Depends(get_current_user)):
    """Λίστα προφίλ για τοπική cache της συσκευής (PWA offline login) — ΧΩΡΙΣ pin hashes.
    Το offline hash του PIN παράγεται client-side (Web Crypto) στην τελευταία online είσοδο."""
    await ensure_profiles_migrated(user["id"])
    docs = await db.profiles.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0, "pin_hash": 0}
    ).sort("created_at", 1).to_list(100)
    return docs


@router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ============ PROFILES (dynamic, per-account) ============
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


@router.get("/profiles")
async def list_profiles(user: dict = Depends(get_current_user)):
    await ensure_profiles_migrated(user["id"])
    docs = await db.profiles.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0, "pin_hash": 0}
    ).sort("created_at", 1).to_list(100)
    return docs


@router.post("/profiles")
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


@router.put("/profiles/{pid}")
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


@router.delete("/profiles/{pid}")
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


@router.post("/profile/select")
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


@router.post("/profile/exit")
async def profile_exit(user: dict = Depends(get_current_user)):
    """Return a token with profile cleared (used for 'Αλλαγή προφίλ')."""
    token = create_token(user["id"], user["email"])
    return {"token": token, "profile": None}


# ============ OWNER PIN GATE (sensitive actions) ============
class PinVerifyIn(BaseModel):
    pin: str = Field(min_length=1, max_length=20)


@router.post("/auth/verify-owner-pin")
async def verify_owner_pin(body: PinVerifyIn, user: dict = Depends(get_current_user)):
    return await check_owner_pin(user["id"], body.pin)
