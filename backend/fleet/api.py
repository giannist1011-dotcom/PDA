"""ΔΗΜΟΣΙΑ ΔΙΕΠΑΦΗ του domain «fleet».

ΚΑΝΟΝΑΣ: κανένα άλλο domain (pos/, platforms/, admin/, shared/) δεν αγγίζει τα
collections fleet_* απευθείας — όλα περνούν από εδώ. Αντίστροφα, το fleet μιλάει
στο POS ΜΟΝΟ μέσω του pos.api.

Η σύνδεση POS ↔ FleetDeck είναι ΑΜΦΙΔΡΟΜΗ και ρητή:
  · fleet_orders.source_pos_order_id → η παραγγελία του POS
  · orders.fleet_order_id            → η παραγγελία στο FleetDeck
Καμία ροή δεν ταυτίζει παραγγελίες με τηλέφωνο/διεύθυνση.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from shared.core import db

# Ετικέτες πεδίων που ταξιδεύουν από την επεξεργασία του POS προς τον οδηγό
POS_EDIT_LABELS = {
    "address": "Διεύθυνση",
    "floor": "Όροφος",
    "phone": "Τηλέφωνο",
    "notes": "Σημείωση",
}
# Μόνο αυτά αξίζουν ειδοποίηση στον οδηγό — όροφος/τηλέφωνο περνούν σιωπηλά
NOTIFY_EDIT_FIELDS = ("address", "notes")

# Καταστάσεις που θεωρούνται «ζωντανές» — μόνο αυτές συγχρονίζονται
OPEN_STATUSES = ("scheduled", "waiting", "pickup", "enroute")


# ΣΗΜ.: τα imports του fleet.company γίνονται ΜΕΣΑ στις συναρτήσεις — το
# fleet.company φορτώνει pos/shared modules και ένα top-level import εδώ θα
# έφτιαχνε κύκλο.


# ============ ΛΟΓΑΡΙΑΣΜΟΙ / BACK-OFFICE ============
async def ensure_team_for_user(u: dict, admin_name: str = "Διαχειριστής") -> dict:
    """Δημιουργεί (ή επιστρέφει) την ομάδα FleetDeck ενός λογαριασμού users."""
    from fleet.company import ensure_fleet_team_for_user
    return await ensure_fleet_team_for_user(u, admin_name)


async def add_team_event(team_id: str, text: str) -> None:
    """Γραμμή στη ζωντανή ροή της εταιρείας."""
    from fleet.company import add_event
    await add_event(team_id, text)


async def next_team_order_number(team_id: str) -> int:
    from fleet.company import next_order_number
    return await next_order_number(team_id)


async def team_for_user(user_id: str) -> Optional[dict]:
    """Η ομάδα FleetDeck που ανήκει σε λογαριασμό users (εταιρεία διανομής)."""
    return await db.fleet_teams.find_one(
        {"owner_user_id": user_id}, {"_id": 0, "id": 1, "name": 1, "city": 1}
    )


async def set_team_disabled(user_id: str, disabled: bool) -> None:
    """Το disabled του λογαριασμού κόβει και τα fleet tokens/είσοδο οδηγών."""
    await db.fleet_teams.update_one(
        {"owner_user_id": user_id}, {"$set": {"disabled": disabled}}
    )


# ============ ΑΝΑΦΟΡΕΣ ΓΙΑ ΤΟ ADMIN PANEL (read-only) ============
async def team_counters_for_users(user_ids: list, totals_for: set | None = None) -> dict:
    """{user_id: {drivers_count, [orders_30d]}} — μία σάρωση, όχι N+1.

    ΑΠΟΡΡΗΤΟ ΠΕΛΑΤΗ: ο όγκος παραγγελιών επιστρέφεται ΜΟΝΟ για τα user_ids του
    totals_for (demo λογαριασμοί) — το admin panel δεν βλέπει επιδόσεις εταιρειών."""
    totals_for = totals_for or set()
    out = {
        uid: ({"drivers_count": 0, "orders_30d": 0} if uid in totals_for
              else {"drivers_count": 0})
        for uid in user_ids
    }
    if not user_ids:
        return out
    team_by_uid = {}
    async for t in db.fleet_teams.find(
        {"owner_user_id": {"$in": user_ids}}, {"_id": 0, "id": 1, "owner_user_id": 1}
    ):
        team_by_uid[t["id"]] = t["owner_user_id"]
    tids = list(team_by_uid)
    if not tids:
        return out
    async for r in db.fleet_members.aggregate([
        {"$match": {"team_id": {"$in": tids}, "role": "driver"}},
        {"$group": {"_id": "$team_id", "n": {"$sum": 1}}},
    ]):
        out[team_by_uid[r["_id"]]]["drivers_count"] = r["n"]
    demo_tids = [t for t in tids if team_by_uid[t] in totals_for]
    if demo_tids:
        d30 = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        async for r in db.fleet_orders.aggregate([
            {"$match": {"team_id": {"$in": demo_tids}, "created_at": {"$gte": d30}}},
            {"$group": {"_id": "$team_id", "n": {"$sum": 1}}},
        ]):
            out[team_by_uid[r["_id"]]]["orders_30d"] = r["n"]
    return out


async def team_detail_for_user(user_id: str, with_totals: bool = False) -> dict:
    """Ομάδα + μέλη μιας εταιρείας, για την καρτέλα admin. Οι μετρητές
    παραγγελιών (όγκος) μόνο με with_totals — ΜΟΝΟ για demo λογαριασμούς."""
    out: dict = {"team": None, "members": [], "last_activity": None}
    if with_totals:
        out.update({"orders_total": 0, "orders_30d": 0})
    team = await db.fleet_teams.find_one(
        {"owner_user_id": user_id}, {"_id": 0, "id": 1, "name": 1, "invite_code": 1}
    )
    if not team:
        return out
    out["team"] = team
    out["members"] = await db.fleet_members.find(
        {"team_id": team["id"]},
        {"_id": 0, "id": 1, "name": 1, "role": 1, "identifier": 1, "created_at": 1},
    ).sort("created_at", 1).to_list(200)
    d30 = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    group: dict = {"_id": None, "last": {"$max": "$created_at"}}
    if with_totals:
        group["n"] = {"$sum": 1}
        group["n30"] = {"$sum": {"$cond": [{"$gte": ["$created_at", d30]}, 1, 0]}}
    async for r in db.fleet_orders.aggregate([
        {"$match": {"team_id": team["id"]}},
        {"$group": group},
    ]):
        out["last_activity"] = r["last"]
        if with_totals:
            out["orders_total"] = r["n"]
            out["orders_30d"] = r["n30"]
    return out


async def teams_by_owner(owner_ids: list) -> dict:
    """{team_id: owner_user_id} για τη σύνδεση ομάδας ↔ λογαριασμού στο admin."""
    if not owner_ids:
        return {}
    out = {}
    async for t in db.fleet_teams.find(
        {"owner_user_id": {"$in": owner_ids}}, {"_id": 0, "id": 1, "owner_user_id": 1}
    ):
        out[t["id"]] = t["owner_user_id"]
    return out


async def drivers_per_team(team_ids: list) -> dict:
    """{team_id: πλήθος οδηγών}."""
    if not team_ids:
        return {}
    out = {}
    async for r in db.fleet_members.aggregate([
        {"$match": {"team_id": {"$in": list(team_ids)}, "role": "driver"}},
        {"$group": {"_id": "$team_id", "n": {"$sum": 1}}},
    ]):
        out[r["_id"]] = r["n"]
    return out


async def pending_partnerships(limit: int = 500) -> list:
    return await db.fleet_partnerships.find(
        {"status": "pending"}, {"_id": 0, "store_user_id": 1, "team_id": 1}
    ).to_list(limit)


async def teams_for_admin(city: str = "", search: str = "", limit: int = 100) -> list:
    """Εταιρείες διανομής για τη λίστα σύνδεσης του admin. Χωρίς φίλτρο πόλης
    επιστρέφονται όλες — η προτεραιότητα «ίδια πόλη» γίνεται στο admin domain.

    ΜΟΝΟ kind="company": οι ομάδες καταστημάτων (OrderDeck Fleet) δεν είναι εταιρείες."""
    import re as _re
    q: dict = {"kind": "company", "disabled": {"$ne": True}}
    if city.strip():
        q["city"] = {"$regex": f"^{_re.escape(city.strip())}$", "$options": "i"}
    if search.strip():
        q["name"] = {"$regex": _re.escape(search.strip()), "$options": "i"}
    return await db.fleet_teams.find(
        q, {"_id": 0, "id": 1, "name": 1, "city": 1}
    ).sort("name", 1).to_list(limit)


async def team_by_id(team_id: str, kind: str = "") -> Optional[dict]:
    """Μία ομάδα. Με kind="company" επιστρέφεται ΜΟΝΟ αν είναι εταιρεία διανομής
    (ο καλών θέλει εταιρεία — ποτέ ομάδα καταστήματος)."""
    q: dict = {"id": team_id}
    if kind:
        q["kind"] = kind
    return await db.fleet_teams.find_one(
        q, {"_id": 0, "id": 1, "name": 1, "city": 1, "kind": 1, "disabled": 1}
    )


async def partnerships_for(*, store_user_id: str = "", team_id: str = "") -> list:
    """Οι συνεργασίες ενός καταστήματος ή μιας εταιρείας (χωρίς τις τερματισμένες)
    — ίδια οντότητα με τις κανονικές συνεργασίες (fleet_partnerships)."""
    q: dict = {"status": {"$in": ["pending", "active"]}}
    if store_user_id:
        q["store_user_id"] = store_user_id
    if team_id:
        q["team_id"] = team_id
    return await db.fleet_partnerships.find(q, {"_id": 0}).sort("requested_at", -1).to_list(200)


async def create_partnership_direct(store: dict, team: dict, by: str = "") -> dict:
    """Ο master admin συνδέει κατάστημα ↔ εταιρεία ΧΩΡΙΣ αίτημα: η συνεργασία
    γεννιέται κατευθείαν «active». Ίδιο έγγραφο με τις κανονικές συνεργασίες."""
    import uuid
    existing = await db.fleet_partnerships.find_one(
        {"store_user_id": store["id"], "team_id": team["id"],
         "status": {"$in": ["pending", "active"]}},
        {"_id": 0},
    )
    now = datetime.now(timezone.utc).isoformat()
    if existing:
        if existing["status"] == "active":
            return existing
        # Εκκρεμές αίτημα → εγκρίνεται άμεσα από τον admin
        await db.fleet_partnerships.update_one(
            {"id": existing["id"]},
            {"$set": {"status": "active", "responded_at": now}},
        )
        existing.update({"status": "active", "responded_at": now})
        await add_team_event(team["id"], f"🤝 Η συνεργασία με «{existing['store_name']}» ενεργοποιήθηκε")
        return existing
    doc = {
        "id": str(uuid.uuid4()),
        "store_user_id": store["id"],
        "store_name": (store.get("restaurant_name") or "").strip() or "Κατάστημα",
        "store_city": (store.get("store_city") or store.get("city") or "").strip(),
        "team_id": team["id"],
        "team_name": team.get("name") or "",
        "team_city": team.get("city") or "",
        "status": "active",
        "created_by_admin": by or None,
        "requested_at": now,
        "responded_at": now,
        "ended_at": None,
    }
    await db.fleet_partnerships.insert_one(dict(doc))
    await add_team_event(team["id"], f"🤝 Νέα συνεργασία με «{doc['store_name']}»")
    return doc


async def end_partnership_direct(pid: str) -> Optional[dict]:
    """Τερματισμός συνεργασίας από τον admin — ίδια κατάληξη με τον τερματισμό
    από το κατάστημα (status=ended)."""
    p = await db.fleet_partnerships.find_one({"id": pid}, {"_id": 0})
    if not p:
        return None
    await db.fleet_partnerships.update_one(
        {"id": pid},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}},
    )
    await add_team_event(p["team_id"], f"Η συνεργασία με «{p['store_name']}» τερματίστηκε")
    return p


async def recent_partnerships(limit: int = 30) -> list:
    return await db.fleet_partnerships.find(
        {}, {"_id": 0, "store_user_id": 1, "team_id": 1, "store_name": 1,
             "team_name": 1, "store_city": 1, "requested_at": 1}
    ).sort("requested_at", -1).to_list(limit)


async def migrate_team_kinds(company_user_ids: set) -> dict:
    """Στάμπα «kind» σε ΚΑΘΕ ομάδα, ώστε οι λίστες εταιρειών να φιλτράρουν αυστηρά:

    · χωρίς owner_user_id → αυτόνομη (legacy) εγγραφή εταιρείας → «company»
    · owner με account_type=fleet_company → «company»
    · οτιδήποτε άλλο (ομάδα ΚΑΤΑΣΤΗΜΑΤΟΣ, π.χ. demo «Πεινώκιο» με OrderDeck Fleet)
      → «store» — φεύγει από συνεργασίες/admin/χάρτη

    Idempotent. Επιστρέφει τα ονόματα όσων ομάδων άλλαξαν ταυτότητα."""
    fixed: dict = {"company": [], "store": []}
    async for t in db.fleet_teams.find(
        {}, {"_id": 0, "id": 1, "name": 1, "kind": 1, "owner_user_id": 1}
    ):
        owner = t.get("owner_user_id")
        kind = "company" if (not owner or owner in company_user_ids) else "store"
        if t.get("kind") == kind:
            continue
        await db.fleet_teams.update_one({"id": t["id"]}, {"$set": {"kind": kind}})
        fixed[kind].append(t.get("name") or t["id"])
    return fixed


# ============ DEMO (back-office) ============
async def seed_company_demo(team_id: str) -> list:
    """Δείγμα οδηγών + παραγγελιών σε ομάδα εταιρείας. Επιστρέφει τα credentials."""
    from fleet.demo import seed_company_demo as _seed
    return await _seed(team_id)


async def seed_store_demo(user_id: str, store_name: str, city: str, create_company) -> str:
    """Ενεργή συνεργασία + δείγμα ανεβασμένων παραγγελιών για demo κατάστημα."""
    from fleet.demo import seed_store_demo as _seed
    return await _seed(user_id, store_name, city, create_company)


async def purge_team(team_id: str) -> None:
    """Μέλη/παραγγελίες/γεγονότα/μετρητές ομάδας (όχι το ίδιο το team doc)."""
    from fleet.demo import purge_fleet_team
    await purge_fleet_team(team_id)


async def delete_team_for_user(user_id: str) -> None:
    """Πλήρης διαγραφή της ομάδας ενός λογαριασμού εταιρείας διανομής."""
    from fleet.demo import purge_fleet_team
    team = await db.fleet_teams.find_one({"owner_user_id": user_id}, {"id": 1})
    if team:
        await purge_fleet_team(team["id"])
        await db.fleet_teams.delete_one({"id": team["id"]})


async def add_demo_admin_member(team_id: str, pin_hash: str) -> None:
    """Ο ένας διαχειριστής που ξαναφτιάχνεται μετά από reset demo εταιρείας."""
    import uuid
    from datetime import datetime as _dt
    await db.fleet_members.insert_one({
        "id": str(uuid.uuid4())[:8],
        "team_id": team_id,
        "name": "Διαχειριστής",
        "role": "fleet_admin",
        "pin_hash": pin_hash,
        "created_at": _dt.now(timezone.utc).isoformat(),
    })


# ============ ΣΥΝΔΕΣΗ ΜΕ ΠΑΡΑΓΓΕΛΙΑ POS ============
async def _open_order_for_pos(store_user_id: str, pos_order_id: str) -> Optional[dict]:
    """Η ζωντανή fleet παραγγελία που προήλθε από τη συγκεκριμένη POS παραγγελία."""
    if not pos_order_id:
        return None
    return await db.fleet_orders.find_one({
        "store_user_id": store_user_id,
        "source_pos_order_id": pos_order_id,
        "status": {"$in": list(OPEN_STATUSES)},
    })


async def get_order_status(store_user_id: str, pos_order_id: str) -> Optional[dict]:
    """Η τρέχουσα κατάσταση της ανεβασμένης παραγγελίας — ό,τι χρειάζεται η κάρτα
    του POS. None όταν η παραγγελία δεν έχει ανέβει πουθενά."""
    o = await db.fleet_orders.find_one(
        {"store_user_id": store_user_id, "source_pos_order_id": pos_order_id},
        {"_id": 0, "id": 1, "number": 1, "status": 1, "team_id": 1, "team_name": 1,
         "driver_name": 1, "claimed_at": 1, "delivered_at": 1, "problem": 1},
        sort=[("created_at", -1)],
    )
    return o or None


async def mark_out_for_delivery(store_user_id: str, pos_order_id: str, platform: str) -> bool:
    """«ΚΑΘ' ΟΔΟΝ» από καρτέλα πλατφόρμας: σημειώνεται και στη συνδεδεμένη
    παραγγελία της εταιρείας διανομής. Δεν αλλάζει κατάσταση/ανάθεση οδηγού —
    ο οδηγός παραμένει κύριος της ροής του."""
    o = await _open_order_for_pos(store_user_id, pos_order_id)
    if not o:
        return False
    await db.fleet_orders.update_one(
        {"id": o["id"]},
        {"$set": {
            "platform_out_for_delivery_at": datetime.now(timezone.utc).isoformat(),
            "platform": platform,
        }},
    )
    return True


async def apply_pos_order_edit(store_user_id: str, pos_order_id: str, changes: dict) -> bool:
    """Η επεξεργασία μιας POS παραγγελίας περνά στη συνδεδεμένη fleet παραγγελία
    (διεύθυνση/όροφος/τηλέφωνο/σημείωση) και ειδοποιεί τον οδηγό με το «Η #Χ
    ενημερώθηκε». Τα είδη ΔΕΝ ταξιδεύουν — οι οδηγοί δεν βλέπουν είδη."""
    changes = {k: v for k, v in (changes or {}).items() if k in POS_EDIT_LABELS}
    if not changes:
        return False
    o = await _open_order_for_pos(store_user_id, pos_order_id)
    if not o:
        return False
    from shared.notifications import notify_push
    from fleet.company import DRIVER_URL, add_event

    update = dict(changes)
    if "address" in changes:
        # Νέα διεύθυνση → το παλιό pin δεν ισχύει (χωρίς νέο geocode εδώ)
        update["lat"] = None
        update["lng"] = None
    notify_fields = [f for f in NOTIFY_EDIT_FIELDS if f in changes]
    if o.get("driver_id") and notify_fields:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        update["updated_fields"] = notify_fields
    await db.fleet_orders.update_one({"id": o["id"]}, {"$set": update})
    if notify_fields and o.get("number") is not None:
        labels = ", ".join(POS_EDIT_LABELS[f] for f in notify_fields)
        await add_event(o["team_id"], f"Η #{o['number']} ενημερώθηκε ({labels})")
        if o.get("driver_id"):
            await notify_push(
                o["team_id"], "driver",
                f"Η #{o['number']} ενημερώθηκε",
                f"Άλλαξε: {labels}",
                DRIVER_URL,
                member_ids=[o["driver_id"]],
            )
    return True


async def cancel_for_pos_order(store_user_id: str, pos_order_id: str, reason: str = "") -> bool:
    """Ακύρωση/διαγραφή παραγγελίας στο POS → ακυρώνεται και στο FleetDeck.
    Προγραμματισμένη (αδημοσίευτη) διαγράφεται· μετά το claim ειδοποιείται ο
    οδηγός και η διαχείριση, όπως και στην ακύρωση από το κατάστημα."""
    o = await _open_order_for_pos(store_user_id, pos_order_id)
    if not o:
        return False
    from shared.notifications import notify_push
    from fleet.company import DISPATCH_URL, DRIVER_URL, add_event, order_push_body

    if o["status"] == "scheduled":
        await db.fleet_orders.delete_one({"id": o["id"]})
        return True
    await db.fleet_orders.update_one({"id": o["id"]}, {"$set": {"status": "cancelled"}})
    suffix = f" ({reason})" if reason else ""
    await add_event(o["team_id"], f"Η #{o['number']} ακυρώθηκε από «{o['pickup_name']}»{suffix}")
    if o.get("driver_id"):
        await notify_push(
            o["team_id"], "driver",
            f"Η #{o['number']} ακυρώθηκε",
            order_push_body(o),
            DRIVER_URL,
            member_ids=[o["driver_id"]],
        )
        await notify_push(
            o["team_id"], "dispatcher",
            f"Η #{o['number']} ακυρώθηκε",
            f"Από το κατάστημα «{o['pickup_name']}»",
            DISPATCH_URL,
        )
    return True


# ============ MIGRATION: σύνδεση παλιών ανεβασμένων παραγγελιών ============
# Παράθυρο γύρω από την ώρα δημιουργίας μέσα στο οποίο δύο παραγγελίες μπορεί να
# είναι η ίδια. Έξω από αυτό δεν γίνεται καμία υπόθεση.
LINK_WINDOW_HOURS = 6


def _norm_address(a: Optional[str]) -> str:
    return " ".join((a or "").strip().lower().split())


async def migrate_link_existing_orders() -> int:
    """Συνδέει ΜΟΝΟ όσες ζωντανές ανεβασμένες παραγγελίες ταυτίζονται με ασφάλεια
    με μία παραγγελία POS: ίδιο κατάστημα, ίδια κανονικοποιημένη διεύθυνση, μέσα
    σε ±6 ώρες, και ΑΚΡΙΒΩΣ μία υποψήφια από κάθε πλευρά. Οτιδήποτε αμφίσημο
    μένει ασύνδετο (χάνει μόνο τον ζωντανό συγχρονισμό — αποδεκτό).

    Idempotent: αγγίζει μόνο fleet παραγγελίες χωρίς source_pos_order_id."""
    from pos import api as pos_api

    since = (datetime.now(timezone.utc) - timedelta(hours=LINK_WINDOW_HOURS * 2)).isoformat()
    pending = await db.fleet_orders.find(
        {
            "store_user_id": {"$ne": None},
            "source_pos_order_id": None,
            "status": {"$in": list(OPEN_STATUSES)},
            "created_at": {"$gte": since},
        },
        {"_id": 0, "id": 1, "store_user_id": 1, "address": 1, "created_at": 1,
         "team_id": 1, "team_name": 1, "status": 1, "driver_name": 1},
    ).to_list(2000)
    if not pending:
        return 0

    linked = 0
    by_store: dict = {}
    for fo in pending:
        by_store.setdefault(fo["store_user_id"], []).append(fo)

    for store_uid, fleet_orders in by_store.items():
        candidates = await pos_api.unlinked_delivery_orders(store_uid, since)
        # Ομαδοποίηση POS παραγγελιών ανά διεύθυνση — >1 σημαίνει αμφισημία
        pos_by_addr: dict = {}
        for po in candidates:
            key = _norm_address((po.get("delivery") or {}).get("address"))
            if key:
                pos_by_addr.setdefault(key, []).append(po)
        # Ίδιο και από την πλευρά του fleet: δύο ανεβασμένες στην ίδια διεύθυνση
        fleet_by_addr: dict = {}
        for fo in fleet_orders:
            key = _norm_address(fo.get("address"))
            if key:
                fleet_by_addr.setdefault(key, []).append(fo)

        for key, fos in fleet_by_addr.items():
            pos_matches = pos_by_addr.get(key) or []
            if len(fos) != 1 or len(pos_matches) != 1:
                continue  # αμφίσημο — δεν μαντεύουμε
            fo, po = fos[0], pos_matches[0]
            try:
                delta = abs(
                    datetime.fromisoformat(fo["created_at"])
                    - datetime.fromisoformat(po["created_at"])
                )
            except (TypeError, ValueError):
                continue
            if delta > timedelta(hours=LINK_WINDOW_HOURS):
                continue
            await db.fleet_orders.update_one(
                {"id": fo["id"], "source_pos_order_id": None},
                {"$set": {"source_pos_order_id": po["id"]}},
            )
            await pos_api.link_fleet_order(store_uid, po["id"], fo)
            await pos_api.set_fleet_status(
                store_uid, po["id"], fo["status"], fo.get("driver_name")
            )
            linked += 1
    return linked


# ============ ΚΥΚΛΟΣ ΖΩΗΣ ΛΟΓΑΡΙΑΣΜΟΥ ============
async def purge_store_data(user_id: str) -> None:
    """Διαγραφή λογαριασμού καταστήματος: συνεργασίες + ανεβασμένες παραγγελίες."""
    await db.fleet_partnerships.delete_many({"store_user_id": user_id})
    await purge_store_orders(user_id)


async def purge_store_orders(user_id: str) -> None:
    """Μόνο οι ανεβασμένες παραγγελίες — οι συνεργασίες μένουν (reset demo)."""
    await db.fleet_orders.delete_many({"store_user_id": user_id})
