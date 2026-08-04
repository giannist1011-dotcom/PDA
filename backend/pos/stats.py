"""Στατιστικά (analytics) & κλείσιμο ημέρας (Z-report)."""
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from shared.core import (
    db, require_staff, require_owner, require_manager, require_feature,
    athens_now, to_athens,
    business_day_cutoff, business_day_range, business_day_expr,
    business_day_bounds, business_today,
)

router = APIRouter()

# Παραγγελίες από πλατφόρμες delivery — ομαδοποιούνται ξεχωριστά στο Z
PLATFORM_SOURCES = ("efood", "Box", "Wolt")

# Φίλτρο προέλευσης (Στατιστικά & Deck View): «Όλα» = all-around, «Ταμείο» = ό,τι
# γράφτηκε μέσα στο μαγαζί (ταμείο/τηλέφωνο/τραπέζι), και μία επιλογή ανά πλατφόρμα.
SOURCE_FILTERS = {
    "all": None,
    "pos": {"$nin": list(PLATFORM_SOURCES)},
    "efood": "efood",
    "box": "Box",
    "wolt": "Wolt",
}
SOURCE_LABELS = {"all": "Όλα", "pos": "Ταμείο", "efood": "efood", "box": "Box", "wolt": "Wolt"}


def source_key_of(src: str) -> str:
    """Η «προέλευση» μιας παραγγελίας για το source-mix (πλατφόρμα ή ταμείο)."""
    if src == "efood":
        return "efood"
    if src == "Box":
        return "box"
    if src == "Wolt":
        return "wolt"
    return "pos"


def source_clause(source: Optional[str]) -> dict:
    """Το κομμάτι του query για το φίλτρο προέλευσης ({} όταν είναι «Όλα»)."""
    key = (source or "all").lower()
    if key not in SOURCE_FILTERS:
        raise HTTPException(400, "Άγνωστη προέλευση")
    clause = SOURCE_FILTERS[key]
    return {} if clause is None else {"source": clause}


def source_mix(docs: list) -> list:
    """Κατανομή παραγγελιών/τζίρου ανά προέλευση — πίτα/στοιβαγμένες μπάρες."""
    agg = defaultdict(lambda: {"count": 0, "revenue": 0.0})
    for d in docs:
        k = source_key_of(d.get("source", "Ταμείο"))
        agg[k]["count"] += 1
        agg[k]["revenue"] += d.get("total", 0)
    total = round(sum(v["revenue"] for v in agg.values()), 2)
    return [
        {
            "key": k,
            "label": SOURCE_LABELS[k],
            "count": v["count"],
            "revenue": round(v["revenue"], 2),
            "share": round(v["revenue"] / total * 100, 1) if total else 0.0,
        }
        for k, v in sorted(agg.items(), key=lambda kv: -kv[1]["revenue"])
    ]


# ============ ANALYTICS ============
@router.get("/analytics")
async def analytics(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    source: Optional[str] = None,
    user: dict = Depends(require_feature("analytics", require_owner)),
):
    cutoff = business_day_cutoff(user)
    today = business_today(cutoff)
    df = date_from or today
    dt = date_to or today
    utc_from, utc_to = business_day_range(df, cutoff, dt)
    query = {
        "user_id": user["id"],
        "created_at": {"$gte": utc_from, "$lt": utc_to},
        "cancelled": {"$ne": True},
        "status": {"$ne": "scheduled"},  # not fired yet → no revenue
        # Φίλτρο προέλευσης: Όλα / Ταμείο / efood / Box / Wolt
        **source_clause(source),
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

    # Οι ώρες ξεκινούν από την αρχή της εργάσιμης ημέρας (π.χ. όριο 02:00 →
    # 02,03,…,01), ώστε η νύχτα να μη βρίσκεται στην αρχή του διαγράμματος
    hourly_list = [
        {"hour": h, "label": f"{h:02d}:00",
         "orders": hourly[h]["orders"], "revenue": round(hourly[h]["revenue"], 2)}
        for h in ((cutoff // 60 + i) % 24 for i in range(24))
    ]
    popular = [
        {"name": n, "quantity": q, "revenue": round(item_revenue[n], 2)}
        for n, q in item_counter.most_common(10)
    ]
    sources_list = [
        {"source": s, "count": v["count"], "revenue": round(v["revenue"], 2)}
        for s, v in by_source.items()
    ]
    # Τα έξοδα δεν έχουν προέλευση — σε φιλτραρισμένη προβολή δεν εμφανίζονται καθόλου
    # (αλλιώς το «καθαρό αποτέλεσμα» θα χρέωνε όλα τα έξοδα σε μία πλατφόρμα)
    has_expenses = (source or "all").lower() == "all"
    total_expenses = 0.0
    if has_expenses:
        exp_docs = await db.expenses.find(
            {"user_id": user["id"], "date": {"$gte": df, "$lte": dt}},
            {"_id": 0, "amount": 1},
        ).to_list(50000)
        total_expenses = round(sum(d.get("amount", 0) for d in exp_docs), 2)
    return {
        "date_from": df,
        "date_to": dt,
        "source": (source or "all").lower(),
        # Μείγμα προέλευσης — δείχνεται μόνο στην «all-around» προβολή
        "source_mix": source_mix(docs),
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "avg_order_value": avg_order,
        "total_expenses": total_expenses,
        "has_expenses": has_expenses,
        "net_result": round(total_revenue - total_expenses, 2),
        "by_source": sources_list,
        "popular_items": popular,
        "hourly": hourly_list,
    }


# ============ ΣΥΓΚΡΙΣΗ ΜΕ ΠΕΡΣΙ (year-over-year) ============
def _minus_one_year(day: str) -> str:
    """YYYY-MM-DD → ίδια μέρα πέρσι (29/2 → 28/2)."""
    y, m, d = day.split("-")
    try:
        return datetime(int(y) - 1, int(m), int(d)).date().isoformat()
    except ValueError:  # 29 Φεβρουαρίου σε μη δίσεκτο έτος
        return f"{int(y) - 1}-02-28"


async def _range_totals(user_id: str, day_from: str, day_to: str, cutoff: int) -> dict:
    utc_from, utc_to = business_day_range(day_from, cutoff, day_to)
    docs = await db.orders.find(
        {
            "user_id": user_id,
            "created_at": {"$gte": utc_from, "$lt": utc_to},
            "cancelled": {"$ne": True},
            "status": {"$ne": "scheduled"},
        },
        {"_id": 0, "total": 1},
    ).to_list(50000)
    return {
        "date_from": day_from,
        "date_to": day_to,
        "orders": len(docs),
        "revenue": round(sum(d.get("total", 0) for d in docs), 2),
    }


@router.get("/analytics/yoy")
async def analytics_yoy(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(require_feature("analytics", require_owner)),
):
    """Ίδια περίοδος πέρσι: έσοδα/παραγγελίες + delta. available=False όταν το
    μαγαζί δεν έχει καθόλου δεδομένα που να φτάνουν την περσινή περίοδο."""
    cutoff = business_day_cutoff(user)
    today = business_today(cutoff)
    df = date_from or today
    dt = date_to or today
    ly_from, ly_to = _minus_one_year(df), _minus_one_year(dt)

    earliest = await db.orders.find_one(
        {"user_id": user["id"]}, {"_id": 0, "created_at": 1}, sort=[("created_at", 1)]
    )
    _, ly_utc_to = business_day_range(ly_from, cutoff, ly_to)
    available = bool(earliest and earliest["created_at"] < ly_utc_to)
    if not available:
        return {"available": False, "current": None, "last_year": None}

    current = await _range_totals(user["id"], df, dt, cutoff)
    last_year = await _range_totals(user["id"], ly_from, ly_to, cutoff)
    return {"available": True, "current": current, "last_year": last_year}


# ============ DAY CLOSE (Z-REPORT) ============
async def compute_day_summary(user: dict, day: str) -> dict:
    """Σύνοψη Z μιας ΕΡΓΑΣΙΜΗΣ ημέρας (ωράριο μαγαζιού, όχι ημερολογιακή)."""
    cutoff = business_day_cutoff(user)
    utc_from, utc_to = business_day_range(day, cutoff)
    docs = await db.orders.find(
        {
            "user_id": user["id"],
            "created_at": {"$gte": utc_from, "$lt": utc_to},
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
        {"user_id": user["id"], "date": day}, {"_id": 0, "amount": 1}
    ).to_list(50000)
    total_expenses = round(sum(e.get("amount", 0) for e in exp_docs), 2)
    total_revenue = round(sum(d.get("total", 0) for d in counted), 2)

    sources_list = [
        {"source": s, "count": v["count"], "revenue": round(v["revenue"], 2)}
        for s, v in by_source.items()
    ]
    platform_rows = [s for s in sources_list if s["source"] in PLATFORM_SOURCES]
    bounds = business_day_bounds(user, day, cutoff)

    return {
        "date": day,
        "range_start": bounds["start"],
        "range_end": bounds["end"],
        "range_label": bounds["label"],
        "total_orders": len(counted),
        "total_revenue": total_revenue,
        "by_source": sources_list,
        # Πλατφόρμες (efood/Box/Wolt) ξεχωριστά, με δικό τους υποσύνολο
        "by_platform": sorted(platform_rows, key=lambda r: -r["revenue"]),
        "platform_orders": sum(r["count"] for r in platform_rows),
        "platform_revenue": round(sum(r["revenue"] for r in platform_rows), 2),
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
async def day_summary(date: Optional[str] = None, user: dict = Depends(require_feature("day_close", require_owner))):
    cutoff = business_day_cutoff(user)
    day = date or business_today(cutoff)
    summary = await compute_day_summary(user, day)
    summary["is_current"] = day == business_today(cutoff)
    return summary


@router.get("/reports/business-days")
async def list_business_days(
    limit: int = 90, user: dict = Depends(require_feature("day_close", require_owner))
):
    """Οι εργάσιμες ημέρες με κίνηση (για την επιλογή παλιάς ημέρας στο Z).
    Η τρέχουσα ημέρα μπαίνει πάντα πρώτη, ακόμη κι αν δεν έχει παραγγελίες."""
    cutoff = business_day_cutoff(user)
    rows = await db.orders.aggregate([
        {"$match": {"user_id": user["id"]}},
        {"$group": {
            "_id": business_day_expr(cutoff),
            "orders": {"$sum": 1},
        }},
        {"$sort": {"_id": -1}},
        {"$limit": max(1, min(limit, 365))},
    ]).to_list(365)
    closed = await db.day_reports.find(
        {"user_id": user["id"]}, {"_id": 0, "date": 1}
    ).to_list(1000)
    closed_days = {r["date"] for r in closed}

    today = business_today(cutoff)
    days = [
        {"date": r["_id"], "orders": r["orders"], "closed": r["_id"] in closed_days}
        for r in rows
        if r["_id"]
    ]
    if not any(d["date"] == today for d in days):
        days.insert(0, {"date": today, "orders": 0, "closed": today in closed_days})
    return {"today": today, "cutoff_min": cutoff, "days": days}


class DayCloseIn(BaseModel):
    date: Optional[str] = None


@router.post("/reports/day-close")
async def close_day(body: Optional[DayCloseIn] = None, user: dict = Depends(require_feature("day_close", require_owner))):
    """Κλείνει ΠΑΝΤΑ την τρέχουσα εργάσιμη ημέρα (οι παλιές είναι read-only)."""
    day = business_today(business_day_cutoff(user))
    if body and body.date and body.date != day:
        raise HTTPException(400, "Κλείνει μόνο η τρέχουσα εργάσιμη ημέρα")
    summary = await compute_day_summary(user, day)
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
async def deck_overview(source: Optional[str] = None, user: dict = Depends(require_owner)):
    now_local = athens_now()
    cutoff = business_day_cutoff(user)
    today = business_today(cutoff)          # εργάσιμη ημέρα, όχι ημερολογιακή
    calendar_today = now_local.date().isoformat()
    utc_from, utc_to = business_day_range(today, cutoff)

    docs = await db.orders.find(
        {
            "user_id": user["id"],
            "created_at": {"$gte": utc_from, "$lt": utc_to},
            "cancelled": {"$ne": True},
            "status": {"$ne": "scheduled"},
            **source_clause(source),
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

    # Όπως και στα Στατιστικά: τα έξοδα δεν μερίζονται ανά προέλευση
    has_expenses = (source or "all").lower() == "all"
    total_expenses = 0.0
    if has_expenses:
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

    # Checklist ημέρας — μικρή ένδειξη "Άνοιγμα: 5/6" στο Deck View.
    # Οι λίστες γράφονται με ημερολογιακή ημέρα (checklist.py) → ίδιο κλειδί εδώ.
    cl_templates = await db.checklist_templates.find(
        {"user_id": user["id"]}, {"_id": 0, "id": 1, "list": 1, "date": 1}
    ).to_list(500)
    # Έκτακτες (one-off) εργασίες μετράνε μόνο τη δική τους μέρα
    cl_templates = [t for t in cl_templates if not t.get("date") or t["date"] == calendar_today]
    cl_ticks = await db.checklist_ticks.find(
        {"user_id": user["id"], "date": calendar_today}, {"_id": 0, "template_id": 1}
    ).to_list(1000)
    ticked = {t["template_id"] for t in cl_ticks}
    checklist = {
        lst: {
            "total": sum(1 for t in cl_templates if t["list"] == lst),
            "done": sum(1 for t in cl_templates if t["list"] == lst and t["id"] in ticked),
        }
        for lst in ("open", "close")
    }

    return {
        "checklist": checklist,
        "date": today,
        "range_label": business_day_bounds(user, today, cutoff)["label"],
        "as_of": now_local.isoformat(),
        "source": (source or "all").lower(),
        "source_mix": source_mix(docs),
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "avg_order_value": avg_order,
        "total_expenses": total_expenses,
        "has_expenses": has_expenses,
        "net_result": round(total_revenue - total_expenses, 2),
        "by_source": [
            {"source": s, "count": v["count"], "revenue": round(v["revenue"], 2)}
            for s, v in by_source.items()
        ],
        "open_tables": open_tables,
        "on_shift": await _on_shift_now(user["id"], now_local),
    }


@router.get("/reports/day")
async def list_day_reports(user: dict = Depends(require_feature("day_close", require_owner))):
    return await db.day_reports.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("closed_at", -1).to_list(365)
