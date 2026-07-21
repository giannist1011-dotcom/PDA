"""Τραπέζια & καρτέλες (tabs), ρυθμίσεις επιχείρησης/τραπεζιών."""
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from core import db, get_current_user, require_owner, require_manager, actor_name
from routers.orders import Order, OrderItem, compute_next_order_number

router = APIRouter()


# ============ TABLES (dine-in tabs) ============
class TableIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    order: int = 0


class TablesToggleIn(BaseModel):
    enabled: bool


class TablesReorderIn(BaseModel):
    ids: List[str] = Field(min_length=1)


class TabRoundIn(BaseModel):
    items: List[OrderItem] = Field(min_length=1)


class TabTransferIn(BaseModel):
    table_id: str


def tab_total(tab: dict) -> float:
    return round(
        sum(
            it.get("line_total", 0)
            for r in tab.get("rounds", [])
            for it in r.get("items", [])
        ),
        2,
    )


class BusinessTypeIn(BaseModel):
    business_type: Literal["souvlaki", "cafe", "pizzeria", "burger"]


@router.put("/settings/business")
async def update_business_type(body: BusinessTypeIn, user: dict = Depends(require_owner)):
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"business_type": body.business_type}}
    )
    return {"business_type": body.business_type}


class HoursRange(BaseModel):
    start: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    end: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


class DayHours(BaseModel):
    closed: bool = False
    ranges: List[HoursRange] = Field(default_factory=list, max_length=2)


WEEK_DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


class StoreDetailsIn(BaseModel):
    restaurant_name: str = Field(min_length=1, max_length=80)
    store_phone: Optional[str] = Field(default=None, max_length=60)
    store_address: Optional[str] = Field(default=None, max_length=200)
    store_city: Optional[str] = Field(default=None, max_length=80)
    store_lat: Optional[float] = Field(default=None, ge=-90, le=90)
    store_lng: Optional[float] = Field(default=None, ge=-180, le=180)
    # Ζώνη διανομής γύρω από το pin του μαγαζιού — κόβει τα αποτελέσματα του autocomplete
    delivery_radius_km: Optional[float] = Field(default=6, ge=1, le=100)
    # Ωράριο ανά ημέρα (mon..sun) — έως 2 βάρδιες/ημέρα, overnight όταν end < start
    store_hours: Optional[dict[str, DayHours]] = None
    google_review_link: Optional[str] = Field(default=None, max_length=300)


@router.put("/settings/store")
async def update_store_details(body: StoreDetailsIn, user: dict = Depends(require_owner)):
    """Στοιχεία καταστήματος — όνομα, τηλέφωνο, διεύθυνση, συντεταγμένες (lat/lng)."""
    hours = {}
    for day, dh in (body.store_hours or {}).items():
        if day in WEEK_DAYS:
            hours[day] = dh.model_dump()
    fields = {
        "restaurant_name": body.restaurant_name.strip(),
        "store_phone": (body.store_phone or "").strip(),
        "store_address": (body.store_address or "").strip(),
        "store_city": (body.store_city or "").strip(),
        "store_lat": body.store_lat,
        "store_lng": body.store_lng,
        "delivery_radius_km": body.delivery_radius_km or 6,
        "store_hours": hours,
        "google_review_link": (body.google_review_link or "").strip(),
    }
    await db.users.update_one({"id": user["id"]}, {"$set": fields})
    # Πόλη/θέση επηρεάζουν το geocoding του live χάρτη — καθάρισε το cache
    # ώστε να ξαναδοκιμαστούν οι διευθύνσεις με τα νέα στοιχεία
    if (
        fields["store_city"] != (user.get("store_city") or "")
        or fields["store_lat"] != user.get("store_lat")
        or fields["store_lng"] != user.get("store_lng")
    ):
        await db.geocode_cache.delete_many({"user_id": user["id"]})
    return fields


class PrintingIn(BaseModel):
    copies: int = Field(ge=1, le=10)
    copy_labels: bool = False
    double_print: bool = False


@router.put("/settings/printing")
async def update_printing(body: PrintingIn, user: dict = Depends(require_owner)):
    """Ρυθμίσεις εκτύπωσης — αποθηκεύονται στον λογαριασμό, έρχονται με το /auth/me."""
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "print_copies": body.copies,
                "print_copy_labels": bool(body.copy_labels),
                "print_double": bool(body.double_print),
            }
        },
    )
    return {
        "copies": body.copies,
        "copy_labels": bool(body.copy_labels),
        "double_print": bool(body.double_print),
    }


@router.put("/settings/tables")
async def toggle_tables(body: TablesToggleIn, user: dict = Depends(require_owner)):
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"tables_enabled": bool(body.enabled)}}
    )
    return {"enabled": bool(body.enabled)}


@router.get("/tables/state")
async def tables_state(user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "tables_enabled": 1})
    enabled = bool(u.get("tables_enabled", False)) if u else False
    tables = await db.tables.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("order", 1).to_list(200)
    tabs = await db.table_tabs.find(
        {"user_id": user["id"], "status": "open"}, {"_id": 0, "user_id": 0}
    ).to_list(200)
    by_table = {}
    for t in tabs:
        by_table[t["table_id"]] = {
            "tab_id": t["id"],
            "total": tab_total(t),
            "rounds_count": len(t.get("rounds", [])),
            "opened_at": t.get("opened_at"),
        }
    for tbl in tables:
        tbl["tab"] = by_table.get(tbl["id"])
    return {"enabled": enabled, "tables": tables}


@router.post("/tables")
async def create_table(body: TableIn, user: dict = Depends(require_manager)):
    count = await db.tables.count_documents({"user_id": user["id"]})
    doc = {
        "id": str(uuid.uuid4())[:8],
        "user_id": user["id"],
        "name": body.name.strip(),
        "order": body.order if body.order else count,
    }
    await db.tables.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@router.post("/tables/reorder")
async def reorder_tables(body: TablesReorderIn, user: dict = Depends(require_manager)):
    for idx, tid in enumerate(body.ids):
        await db.tables.update_one(
            {"id": tid, "user_id": user["id"]}, {"$set": {"order": idx}}
        )
    return {"ok": True}


@router.put("/tables/{tid}")
async def update_table(tid: str, body: TableIn, user: dict = Depends(require_manager)):
    r = await db.tables.update_one(
        {"id": tid, "user_id": user["id"]},
        {"$set": {"name": body.name.strip(), "order": body.order}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": tid, "name": body.name.strip(), "order": body.order}


@router.delete("/tables/{tid}")
async def delete_table(tid: str, user: dict = Depends(require_manager)):
    open_tab = await db.table_tabs.find_one(
        {"user_id": user["id"], "table_id": tid, "status": "open"}
    )
    if open_tab:
        raise HTTPException(400, "Το τραπέζι έχει ανοιχτή καρτέλα — κλείστε την πρώτα")
    r = await db.tables.delete_one({"id": tid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@router.get("/tables/{tid}/tab")
async def get_table_tab(tid: str, user: dict = Depends(get_current_user)):
    table = await db.tables.find_one(
        {"id": tid, "user_id": user["id"]}, {"_id": 0, "user_id": 0}
    )
    if not table:
        raise HTTPException(404, "Το τραπέζι δεν βρέθηκε")
    tab = await db.table_tabs.find_one(
        {"user_id": user["id"], "table_id": tid, "status": "open"},
        {"_id": 0, "user_id": 0},
    )
    if tab:
        tab["total"] = tab_total(tab)
    return {"table": table, "tab": tab}


@router.post("/tables/{tid}/rounds")
async def send_round(tid: str, body: TabRoundIn, user: dict = Depends(get_current_user)):
    """Αποστολή: append a round to the table's open tab (create the tab if needed)."""
    table = await db.tables.find_one({"id": tid, "user_id": user["id"]})
    if not table:
        raise HTTPException(404, "Το τραπέζι δεν βρέθηκε")
    now = datetime.now(timezone.utc).isoformat()
    tab = await db.table_tabs.find_one(
        {"user_id": user["id"], "table_id": tid, "status": "open"}
    )
    if not tab:
        tab = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "table_id": tid,
            "status": "open",
            "opened_at": now,
            "opened_by": {"name": actor_name(user), "role": user.get("role")},
            "rounds": [],
        }
        await db.table_tabs.insert_one(tab)
    round_doc = {
        "round_no": len(tab.get("rounds", [])) + 1,
        "items": [it.model_dump() for it in body.items],
        "sent_at": now,
        "sent_by": {"name": actor_name(user), "role": user.get("role")},
    }
    await db.table_tabs.update_one(
        {"id": tab["id"], "user_id": user["id"]}, {"$push": {"rounds": round_doc}}
    )
    fresh = await db.table_tabs.find_one(
        {"id": tab["id"], "user_id": user["id"]}, {"_id": 0, "user_id": 0}
    )
    fresh["total"] = tab_total(fresh)
    return {"tab": fresh, "round": round_doc, "table": {"id": table["id"], "name": table["name"]}}


@router.post("/tabs/{tab_id}/close", response_model=Order)
async def close_tab(tab_id: str, user: dict = Depends(get_current_user)):
    """Κλείσιμο τραπεζιού: turn the tab into a normal completed order and free the table."""
    tab = await db.table_tabs.find_one(
        {"id": tab_id, "user_id": user["id"], "status": "open"}
    )
    if not tab:
        raise HTTPException(404, "Η καρτέλα δεν βρέθηκε")
    table = await db.tables.find_one({"id": tab["table_id"], "user_id": user["id"]})
    table_name = table["name"] if table else "Τραπέζι"
    items = [it for r in tab.get("rounds", []) for it in r.get("items", [])]
    if not items:
        raise HTTPException(400, "Η καρτέλα είναι άδεια")
    total = tab_total(tab)
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "order_number": await compute_next_order_number(user["id"]),
        "items": items,
        "subtotal": total,
        "total": total,
        "source": "Τραπέζι",
        "table_name": table_name,
        "note": None,
        "delivery": None,
        "scheduled_at": None,
        "discount": None,
        "created_at": now.isoformat(),
        "status": "active",
        "taken_by": {
            "profile_id": user.get("profile_id"),
            "name": actor_name(user),
            "role": user.get("role"),
        },
    }
    await db.orders.insert_one(doc)
    await db.table_tabs.delete_one({"id": tab_id, "user_id": user["id"]})
    doc.pop("_id", None)
    doc["created_at"] = now
    return doc


@router.post("/tabs/{tab_id}/transfer")
async def transfer_tab(tab_id: str, body: TabTransferIn, user: dict = Depends(get_current_user)):
    tab = await db.table_tabs.find_one(
        {"id": tab_id, "user_id": user["id"], "status": "open"}
    )
    if not tab:
        raise HTTPException(404, "Η καρτέλα δεν βρέθηκε")
    target = await db.tables.find_one({"id": body.table_id, "user_id": user["id"]})
    if not target:
        raise HTTPException(404, "Το τραπέζι δεν βρέθηκε")
    occupied = await db.table_tabs.find_one(
        {"user_id": user["id"], "table_id": body.table_id, "status": "open"}
    )
    if occupied:
        raise HTTPException(400, "Το τραπέζι προορισμού έχει ήδη ανοιχτή καρτέλα")
    await db.table_tabs.update_one(
        {"id": tab_id, "user_id": user["id"]}, {"$set": {"table_id": body.table_id}}
    )
    return {"ok": True, "table_id": body.table_id, "table_name": target["name"]}
