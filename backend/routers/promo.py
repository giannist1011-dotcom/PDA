"""Εκπτωτικοί κωδικοί (promo codes).

Admin endpoints: προστατεύονται με ξεχωριστό admin password από το env
(PROMO_ADMIN_PASSWORD) — ΔΕΝ σχετίζονται με τους λογαριασμούς μαγαζιών.
Public endpoint: validation κωδικού για το wizard εγγραφής.
"""
import os
import secrets
import string
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

from core import db

router = APIRouter()

DURATION_LABELS = {
    "one_time": "εφάπαξ",
    "1_month": "για 1 μήνα",
    "3_months": "για 3 μήνες",
    "6_months": "για 6 μήνες",
    "12_months": "για 12 μήνες",
    "lifetime": "μόνιμα",
}


def _fmt_eur(v: float) -> str:
    return f"{v:.2f}".replace(".", ",")


def promo_description(p: dict) -> str:
    """Ανθρώπινη περιγραφή της έκπτωσης στα ελληνικά (για wizard + billing_note)."""
    t, v = p["type"], p["value"]
    dur = DURATION_LABELS.get(p.get("duration", ""), "")
    if t == "percentage":
        return f"Έκπτωση {v:g}% {dur}".strip()
    if t == "fixed":
        return f"Έκπτωση {_fmt_eur(v)} € {dur}".strip()
    if t == "free_months":
        months = int(v)
        return f"{months} δωρεάν {'μήνας' if months == 1 else 'μήνες'}"
    if t == "lifetime_discount":
        return f"Μόνιμη έκπτωση {v:g}%"
    return ""


# ============ ADMIN AUTH (ξεχωριστό password, όχι λογαριασμοί μαγαζιών) ============
def require_admin(x_admin_password: Optional[str] = Header(None)) -> None:
    expected = os.environ.get("PROMO_ADMIN_PASSWORD", "")
    if not expected:
        raise HTTPException(503, "Το admin password δεν έχει ρυθμιστεί στον server")
    if not x_admin_password or not secrets.compare_digest(x_admin_password, expected):
        raise HTTPException(401, "Λάθος κωδικός διαχειριστή")


# ============ MODELS ============
class PromoCreateIn(BaseModel):
    code: Optional[str] = Field(default=None, max_length=40)  # κενό → auto-generate
    type: Literal["percentage", "fixed", "free_months", "lifetime_discount"]
    value: float = Field(gt=0)
    duration: Literal["one_time", "1_month", "3_months", "6_months", "12_months", "lifetime"]
    max_uses: Optional[int] = Field(default=None, ge=1)
    expires_at: Optional[str] = None  # ISO date (λήξη του ίδιου του κωδικού)


class PromoToggleIn(BaseModel):
    active: bool


class PromoValidateIn(BaseModel):
    code: str = Field(min_length=1, max_length=40)


def public_promo(p: dict) -> dict:
    return {k: v for k, v in p.items() if k != "_id"}


def _generate_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(8))


def _is_expired(p: dict) -> bool:
    exp = p.get("expires_at")
    if not exp:
        return False
    try:
        exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) > exp_dt
    except ValueError:
        return False


def _uses_exhausted(p: dict) -> bool:
    return p.get("max_uses") is not None and p.get("used_count", 0) >= p["max_uses"]


# ============ ADMIN ROUTES ============
@router.get("/admin/promo")
async def admin_list_promos(x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    codes = await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Πόσα μαγαζιά έχουν χρησιμοποιήσει κάθε κωδικό
    counts = {}
    async for row in db.users.aggregate([
        {"$match": {"promo.code": {"$exists": True}}},
        {"$group": {"_id": "$promo.code", "n": {"$sum": 1}}},
    ]):
        counts[row["_id"]] = row["n"]
    for c in codes:
        c["shops_count"] = counts.get(c["code"], 0)
    return codes


@router.post("/admin/promo")
async def admin_create_promo(body: PromoCreateIn, x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    code = (body.code or "").strip().upper() or _generate_code()
    if not all(ch.isalnum() or ch in "-_" for ch in code):
        raise HTTPException(400, "Ο κωδικός επιτρέπει μόνο γράμματα, αριθμούς, - και _")
    if await db.promo_codes.find_one({"code": code}):
        raise HTTPException(400, "Ο κωδικός υπάρχει ήδη")
    if body.type in ("percentage", "lifetime_discount") and body.value > 100:
        raise HTTPException(400, "Το ποσοστό δεν μπορεί να ξεπερνά το 100%")
    doc = {
        "id": str(uuid.uuid4()),
        "code": code,
        "type": body.type,
        "value": body.value,
        "duration": "lifetime" if body.type == "lifetime_discount" else body.duration,
        "max_uses": body.max_uses,
        "used_count": 0,
        "active": True,
        "expires_at": body.expires_at,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.promo_codes.insert_one(doc)
    return public_promo(doc)


@router.patch("/admin/promo/{pid}")
async def admin_toggle_promo(pid: str, body: PromoToggleIn, x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    res = await db.promo_codes.update_one({"id": pid}, {"$set": {"active": body.active}})
    if res.matched_count == 0:
        raise HTTPException(404, "Ο κωδικός δεν βρέθηκε")
    return {"ok": True, "active": body.active}


@router.delete("/admin/promo/{pid}")
async def admin_delete_promo(pid: str, x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    res = await db.promo_codes.delete_one({"id": pid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Ο κωδικός δεν βρέθηκε")
    return {"ok": True}


@router.get("/admin/promo/{pid}/uses")
async def admin_promo_uses(pid: str, x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    promo = await db.promo_codes.find_one({"id": pid}, {"_id": 0})
    if not promo:
        raise HTTPException(404, "Ο κωδικός δεν βρέθηκε")
    shops = await db.users.find(
        {"promo.code": promo["code"]},
        {"_id": 0, "restaurant_name": 1, "email": 1, "city": 1, "promo.applied_at": 1},
    ).sort("promo.applied_at", -1).to_list(1000)
    return {
        "code": promo["code"],
        "shops": [
            {
                "restaurant_name": s.get("restaurant_name", ""),
                "email": s.get("email", ""),
                "city": s.get("city", ""),
                "applied_at": (s.get("promo") or {}).get("applied_at"),
            }
            for s in shops
        ],
    }


# ============ PUBLIC: VALIDATION ΓΙΑ ΤΟ WIZARD ============
def promo_invalid_reason(p: Optional[dict]) -> Optional[str]:
    """None αν είναι έγκυρος, αλλιώς ελληνικό μήνυμα σφάλματος."""
    if not p:
        return "Ο εκπτωτικός κωδικός δεν βρέθηκε"
    if not p.get("active"):
        return "Ο εκπτωτικός κωδικός δεν είναι ενεργός"
    if _is_expired(p):
        return "Ο εκπτωτικός κωδικός έχει λήξει"
    if _uses_exhausted(p):
        return "Ο εκπτωτικός κωδικός έχει εξαντληθεί"
    return None


@router.post("/promo/validate")
async def validate_promo(body: PromoValidateIn):
    code = body.code.strip().upper()
    p = await db.promo_codes.find_one({"code": code}, {"_id": 0})
    reason = promo_invalid_reason(p)
    if reason:
        raise HTTPException(400, reason)
    return {
        "valid": True,
        "code": p["code"],
        "type": p["type"],
        "value": p["value"],
        "duration": p["duration"],
        "description": promo_description(p),
    }


async def redeem_promo(code: str) -> dict:
    """Ατομική δέσμευση χρήσης κωδικού στο register. Επιστρέφει το promo doc.

    Raise HTTPException με ελληνικό μήνυμα αν δεν είναι πλέον έγκυρος —
    το increment γίνεται ατομικά ώστε να μην ξεπεραστεί το max_uses σε race.
    """
    code = code.strip().upper()
    p = await db.promo_codes.find_one({"code": code}, {"_id": 0})
    reason = promo_invalid_reason(p)
    if reason:
        raise HTTPException(400, reason)
    claimed = await db.promo_codes.find_one_and_update(
        {
            "code": code,
            "active": True,
            "$or": [
                {"max_uses": None},
                {"$expr": {"$lt": ["$used_count", "$max_uses"]}},
            ],
        },
        {"$inc": {"used_count": 1}},
        projection={"_id": 0},
    )
    if not claimed:
        raise HTTPException(400, "Ο εκπτωτικός κωδικός έχει εξαντληθεί")
    return claimed
