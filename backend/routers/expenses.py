"""Έξοδα: κατηγορίες εξόδων & καταχωρήσεις."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from core import db, require_owner

router = APIRouter()


DEFAULT_EXPENSE_CATEGORIES = [
    "Προμηθευτές",
    "Μισθοδοσία",
    "Ενοίκιο",
    "Λογαριασμοί (ΔΕΗ/νερό/ίντερνετ)",
    "Εξοπλισμός",
    "Συσκευασίες",
    "Λοιπά",
]


class ExpenseCategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    order: int = 0


class ExpenseIn(BaseModel):
    amount: float = Field(gt=0)
    description: str = Field(default="", max_length=300)
    category_id: Optional[str] = None
    date: str  # YYYY-MM-DD


def validate_expense_date(s: str):
    try:
        datetime.strptime(s, "%Y-%m-%d")
    except (ValueError, TypeError):
        raise HTTPException(422, "Μη έγκυρη ημερομηνία (μορφή YYYY-MM-DD)")


async def ensure_expense_categories(user_id: str):
    """Seed the default expense categories the first time an account uses expenses."""
    count = await db.expense_categories.count_documents({"user_id": user_id})
    if count == 0:
        docs = [
            {"id": str(uuid.uuid4())[:8], "user_id": user_id, "name": n, "order": i}
            for i, n in enumerate(DEFAULT_EXPENSE_CATEGORIES)
        ]
        await db.expense_categories.insert_many(docs)


@router.get("/expenses/categories")
async def list_expense_categories(user: dict = Depends(require_owner)):
    await ensure_expense_categories(user["id"])
    return await db.expense_categories.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("order", 1).to_list(500)


@router.post("/expenses/categories")
async def create_expense_category(body: ExpenseCategoryIn, user: dict = Depends(require_owner)):
    count = await db.expense_categories.count_documents({"user_id": user["id"]})
    doc = {
        "id": str(uuid.uuid4())[:8],
        "user_id": user["id"],
        "name": body.name.strip(),
        "order": body.order if body.order else count,
    }
    await db.expense_categories.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@router.put("/expenses/categories/{cid}")
async def update_expense_category(cid: str, body: ExpenseCategoryIn, user: dict = Depends(require_owner)):
    r = await db.expense_categories.update_one(
        {"id": cid, "user_id": user["id"]},
        {"$set": {"name": body.name.strip(), "order": body.order}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": cid, "name": body.name.strip(), "order": body.order}


@router.delete("/expenses/categories/{cid}")
async def delete_expense_category(cid: str, user: dict = Depends(require_owner)):
    r = await db.expense_categories.delete_one({"id": cid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    # expenses in this category become uncategorized
    await db.expenses.update_many(
        {"user_id": user["id"], "category_id": cid},
        {"$set": {"category_id": None}},
    )
    return {"ok": True}


@router.get("/expenses")
async def list_expenses(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    category_id: Optional[str] = None,
    user: dict = Depends(require_owner),
):
    query = {"user_id": user["id"]}
    rng = {}
    if date_from:
        rng["$gte"] = date_from
    if date_to:
        rng["$lte"] = date_to
    if rng:
        query["date"] = rng
    if category_id:
        query["category_id"] = category_id
    docs = await db.expenses.find(
        query, {"_id": 0, "user_id": 0}
    ).sort([("date", -1), ("created_at", -1)]).to_list(5000)
    return docs


@router.post("/expenses")
async def create_expense(body: ExpenseIn, user: dict = Depends(require_owner)):
    validate_expense_date(body.date)
    if body.category_id:
        cat = await db.expense_categories.find_one(
            {"id": body.category_id, "user_id": user["id"]}
        )
        if not cat:
            raise HTTPException(404, "Η κατηγορία δεν βρέθηκε")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "amount": round(float(body.amount), 2),
        "description": body.description.strip(),
        "category_id": body.category_id,
        "date": body.date,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.expenses.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@router.put("/expenses/{eid}")
async def update_expense(eid: str, body: ExpenseIn, user: dict = Depends(require_owner)):
    validate_expense_date(body.date)
    if body.category_id:
        cat = await db.expense_categories.find_one(
            {"id": body.category_id, "user_id": user["id"]}
        )
        if not cat:
            raise HTTPException(404, "Η κατηγορία δεν βρέθηκε")
    update = {
        "amount": round(float(body.amount), 2),
        "description": body.description.strip(),
        "category_id": body.category_id,
        "date": body.date,
    }
    r = await db.expenses.update_one(
        {"id": eid, "user_id": user["id"]}, {"$set": update}
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": eid, **update}


@router.delete("/expenses/{eid}")
async def delete_expense(eid: str, user: dict = Depends(require_owner)):
    r = await db.expenses.delete_one({"id": eid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}
