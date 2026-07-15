"""Στατιστικά (analytics) & κλείσιμο ημέρας (Z-report)."""
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core import db, require_staff, require_owner, require_manager

router = APIRouter()


# ============ ANALYTICS ============
@router.get("/analytics")
async def analytics(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(require_owner),
):
    today = datetime.now(timezone.utc).date().isoformat()
    df = date_from or today
    dt = date_to or today
    query = {
        "user_id": user["id"],
        "created_at": {"$gte": f"{df}T00:00:00+00:00", "$lte": f"{dt}T23:59:59+00:00"},
        "cancelled": {"$ne": True},
        "status": {"$ne": "scheduled"},  # not fired yet → no revenue
    }
    docs = await db.orders.find(query, {"_id": 0}).to_list(50000)
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
        try:
            dt_obj = datetime.fromisoformat(d["created_at"])
            hr = dt_obj.hour
            hourly[hr]["orders"] += 1
            hourly[hr]["revenue"] += d.get("total", 0)
        except Exception:
            pass
        for item in d.get("items", []):
            k = item["name"]
            item_counter[k] += item.get("quantity", 1)
            item_revenue[k] += item.get("line_total", 0)

    hourly_list = [
        {"hour": h, "label": f"{h:02d}:00",
         "orders": hourly[h]["orders"], "revenue": round(hourly[h]["revenue"], 2)}
        for h in range(24)
    ]
    popular = [
        {"name": n, "quantity": q, "revenue": round(item_revenue[n], 2)}
        for n, q in item_counter.most_common(10)
    ]
    sources_list = [
        {"source": s, "count": v["count"], "revenue": round(v["revenue"], 2)}
        for s, v in by_source.items()
    ]
    exp_docs = await db.expenses.find(
        {"user_id": user["id"], "date": {"$gte": df, "$lte": dt}},
        {"_id": 0, "amount": 1},
    ).to_list(50000)
    total_expenses = round(sum(d.get("amount", 0) for d in exp_docs), 2)
    return {
        "date_from": df,
        "date_to": dt,
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "avg_order_value": avg_order,
        "total_expenses": total_expenses,
        "net_result": round(total_revenue - total_expenses, 2),
        "by_source": sources_list,
        "popular_items": popular,
        "hourly": hourly_list,
    }


# ============ DAY CLOSE (Z-REPORT) ============
async def compute_day_summary(user_id: str, day: str) -> dict:
    """Aggregate a single day's orders + expenses into a Z-report summary."""
    docs = await db.orders.find(
        {
            "user_id": user_id,
            "created_at": {"$gte": f"{day}T00:00:00+00:00", "$lte": f"{day}T23:59:59+00:00"},
        },
        {"_id": 0},
    ).to_list(50000)

    counted = [
        d for d in docs
        if not d.get("cancelled") and d.get("status") != "scheduled"
    ]
    cancelled_count = sum(1 for d in docs if d.get("cancelled"))
    scheduled_pending = sum(
        1 for d in docs if d.get("status") == "scheduled" and not d.get("cancelled")
    )

    by_source = defaultdict(lambda: {"count": 0, "revenue": 0.0})
    by_type = defaultdict(lambda: {"count": 0, "revenue": 0.0})
    total_discounts = 0.0
    for d in counted:
        src = d.get("source", "Ταμείο")
        by_source[src]["count"] += 1
        by_source[src]["revenue"] += d.get("total", 0)
        dt_key = (d.get("delivery") or {}).get("delivery_type") or "store"
        by_type[dt_key]["count"] += 1
        by_type[dt_key]["revenue"] += d.get("total", 0)
        disc = d.get("discount") or {}
        total_discounts += disc.get("amount", 0) or 0

    exp_docs = await db.expenses.find(
        {"user_id": user_id, "date": day}, {"_id": 0, "amount": 1}
    ).to_list(50000)
    total_expenses = round(sum(e.get("amount", 0) for e in exp_docs), 2)
    total_revenue = round(sum(d.get("total", 0) for d in counted), 2)

    return {
        "date": day,
        "total_orders": len(counted),
        "total_revenue": total_revenue,
        "by_source": [
            {"source": s, "count": v["count"], "revenue": round(v["revenue"], 2)}
            for s, v in by_source.items()
        ],
        "by_type": [
            {"type": t, "count": v["count"], "revenue": round(v["revenue"], 2)}
            for t, v in by_type.items()
        ],
        "total_discounts": round(total_discounts, 2),
        "cancelled_count": cancelled_count,
        "scheduled_pending": scheduled_pending,
        "total_expenses": total_expenses,
        "net_result": round(total_revenue - total_expenses, 2),
    }


@router.get("/reports/day-summary")
async def day_summary(date: Optional[str] = None, user: dict = Depends(require_staff)):
    day = date or datetime.now(timezone.utc).date().isoformat()
    return await compute_day_summary(user["id"], day)


class DayCloseIn(BaseModel):
    date: Optional[str] = None


@router.post("/reports/day-close")
async def close_day(body: Optional[DayCloseIn] = None, user: dict = Depends(require_staff)):
    day = (body.date if body and body.date else None) or datetime.now(timezone.utc).date().isoformat()
    summary = await compute_day_summary(user["id"], day)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "closed_at": datetime.now(timezone.utc).isoformat(),
        "closed_by": user.get("profile"),
        **summary,
    }
    await db.day_reports.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@router.get("/reports/day")
async def list_day_reports(user: dict = Depends(require_manager)):
    return await db.day_reports.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("closed_at", -1).to_list(365)
