"""Συνεργασίες καταστήματος ↔ εταιρείας διανομής από το admin panel.

Ο master admin τις δημιουργεί/τερματίζει ΑΠΕΥΘΕΙΑΣ (χωρίς αίτημα/έγκριση) — ίδια
οντότητα με τις κανονικές συνεργασίες (fleet_partnerships), οπότε δουλεύουν
αμέσως και στις δύο πλευρές. Τα sub-admins έχουν ΜΟΝΟ προβολή.

Όρια domain: το admin δεν αγγίζει ποτέ fleet_* collections — όλα περνούν από το
`fleet/api.py`. Τα `users` είναι shared και διαβάζονται εδώ κανονικά.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from shared.core import db
from admin.admins import check_city, get_admin_ctx, require_product
from fleet import api as fleet_api

router = APIRouter()

# Πόσα υποψήφια για σύνδεση επιστρέφονται (ίδια πόλη πρώτα)
CANDIDATE_LIMIT = 60

STORE_FIELDS = {
    "_id": 0, "id": 1, "restaurant_name": 1, "email": 1,
    "store_city": 1, "city": 1, "plan": 1, "disabled": 1,
}


def _city_of(u: dict) -> str:
    return (u.get("store_city") or u.get("city") or "").strip()


def require_master(ctx: dict) -> None:
    """Δημιουργία/τερματισμός συνεργασίας — μόνο master (sub-admins: προβολή)."""
    if not ctx["is_master"]:
        raise HTTPException(403, "Οι συνεργασίες αλλάζουν μόνο από τον κύριο διαχειριστή")


class LinkStoreIn(BaseModel):
    team_id: str


class LinkCompanyIn(BaseModel):
    store_user_id: str


async def _store_or_404(uid: str, ctx: dict) -> dict:
    u = await db.users.find_one(
        {"id": uid, "account_type": {"$ne": "fleet_company"}}, STORE_FIELDS
    )
    if not u:
        raise HTTPException(404, "Το μαγαζί δεν βρέθηκε")
    check_city(ctx, u)
    return u


async def _company_or_404(uid: str, ctx: dict) -> tuple:
    u = await db.users.find_one({"id": uid, "account_type": "fleet_company"}, STORE_FIELDS)
    if not u:
        raise HTTPException(404, "Η εταιρεία δεν βρέθηκε")
    check_city(ctx, u)
    team = await fleet_api.team_for_user(uid)
    if not team:
        raise HTTPException(404, "Η εταιρεία δεν έχει ακόμα ομάδα διανομής")
    return u, team


# ============ ΠΛΕΥΡΑ ΜΑΓΑΖΙΟΥ ============
@router.get("/admin/shops/{uid}/partnerships")
async def admin_shop_partnerships(uid: str, ctx: dict = Depends(get_admin_ctx)):
    """Ενεργές/εκκρεμείς συνεργασίες του μαγαζιού + υποψήφιες εταιρείες προς
    σύνδεση (πρώτα οι εταιρείες της ίδιας πόλης)."""
    require_product(ctx, "orderdeck")
    u = await _store_or_404(uid, ctx)
    city = _city_of(u)
    partnerships = await fleet_api.partnerships_for(store_user_id=uid)
    linked = {p["team_id"] for p in partnerships}
    teams = await fleet_api.teams_for_admin(limit=400)
    same = [t for t in teams if (t.get("city") or "").strip().lower() == city.lower() and city]
    other = [t for t in teams if t not in same]
    candidates = [t for t in same + other if t["id"] not in linked][:CANDIDATE_LIMIT]
    return {
        "store_city": city,
        "partnerships": partnerships,
        "candidates": [{**t, "same_city": t in same} for t in candidates],
    }


@router.post("/admin/shops/{uid}/partnerships")
async def admin_shop_link_partner(
    uid: str, body: LinkStoreIn, ctx: dict = Depends(get_admin_ctx)
):
    require_product(ctx, "orderdeck")
    require_master(ctx)
    u = await _store_or_404(uid, ctx)
    # kind="company": ποτέ σύνδεση μαγαζιού με την ομάδα ΑΛΛΟΥ μαγαζιού (OrderDeck Fleet)
    team = await fleet_api.team_by_id(body.team_id, kind="company")
    if not team or team.get("disabled"):
        raise HTTPException(404, "Η εταιρεία δεν βρέθηκε")
    return await fleet_api.create_partnership_direct(u, team, by=ctx["name"])


@router.delete("/admin/shops/{uid}/partnerships/{pid}")
async def admin_shop_unlink_partner(
    uid: str, pid: str, ctx: dict = Depends(get_admin_ctx)
):
    require_product(ctx, "orderdeck")
    require_master(ctx)
    await _store_or_404(uid, ctx)
    p = await fleet_api.end_partnership_direct(pid)
    if not p or p["store_user_id"] != uid:
        raise HTTPException(404, "Η συνεργασία δεν βρέθηκε")
    return {"ok": True}


# ============ ΠΛΕΥΡΑ ΕΤΑΙΡΕΙΑΣ ============
@router.get("/admin/fleet/{uid}/partnerships")
async def admin_company_partnerships(uid: str, ctx: dict = Depends(get_admin_ctx)):
    """Συνεργασίες της εταιρείας + υποψήφια μαγαζιά προς σύνδεση (ίδια πόλη πρώτα,
    μόνο λογαριασμοί με πλάνο που περιλαμβάνει διανομή)."""
    require_product(ctx, "fleet")
    u, team = await _company_or_404(uid, ctx)
    city = (team.get("city") or _city_of(u)).strip()
    partnerships = await fleet_api.partnerships_for(team_id=team["id"])
    linked = {p["store_user_id"] for p in partnerships}
    shops = await db.users.find(
        {
            "account_type": {"$ne": "fleet_company"},
            "disabled": {"$ne": True},
            "plan": {"$in": ["fleet", "orderdeck_fleet"]},
        },
        STORE_FIELDS,
    ).sort("restaurant_name", 1).to_list(400)
    same = [s for s in shops if city and _city_of(s).lower() == city.lower()]
    other = [s for s in shops if s not in same]
    candidates = [s for s in same + other if s["id"] not in linked][:CANDIDATE_LIMIT]
    return {
        "team": team,
        "company_city": city,
        "partnerships": partnerships,
        "candidates": [
            {
                "id": s["id"],
                "restaurant_name": s.get("restaurant_name") or "",
                "city": _city_of(s),
                "plan": s.get("plan"),
                "same_city": s in same,
            }
            for s in candidates
        ],
    }


@router.post("/admin/fleet/{uid}/partnerships")
async def admin_company_link_store(
    uid: str, body: LinkCompanyIn, ctx: dict = Depends(get_admin_ctx)
):
    require_product(ctx, "fleet")
    require_master(ctx)
    _, team = await _company_or_404(uid, ctx)
    store: Optional[dict] = await db.users.find_one(
        {"id": body.store_user_id, "account_type": {"$ne": "fleet_company"}}, STORE_FIELDS
    )
    if not store:
        raise HTTPException(404, "Το μαγαζί δεν βρέθηκε")
    return await fleet_api.create_partnership_direct(store, team, by=ctx["name"])


@router.delete("/admin/fleet/{uid}/partnerships/{pid}")
async def admin_company_unlink_store(
    uid: str, pid: str, ctx: dict = Depends(get_admin_ctx)
):
    require_product(ctx, "fleet")
    require_master(ctx)
    _, team = await _company_or_404(uid, ctx)
    p = await fleet_api.end_partnership_direct(pid)
    if not p or p["team_id"] != team["id"]:
        raise HTTPException(404, "Η συνεργασία δεν βρέθηκε")
    return {"ok": True}
