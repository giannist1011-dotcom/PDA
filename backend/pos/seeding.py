"""Αρχικοποίηση δεδομένων POS: μενού/ελλείψεις/τραπέζια από preset, migrations
και ο seeded demo λογαριασμός «Πεινώκιο».

Ζει στο pos/ γιατί όλα όσα γράφει (categories, items, stock_*, tables) ανήκουν
στο POS domain — το shared δεν ξέρει τι είναι «μενού».
"""
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from shared.core import ai_features_global, db, hash_password, verify_password
from pos.presets import PRESETS, DEFAULT_TABLE_NAMES
from pos.seed_data import DEFAULT_CUSTOMIZATION

logger = logging.getLogger("orderdeck.pos.seeding")


# ============ MIGRATIONS ============
async def migrate_items_sort_order():
    """Backfill sort_order σε υπάρχοντα προϊόντα: σειρά εισαγωγής ανά (χρήστη, κατηγορία).

    Idempotent — αγγίζει μόνο docs χωρίς sort_order· μετά το πρώτο deploy δεν κάνει τίποτα.
    """
    counters = {}
    async for it in db.items.find(
        {"sort_order": {"$exists": False}}, {"_id": 1, "user_id": 1, "category": 1}
    ).sort("_id", 1):
        key = (it["user_id"], it.get("category"))
        order = counters.get(key, 0)
        counters[key] = order + 1
        await db.items.update_one({"_id": it["_id"]}, {"$set": {"sort_order": order}})


# ============ SEEDING ============
async def seed_user_menu(user_id: str, preset: Optional[dict] = None):
    """Create default categories, customization config and menu items for a user."""
    # customization config on user document already; here we insert items & categories.
    preset = preset or PRESETS["souvlaki"]
    await db.categories.insert_many([
        {"id": c["id"], "name": c["name"], "order": c["order"], "user_id": user_id}
        for c in preset["categories"]
    ])
    docs = []
    cat_counters = {}  # sort_order ανά κατηγορία, με τη σειρά του preset
    for it in preset["items"]:
        order = cat_counters.get(it["category"], 0)
        cat_counters[it["category"]] = order + 1
        docs.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "name": it["name"],
            "price": float(it["price"]),
            "category": it["category"],
            "customizable": it.get("customizable", False),
            "double_meat_eligible": it.get("double_meat_eligible", False),
            "option_groups": it.get("option_groups", []),
            "photo_id": None,
            "available": True,
            "unavailable_note": "",
            "sort_order": order,
        })
    await db.items.insert_many(docs)


async def seed_account_from_preset(user_id: str, preset: dict, has_tables: bool):
    """Menu, stock categories and default tables for a freshly registered account."""
    await seed_user_menu(user_id, preset)
    stock_names = preset.get("stock_categories") or []
    if stock_names:
        cat_docs = [
            {"id": str(uuid.uuid4())[:8], "user_id": user_id, "name": n, "order": i}
            for i, n in enumerate(stock_names)
        ]
        await db.stock_categories.insert_many(cat_docs)
        # Είδη (υποπροϊόντα) κάτω από κάθε κατηγορία ελλείψεων
        stock_items = preset.get("stock_items") or {}
        now = datetime.now(timezone.utc).isoformat()
        item_docs = []
        for cat in cat_docs:
            # Κάθε είδος: σκέτο όνομα ή {"name": ..., "variants": [...]} για είδη
            # με παραλλαγές (π.χ. Σακούλες → 35άρες/40άρες/45άρες)
            for order, entry in enumerate(stock_items.get(cat["name"]) or []):
                name = entry["name"] if isinstance(entry, dict) else entry
                variants = entry.get("variants") or [] if isinstance(entry, dict) else []
                item_docs.append({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "name": name,
                    "category_id": cat["id"],
                    "order": order,
                    "available": True,
                    "note": "",
                    "variants": [
                        {"id": str(uuid.uuid4())[:8], "name": v} for v in variants
                    ],
                    "selected_variant_ids": [],
                    "shopping_item_id": None,
                    "created_at": now,
                })
        if item_docs:
            await db.stock_items.insert_many(item_docs)
    if has_tables:
        await db.tables.insert_many([
            {"id": str(uuid.uuid4())[:8], "user_id": user_id, "name": n, "order": i}
            for i, n in enumerate(DEFAULT_TABLE_NAMES)
        ])


async def ensure_demo_account():
    demo_email = os.environ.get("DEMO_EMAIL", "demo@peinokio.gr").lower()
    demo_pw = os.environ.get("DEMO_PASSWORD", "demo1234")
    existing = await db.users.find_one({"email": demo_email})
    if existing:
        # Update password if changed
        if not verify_password(demo_pw, existing.get("password_hash", "")):
            await db.users.update_one(
                {"email": demo_email},
                {"$set": {"password_hash": hash_password(demo_pw)}},
            )
        # Το seeded demo έχει ενεργά τα AI features ΜΟΝΟ όταν ο global διακόπτης
        # AI_FEATURES_GLOBAL είναι ON — αλλιώς ο κανόνας δεν τρέχει καθόλου (αυτός
        # ο κανόνας ήταν που ξανα-άναβε το toggle σε κάθε restart του backend)
        if ai_features_global() and not existing.get("ai_features_enabled"):
            await db.users.update_one(
                {"email": demo_email}, {"$set": {"ai_features_enabled": True}}
            )
        # Το seeded demo τρέχει στο πλάνο «OrderDeck Fleet» (POS + FleetDeck
        # καταστήματος στο ίδιο session) — εκεί δοκιμάζεται η πλήρης επιφάνεια
        if existing.get("plan") != "orderdeck_fleet":
            await db.users.update_one(
                {"email": demo_email}, {"$set": {"plan": "orderdeck_fleet"}}
            )
        # Backfill default PINs if missing
        if "owner_pin_hash" not in existing:
            await db.users.update_one(
                {"email": demo_email},
                {"$set": {
                    "owner_pin_hash": hash_password("0000"),
                    "employee_pin_hash": hash_password("0000"),
                    "owner_pin_set": False,
                    "employee_pin_set": False,
                }},
            )
        return
    uid = str(uuid.uuid4())
    user_doc = {
        "id": uid,
        "email": demo_email,
        "password_hash": hash_password(demo_pw),
        "restaurant_name": "Πεινώκιο",
        "customization": DEFAULT_CUSTOMIZATION,
        "owner_pin_hash": hash_password("0000"),
        "employee_pin_hash": hash_password("0000"),
        "owner_pin_set": False,
        "employee_pin_set": False,
        # demo λογαριασμός: AI features μόνο αν είναι ON ο global διακόπτης
        "ai_features_enabled": ai_features_global(),
        # ΚΑΤΑΣΤΗΜΑ — ποτέ εταιρεία διανομής: το πλάνο δίνει πρόσβαση στο FleetDeck,
        # δεν αλλάζει την ταυτότητα του λογαριασμού
        "account_type": "store",
        "plan": "orderdeck_fleet",  # πλήρης επιφάνεια: POS + FleetDeck καταστήματος
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    await seed_user_menu(uid)
    logger.info("Seeded demo Πεινώκιο account: %s", demo_email)