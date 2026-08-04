"""Admin panel — Επισκόπηση (command-center dashboard).

Ένα endpoint (GET /admin/overview) επιστρέφει όλα τα δεδομένα του dashboard:
KPIs με τάση 30 ημερών, «Θέλουν την προσοχή σου», χάρτη επέκτασης ανά πόλη,
growth ανά εβδομάδα και πρόσφατη δραστηριότητα. Σεβασμός στο scope των
sub-admins (πόλεις ευθύνης) — ίδιο get_admin_ctx gate με το υπόλοιπο panel.

ΑΠΟΡΡΗΤΟ ΠΕΛΑΤΗ (σκληρός κανόνας): τίποτα εδώ δεν μετρά τζίρο ή όγκο
παραγγελιών μαγαζιών/εταιρειών — μόνο λογαριασμούς (εγγραφές, πλάνα, πόλεις)
και το δικό μας MRR από τις συνδρομές. Ούτε το growth chart μετρά παραγγελίες.

Χάρτης: οι συντεταγμένες κάθε πόλης γεωκωδικοποιούνται ΜΙΑ φορά (Nominatim,
fire-and-forget στο background) και αποθηκεύονται στο admin_city_geo — ποτέ
geocoding σε κάθε load. Όλα τα νούμερα βγαίνουν από λίγα aggregate queries
(κανένα N+1) ώστε να μένει γρήγορο και με εκατοντάδες λογαριασμούς.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends

from shared.core import db
from admin.admins import get_admin_ctx, scope_city_match
from shared.geocoding import nominatim_lookup
from fleet import api as fleet_api

router = APIRouter()
logger = logging.getLogger("orderdeck")

ATHENS = ZoneInfo("Europe/Athens")

# Εκτίμηση MRR (χειροκίνητη τιμολόγηση — ίδιες τιμές με το wizard εγγραφής):
# OrderDeck 20 €, FleetDeck 30 € (έως 15 διανομείς) / 50 € (περισσότεροι),
# OrderDeck Fleet = POS + fleet κλιμάκιο. Demo λογαριασμοί εκτός.
FLEET_DRIVER_TIER_LIMIT = 15
POS_EUR = 20.0
FLEET_EUR_SMALL, FLEET_EUR_BIG = 30.0, 50.0

GEOCODE_BATCH = 8  # max νέες πόλεις ανά load (Nominatim: 1 αίτημα/δευτερόλεπτο)


def _norm_city(u: dict) -> str:
    return (u.get("store_city") or u.get("city") or "").strip()


def _fleet_tier_eur(drivers: int) -> float:
    return FLEET_EUR_BIG if drivers > FLEET_DRIVER_TIER_LIMIT else FLEET_EUR_SMALL


def _account_mrr(u: dict, drivers: int) -> float:
    """Μηνιαία αξία ενεργής συνδρομής — 0 για demo/απενεργοποιημένους/ληγμένους."""
    if u.get("is_demo") or u.get("disabled") or u.get("payment_status") == "expired":
        return 0.0
    if u.get("account_type") == "fleet_company":
        return _fleet_tier_eur(drivers)
    plan = u.get("plan") or "orderdeck"
    if plan == "fleet":
        return _fleet_tier_eur(drivers)
    if plan == "orderdeck_fleet":
        return POS_EUR + _fleet_tier_eur(drivers)
    return POS_EUR


def _parse_iso(s) -> datetime | None:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _warm_city_geocode(missing: list[str]):
    """Fire-and-forget geocode πόλεων που λείπουν από το admin_city_geo — max
    GEOCODE_BATCH ανά load, 1"/αίτημα. Και οι αποτυχίες γράφονται (lat=None)
    ώστε λάθος πόλη να μη γεωκωδικοποιείται ξανά και ξανά."""

    async def run():
        for city in missing[:GEOCODE_BATCH]:
            key = " ".join(city.lower().split())
            try:
                lat, lng = await asyncio.to_thread(nominatim_lookup, city)
            except Exception as e:
                logger.warning("admin map: geocode error for %r: %s", city, e)
                continue  # προσωρινό σφάλμα — δεν γράφεται, retry στο επόμενο load
            await db.admin_city_geo.update_one(
                {"key": key},
                {"$set": {"label": city, "lat": lat, "lng": lng,
                          "created_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True,
            )
            await asyncio.sleep(1)

    asyncio.create_task(run())


@router.get("/admin/overview")
async def admin_overview(ctx: dict = Depends(get_admin_ctx)):
    now = datetime.now(timezone.utc)
    d30 = (now - timedelta(days=30)).isoformat()
    d60 = (now - timedelta(days=60)).isoformat()
    d7 = (now - timedelta(days=7)).isoformat()

    # ---- Όλοι οι λογαριασμοί με μικρό projection (ένα query — τα groupings σε μνήμη)
    match = scope_city_match(ctx) or {}
    accounts = await db.users.find(match, {
        "_id": 0, "id": 1, "account_type": 1, "plan": 1, "is_demo": 1,
        "disabled": 1, "payment_status": 1, "created_at": 1,
        "store_city": 1, "city": 1, "restaurant_name": 1,
    }).to_list(None)
    stores = [u for u in accounts if u.get("account_type") != "fleet_company"]
    companies = [u for u in accounts if u.get("account_type") == "fleet_company"]
    account_ids = {u["id"] for u in accounts}
    scoped = not ctx["is_master"] and bool(ctx["cities"])

    # ---- Ομάδες & διανομείς (2 queries): owner_user_id → team_id → πλήθος οδηγών
    owner_ids = [u["id"] for u in companies] + [
        u["id"] for u in stores if (u.get("plan") in ("fleet", "orderdeck_fleet"))
    ]
    team_owner = await fleet_api.teams_by_owner(owner_ids)
    drivers_by_owner: dict = {
        team_owner[tid]: n
        for tid, n in (await fleet_api.drivers_per_team(list(team_owner))).items()
    }

    def is_active(u):
        return not u.get("is_demo") and not u.get("disabled")

    active_stores = [u for u in stores if is_active(u)]
    active_companies = [u for u in companies if is_active(u)]

    # ---- KPIs
    by_plan = {"orderdeck": 0, "fleet": 0, "orderdeck_fleet": 0}
    for u in active_stores:
        by_plan[u.get("plan") or "orderdeck"] = by_plan.get(u.get("plan") or "orderdeck", 0) + 1
    drivers_total = sum(drivers_by_owner.get(u["id"], 0) for u in active_companies)

    def new_counts(items):
        n30 = sum(1 for u in items if (u.get("created_at") or "") >= d30)
        prev = sum(1 for u in items if d60 <= (u.get("created_at") or "") < d30)
        return n30, prev

    stores_new30, stores_prev30 = new_counts([u for u in stores if not u.get("is_demo")])
    comp_new30, comp_prev30 = new_counts([u for u in companies if not u.get("is_demo")])

    mrr_total, paying, mrr_added_30d = 0.0, 0, 0.0
    for u in stores + companies:
        eur = _account_mrr(u, drivers_by_owner.get(u["id"], 0))
        if eur > 0:
            mrr_total += eur
            paying += 1
            if (u.get("created_at") or "") >= d30:
                mrr_added_30d += eur

    # ΑΠΟΡΡΗΤΟ ΠΕΛΑΤΗ: καμία μέτρηση όγκου/τζίρου παραγγελιών μαγαζιών ή εταιρειών
    # στην Επισκόπηση. Τα KPIs μετρούν ΜΟΝΟ λογαριασμούς και τη δική μας συνδρομητική
    # αξία (MRR). Το growth chart μετρά εγγραφές, όχι παραγγελίες.

    # ---- «Θέλουν την προσοχή σου»
    bill_match = {"billing_request": {"$ne": None}, "is_demo": {"$ne": True}}
    if scoped:
        bill_match["id"] = {"$in": list(account_ids)}
    billing_requests = await db.users.count_documents(bill_match)
    new_leads_7d = (
        await db.demo_leads.count_documents({"created_at": {"$gte": d7}})
        if ctx["is_master"] else None  # τα leads δεν έχουν πόλη — master μόνο
    )
    pending_parts = await fleet_api.pending_partnerships()
    if scoped:
        pending_parts = [
            p for p in pending_parts
            if p.get("store_user_id") in account_ids
            or team_owner.get(p.get("team_id")) in account_ids
        ]
    pending_partnerships = len(pending_parts)

    # ---- Πόλεις (χάρτης + πίνακας): grouping σε μνήμη, συντεταγμένες από cache
    cities: dict = {}
    for u in stores + companies:
        name = _norm_city(u)
        if not name:
            continue
        key = " ".join(name.lower().split())
        c = cities.setdefault(key, {
            "name": name, "lat": None, "lng": None,
            "stores": {"orderdeck": 0, "fleet": 0, "orderdeck_fleet": 0},
            "companies": 0, "demo": 0, "paying": 0,
        })
        if u.get("is_demo"):
            c["demo"] += 1
            continue
        if u.get("account_type") == "fleet_company":
            c["companies"] += 1
        else:
            plan = u.get("plan") or "orderdeck"
            c["stores"][plan] = c["stores"].get(plan, 0) + 1
        if _account_mrr(u, drivers_by_owner.get(u["id"], 0)) > 0:
            c["paying"] += 1
    missing_geo = []
    if cities:
        cached = {
            g["key"]: g async for g in db.admin_city_geo.find(
                {"key": {"$in": list(cities)}}, {"_id": 0, "key": 1, "lat": 1, "lng": 1}
            )
        }
        for key, c in cities.items():
            g = cached.get(key)
            if g:
                c["lat"], c["lng"] = g.get("lat"), g.get("lng")
            else:
                missing_geo.append(c["name"])
        if missing_geo:
            _warm_city_geocode(missing_geo)
    city_list = sorted(
        cities.values(),
        key=lambda c: (c["paying"], c["companies"], c["demo"]),
        reverse=True,
    )

    # ---- Growth: νέοι λογαριασμοί ανά εβδομάδα (12 εβδομάδες, Δευτέρα, ώρα Αθήνας)
    this_monday = now.astimezone(ATHENS).date()
    this_monday -= timedelta(days=this_monday.weekday())
    weeks = [this_monday - timedelta(weeks=i) for i in range(11, -1, -1)]
    growth = {w: {"week": w.strftime("%d/%m"), "stores": 0, "companies": 0} for w in weeks}
    for u in stores + companies:
        if u.get("is_demo"):
            continue
        dt = _parse_iso(u.get("created_at"))
        if not dt:
            continue
        d = dt.astimezone(ATHENS).date()
        monday = d - timedelta(days=d.weekday())
        if monday in growth:
            kind = "companies" if u.get("account_type") == "fleet_company" else "stores"
            growth[monday][kind] += 1

    # ---- Πρόσφατη δραστηριότητα: εγγραφές/demo (μνήμη) + partnerships + audit (master)
    events = []
    for u in stores + companies:
        is_comp = u.get("account_type") == "fleet_company"
        events.append({
            "type": "demo_created" if u.get("is_demo")
            else ("fleet_signup" if is_comp else "signup"),
            "title": u.get("restaurant_name") or u.get("id"),
            "city": _norm_city(u),
            "at": u.get("created_at") or "",
        })
    parts = await fleet_api.recent_partnerships()
    for p in parts:
        if scoped and not (
            p.get("store_user_id") in account_ids
            or team_owner.get(p.get("team_id")) in account_ids
        ):
            continue
        events.append({
            "type": "partnership",
            "title": f"{p.get('store_name') or '—'} ↔ {p.get('team_name') or '—'}",
            "city": p.get("store_city") or "",
            "at": p.get("requested_at") or "",
        })
    if ctx["is_master"]:
        async for a in db.admin_audit.find(
            {}, {"_id": 0, "action": 1, "admin_name": 1, "restaurant_name": 1, "created_at": 1}
        ).sort("created_at", -1).limit(15):
            events.append({
                "type": "admin_action",
                "title": f"{a.get('admin_name') or 'Sub-admin'}: {a.get('action') or ''}"
                + (f" — {a['restaurant_name']}" if a.get("restaurant_name") else ""),
                "city": "",
                "at": a.get("created_at") or "",
            })
    events.sort(key=lambda e: e["at"], reverse=True)

    return {
        "kpis": {
            "shops": {
                "active": len(active_stores), "by_plan": by_plan,
                "demo": sum(1 for u in stores if u.get("is_demo")),
                "new_30d": stores_new30, "prev_30d": stores_prev30,
            },
            "companies": {
                "active": len(active_companies), "drivers": drivers_total,
                "demo": sum(1 for u in companies if u.get("is_demo")),
                "new_30d": comp_new30, "prev_30d": comp_prev30,
            },
            "mrr": {
                "total": round(mrr_total, 2), "paying_accounts": paying,
                "added_30d": round(mrr_added_30d, 2),
            },
        },
        "attention": {
            "billing_requests": billing_requests,
            "new_leads_7d": new_leads_7d,
            "pending_partnerships": pending_partnerships,
        },
        "cities": city_list,
        "geocoding_pending": len(missing_geo),
        "growth": list(growth.values()),
        "activity": events[:15],
    }
