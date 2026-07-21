"""FastAPI server for OrderDeck multi-tenant POS SaaS — app setup μόνο.

Τα endpoints ζουν στα routers/ (ένα ανά feature)· τα κοινά (db, auth, seeding) στο core.py.
"""
import logging
import os

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from core import client, db, ensure_demo_account, migrate_items_sort_order
from routers import auth, menu, orders, tables, stock, schedule, stats, expenses, promo, public_menu, stock_photos, ai, checklist, admin, announcements, onboarding

app = FastAPI(title="OrderDeck")

api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"status": "ok", "service": "OrderDeck"}


# Uptime ping κάθε 5' — χωρίς auth και χωρίς DB query, σχεδόν μηδενικό κόστος
@app.get("/health")
async def health():
    return {"status": "ok"}


# Route registration order matters for overlapping paths (literal before {param}),
# which each router preserves internally — same order as the old monolith.
api.include_router(auth.router)
api.include_router(menu.router)
api.include_router(orders.router)
api.include_router(stats.router)
api.include_router(stock.router)
api.include_router(schedule.router)
api.include_router(expenses.router)
api.include_router(tables.router)
api.include_router(promo.router)
api.include_router(public_menu.router)
api.include_router(stock_photos.router)
api.include_router(ai.router)
api.include_router(checklist.router)
api.include_router(admin.router)
api.include_router(announcements.router)
api.include_router(onboarding.router)

app.include_router(api)

# CORS: μόνο τα origins του CORS_ORIGINS (comma-separated). Χωρίς env var → "*"
# με warning, ώστε το local dev να δουλεύει χωρίς setup.
_cors_env = os.environ.get("CORS_ORIGINS", "").strip()
if _cors_env:
    cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
else:
    cors_origins = ["*"]
    logging.getLogger("orderdeck").warning(
        "CORS_ORIGINS not set — allowing ALL origins (dev fallback, do not use in production)"
    )

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.categories.create_index([("user_id", 1)])
    await db.items.create_index([("user_id", 1)])
    await db.items.create_index([("user_id", 1), ("sort_order", 1)])
    await db.orders.create_index([("user_id", 1), ("created_at", -1)])
    # Offline sync: idempotency ανά client_id (μόνο όσες παραγγελίες το έχουν)
    await db.orders.create_index([("user_id", 1), ("client_id", 1)], sparse=True)
    await db.shopping.create_index([("user_id", 1), ("created_at", 1)])
    await db.stock_categories.create_index([("user_id", 1), ("order", 1)])
    await db.stock_items.create_index([("user_id", 1), ("category_id", 1)])
    await db.photos.create_index([("user_id", 1), ("created_at", -1)])
    await db.employees.create_index([("user_id", 1), ("order", 1)])
    await db.shifts.create_index([("user_id", 1), ("week_start", 1)])
    await db.shifts.create_index(
        [("user_id", 1), ("employee_id", 1), ("week_start", 1), ("day", 1)],
        unique=True,
    )
    await db.expense_categories.create_index([("user_id", 1), ("order", 1)])
    await db.expenses.create_index([("user_id", 1), ("date", -1)])
    await db.day_reports.create_index([("user_id", 1), ("closed_at", -1)])
    await db.profiles.create_index([("user_id", 1), ("created_at", 1)])
    await db.tables.create_index([("user_id", 1), ("order", 1)])
    await db.table_tabs.create_index([("user_id", 1), ("table_id", 1), ("status", 1)])
    await db.promo_codes.create_index("code", unique=True)
    await db.stock_photos.create_index([("business_type", 1), ("uploaded_at", -1)])
    await db.users.create_index([("promo.code", 1)], sparse=True)
    await db.users.create_index("public_slug", unique=True, sparse=True)
    # Demo λογαριασμοί: γρήγορο εντοπισμό ληγμένων για το auto-cleanup
    await db.users.create_index([("is_demo", 1), ("demo_expires_at", 1)], sparse=True)
    await db.demo_leads.create_index([("created_at", -1)])
    # Admin panel: λίστα "λήγουν σύντομα" (χειροκίνητες συνδρομές)
    await db.users.create_index([("subscription_expires_at", 1)], sparse=True)
    # Live χάρτης: geocode cache ανά διεύθυνση (μία γεωκωδικοποίηση ανά διεύθυνση)
    await db.geocode_cache.create_index([("user_id", 1), ("address", 1)], unique=True)
    # Μία φορά: πέτα entries από πριν το city/viewbox geocoding (χωρίς πεδίο "q") —
    # περιλαμβάνει και failed και λάθος-πόλης αποτελέσματα· θα ξανα-γεωκωδικοποιηθούν
    await db.geocode_cache.delete_many({"q": {"$exists": False}})
    # Checklist ανοίγματος/κλεισίματος: templates + ημερήσια τικ (ένα ανά item/μέρα)
    await db.checklist_templates.create_index([("user_id", 1), ("list", 1), ("order", 1)])
    await db.checklist_ticks.create_index(
        [("user_id", 1), ("date", -1), ("template_id", 1)], unique=True
    )
    # AI (DeckPilot): rate limiting ανά ώρα + cached ημερήσια briefs
    await db.ai_usage.create_index(
        [("user_id", 1), ("kind", 1), ("hour", 1)], unique=True
    )
    await db.ai_briefs.create_index(
        [("user_id", 1), ("date", -1), ("mode", 1)], unique=True
    )
    # Audit log ενεργειών admin panel (π.χ. reset PIN) — ανά μαγαζί, πιο πρόσφατα πρώτα
    await db.admin_audit.create_index([("user_id", 1), ("created_at", -1)])
    # Ανακοινώσεις πλατφόρμας: γρήγορη εύρεση ενεργής ανά μαγαζί
    await db.announcements.create_index([("active", 1), ("created_at", -1)])
    # Μία φορά: ενοποίηση πεδίου πόλης — παλιοί λογαριασμοί με city από την εγγραφή
    # αλλά χωρίς store_city (το κανονικό πεδίο) → αντιγραφή city → store_city
    await db.users.update_many(
        {
            "city": {"$exists": True, "$nin": ["", None]},
            "$or": [{"store_city": {"$exists": False}}, {"store_city": {"$in": ["", None]}}],
        },
        [{"$set": {"store_city": "$city"}}],
    )
    await migrate_items_sort_order()
    await ensure_demo_account()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
