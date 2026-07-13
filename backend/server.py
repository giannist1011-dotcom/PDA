"""FastAPI server for Πεινώκιο multi-tenant POS SaaS — app setup μόνο.

Τα endpoints ζουν στα routers/ (ένα ανά feature)· τα κοινά (db, auth, seeding) στο core.py.
"""
import os

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from core import client, db, ensure_demo_account
from routers import auth, menu, orders, tables, stock, schedule, stats, expenses

app = FastAPI(title="Peinokio POS SaaS")

api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"status": "ok", "service": "Peinokio POS SaaS"}


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

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.categories.create_index([("user_id", 1)])
    await db.items.create_index([("user_id", 1)])
    await db.orders.create_index([("user_id", 1), ("created_at", -1)])
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
    await ensure_demo_account()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
