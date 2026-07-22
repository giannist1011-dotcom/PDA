"""Ελλείψεις (stock) & λίστα αγορών (shopping list)."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from core import db, require_staff, require_manager, actor_name

router = APIRouter()


# ============ SHOPPING LIST ============
class ShoppingItemIn(BaseModel):
    text: str = Field(min_length=1, max_length=200)


# ============ PRINT HISTORY (ιστορικό εκτυπώσεων λίστας αγορών) ============
PRINT_HISTORY_KEEP_DAYS = 90  # κρατάμε τουλάχιστον 30 ημέρες — καθαρίζουμε στις 90


class ShortagePrintItemIn(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    bought: bool = False


class ShortagePrintIn(BaseModel):
    items: list[ShortagePrintItemIn] = Field(min_length=1, max_length=1000)


@router.post("/shopping/print")
async def record_shopping_print(body: ShortagePrintIn, user: dict = Depends(require_manager)):
    """Καταγραφή εκτύπωσης της λίστας αγορών: snapshot ειδών + ποιος/πότε τύπωσε."""
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "printed_at": now.isoformat(),
        "printed_by": actor_name(user),
        "items": [{"text": it.text.strip(), "bought": bool(it.bought)} for it in body.items],
    }
    await db.shortage_prints.insert_one(doc)
    # Lazy καθαρισμός: ό,τι είναι παλαιότερο από PRINT_HISTORY_KEEP_DAYS φεύγει
    cutoff = (now - timedelta(days=PRINT_HISTORY_KEEP_DAYS)).isoformat()
    await db.shortage_prints.delete_many(
        {"user_id": user["id"], "printed_at": {"$lt": cutoff}}
    )
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@router.get("/shopping/prints")
async def list_shopping_prints(
    skip: int = 0, limit: int = 20, user: dict = Depends(require_staff)
):
    limit = max(1, min(limit, 50))
    skip = max(0, skip)
    docs = await db.shortage_prints.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("printed_at", -1).skip(skip).to_list(limit)
    return docs


# ============ STOCK (INDEPENDENT INVENTORY) ============
class StockCategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    order: int = 0


class StockItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category_id: str
    available: bool = True
    note: str = ""


class StockItemPatchIn(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
    available: Optional[bool] = None
    note: Optional[str] = None


@router.get("/stock/config")
async def stock_config(user: dict = Depends(require_staff)):
    cats = await db.stock_categories.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("order", 1).to_list(500)
    items = await db.stock_items.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("created_at", 1).to_list(2000)
    return {"categories": cats, "items": items}


@router.post("/stock/categories")
async def create_stock_category(body: StockCategoryIn, user: dict = Depends(require_manager)):
    count = await db.stock_categories.count_documents({"user_id": user["id"]})
    doc = {
        "id": str(uuid.uuid4())[:8],
        "user_id": user["id"],
        "name": body.name.strip(),
        "order": body.order if body.order else count,
    }
    await db.stock_categories.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@router.put("/stock/categories/{cid}")
async def update_stock_category(cid: str, body: StockCategoryIn, user: dict = Depends(require_manager)):
    r = await db.stock_categories.update_one(
        {"id": cid, "user_id": user["id"]},
        {"$set": {"name": body.name.strip(), "order": body.order}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": cid, "name": body.name.strip(), "order": body.order}


@router.delete("/stock/categories/{cid}")
async def delete_stock_category(cid: str, user: dict = Depends(require_manager)):
    # cascade: remove shopping entries created from items in this category
    stock_ids = [
        d["id"] async for d in db.stock_items.find(
            {"user_id": user["id"], "category_id": cid}, {"_id": 0, "id": 1}
        )
    ]
    if stock_ids:
        await db.shopping.delete_many({"user_id": user["id"], "source_stock_id": {"$in": stock_ids}})
    await db.stock_items.delete_many({"user_id": user["id"], "category_id": cid})
    r = await db.stock_categories.delete_one({"id": cid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@router.post("/stock/items")
async def create_stock_item(body: StockItemIn, user: dict = Depends(require_manager)):
    cat = await db.stock_categories.find_one({"id": body.category_id, "user_id": user["id"]})
    if not cat:
        raise HTTPException(404, "Η κατηγορία δεν βρέθηκε")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": body.name.strip(),
        "category_id": body.category_id,
        "available": bool(body.available),
        "note": body.note.strip(),
        "shopping_item_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.stock_items.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@router.patch("/stock/items/{iid}")
async def update_stock_item(iid: str, body: StockItemPatchIn, user: dict = Depends(require_staff)):
    update = {}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.category_id is not None:
        cat = await db.stock_categories.find_one({"id": body.category_id, "user_id": user["id"]})
        if not cat:
            raise HTTPException(404, "Η κατηγορία δεν βρέθηκε")
        update["category_id"] = body.category_id
    if body.available is not None:
        update["available"] = bool(body.available)
    if body.note is not None:
        update["note"] = body.note.strip()
    if not update:
        raise HTTPException(400, "Nothing to update")
    r = await db.stock_items.update_one({"id": iid, "user_id": user["id"]}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    # keep linked shopping text in sync on rename
    if "name" in update:
        item = await db.stock_items.find_one({"id": iid, "user_id": user["id"]}, {"_id": 0, "shopping_item_id": 1})
        sid = item.get("shopping_item_id") if item else None
        if sid:
            await db.shopping.update_one(
                {"id": sid, "user_id": user["id"]},
                {"$set": {"text": update["name"]}},
            )
    return {"id": iid, **update}


class StockShoppingIn(BaseModel):
    needs: bool


@router.post("/stock/items/{iid}/shopping")
async def toggle_stock_item_shopping(
    iid: str, body: StockShoppingIn, user: dict = Depends(require_staff)
):
    item = await db.stock_items.find_one({"id": iid, "user_id": user["id"]})
    if not item:
        raise HTTPException(404, "Not found")
    existing_id = item.get("shopping_item_id")
    if body.needs:
        if existing_id:
            existing = await db.shopping.find_one({"id": existing_id, "user_id": user["id"]}, {"_id": 0, "user_id": 0})
            if existing:
                return {"item_id": iid, "shopping_item_id": existing_id, "shopping_item": existing}
        sid = str(uuid.uuid4())
        shopping_doc = {
            "id": sid,
            "user_id": user["id"],
            "text": item["name"],
            "bought": False,
            "source_stock_id": iid,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.shopping.insert_one(shopping_doc)
        await db.stock_items.update_one(
            {"id": iid, "user_id": user["id"]}, {"$set": {"shopping_item_id": sid}}
        )
        return {
            "item_id": iid,
            "shopping_item_id": sid,
            "shopping_item": {k: v for k, v in shopping_doc.items() if k not in ("_id", "user_id")},
        }
    # needs=false → remove linked shopping entry
    if existing_id:
        await db.shopping.delete_one({"id": existing_id, "user_id": user["id"]})
        await db.stock_items.update_one(
            {"id": iid, "user_id": user["id"]}, {"$set": {"shopping_item_id": None}}
        )
    return {"item_id": iid, "shopping_item_id": None}



@router.delete("/stock/items/{iid}")
async def delete_stock_item(iid: str, user: dict = Depends(require_manager)):
    item = await db.stock_items.find_one({"id": iid, "user_id": user["id"]}, {"_id": 0, "shopping_item_id": 1})
    if item and item.get("shopping_item_id"):
        await db.shopping.delete_one({"id": item["shopping_item_id"], "user_id": user["id"]})
    r = await db.stock_items.delete_one({"id": iid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@router.get("/shopping")
async def list_shopping(user: dict = Depends(require_staff)):
    docs = await db.shopping.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("created_at", 1).to_list(1000)
    return docs


@router.post("/shopping/reset")
async def reset_shopping(user: dict = Depends(require_manager)):
    """Wipe entire shopping list and clear shopping_item_id on all stock items."""
    result = await db.shopping.delete_many({"user_id": user["id"]})
    await db.stock_items.update_many(
        {"user_id": user["id"], "shopping_item_id": {"$ne": None}},
        {"$set": {"shopping_item_id": None}},
    )
    return {"ok": True, "deleted": result.deleted_count}


@router.post("/shopping")
async def add_shopping(body: ShoppingItemIn, user: dict = Depends(require_manager)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "text": body.text.strip(),
        "bought": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.shopping.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


class ShoppingUpdateIn(BaseModel):
    text: Optional[str] = None
    bought: Optional[bool] = None


@router.put("/shopping/{sid}")
async def update_shopping(sid: str, body: ShoppingUpdateIn, user: dict = Depends(require_manager)):
    update = {}
    if body.text is not None:
        update["text"] = body.text.strip()
    if body.bought is not None:
        update["bought"] = bool(body.bought)
    if not update:
        raise HTTPException(400, "Nothing to update")
    r = await db.shopping.update_one({"id": sid, "user_id": user["id"]}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": sid, **update}


@router.delete("/shopping/{sid}")
async def delete_shopping(sid: str, user: dict = Depends(require_manager)):
    r = await db.shopping.delete_one({"id": sid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    # if this shopping entry was linked from a stock item, clear the link
    await db.stock_items.update_many(
        {"user_id": user["id"], "shopping_item_id": sid},
        {"$set": {"shopping_item_id": None}},
    )
    return {"ok": True}
