"""Menu: κατηγορίες, είδη, bulk ενέργειες, customization, φωτογραφίες."""
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, ConfigDict

from core import db, get_current_user, require_manager, require_staff
from seed_data import DEFAULT_CUSTOMIZATION

router = APIRouter()


async def _mark_menu_customized(uid: str):
    """Onboarding: το μαγαζί πείραξε το μενού του (βήμα «Έλεγξε/προσάρμοσε το μενού»)."""
    await db.users.update_one({"id": uid}, {"$set": {"onb_menu": True}})


# ============ MODELS ============
class MenuOption(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    price: float = 0.0


class MenuOptionGroup(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    type: Literal["single", "multi"] = "single"
    required: bool = False
    price_mode: Literal["add", "replace"] = "add"
    options: List[MenuOption] = Field(default_factory=list)


class MenuItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    price: float = Field(ge=0)
    category: str
    customizable: bool = False
    double_meat_eligible: bool = False
    available: bool = True
    unavailable_note: str = ""
    option_groups: List[MenuOptionGroup] = Field(default_factory=list)
    photo_id: Optional[str] = None


class AvailabilityIn(BaseModel):
    available: bool
    unavailable_note: str = ""


class NamedPricedOption(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    price: float = 0.0


class CustomizationConfig(BaseModel):
    bread_options: List[NamedPricedOption] = Field(default_factory=list)
    extras_options: List[NamedPricedOption] = Field(default_factory=list)
    sauces_options: List[NamedPricedOption] = Field(default_factory=list)
    double_meat_price: float = Field(ge=0)


def _coerce_named_priced(items):
    """Backwards-compat: turn plain string option into {name, price:0}."""
    out = []
    for x in items or []:
        if isinstance(x, str):
            out.append({"name": x, "price": 0.0})
        elif isinstance(x, dict) and "name" in x:
            out.append({"name": x["name"], "price": float(x.get("price", 0) or 0)})
    return out


def _normalize_customization(cust: dict) -> dict:
    """Ensure stored customization matches new schema (all option lists as {name, price} dicts)."""
    if not cust:
        return cust
    cust = dict(cust)
    cust["bread_options"] = _coerce_named_priced(cust.get("bread_options"))
    cust["extras_options"] = _coerce_named_priced(cust.get("extras_options"))
    cust["sauces_options"] = _coerce_named_priced(cust.get("sauces_options"))
    return cust


# ============ MENU ROUTES ============
@router.get("/menu/config")
async def get_menu_config(user: dict = Depends(get_current_user)):
    cats = await db.categories.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).sort("order", 1).to_list(500)
    items = await db.items.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).sort("sort_order", 1).to_list(2000)
    # attach photo_url for items with photo_id
    photo_ids = list({i.get("photo_id") for i in items if i.get("photo_id")})
    photo_map = {}
    if photo_ids:
        async for p in db.photos.find(
            {"user_id": user["id"], "id": {"$in": photo_ids}}, {"_id": 0, "id": 1, "data_url": 1}
        ):
            photo_map[p["id"]] = p["data_url"]
    for it in items:
        if it.get("photo_id") and photo_map.get(it["photo_id"]):
            it["photo_url"] = photo_map[it["photo_id"]]
    # customization from user doc, normalized
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "customization": 1})
    cust = u.get("customization") if u else DEFAULT_CUSTOMIZATION
    return {
        "categories": cats,
        "items": items,
        "customization": _normalize_customization(cust) if cust else DEFAULT_CUSTOMIZATION,
    }


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    order: int = 0


@router.post("/menu/categories")
async def create_category(body: CategoryIn, user: dict = Depends(require_manager)):
    # generate slug-ish id
    cid = str(uuid.uuid4())[:8]
    doc = {"id": cid, "name": body.name.strip(), "order": body.order, "user_id": user["id"]}
    await db.categories.insert_one(doc)
    await _mark_menu_customized(user["id"])
    return {"id": cid, "name": body.name.strip(), "order": body.order}


class ReorderIn(BaseModel):
    ids: List[str] = Field(min_length=1)


@router.post("/menu/categories/reorder")
async def reorder_categories(body: ReorderIn, user: dict = Depends(require_manager)):
    """Νέα σειρά κατηγοριών: η θέση στη λίστα ids γίνεται το order."""
    for idx, cid in enumerate(body.ids):
        await db.categories.update_one(
            {"id": cid, "user_id": user["id"]}, {"$set": {"order": idx}}
        )
    return {"ok": True}


@router.post("/menu/items/reorder")
async def reorder_items(body: ReorderIn, user: dict = Depends(require_manager)):
    """Νέα σειρά προϊόντων (μέσα σε μία κατηγορία): η θέση στη λίστα ids γίνεται το sort_order."""
    for idx, iid in enumerate(body.ids):
        await db.items.update_one(
            {"id": iid, "user_id": user["id"]}, {"$set": {"sort_order": idx}}
        )
    return {"ok": True}


@router.put("/menu/categories/{cid}")
async def update_category(cid: str, body: CategoryIn, user: dict = Depends(require_manager)):
    r = await db.categories.update_one(
        {"id": cid, "user_id": user["id"]},
        {"$set": {"name": body.name.strip(), "order": body.order}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    await _mark_menu_customized(user["id"])
    return {"id": cid, "name": body.name.strip(), "order": body.order}


@router.delete("/menu/categories/{cid}")
async def delete_category(cid: str, user: dict = Depends(require_manager)):
    await db.items.delete_many({"user_id": user["id"], "category": cid})
    r = await db.categories.delete_one({"id": cid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    await _mark_menu_customized(user["id"])
    return {"ok": True}


@router.post("/menu/items")
async def create_item(body: MenuItemIn, user: dict = Depends(require_manager)):
    iid = str(uuid.uuid4())
    # Νέο προϊόν μπαίνει στο τέλος της κατηγορίας του
    sort_order = await db.items.count_documents({"user_id": user["id"], "category": body.category})
    doc = {
        "id": iid,
        "user_id": user["id"],
        "name": body.name.strip(),
        "price": float(body.price),
        "category": body.category,
        "customizable": bool(body.customizable),
        "double_meat_eligible": bool(body.double_meat_eligible),
        "available": bool(body.available),
        "unavailable_note": body.unavailable_note.strip(),
        "option_groups": [g.model_dump() for g in body.option_groups],
        "photo_id": body.photo_id,
        "sort_order": sort_order,
    }
    await db.items.insert_one(doc)
    await _mark_menu_customized(user["id"])
    doc.pop("user_id", None)
    doc.pop("_id", None)
    return doc


@router.put("/menu/items/{iid}")
async def update_item(iid: str, body: MenuItemIn, user: dict = Depends(require_manager)):
    update = {
        "name": body.name.strip(),
        "price": float(body.price),
        "category": body.category,
        "customizable": bool(body.customizable),
        "double_meat_eligible": bool(body.double_meat_eligible),
        "available": bool(body.available),
        "unavailable_note": body.unavailable_note.strip(),
        "option_groups": [g.model_dump() for g in body.option_groups],
        "photo_id": body.photo_id,
    }
    r = await db.items.update_one({"id": iid, "user_id": user["id"]}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    await _mark_menu_customized(user["id"])
    return {"id": iid, **update}


@router.patch("/menu/items/{iid}/availability")
async def set_item_availability(iid: str, body: AvailabilityIn, user: dict = Depends(require_staff)):
    r = await db.items.update_one(
        {"id": iid, "user_id": user["id"]},
        {"$set": {"available": bool(body.available), "unavailable_note": body.unavailable_note.strip()}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": iid, "available": body.available, "unavailable_note": body.unavailable_note.strip()}

@router.delete("/menu/items/{iid}")
async def delete_item(iid: str, user: dict = Depends(require_manager)):
    r = await db.items.delete_one({"id": iid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    await _mark_menu_customized(user["id"])
    return {"ok": True}


# ---------- Bulk item operations ----------
class BulkItemsIn(BaseModel):
    ids: List[str] = Field(min_length=1)
    action: Literal[
        "set_price",
        "adjust_price",
        "adjust_price_pct",
        "set_category",
        "set_availability",
        "add_option_group",
        "delete",
    ]
    price: Optional[float] = None
    delta: Optional[float] = None
    pct: Optional[float] = None
    category: Optional[str] = None
    available: Optional[bool] = None
    note: Optional[str] = ""
    group: Optional[MenuOptionGroup] = None


@router.post("/menu/items/bulk")
async def bulk_items(body: BulkItemsIn, user: dict = Depends(require_manager)):
    q = {"user_id": user["id"], "id": {"$in": body.ids}}
    await _mark_menu_customized(user["id"])

    if body.action == "delete":
        r = await db.items.delete_many(q)
        return {"ok": True, "affected": r.deleted_count}

    if body.action == "set_price":
        if body.price is None or body.price < 0:
            raise HTTPException(400, "Άκυρη τιμή")
        r = await db.items.update_many(q, {"$set": {"price": float(body.price)}})
        return {"ok": True, "affected": r.modified_count}

    if body.action == "adjust_price":
        if body.delta is None:
            raise HTTPException(400, "Άκυρη μεταβολή")
        docs = await db.items.find(q, {"_id": 0, "id": 1, "price": 1}).to_list(2000)
        affected = 0
        for d in docs:
            new_price = round(max(0.0, float(d.get("price", 0)) + float(body.delta)), 2)
            await db.items.update_one(
                {"id": d["id"], "user_id": user["id"]},
                {"$set": {"price": new_price}},
            )
            affected += 1
        return {"ok": True, "affected": affected}

    if body.action == "adjust_price_pct":
        if body.pct is None:
            raise HTTPException(400, "Άκυρο ποσοστό")
        docs = await db.items.find(q, {"_id": 0, "id": 1, "price": 1}).to_list(2000)
        affected = 0
        factor = 1 + float(body.pct) / 100.0
        for d in docs:
            new_price = round(max(0.0, float(d.get("price", 0)) * factor), 2)
            await db.items.update_one(
                {"id": d["id"], "user_id": user["id"]},
                {"$set": {"price": new_price}},
            )
            affected += 1
        return {"ok": True, "affected": affected}

    if body.action == "set_category":
        if not body.category:
            raise HTTPException(400, "Άκυρη κατηγορία")
        cat = await db.categories.find_one({"id": body.category, "user_id": user["id"]})
        if not cat:
            raise HTTPException(404, "Η κατηγορία δεν βρέθηκε")
        r = await db.items.update_many(q, {"$set": {"category": body.category}})
        return {"ok": True, "affected": r.modified_count}

    if body.action == "set_availability":
        if body.available is None:
            raise HTTPException(400, "Άκυρη τιμή διαθεσιμότητας")
        r = await db.items.update_many(
            q,
            {"$set": {"available": bool(body.available), "unavailable_note": (body.note or "").strip()}},
        )
        return {"ok": True, "affected": r.modified_count}

    if body.action == "add_option_group":
        if body.group is None:
            raise HTTPException(400, "Απαιτείται ομάδα")
        group_doc = body.group.model_dump()
        docs = await db.items.find(q, {"_id": 0, "id": 1, "option_groups": 1}).to_list(2000)
        affected = 0
        for d in docs:
            existing = d.get("option_groups", []) or []
            others = [g for g in existing if g.get("id") != group_doc["id"]]
            new_groups = others + [group_doc]
            await db.items.update_one(
                {"id": d["id"], "user_id": user["id"]},
                {"$set": {"option_groups": new_groups}},
            )
            affected += 1
        return {"ok": True, "affected": affected}

    raise HTTPException(400, "Άκυρη ενέργεια")


@router.put("/menu/customization")
async def update_customization(body: CustomizationConfig, user: dict = Depends(require_manager)):
    payload = body.model_dump()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"customization": payload}},
    )
    return payload


# ============ PHOTO LIBRARY ============
class PhotoIn(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    data_url: str = Field(min_length=10, max_length=6_000_000)  # cap ~6MB base64


@router.get("/photos")
async def list_photos(user: dict = Depends(require_manager)):
    docs = await db.photos.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("created_at", -1).to_list(500)
    return docs


@router.post("/photos")
async def create_photo(body: PhotoIn, user: dict = Depends(require_manager)):
    if not body.data_url.startswith("data:image/"):
        raise HTTPException(400, "Δεν είναι εικόνα (data URL)")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "filename": body.filename.strip(),
        "data_url": body.data_url,
        "size_bytes": len(body.data_url),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.photos.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@router.post("/photos/import-stock/{stock_id}")
async def import_stock_photo(stock_id: str, user: dict = Depends(require_manager)):
    """Επιλογή stock φωτογραφίας από τη βιβλιοθήκη OrderDeck → προσωπικό αντίγραφο.

    Δημιουργεί ένα φυσιολογικό photo doc του μαγαζιού ώστε η αντιστοίχιση σε προϊόν
    (photo_id) και η ανάλυση σε photo_url να δουλεύουν χωρίς αλλαγές. Idempotent:
    αν έχει ήδη εισαχθεί η ίδια stock φωτογραφία, επιστρέφει το υπάρχον αντίγραφο.
    """
    stock = await db.stock_photos.find_one({"id": stock_id}, {"_id": 0})
    if not stock:
        raise HTTPException(404, "Η φωτογραφία δεν βρέθηκε")
    existing = await db.photos.find_one(
        {"user_id": user["id"], "source_stock_id": stock_id}, {"_id": 0, "user_id": 0}
    )
    if existing:
        return existing
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "filename": stock.get("product_label") or "OrderDeck",
        "data_url": stock["data_url"],
        "size_bytes": len(stock["data_url"]),
        "source_stock_id": stock_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.photos.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@router.delete("/photos/{pid}")
async def delete_photo(pid: str, user: dict = Depends(require_manager)):
    r = await db.photos.delete_one({"id": pid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    # unlink from any items
    await db.items.update_many(
        {"user_id": user["id"], "photo_id": pid},
        {"$set": {"photo_id": None}},
    )
    return {"ok": True}
