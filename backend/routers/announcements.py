"""Ανακοινώσεις πλατφόρμας προς τα μαγαζιά.

Admin CRUD με το ίδιο password gate του admin panel (X-Admin-Password) +
endpoint /announcements/active για την εφαρμογή των μαγαζιών (JWT), που
επιστρέφει την ενεργή ανακοίνωση που ταιριάζει στο μαγαζί (τύπος/πλάνο).
"""
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from core import db, get_current_user
from routers.promo import require_admin

router = APIRouter()


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=2000)
    type: Literal["info", "warning", "success"] = "info"
    expires_at: Optional[str] = None  # ISO date (YYYY-MM-DD), None = χωρίς λήξη
    active: bool = True
    # Στόχευση: None/"all" = όλα τα μαγαζιά
    target_business_type: Optional[str] = None  # souvlaki/cafe/pizzeria/burger
    target_plan: Optional[str] = None  # trial/pro/pro_deckpilot


class AnnouncementPatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    body: Optional[str] = Field(default=None, min_length=1, max_length=2000)
    type: Optional[Literal["info", "warning", "success"]] = None
    expires_at: Optional[str] = None  # "" = καθαρισμός
    active: Optional[bool] = None
    target_business_type: Optional[str] = None  # "" ή "all" = όλα
    target_plan: Optional[str] = None


def _norm_target(v: Optional[str]) -> Optional[str]:
    return None if not v or v == "all" else v


# ============ ADMIN CRUD ============
@router.get("/admin/announcements")
async def admin_list_announcements(x_admin_password: Optional[str] = Header(None)):
    require_admin(x_admin_password)
    return await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/admin/announcements")
async def admin_create_announcement(
    body: AnnouncementIn, x_admin_password: Optional[str] = Header(None)
):
    require_admin(x_admin_password)
    doc = {
        "id": str(uuid.uuid4()),
        "title": body.title.strip(),
        "body": body.body.strip(),
        "type": body.type,
        "expires_at": body.expires_at or None,
        "active": body.active,
        "target_business_type": _norm_target(body.target_business_type),
        "target_plan": _norm_target(body.target_plan),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.announcements.insert_one({**doc})
    return doc


@router.patch("/admin/announcements/{aid}")
async def admin_update_announcement(
    aid: str, body: AnnouncementPatch, x_admin_password: Optional[str] = Header(None)
):
    require_admin(x_admin_password)
    update = body.model_dump(exclude_unset=True)
    if not update:
        raise HTTPException(400, "Δεν δόθηκαν αλλαγές")
    if "title" in update:
        update["title"] = update["title"].strip()
    if "body" in update:
        update["body"] = update["body"].strip()
    if "expires_at" in update and not update["expires_at"]:
        update["expires_at"] = None
    for k in ("target_business_type", "target_plan"):
        if k in update:
            update[k] = _norm_target(update[k])
    res = await db.announcements.update_one({"id": aid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Η ανακοίνωση δεν βρέθηκε")
    return {"ok": True}


@router.delete("/admin/announcements/{aid}")
async def admin_delete_announcement(
    aid: str, x_admin_password: Optional[str] = Header(None)
):
    require_admin(x_admin_password)
    res = await db.announcements.delete_one({"id": aid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Η ανακοίνωση δεν βρέθηκε")
    return {"ok": True}


# ============ ΕΦΑΡΜΟΓΗ ΜΑΓΑΖΙΩΝ ============
@router.get("/announcements/active")
async def active_announcement(user: dict = Depends(get_current_user)):
    """Η πιο πρόσφατη ενεργή ανακοίνωση που αφορά αυτό το μαγαζί (ή null)."""
    today = datetime.now(timezone.utc).date().isoformat()
    biz = user.get("business_type") or "souvlaki"
    plan = user.get("plan") or "trial"
    match = {
        "active": True,
        "$and": [
            {"$or": [{"expires_at": None}, {"expires_at": {"$gte": today}}]},
            {"$or": [{"target_business_type": None}, {"target_business_type": biz}]},
            {"$or": [{"target_plan": None}, {"target_plan": plan}]},
        ],
    }
    ann = await db.announcements.find_one(match, {"_id": 0}, sort=[("created_at", -1)])
    return {"announcement": ann}
