"""Checklist ανοίγματος & κλεισίματος καταστήματος.

- Ο ιδιοκτήτης ορίζει δύο λίστες εργασιών ("open" / "close").
- Το προσωπικό τικάρει τα items — κάθε τικ γράφεται με προφίλ + ώρα.
- Το "σήμερα" βασίζεται στην ημερομηνία Αθήνας· νέα μέρα = φρέσκο checklist,
  τα τικ των προηγούμενων ημερών μένουν ως ιστορικό.
"""
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from core import db, actor_name, require_staff, require_owner, athens_today

router = APIRouter()

LISTS = ("open", "close")


# ============ TEMPLATES (owner) ============
class TemplateIn(BaseModel):
    list: Literal["open", "close"]
    text: str = Field(min_length=1, max_length=200)


class TemplatePatchIn(BaseModel):
    text: str = Field(min_length=1, max_length=200)


class ReorderIn(BaseModel):
    list: Literal["open", "close"]
    ids: list[str]


@router.get("/checklist/templates")
async def list_templates(user: dict = Depends(require_staff)):
    docs = await db.checklist_templates.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("order", 1).to_list(500)
    return docs


@router.post("/checklist/templates")
async def create_template(body: TemplateIn, user: dict = Depends(require_owner)):
    count = await db.checklist_templates.count_documents(
        {"user_id": user["id"], "list": body.list}
    )
    doc = {
        "id": str(uuid.uuid4())[:8],
        "user_id": user["id"],
        "list": body.list,
        "text": body.text.strip(),
        "order": count,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.checklist_templates.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@router.put("/checklist/templates/{tid}")
async def update_template(tid: str, body: TemplatePatchIn, user: dict = Depends(require_owner)):
    r = await db.checklist_templates.update_one(
        {"id": tid, "user_id": user["id"]}, {"$set": {"text": body.text.strip()}}
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": tid, "text": body.text.strip()}


@router.delete("/checklist/templates/{tid}")
async def delete_template(tid: str, user: dict = Depends(require_owner)):
    r = await db.checklist_templates.delete_one({"id": tid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    # τα σημερινά τικ του item φεύγουν, το ιστορικό προηγούμενων ημερών μένει
    await db.checklist_ticks.delete_many(
        {"user_id": user["id"], "template_id": tid, "date": athens_today()}
    )
    return {"ok": True}


@router.post("/checklist/templates/reorder")
async def reorder_templates(body: ReorderIn, user: dict = Depends(require_owner)):
    for i, tid in enumerate(body.ids):
        await db.checklist_templates.update_one(
            {"id": tid, "user_id": user["id"], "list": body.list},
            {"$set": {"order": i}},
        )
    return {"ok": True}


# ============ TODAY (staff) ============
@router.get("/checklist/today")
async def checklist_today(user: dict = Depends(require_staff)):
    today = athens_today()
    templates = await db.checklist_templates.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("order", 1).to_list(500)
    ticks = await db.checklist_ticks.find(
        {"user_id": user["id"], "date": today}, {"_id": 0, "user_id": 0}
    ).to_list(1000)
    by_template = {t["template_id"]: t for t in ticks}
    items = []
    for tpl in templates:
        tick = by_template.get(tpl["id"])
        items.append({
            "id": tpl["id"],
            "list": tpl["list"],
            "text": tpl["text"],
            "order": tpl.get("order", 0),
            "done": bool(tick),
            "done_by": tick["by"] if tick else None,
            "done_at": tick["at"] if tick else None,
        })
    return {"date": today, "items": items}


class TickIn(BaseModel):
    template_id: str
    done: bool


@router.post("/checklist/tick")
async def tick_item(body: TickIn, user: dict = Depends(require_staff)):
    today = athens_today()
    tpl = await db.checklist_templates.find_one(
        {"id": body.template_id, "user_id": user["id"]}, {"_id": 0, "user_id": 0}
    )
    if not tpl:
        raise HTTPException(404, "Η εργασία δεν βρέθηκε")
    if not body.done:
        await db.checklist_ticks.delete_one(
            {"user_id": user["id"], "template_id": body.template_id, "date": today}
        )
        return {"template_id": body.template_id, "done": False}
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "user_id": user["id"],
        "template_id": body.template_id,
        "date": today,
        "list": tpl["list"],
        "text": tpl["text"],  # snapshot — το ιστορικό δείχνει το τότε κείμενο
        "by": actor_name(user),
        "role": user.get("role"),
        "at": now,
    }
    # upsert ώστε δύο ταυτόχρονα τικ να μη διπλογράψουν
    await db.checklist_ticks.update_one(
        {"user_id": user["id"], "template_id": body.template_id, "date": today},
        {"$setOnInsert": doc},
        upsert=True,
    )
    saved = await db.checklist_ticks.find_one(
        {"user_id": user["id"], "template_id": body.template_id, "date": today},
        {"_id": 0, "user_id": 0},
    )
    return {"template_id": body.template_id, "done": True,
            "done_by": saved["by"], "done_at": saved["at"]}


# ============ HISTORY (owner) ============
@router.get("/checklist/history")
async def checklist_history(days: int = 14, user: dict = Depends(require_owner)):
    days = max(1, min(days, 60))
    today = athens_today()
    ticks = await db.checklist_ticks.find(
        {"user_id": user["id"], "date": {"$lte": today}},
        {"_id": 0, "user_id": 0},
    ).sort("date", -1).to_list(days * 200)
    templates = await db.checklist_templates.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("order", 1).to_list(500)

    by_date: dict = {}
    for t in ticks:
        by_date.setdefault(t["date"], []).append(t)
    dates = sorted(by_date.keys(), reverse=True)[:days]

    out = []
    for d in dates:
        day_ticks = by_date[d]
        ticked_ids = {t["template_id"] for t in day_ticks}
        # ό,τι υπάρχει σήμερα στα templates και δεν τικαρίστηκε εκείνη τη μέρα
        missing = [
            {"id": tpl["id"], "list": tpl["list"], "text": tpl["text"]}
            for tpl in templates if tpl["id"] not in ticked_ids
        ]
        out.append({
            "date": d,
            "ticks": sorted(day_ticks, key=lambda t: (t["list"], t["at"])),
            "missing": missing,
        })
    return {"days": out}
