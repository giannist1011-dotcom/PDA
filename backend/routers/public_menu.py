"""Δημόσιος κατάλογος μενού ανά κατάστημα.

- Owner endpoints (JWT, require_owner): logo, slug, on/off toggle — ζουν κάτω από /settings/public-menu.
- Public endpoint (ΧΩΡΙΣ login): /public/menu/{slug} → όνομα, λογότυπο, κατηγορίες με διαθέσιμα προϊόντα.
"""
import re

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from core import db, require_owner

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
async def get_public_menu_settings(user: dict = Depends(require_owner)):
    slug = await ensure_public_slug(user)
    u = await db.users.find_one(
        {"id": user["id"]}, {"_id": 0, "store_logo": 1, "public_menu_enabled": 1}
    )
    u = u or {}
    return {
        "enabled": bool(u.get("public_menu_enabled", False)),
        "slug": slug,
        "logo": u.get("store_logo"),
        "path": f"/menu/{slug}",
    }


@router.put("/settings/public-menu")
async def toggle_public_menu(body: ToggleIn, user: dict = Depends(require_owner)):
    await ensure_public_slug(user)
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"public_menu_enabled": bool(body.enabled)}}
    )
    return {"enabled": bool(body.enabled)}


@router.put("/settings/public-menu/slug")
async def update_public_slug(body: SlugIn, user: dict = Depends(require_owner)):
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
async def set_store_logo(body: LogoIn, user: dict = Depends(require_owner)):
    if not body.data_url.startswith("data:image/"):
        raise HTTPException(400, "Δεν είναι εικόνα (data URL)")
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"store_logo": body.data_url}}
    )
    return {"ok": True, "logo": body.data_url}


@router.delete("/settings/public-menu/logo")
async def remove_store_logo(user: dict = Depends(require_owner)):
    await db.users.update_one({"id": user["id"]}, {"$unset": {"store_logo": ""}})
    return {"ok": True}


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
        {"_id": 0, "id": 1, "name": 1, "price": 1, "category": 1, "photo_id": 1, "description": 1},
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
        "categories": out_cats,
    }
