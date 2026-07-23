"""Sub-admin λογαριασμοί («Διαχειριστές») + κοινή admin auth για το admin panel.

Master admin: X-Admin-Password (PROMO_ADMIN_PASSWORD) — όπως πάντα, πλήρη δικαιώματα.
Sub-admin: δημιουργείται ΜΟΝΟ από τον master, συνδέεται από το ΙΔΙΟ /admin gate με
email+password (προσωρινός κωδικός → υποχρεωτική αλλαγή στην πρώτη είσοδο, όπως οι
διανομείς Fleet) → JWT type=admin_access στο header X-Admin-Token.

Scope ανά sub-admin (επιβάλλεται στο backend, όχι μόνο στο UI):
- products: ["orderdeck"] / ["fleet"] / και τα δύο
- cities: μία ή περισσότερες πόλεις (ταιριάζουν με store_city/city, case-insensitive)
- rights: "view" (μόνο ανάγνωση) ή "manage" (ενεργοποίηση/απενεργοποίηση, σημειώσεις,
  resets — ΠΟΤΕ διαγραφές, πλάνα/τιμές, δημιουργία admins ή demos)

Κάθε ενέργεια sub-admin καταγράφεται στο admin_audit (ορατό μόνο στον master).
"""
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

import jwt as pyjwt
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field

from core import JWT_ALG, JWT_SECRET, db, hash_password, rate_limit, verify_password

router = APIRouter()

ADMIN_TOKEN_TTL_HOURS = 12
ADMIN_PRODUCTS = ("orderdeck", "fleet")

# Χωρίς διφορούμενους χαρακτήρες — οι προσωρινοί κωδικοί υπαγορεύονται προφορικά
CRED_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


def _temp_password(n: int = 10) -> str:
    return "".join(secrets.choice(CRED_ALPHABET) for _ in range(n))


# ============ ΚΟΙΝΗ ADMIN AUTH (master password Ή sub-admin token) ============
async def get_admin_ctx(
    x_admin_password: Optional[str] = Header(None),
    x_admin_token: Optional[str] = Header(None),
) -> dict:
    """Dependency για admin endpoints: δέχεται master password ή sub-admin JWT.

    Επιστρέφει ctx με is_master + scope. Τα endpoints καλούν require_product /
    require_manage / check_city για την επιβολή του scope (403 εκτός ορίων).
    """
    if x_admin_password:
        expected = os.environ.get("PROMO_ADMIN_PASSWORD", "")
        if not expected:
            raise HTTPException(503, "Το admin password δεν έχει ρυθμιστεί στον server")
        if not secrets.compare_digest(x_admin_password, expected):
            raise HTTPException(401, "Λάθος κωδικός διαχειριστή")
        return {
            "is_master": True, "id": "platform_admin", "name": "Master admin",
            "email": "", "products": list(ADMIN_PRODUCTS), "cities": [],
            "rights": "manage", "must_change_password": False,
        }
    if x_admin_token:
        try:
            payload = pyjwt.decode(x_admin_token, JWT_SECRET, algorithms=[JWT_ALG])
        except pyjwt.ExpiredSignatureError:
            raise HTTPException(401, "Η σύνδεση διαχειριστή έληξε — συνδεθείτε ξανά")
        except pyjwt.InvalidTokenError:
            raise HTTPException(401, "Μη έγκυρη σύνδεση διαχειριστή")
        if payload.get("type") != "admin_access":
            raise HTTPException(401, "Μη έγκυρη σύνδεση διαχειριστή")
        a = await db.admin_users.find_one({"id": payload.get("sub")})
        if not a:
            raise HTTPException(401, "Ο λογαριασμός διαχειριστή δεν βρέθηκε")
        if not a.get("active", True):
            raise HTTPException(403, "Ο λογαριασμός διαχειριστή έχει απενεργοποιηθεί")
        return {
            "is_master": False, "id": a["id"], "name": a.get("name") or "",
            "email": a.get("email") or "", "products": a.get("products") or [],
            "cities": a.get("cities") or [], "rights": a.get("rights") or "view",
            "must_change_password": bool(a.get("must_change_password")),
        }
    raise HTTPException(401, "Απαιτείται σύνδεση διαχειριστή")


def require_master(ctx: dict) -> None:
    if not ctx["is_master"]:
        raise HTTPException(403, "Επιτρέπεται μόνο στον κύριο διαχειριστή")


def require_product(ctx: dict, product: str) -> None:
    if not ctx["is_master"] and product not in ctx["products"]:
        raise HTTPException(403, "Το προϊόν αυτό είναι εκτός των αρμοδιοτήτων σας")


def require_manage(ctx: dict) -> None:
    if not ctx["is_master"] and ctx["rights"] != "manage":
        raise HTTPException(403, "Ο λογαριασμός σας έχει δικαιώματα μόνο προβολής")


def scope_city_match(ctx: dict) -> dict:
    """Επιπλέον Mongo filter για λίστες: μόνο λογαριασμοί στις πόλεις του scope."""
    if ctx["is_master"] or not ctx["cities"]:
        return {}
    rx = [re.compile(rf"^\s*{re.escape(c.strip())}\s*$", re.IGNORECASE) for c in ctx["cities"]]
    return {"$or": [{"store_city": {"$in": rx}}, {"city": {"$in": rx}}]}


def check_city(ctx: dict, u: dict) -> None:
    """403 αν ο συγκεκριμένος λογαριασμός είναι εκτός των πόλεων του scope."""
    if ctx["is_master"] or not ctx["cities"]:
        return
    city = (u.get("store_city") or u.get("city") or "").strip().lower()
    if city not in {c.strip().lower() for c in ctx["cities"]}:
        raise HTTPException(403, "Ο λογαριασμός είναι εκτός της περιοχής ευθύνης σας")


async def audit_subadmin(ctx: dict, action: str, target_id: str = "",
                         target_name: str = "", details: str = "") -> None:
    """Καταγραφή ενέργειας sub-admin (ποιος/τι/πότε) — ορατή μόνο στον master."""
    if ctx["is_master"]:
        return
    await db.admin_audit.insert_one({
        "id": str(uuid.uuid4()),
        "action": action,
        "admin_id": ctx["id"],
        "admin_name": ctx["name"],
        "user_id": target_id,
        "restaurant_name": target_name,
        "details": details,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ============ SUB-ADMIN LOGIN (ίδιο /admin gate με τον master) ============
class AdminLoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


@router.post("/admin/auth/login")
async def admin_sub_login(body: AdminLoginIn, request: Request):
    rate_limit(request, "admin_login", 10, 300)
    a = await db.admin_users.find_one({"email": body.email.lower().strip()})
    if not a or not verify_password(body.password, a.get("password_hash", "")):
        raise HTTPException(401, "Λάθος email ή κωδικός")
    if not a.get("active", True):
        raise HTTPException(403, "Ο λογαριασμός διαχειριστή έχει απενεργοποιηθεί")
    await db.admin_users.update_one(
        {"id": a["id"]}, {"$set": {"last_login_at": datetime.now(timezone.utc).isoformat()}}
    )
    token = pyjwt.encode(
        {
            "sub": a["id"],
            "type": "admin_access",
            "exp": datetime.now(timezone.utc) + timedelta(hours=ADMIN_TOKEN_TTL_HOURS),
        },
        JWT_SECRET,
        algorithm=JWT_ALG,
    )
    return {
        "token": token,
        "is_master": False,
        "name": a.get("name") or "",
        "email": a["email"],
        "products": a.get("products") or [],
        "cities": a.get("cities") or [],
        "rights": a.get("rights") or "view",
        "must_change_password": bool(a.get("must_change_password")),
    }


class AdminChangePasswordIn(BaseModel):
    password: str = Field(min_length=8, max_length=200)


@router.post("/admin/auth/change-password")
async def admin_sub_change_password(
    body: AdminChangePasswordIn, ctx: dict = Depends(get_admin_ctx)
):
    """Αλλαγή κωδικού sub-admin — υποχρεωτική μετά από προσωρινό κωδικό."""
    if ctx["is_master"]:
        raise HTTPException(400, "Ο master admin δεν έχει λογαριασμό με κωδικό εδώ")
    await db.admin_users.update_one(
        {"id": ctx["id"]},
        {"$set": {"password_hash": hash_password(body.password), "must_change_password": False}},
    )
    return {"ok": True}


# ============ ΔΙΑΧΕΙΡΙΣΤΕΣ — CRUD (ΜΟΝΟ master) ============
ADMIN_FIELDS = {
    "_id": 0, "id": 1, "name": 1, "email": 1, "products": 1, "cities": 1,
    "rights": 1, "active": 1, "must_change_password": 1,
    "last_login_at": 1, "created_at": 1,
}


class AdminCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    products: List[Literal["orderdeck", "fleet"]] = Field(min_length=1)
    cities: List[str] = Field(min_length=1)
    rights: Literal["view", "manage"] = "view"


def _clean_cities(cities: List[str]) -> List[str]:
    out = [c.strip() for c in cities if c.strip()]
    if not out:
        raise HTTPException(400, "Απαιτείται τουλάχιστον μία πόλη")
    return out


@router.get("/admin/admins")
async def admin_list_admins(ctx: dict = Depends(get_admin_ctx)):
    require_master(ctx)
    return await db.admin_users.find({}, ADMIN_FIELDS).sort("created_at", 1).to_list(200)


@router.post("/admin/admins")
async def admin_create_admin(body: AdminCreateIn, ctx: dict = Depends(get_admin_ctx)):
    """Νέος sub-admin: προσωρινός κωδικός (επιστρέφεται ΜΙΑ φορά — αποθηκεύεται hash),
    υποχρεωτική αλλαγή στην πρώτη είσοδο."""
    require_master(ctx)
    email = body.email.lower().strip()
    if await db.admin_users.find_one({"email": email}, {"_id": 1}):
        raise HTTPException(400, "Υπάρχει ήδη διαχειριστής με αυτό το email")
    password = _temp_password()
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "email": email,
        "password_hash": hash_password(password),
        "must_change_password": True,
        "products": sorted(set(body.products)),
        "cities": _clean_cities(body.cities),
        "rights": body.rights,
        "active": True,
        "last_login_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.admin_users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return {**doc, "password": password}


class AdminUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    products: Optional[List[Literal["orderdeck", "fleet"]]] = Field(default=None, min_length=1)
    cities: Optional[List[str]] = Field(default=None, min_length=1)
    rights: Optional[Literal["view", "manage"]] = None
    active: Optional[bool] = None


@router.put("/admin/admins/{aid}")
async def admin_update_admin(aid: str, body: AdminUpdateIn, ctx: dict = Depends(get_admin_ctx)):
    require_master(ctx)
    update = body.model_dump(exclude_unset=True)
    if not update:
        raise HTTPException(400, "Δεν δόθηκαν αλλαγές")
    if "name" in update:
        update["name"] = update["name"].strip()
    if "products" in update:
        update["products"] = sorted(set(update["products"]))
    if "cities" in update:
        update["cities"] = _clean_cities(update["cities"])
    res = await db.admin_users.update_one({"id": aid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Ο διαχειριστής δεν βρέθηκε")
    return {"ok": True, **update}


@router.post("/admin/admins/{aid}/reset-password")
async def admin_reset_admin_password(aid: str, ctx: dict = Depends(get_admin_ctx)):
    """Νέος προσωρινός κωδικός sub-admin — υποχρεωτική αλλαγή στην επόμενη είσοδο."""
    require_master(ctx)
    password = _temp_password()
    res = await db.admin_users.update_one(
        {"id": aid},
        {"$set": {"password_hash": hash_password(password), "must_change_password": True}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Ο διαχειριστής δεν βρέθηκε")
    return {"ok": True, "password": password}


@router.delete("/admin/admins/{aid}")
async def admin_delete_admin(aid: str, ctx: dict = Depends(get_admin_ctx)):
    require_master(ctx)
    res = await db.admin_users.delete_one({"id": aid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Ο διαχειριστής δεν βρέθηκε")
    return {"ok": True}


# ============ AUDIT LOG (ΜΟΝΟ master) ============
@router.get("/admin/audit")
async def admin_audit_list(
    ctx: dict = Depends(get_admin_ctx),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    require_master(ctx)
    total = await db.admin_audit.count_documents({})
    entries = await db.admin_audit.find({}, {"_id": 0}).sort("created_at", -1) \
        .skip((page - 1) * limit).to_list(limit)
    return {"total": total, "page": page, "limit": limit, "entries": entries}
