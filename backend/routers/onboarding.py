"""Onboarding checklist νέου μαγαζιού: αυτόματος έλεγχος πρώτων βημάτων.

Τα περισσότερα βήματα υπολογίζονται από υπάρχοντα πεδία του user doc.
Όσα δεν έχουν φυσικό σήμα (επεξεργασία μενού, αλλαγή PIN, νέο προφίλ,
δοκιμαστική εκτύπωση) καλύπτονται με flags (onb_*) που θέτουν τα αντίστοιχα
endpoints των routers menu/auth και το /onboarding/print-test.
"""
from typing import Optional

from fastapi import APIRouter, Depends

from core import db, get_current_user, require_owner

router = APIRouter()

ONBOARDING_TOTAL = 7

# Projection με expressions — ΠΟΤΕ δεν κατεβάζουμε το store_logo blob, μόνο boolean
ONB_PROJECT = {
    "_id": 0,
    "has_logo": {"$gt": [{"$ifNull": ["$store_logo", ""]}, ""]},
    "store_address": {"$ifNull": ["$store_address", ""]},
    "store_lat": {"$ifNull": ["$store_lat", None]},
    "store_lng": {"$ifNull": ["$store_lng", None]},
    "owner_pin_set": {"$ifNull": ["$owner_pin_set", False]},
    "onb_menu": {"$ifNull": ["$onb_menu", False]},
    "onb_pins": {"$ifNull": ["$onb_pins", False]},
    "onb_profile": {"$ifNull": ["$onb_profile", False]},
    "onb_print": {"$ifNull": ["$onb_print", False]},
    "public_menu_enabled": {"$ifNull": ["$public_menu_enabled", False]},
    "onboarding_hidden": {"$ifNull": ["$onboarding_hidden", False]},
}


def onboarding_progress(u: dict) -> dict:
    """Υπολογισμός βημάτων από πεδία που έχουν έρθει με το ONB_PROJECT projection
    (ή ισοδύναμα boolean πεδία). Επιστρέφει steps + done/total/percent."""
    steps = {
        "logo": bool(u.get("has_logo")),
        "details": bool((u.get("store_address") or "").strip())
        or (u.get("store_lat") is not None and u.get("store_lng") is not None),
        "menu": bool(u.get("onb_menu")),
        "pins": bool(u.get("owner_pin_set")) or bool(u.get("onb_pins")),
        "profiles": bool(u.get("onb_profile")),
        "print": bool(u.get("onb_print")),
        "catalog": bool(u.get("public_menu_enabled")),
    }
    done = sum(1 for v in steps.values() if v)
    return {
        "steps": steps,
        "done": done,
        "total": ONBOARDING_TOTAL,
        "percent": round(done * 100 / ONBOARDING_TOTAL),
    }


async def fetch_onboarding(uid: str) -> Optional[dict]:
    """Progress + hidden flag για έναν λογαριασμό (χωρίς να φορτωθεί το logo blob)."""
    docs = await db.users.aggregate(
        [{"$match": {"id": uid}}, {"$project": ONB_PROJECT}]
    ).to_list(1)
    if not docs:
        return None
    out = onboarding_progress(docs[0])
    out["hidden"] = bool(docs[0].get("onboarding_hidden"))
    return out


@router.get("/onboarding/status")
async def onboarding_status(user: dict = Depends(require_owner)):
    return await fetch_onboarding(user["id"])


@router.post("/onboarding/hide")
async def onboarding_hide(user: dict = Depends(require_owner)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"onboarding_hidden": True}})
    return {"ok": True}


@router.post("/onboarding/print-test")
async def onboarding_print_test(user: dict = Depends(get_current_user)):
    """Καλείται από το frontend όταν γίνει οποιαδήποτε εκτύπωση απόδειξης."""
    await db.users.update_one({"id": user["id"]}, {"$set": {"onb_print": True}})
    return {"ok": True}
