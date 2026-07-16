"""Στατιστικά (analytics) & κλείσιμο ημέρας (Z-report)."""
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core import db, require_staff, require_owner, require_manager

router = APIRouter()

ATHENS = ZoneInfo("Europe/Athens")


def athens_now() -> datetime:
    return datetime.now(timezone.utc).astimezone(ATHENS)


def athens_today() -> str:
    return athens_now().date().isoformat()


def local_day_range_utc(day_from: str, day_to: str) -> tuple[str, str]:
    """Όρια τοπικών (Ελλάδα) ημερών ως UTC ISO strings για query στο created_at."""
    start = datetime.fromisoformat(f"{day_from}T00:00:00").replace(tzinfo=ATHENS)
    end = datetime.fromisoformat(f"{day_to}T00:00:00").replace(tzinfo=ATHENS) + timedelta(days=1)
    return (
        start.astimezone(timezone.utc).isoformat(),
        end.astimezone(timezone.utc).isoformat(),
    )


def to_athens(iso: str) -> datetime:
    dt_obj = datetime.fromisoformat(iso)
    if dt_obj.tzinfo is None:
        dt_obj = dt_obj.replace(tzinfo=timezone.utc)
    return dt_obj.astimezone(ATHENS)


# ============ ANALYTICS ============
@router.get("/analytics")
async def analytics(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(require_owner),
):
    today = athens_today()
    df = date_from or today
    dt = date_to or today
    utc_from, utc_to = local_day_range_utc(df, dt)
    query = {
        "user_id": user["id"],
        "created_at": {"$gte": utc_from, "$lt": utc_to},
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
            hr = to_athens(d["created_at"]).hour
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


# ============ DECK VIEW (live overview ημέρας) ============
def _tab_total(tab: dict) -> float:
    return round(
        sum(
            it.get("line_total", 0)
            for r in tab.get("rounds", [])
            for it in r.get("items", [])
        ),
        2,
    )


def _hm_to_min(s: str) -> Optional[int]:
    try:
        h, m = s.strip().split(":")
        return int(h) * 60 + int(m)
    except Exception:
        return None


async def _on_shift_now(user_id: str, now_local: datetime) -> list:
    """Ποιοι είναι σε βάρδια αυτή τη στιγμή (τοπική ώρα), με χειρισμό βαρδιών που περνούν τα μεσάνυχτα."""
    today = now_local.date()
    now_min = now_local.hour * 60 + now_local.minute

    def week_start_of(d):
        return (d - timedelta(days=d.weekday())).isoformat()

    yesterday = today - timedelta(days=1)
    lookups = [
        # (week_start, day index, θεωρούμε overnight-από-χθες;)
        (week_start_of(today), today.weekday(), False),
        (week_start_of(yesterday), yesterday.weekday(), True),
    ]
    emp_docs = await db.employees.find(
        {"user_id": user_id}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(500)
    emp_names = {e["id"]: e["name"] for e in emp_docs}

    active = {}
    for week_start, day, from_yesterday in lookups:
        shifts = await db.shifts.find(
            {"user_id": user_id, "week_start": week_start, "day": day},
            {"_id": 0, "user_id": 0},
        ).to_list(1000)
        for s in shifts:
            start = _hm_to_min(s.get("start", ""))
            end = _hm_to_min(s.get("end", ""))
            if start is None or end is None:
                continue
            overnight = end <= start
            if from_yesterday:
                hit = overnight and now_min < end
            else:
                hit = (start <= now_min < end) if not overnight else now_min >= start
            if hit and s["employee_id"] in emp_names:
                active[s["employee_id"]] = {
                    "name": emp_names[s["employee_id"]],
                    "start": s.get("start"),
                    "end": s.get("end"),
                }
    return list(active.values())


@router.get("/deck/overview")
async def deck_overview(user: dict = Depends(require_owner)):
    now_local = athens_now()
    today = now_local.date().isoformat()
    utc_from, utc_to = local_day_range_utc(today, today)

    docs = await db.orders.find(
        {
            "user_id": user["id"],
            "created_at": {"$gte": utc_from, "$lt": utc_to},
            "cancelled": {"$ne": True},
            "status": {"$ne": "scheduled"},
        },
        {"_id": 0, "total": 1, "source": 1},
    ).to_list(50000)
    total_orders = len(docs)
    total_revenue = round(sum(d.get("total", 0) for d in docs), 2)
    avg_order = round(total_revenue / total_orders, 2) if total_orders else 0.0
    by_source = defaultdict(lambda: {"count": 0, "revenue": 0.0})
    for d in docs:
        src = d.get("source", "Ταμείο")
        by_source[src]["count"] += 1
        by_source[src]["revenue"] += d.get("total", 0)

    exp_docs = await db.expenses.find(
        {"user_id": user["id"], "date": today}, {"_id": 0, "amount": 1}
    ).to_list(50000)
    total_expenses = round(sum(e.get("amount", 0) for e in exp_docs), 2)

    # Ανοιχτά τραπέζια (open tabs) με τρέχον σύνολο
    tabs = await db.table_tabs.find(
        {"user_id": user["id"], "status": "open"}, {"_id": 0, "user_id": 0}
    ).to_list(200)
    table_docs = await db.tables.find(
        {"user_id": user["id"]}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(200)
    table_names = {t["id"]: t["name"] for t in table_docs}
    open_tables = [
        {
            "table_name": table_names.get(t["table_id"], "Τραπέζι"),
            "total": _tab_total(t),
            "opened_at": t.get("opened_at"),
            "rounds_count": len(t.get("rounds", [])),
        }
        for t in tabs
    ]
    open_tables.sort(key=lambda x: x["table_name"])

    return {
        "date": today,
        "as_of": now_local.isoformat(),
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "avg_order_value": avg_order,
        "total_expenses": total_expenses,
        "net_result": round(total_revenue - total_expenses, 2),
        "by_source": [
            {"source": s, "count": v["count"], "revenue": round(v["revenue"], 2)}
            for s, v in by_source.items()
        ],
        "open_tables": open_tables,
        "on_shift": await _on_shift_now(user["id"], now_local),
    }


@router.get("/reports/day")
async def list_day_reports(user: dict = Depends(require_manager)):
    return await db.day_reports.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("closed_at", -1).to_list(365)
