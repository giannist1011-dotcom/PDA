"""Δημόσιος κατάλογος μενού ανά κατάστημα.

- Owner endpoints (JWT, require_owner): logo, slug, on/off toggle — ζουν κάτω από /settings/public-menu.
- Public endpoint (ΧΩΡΙΣ login): /public/menu/{slug} → όνομα, λογότυπο, κατηγορίες με διαθέσιμα προϊόντα.
"""
import re

from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from core import db, get_current_user, require_owner, require_feature

router = APIRouter()


# ============ SLUG HELPERS ============
# Ελληνικά → greeklish για αυτόματο slug από το όνομα επιχείρησης
GREEK_MAP = {
    "α": "a", "ά": "a", "β": "v", "γ": "g", "δ": "d", "ε": "e", "έ": "e",
    "ζ": "z", "η": "i", "ή": "i", "θ": "th", "ι": "i", "ί": "i", "ϊ": "i", "ΐ": "i",
    "κ": "k", "λ": "l", "μ": "m", "ν": "n", "ξ": "x", "ο": "o", "ό": "o", "π": "p",
    "ρ": "r", "σ": "s", "ς": "s", "τ": "t", "υ": "y", "ύ": "y", "ϋ": "y", "ΰ": "y",
    "φ": "f", "χ": "ch", "ψ": "ps", "ω": "o", "ώ": "o",
}

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def slugify_greek(name: str) -> str:
    """Μετατροπή ονόματος (ελληνικά/λατινικά) σε ασφαλές URL slug."""
    name = (name or "").strip().lower()
    out = []
    for ch in name:
        if ch in GREEK_MAP:
            out.append(GREEK_MAP[ch])
        elif ch.isascii() and ch.isalnum():
            out.append(ch)
        elif ch in " -_.":
            out.append("-")
        # ό,τι άλλο (σύμβολα, emoji, μη χαρτογραφημένα) αγνοείται
    slug = re.sub(r"-+", "-", "".join(out)).strip("-")
    return slug[:40].strip("-")


async def _slug_taken(slug: str, exclude_id: str) -> bool:
    existing = await db.users.find_one(
        {"public_slug": slug, "id": {"$ne": exclude_id}}, {"_id": 1}
    )
    return existing is not None


async def ensure_public_slug(user: dict) -> str:
    """Επιστρέφει το μόνιμο slug του λογαριασμού· το δημιουργεί αν λείπει (unique)."""
    if user.get("public_slug"):
        return user["public_slug"]
    base = slugify_greek(user.get("restaurant_name", "")) or "menu"
    slug = base
    n = 1
    while await _slug_taken(slug, user["id"]):
        n += 1
        slug = f"{base}-{n}"
    await db.users.update_one({"id": user["id"]}, {"$set": {"public_slug": slug}})
    return slug


# ============ OWNER SETTINGS (require_owner) ============
class ToggleIn(BaseModel):
    enabled: bool


class SlugIn(BaseModel):
    slug: str = Field(min_length=1, max_length=60)


class LogoIn(BaseModel):
    # ~2MB εικόνα → ~2.7MB base64· αφήνουμε λίγο περιθώριο
    data_url: str = Field(min_length=10, max_length=3_500_000)


@router.get("/settings/public-menu")
async def get_public_menu_settings(user: dict = Depends(require_feature("settings", require_owner))):
    slug = await ensure_public_slug(user)
    u = await db.users.find_one(
        {"id": user["id"]},
        {
            "_id": 0,
            "store_logo": 1,
            "public_menu_enabled": 1,
            "min_order": 1,
            "delivery_fee": 1,
            "link_wolt": 1,
            "link_efood": 1,
            "link_box": 1,
        },
    )
    u = u or {}
    return {
        "enabled": bool(u.get("public_menu_enabled", False)),
        "slug": slug,
        "logo": u.get("store_logo"),
        "path": f"/menu/{slug}",
        "min_order": u.get("min_order"),
        "delivery_fee": u.get("delivery_fee"),
        "link_wolt": u.get("link_wolt") or "",
        "link_efood": u.get("link_efood") or "",
        "link_box": u.get("link_box") or "",
    }


class CatalogSettingsIn(BaseModel):
    # Κενό πεδίο = None = δεν εμφανίζεται πουθενά (κατάλογος/POS)
    min_order: Optional[float] = Field(default=None, ge=0, le=1000)
    delivery_fee: Optional[float] = Field(default=None, ge=0, le=100)
    link_wolt: Optional[str] = Field(default=None, max_length=300)
    link_efood: Optional[str] = Field(default=None, max_length=300)
    link_box: Optional[str] = Field(default=None, max_length=300)


@router.put("/settings/catalog")
async def update_catalog_settings(body: CatalogSettingsIn, user: dict = Depends(require_feature("settings", require_owner))):
    """Ελάχιστη παραγγελία, χρέωση delivery και σύνδεσμοι πλατφορμών (Wolt/efood/Box)."""
    fields = {
        "min_order": body.min_order if body.min_order else None,
        "delivery_fee": body.delivery_fee if body.delivery_fee else None,
        "link_wolt": (body.link_wolt or "").strip(),
        "link_efood": (body.link_efood or "").strip(),
        "link_box": (body.link_box or "").strip(),
    }
    await db.users.update_one({"id": user["id"]}, {"$set": fields})
    return fields


@router.put("/settings/public-menu")
async def toggle_public_menu(body: ToggleIn, user: dict = Depends(require_feature("settings", require_owner))):
    await ensure_public_slug(user)
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"public_menu_enabled": bool(body.enabled)}}
    )
    return {"enabled": bool(body.enabled)}


@router.put("/settings/public-menu/slug")
async def update_public_slug(body: SlugIn, user: dict = Depends(require_feature("settings", require_owner))):
    slug = slugify_greek(body.slug)
    if len(slug) < 3:
        raise HTTPException(
            400, "Το slug πρέπει να έχει τουλάχιστον 3 χαρακτήρες (λατινικά, αριθμοί, παύλες)"
        )
    if not SLUG_RE.match(slug):
        raise HTTPException(400, "Μη έγκυρο slug — μόνο λατινικά, αριθμοί και παύλες")
    if await _slug_taken(slug, user["id"]):
        raise HTTPException(400, "Το slug χρησιμοποιείται ήδη από άλλο κατάστημα")
    await db.users.update_one({"id": user["id"]}, {"$set": {"public_slug": slug}})
    return {"slug": slug, "path": f"/menu/{slug}"}


@router.put("/settings/public-menu/logo")
async def set_store_logo(body: LogoIn, user: dict = Depends(require_feature("settings", require_owner))):
    if not body.data_url.startswith("data:image/"):
        raise HTTPException(400, "Δεν είναι εικόνα (data URL)")
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"store_logo": body.data_url}}
    )
    return {"ok": True, "logo": body.data_url}


@router.delete("/settings/public-menu/logo")
async def remove_store_logo(user: dict = Depends(require_feature("settings", require_owner))):
    await db.users.update_one({"id": user["id"]}, {"$unset": {"store_logo": ""}})
    return {"ok": True}


# ============ BRANDING (κάθε συνδεδεμένο προφίλ) ============
# Το /auth/me αποκλείει σκόπιμα το store_logo (μεγάλο base64 blob σε κάθε request).
# Εδώ το φέρνουμε μία φορά, on demand, για header + dynamic favicon.
@router.get("/branding")
async def get_branding(user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "store_logo": 1})
    return {"logo": (u or {}).get("store_logo")}


# ============ PUBLIC (ΧΩΡΙΣ login) ============
@router.get("/public/menu/{slug}")
async def public_menu(slug: str):
    slug = (slug or "").strip().lower()
    u = await db.users.find_one(
        {"public_slug": slug},
        {
            "_id": 0,
            "id": 1,
            "restaurant_name": 1,
            "store_logo": 1,
            "public_menu_enabled": 1,
            "business_type": 1,
            "store_phone": 1,
            "store_address": 1,
            "store_city": 1,
            "store_lat": 1,
            "store_lng": 1,
            "store_hours": 1,
            "google_review_link": 1,
            "min_order": 1,
            "delivery_fee": 1,
            "link_wolt": 1,
            "link_efood": 1,
            "link_box": 1,
        },
    )
    if not u or not u.get("public_menu_enabled"):
        raise HTTPException(404, "Ο κατάλογος δεν βρέθηκε ή δεν είναι διαθέσιμος")
    uid = u["id"]
    cats = (
        await db.categories.find({"user_id": uid}, {"_id": 0, "user_id": 0})
        .sort("order", 1)
        .to_list(500)
    )
    items = await db.items.find(
        {"user_id": uid, "available": True},
        {"_id": 0, "id": 1, "name": 1, "price": 1, "category": 1, "photo_id": 1, "description": 1, "allergens": 1},
    ).sort("sort_order", 1).to_list(2000)
    # φωτογραφίες προϊόντων
    photo_ids = list({i.get("photo_id") for i in items if i.get("photo_id")})
    photo_map = {}
    if photo_ids:
        async for p in db.photos.find(
            {"user_id": uid, "id": {"$in": photo_ids}}, {"_id": 0, "id": 1, "data_url": 1}
        ):
            photo_map[p["id"]] = p["data_url"]
    by_cat = {}
    for it in items:
        pid = it.pop("photo_id", None)
        if pid and photo_map.get(pid):
            it["photo_url"] = photo_map[pid]
        by_cat.setdefault(it["category"], []).append(it)
    # κατηγορίες με τουλάχιστον ένα διαθέσιμο προϊόν, με τη σειρά τους
    out_cats = []
    for c in cats:
        its = by_cat.get(c["id"], [])
        if its:
            out_cats.append({"id": c["id"], "name": c["name"], "items": its})
    return {
        "restaurant_name": u["restaurant_name"],
        "logo": u.get("store_logo"),
        "business_type": u.get("business_type") or "souvlaki",
        "store_phone": u.get("store_phone") or "",
        "store_address": u.get("store_address") or "",
        "store_city": u.get("store_city") or "",
        "store_lat": u.get("store_lat"),
        "store_lng": u.get("store_lng"),
        "store_hours": u.get("store_hours") or {},
        "google_review_link": u.get("google_review_link") or "",
        "min_order": u.get("min_order"),
        "delivery_fee": u.get("delivery_fee"),
        "link_wolt": u.get("link_wolt") or "",
        "link_efood": u.get("link_efood") or "",
        "link_box": u.get("link_box") or "",
        "categories": out_cats,
    }
