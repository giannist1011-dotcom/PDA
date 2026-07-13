"""Πρόγραμμα: υπάλληλοι (πρόγραμμα) & βάρδιες."""
import uuid

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from core import db, get_current_user, require_manager

router = APIRouter()


# ============ EMPLOYEES ============
class EmployeeIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)


@router.get("/employees")
async def list_employees(user: dict = Depends(get_current_user)):
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


@router.get("/shifts")
async def list_shifts(week_start: str, user: dict = Depends(get_current_user)):
    docs = await db.shifts.find(
        {"user_id": user["id"], "week_start": week_start},
        {"_id": 0, "user_id": 0},
    ).to_list(1000)
    return docs


@router.put("/shifts")
async def upsert_shift(body: ShiftIn, user: dict = Depends(require_manager)):
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
    r = await db.shifts.delete_one({
        "user_id": user["id"],
        "employee_id": employee_id,
        "week_start": week_start,
        "day": day,
    })
    return {"ok": True, "deleted": r.deleted_count}
