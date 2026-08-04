"""ΔΗΜΟΣΙΑ ΔΙΕΠΑΦΗ του domain «pos».

ΚΑΝΟΝΑΣ: κανένα άλλο domain (fleet/, platforms/, admin/, shared/) δεν αγγίζει τα
collections orders/items/categories/tables/... απευθείας — όλα περνούν από εδώ.
Αντίστροφα, το pos μιλάει στο FleetDeck ΜΟΝΟ μέσω του fleet.api.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from shared.core import actor_name, db

# Ζωντανή παραγγελία POS: ούτε ακυρωμένη ούτε προγραμματισμένη
LIVE_ORDER_MATCH = {"cancelled": {"$ne": True}}


# ============ ΑΡΧΙΚΟΠΟΙΗΣΗ ΛΟΓΑΡΙΑΣΜΟΥ ============
def preset_for(business_type: Optional[str]) -> dict:
    """Το preset μενού/ελλείψεων του τύπου επιχείρησης (fallback: σουβλατζίδικο)."""
    from pos.presets import PRESETS
    return PRESETS.get(business_type or "", PRESETS["souvlaki"])


async def seed_account(user_id: str, preset: dict, has_tables: bool) -> None:
    """Μενού, κατηγορίες ελλείψεων και τραπέζια για νέο λογαριασμό."""
    from pos.seeding import seed_account_from_preset
    await seed_account_from_preset(user_id, preset, has_tables)


# ============ ΑΡΙΘΜΗΣΗ ============
async def next_order_number(user: dict) -> int:
    """Ο επόμενος αριθμός της εργάσιμης ημέρας — ίδιος μετρητής με το ταμείο."""
    from pos.orders import compute_next_order_number
    return await compute_next_order_number(user)


# ============ ΕΞΩΤΕΡΙΚΕΣ ΠΑΡΑΓΓΕΛΙΕΣ (πλατφόρμες) ============
async def create_external_order(
    user: dict,
    *,
    source: str,
    items: list,
    subtotal: float,
    total: float,
    note: Optional[str] = None,
    delivery_fee: Optional[float] = None,
    delivery: Optional[dict] = None,
    platform: Optional[str] = None,
    platform_ref: Optional[str] = None,
    platform_order_id: Optional[str] = None,
    platform_due_at: Optional[str] = None,
) -> dict:
    """Μια παραγγελία που ήρθε από έξω (efood/Box/Wolt) γίνεται ΚΑΝΟΝΙΚΗ
    παραγγελία POS, ώστε να μετράει παντού (Ιστορικό, Z, Στατιστικά)."""
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "order_number": await next_order_number(user),
        "source": source,
        "items": items,
        "subtotal": subtotal,
        "total": total,
        "note": note or None,
        "delivery_fee": delivery_fee or None,
        "discount": None,
        "delivery": delivery,
        "scheduled_at": None,
        "table_name": None,
        "created_at": now.isoformat(),
        "status": "active",
        "cancelled": False,
        "taken_by": {
            "profile_id": user.get("profile_id"),
            "name": actor_name(user),
            "role": user.get("role"),
        },
        "edits": [],
        # Σήμανση πλατφόρμας — banner στην απόδειξη + countdown στη λίστα
        "platform": platform,
        "platform_ref": platform_ref,
        "platform_order_id": platform_order_id,
        "platform_due_at": platform_due_at,
        # Σύνδεση με FleetDeck — γεμίζει μόνο όταν ανέβει σε εταιρεία διανομής
        "fleet_order_id": None,
    }
    await db.orders.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


async def set_platform_due_at(user_id: str, order_id: str, due_at: str) -> None:
    """Αλλαγή χρόνου παράδοσης από την πλατφόρμα → ενημερώνεται το countdown."""
    await db.orders.update_one(
        {"id": order_id, "user_id": user_id}, {"$set": {"platform_due_at": due_at}}
    )


async def available_menu_items(user_id: str, limit: int = 400) -> list:
    """Διαθέσιμα είδη του μενού (όνομα + τιμή) — για τις δοκιμαστικές παραγγελίες
    πλατφορμών, ώστε να μοιάζουν με πραγματικές."""
    return await db.items.find(
        {"user_id": user_id, "available": {"$ne": False}},
        {"_id": 0, "name": 1, "price": 1},
    ).to_list(limit)


# ============ ΑΝΑΦΟΡΕΣ ΓΙΑ ΤΟ ADMIN PANEL (read-only) ============
# ΑΠΟΡΡΗΤΟ ΠΕΛΑΤΗ: το admin panel ΔΕΝ βλέπει επιδόσεις μαγαζιών (πλήθος
# παραγγελιών/τζίρο). Επιστρέφεται μόνο η τελευταία δραστηριότητα (σήμα υγείας
# λογαριασμού). Εξαίρεση: demo λογαριασμοί (δικοί μας) — with_totals=True.
async def shop_order_stats(user_id: str, with_totals: bool = False) -> dict:
    """Τελευταία παραγγελία ενός μαγαζιού (καρτέλα admin). Με with_totals
    (ΜΟΝΟ demo) και πλήθος/τζίρο."""
    out: dict = {"last_activity": None}
    if with_totals:
        out.update({"orders_count": 0, "orders_revenue": 0})
    group = {"_id": None, "last": {"$max": "$created_at"}}
    if with_totals:
        group["n"] = {"$sum": 1}
        group["revenue"] = {"$sum": {"$ifNull": ["$total", 0]}}
    async for row in db.orders.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": group},
    ]):
        out["last_activity"] = row["last"]
        if with_totals:
            out["orders_count"] = row["n"]
            out["orders_revenue"] = round(row["revenue"], 2)
    return out


async def shops_activity(user_ids: list, totals_for: set | None = None) -> dict:
    """{user_id: {last_activity, [orders_count, orders_revenue]}} για τη λίστα
    του admin — μία σάρωση, όχι N+1. Πλήθος/τζίρος ΜΟΝΟ για τα user_ids του
    totals_for (demo λογαριασμοί)."""
    out: dict = {uid: {"last_activity": None} for uid in user_ids}
    if not user_ids:
        return out
    async for r in db.orders.aggregate([
        {"$match": {"user_id": {"$in": list(user_ids)}}},
        {"$group": {
            "_id": "$user_id", "n": {"$sum": 1}, "last": {"$max": "$created_at"},
            "revenue": {"$sum": {"$ifNull": ["$total", 0]}},
        }},
    ]):
        row = out.get(r["_id"])
        if row is None:
            continue
        row["last_activity"] = r["last"]
        if totals_for and r["_id"] in totals_for:
            row["orders_count"] = r["n"]
            row["orders_revenue"] = round(r["revenue"] or 0, 2)
    for uid in (totals_for or set()):
        if uid in out:
            out[uid].setdefault("orders_count", 0)
            out[uid].setdefault("orders_revenue", 0)
    return out


async def shop_usage(user_id: str) -> dict:
    """Πλήθος ειδών μενού + αν το μαγαζί χρησιμοποιεί DeckPilot."""
    return {
        "items_count": await db.items.count_documents({"user_id": user_id}),
        "uses_deckpilot": bool(await db.ai_usage.find_one({"user_id": user_id}, {"_id": 1})),
    }


def onboarding_projection() -> dict:
    """Τα πεδία onboarding που πρέπει να έρθουν στο projection ενός μαγαζιού."""
    from pos.onboarding import ONB_PROJECT
    return dict(ONB_PROJECT)


def onboarding_progress(shop: dict) -> dict:
    """Η πρόοδος onboarding από τα ήδη διαβασμένα πεδία του μαγαζιού."""
    from pos.onboarding import onboarding_progress as _p
    return _p(shop)


async def onboarding_state(user_id: str):
    """Πλήρης κατάσταση onboarding ενός μαγαζιού (καρτέλα admin)."""
    from pos.onboarding import fetch_onboarding
    return await fetch_onboarding(user_id)


# ============ ΣΥΝΔΕΣΗ ΜΕ FLEETDECK ============
async def get_uploadable_delivery_order(user_id: str, order_id: str) -> Optional[dict]:
    """Η POS παραγγελία που ζητήθηκε να ανέβει σε εταιρεία διανομής — μόνο αν
    είναι ζωντανή παραγγελία ΠΑΡΑΔΟΣΗΣ. None σε κάθε άλλη περίπτωση."""
    o = await db.orders.find_one(
        {"id": order_id, "user_id": user_id, **LIVE_ORDER_MATCH}, {"_id": 0}
    )
    if not o:
        return None
    if (o.get("delivery") or {}).get("delivery_type") != "delivery":
        return None
    return o


async def unlinked_delivery_orders(user_id: str, since_iso: str) -> list:
    """Ζωντανές παραγγελίες παράδοσης του καταστήματος που δεν έχουν ανέβει
    πουθενά — υποψήφιες για το migration της σύνδεσης."""
    return await db.orders.find(
        {
            "user_id": user_id,
            "created_at": {"$gte": since_iso},
            "delivery.delivery_type": "delivery",
            "fleet_order_id": None,
            **LIVE_ORDER_MATCH,
        },
        {"_id": 0, "id": 1, "created_at": 1, "delivery": 1},
    ).to_list(2000)


async def link_fleet_order(user_id: str, order_id: str, fleet_order: dict) -> None:
    """Γράφει στην POS παραγγελία τη ΜΟΝΑΔΙΚΗ αναφορά προς το FleetDeck. Το
    αντίστροφο (source_pos_order_id) το γράφει το fleet domain."""
    await db.orders.update_one(
        {"id": order_id, "user_id": user_id},
        {"$set": {
            "fleet_order_id": fleet_order["id"],
            "fleet_team_id": fleet_order.get("team_id"),
            "fleet_team_name": fleet_order.get("team_name"),
            "fleet_status": fleet_order.get("status"),
            "fleet_status_at": datetime.now(timezone.utc).isoformat(),
            "fleet_driver_name": None,
        }},
    )


async def set_fleet_status(
    user_id: str, order_id: str, status: str, driver_name: Optional[str] = None
) -> None:
    """Κάθε αλλαγή κατάστασης στο FleetDeck καθρεφτίζεται στην κάρτα του POS."""
    await db.orders.update_one(
        {"id": order_id, "user_id": user_id},
        {"$set": {
            "fleet_status": status,
            "fleet_driver_name": driver_name,
            "fleet_status_at": datetime.now(timezone.utc).isoformat(),
        }},
    )


async def unlink_fleet_order(user_id: str, order_id: str) -> None:
    """Η fleet παραγγελία έπαψε να υπάρχει (διαγραφή αδημοσίευτης) — η POS
    παραγγελία ξαναγίνεται «μη ανεβασμένη» και μπορεί να ανέβει αλλού."""
    await db.orders.update_one(
        {"id": order_id, "user_id": user_id},
        {"$set": {"fleet_order_id": None, "fleet_team_id": None,
                  "fleet_team_name": None, "fleet_status": None,
                  "fleet_driver_name": None, "fleet_status_at": None}},
    )


# ============ ΚΥΚΛΟΣ ΖΩΗΣ ΛΟΓΑΡΙΑΣΜΟΥ ============
# Όλα τα per-user collections του POS — για ΠΛΗΡΗ διαγραφή λογαριασμού.
PER_USER_COLLECTIONS = [
    "categories", "items", "orders", "shopping",
    "stock_categories", "stock_items", "photos", "employees", "shifts",
    "expense_categories", "expenses", "day_reports", "tables", "table_tabs",
    "ai_usage", "ai_briefs", "checklist_templates", "checklist_ticks",
    "shortage_prints",
]


async def purge_store_data(user_id: str) -> None:
    for coll in PER_USER_COLLECTIONS:
        await db[coll].delete_many({"user_id": user_id})
