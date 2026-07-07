from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
from collections import Counter, defaultdict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# App
app = FastAPI(title="Peinokio POS API")
api_router = APIRouter(prefix="/api")


# Models
class OrderItemCustomization(BaseModel):
    model_config = ConfigDict(extra="ignore")
    bread: Optional[str] = None
    extras: List[str] = Field(default_factory=list)
    sauces: List[str] = Field(default_factory=list)
    double_meat: bool = False


class OrderItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    item_id: str
    name: str
    category: str
    unit_price: float
    quantity: int = 1
    line_total: float
    customization: Optional[OrderItemCustomization] = None


class OrderCreate(BaseModel):
    order_number: int
    items: List[OrderItem]
    subtotal: float
    total: float
    source: Literal["Ταμείο", "Τηλέφωνο", "efood", "Box"]
    note: Optional[str] = None


class Order(OrderCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NextOrderNumberResponse(BaseModel):
    next_order_number: int


# Routes
@api_router.get("/")
async def root():
    return {"message": "Peinokio POS API", "status": "ok"}


@api_router.get("/orders/next-number", response_model=NextOrderNumberResponse)
async def next_order_number():
    """Return the next order number for today (auto-increment per day)."""
    today = datetime.now(timezone.utc).date().isoformat()
    # Find max order_number for today's orders
    start = f"{today}T00:00:00+00:00"
    end = f"{today}T23:59:59+00:00"
    cursor = db.orders.find(
        {"created_at": {"$gte": start, "$lte": end}},
        {"_id": 0, "order_number": 1},
    ).sort("order_number", -1).limit(1)
    docs = await cursor.to_list(1)
    next_num = (docs[0]["order_number"] + 1) if docs else 1
    return {"next_order_number": next_num}


@api_router.post("/orders", response_model=Order)
async def create_order(payload: OrderCreate):
    order = Order(**payload.model_dump())
    doc = order.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.orders.insert_one(doc)
    return order


@api_router.get("/orders", response_model=List[Order])
async def list_orders(
    date_from: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    limit: int = 500,
):
    query = {}
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = f"{date_from}T00:00:00+00:00"
        if date_to:
            rng["$lte"] = f"{date_to}T23:59:59+00:00"
        query["created_at"] = rng
    docs = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
    return docs


@api_router.get("/analytics")
async def analytics(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """Aggregated analytics filtered by date range."""
    # Default: today
    today = datetime.now(timezone.utc).date().isoformat()
    df = date_from or today
    dt = date_to or today

    query = {
        "created_at": {
            "$gte": f"{df}T00:00:00+00:00",
            "$lte": f"{dt}T23:59:59+00:00",
        }
    }
    docs = await db.orders.find(query, {"_id": 0}).to_list(10000)

    total_orders = len(docs)
    total_revenue = round(sum(d.get("total", 0) for d in docs), 2)
    avg_order = round(total_revenue / total_orders, 2) if total_orders else 0.0

    by_source = defaultdict(lambda: {"count": 0, "revenue": 0.0})
    hourly = defaultdict(lambda: {"orders": 0, "revenue": 0.0})
    item_counter = Counter()
    item_revenue = defaultdict(float)

    for d in docs:
        src = d.get("source", "Ταμείο")
        by_source[src]["count"] += 1
        by_source[src]["revenue"] += d.get("total", 0)

        # hour
        try:
            dt_obj = datetime.fromisoformat(d["created_at"])
            hr = dt_obj.hour
            hourly[hr]["orders"] += 1
            hourly[hr]["revenue"] += d.get("total", 0)
        except Exception:
            pass

        for item in d.get("items", []):
            key = item["name"]
            item_counter[key] += item.get("quantity", 1)
            item_revenue[key] += item.get("line_total", 0)

    # Build ordered hourly (0-23) for chart
    hourly_list = [
        {
            "hour": h,
            "label": f"{h:02d}:00",
            "orders": hourly[h]["orders"],
            "revenue": round(hourly[h]["revenue"], 2),
        }
        for h in range(24)
    ]

    popular_items = [
        {
            "name": name,
            "quantity": qty,
            "revenue": round(item_revenue[name], 2),
        }
        for name, qty in item_counter.most_common(10)
    ]

    sources_list = [
        {
            "source": s,
            "count": v["count"],
            "revenue": round(v["revenue"], 2),
        }
        for s, v in by_source.items()
    ]

    return {
        "date_from": df,
        "date_to": dt,
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "avg_order_value": avg_order,
        "by_source": sources_list,
        "popular_items": popular_items,
        "hourly": hourly_list,
    }


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
