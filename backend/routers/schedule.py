"""Πρόγραμμα: υπάλληλοι (πρόγραμμα) & βάρδιες.

Οι βάρδιες αποθηκεύονται ανά week_start (Δευτέρα) — οι παλιές εβδομάδες μένουν
στη βάση ως ιστορικό και είναι ΜΟΝΟ για προβολή (τα writes τις απορρίπτουν).
"""
import uuid
from datetime import timedelta

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from core import db, require_staff, require_manager, athens_now

router = APIRouter()


def _current_week_start() -> str:
    """Η Δευτέρα της τρέχουσας εβδομάδας (ημέρα Ελλάδας, YYYY-MM-DD)."""
    today = athens_now().date()
    return (today - timedelta(days=today.weekday())).isoformat()


def _reject_past_week(week_start: str):
    if week_start < _current_week_start():
        raise HTTPException(
            403, "Το πρόγραμμα περασμένων εβδομάδων είναι μόνο για προβολή"
        )


# ============ EMPLOYEES ============
class EmployeeIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)


@router.get("/employees")
async def list_employees(user: dict = Depends(require_staff)):
    docs = await db.employees.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("order", 1).to_list(500)
    return docs


@router.post("/employees")
async def create_employee(body: EmployeeIn, user: dict = Depends(require_manager)):
    count = await db.employees.count_documents({"user_id": user["id"]})
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": body.name.strip(),
        "order": count,
    }
    await db.employees.insert_one(doc)
    return {"id": doc["id"], "name": doc["name"], "order": doc["order"]}


@router.put("/employees/{eid}")
async def update_employee(eid: str, body: EmployeeIn, user: dict = Depends(require_manager)):
    r = await db.employees.update_one(
        {"id": eid, "user_id": user["id"]},
        {"$set": {"name": body.name.strip()}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": eid, "name": body.name.strip()}


@router.delete("/employees/{eid}")
async def delete_employee(eid: str, user: dict = Depends(require_manager)):
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


@router.get("/shifts/weeks")
async def list_shift_weeks(user: dict = Depends(require_staff)):
    """Εβδομάδες (week_start) που έχουν καταχωρημένες βάρδιες — για το ιστορικό."""
    weeks = await db.shifts.distinct("week_start", {"user_id": user["id"]})
    return {"weeks": sorted(weeks, reverse=True), "current": _current_week_start()}


@router.get("/shifts")
async def list_shifts(week_start: str, user: dict = Depends(require_staff)):
    docs = await db.shifts.find(
        {"user_id": user["id"], "week_start": week_start},
        {"_id": 0, "user_id": 0},
    ).to_list(1000)
    return docs


@router.put("/shifts")
async def upsert_shift(body: ShiftIn, user: dict = Depends(require_manager)):
    _reject_past_week(body.week_start)
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


@router.delete("/shifts")
async def delete_shift(
    employee_id: str,
    week_start: str,
    day: int,
    user: dict = Depends(require_manager),
):
    _reject_past_week(week_start)
    r = await db.shifts.delete_one({
        "user_id": user["id"],
        "employee_id": employee_id,
        "week_start": week_start,
        "day": day,
    })
    return {"ok": True, "deleted": r.deleted_count}
