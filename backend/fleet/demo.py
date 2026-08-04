"""Δείγματα δεδομένων FleetDeck (demo λογαριασμοί) + καθαρισμός ομάδας.

Ζει στο fleet/ γιατί γράφει ΜΟΝΟ σε fleet_* collections. Το admin panel το
καλεί μέσω του fleet.api — δεν αγγίζει τα collections μόνο του.
"""
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from shared.core import athens_today, db, hash_password

# Χωρίς διφορούμενους χαρακτήρες — τα credentials πληκτρολογούνται σε παρουσιάσεις
CRED_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


def _rand(n: int) -> str:
    return "".join(secrets.choice(CRED_ALPHABET) for _ in range(n))


async def purge_fleet_team(team_id: str) -> None:
    """Σβήνει μέλη/παραγγελίες/γεγονότα/μετρητές μιας ομάδας (όχι το team doc).
    Λογαριασμοί οδηγών σβήνονται μόνο αν δεν ανήκουν και σε άλλη εταιρεία."""
    members = await db.fleet_members.find({"team_id": team_id}).to_list(500)
    for m in members:
        aid = m.get("account_id")
        if not aid:
            continue
        elsewhere = await db.fleet_members.count_documents(
            {"account_id": aid, "team_id": {"$ne": team_id}}
        )
        if elsewhere == 0:
            await db.fleet_accounts.delete_one({"id": aid})
    await db.fleet_members.delete_many({"team_id": team_id})
    for coll in ("fleet_orders", "fleet_events", "fleet_counters"):
        await db[coll].delete_many({"team_id": team_id})



DEMO_DRIVERS = ["Γιώργος Κ.", "Μαρία Π.", "Νίκος Δ."]

# (κατάστημα παραλαβής, διεύθυνση, ποσό, πληρωμή, κατάσταση, index οδηγού|None, πριν από λεπτά)
DEMO_SAMPLE_ORDERS = [
    ("Πεινώκιο", "Ερμού 12", 12.50, "cash", "delivered", 0, 110),
    ("Pizza Roma", "Αγ. Δημητρίου 45", 18.90, "card", "delivered", 1, 95),
    ("Burger Bros", "Παπάφη 3", 9.80, "cash", "delivered", 0, 70),
    ("Πεινώκιο", "Τσιμισκή 88", 15.40, "paid", "cancelled", None, 60),
    ("Cafe Central", "Βενιζέλου 21", 7.20, "cash", "enroute", 1, 25),
    ("Pizza Roma", "Ολύμπου 65", 22.00, "card", "pickup", 2, 15),
    ("Burger Bros", "Καρόλου Ντηλ 9", 11.60, "cash", "waiting", None, 8),
    ("Πεινώκιο", "Μητροπόλεως 33", 14.30, "cash", "waiting", None, 3),
]

STATUS_EVENT = {
    "waiting": "Νέα παραγγελία #{n} · {pickup}",
    "pickup": "Ο/Η {driver} πήρε την #{n}",
    "enroute": "Η #{n} σε διαδρομή ({driver})",
    "delivered": "Η #{n} παραδόθηκε ({driver})",
    "cancelled": "Η #{n} ακυρώθηκε",
}


async def _unique_demo_phone() -> str:
    while True:
        phone = "69" + "".join(secrets.choice("0123456789") for _ in range(8))
        if not await db.fleet_accounts.find_one({"phone": phone}, {"_id": 1}):
            return phone


async def seed_company_demo(team_id: str) -> list:
    """Δείγμα οδηγών + παραγγελιών/γεγονότων ώστε πίνακας διαχειριστή και οθόνη οδηγού
    να δείχνουν ζωντανά. Επιστρέφει τα credentials των demo οδηγών (ο καλών τα
    αποθηκεύει στο demo_credentials ώστε να φαίνονται και στην καρτέλα του demo)."""
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    driver_creds, driver_members = [], []
    for name in DEMO_DRIVERS:
        phone = await _unique_demo_phone()
        password = _rand(6)
        account = {
            "id": str(uuid.uuid4()),
            "account_type": "driver",
            "phone": phone,
            "name": name,
            "password_hash": hash_password(password),
            "must_change_password": False,
            "is_demo": True,
            "created_at": now_iso,
        }
        await db.fleet_accounts.insert_one(account)
        member = {
            "id": str(uuid.uuid4())[:8],
            "team_id": team_id,
            "name": name,
            "role": "driver",
            "account_id": account["id"],
            "identifier": phone,
            "created_at": now_iso,
        }
        await db.fleet_members.insert_one(member)
        driver_members.append(member)
        driver_creds.append({"name": name, "phone": phone, "password": password})

    for i, (pickup, address, amount, payment, status, didx, mins) in enumerate(DEMO_SAMPLE_ORDERS):
        created = (now - timedelta(minutes=mins)).isoformat()
        driver = driver_members[didx] if didx is not None else None
        order = {
            "id": str(uuid.uuid4()),
            "team_id": team_id,
            "number": i + 1,
            "pickup_name": pickup,
            "address": address,
            "amount": amount,
            "payment": payment,
            "notes": "",
            "status": status,
            "driver_id": driver["id"] if driver else None,
            "driver_name": driver["name"] if driver else None,
            "created_by": "Διαχειριστής",
            "created_at": created,
            "claimed_at": created if driver else None,
            "delivered_at": (now - timedelta(minutes=max(mins - 20, 1))).isoformat()
            if status == "delivered" else None,
        }
        await db.fleet_orders.insert_one(order)
        await db.fleet_events.insert_one({
            "id": str(uuid.uuid4()),
            "team_id": team_id,
            "text": STATUS_EVENT[status].format(
                n=order["number"], pickup=pickup, driver=driver["name"] if driver else ""
            ),
            "created_at": created,
        })
    # Ο μετρητής συνεχίζει από τα seeded νούμερα για νέες παραγγελίες της ημέρας
    await db.fleet_counters.update_one(
        {"team_id": team_id, "day": athens_today()},
        {"$set": {"seq": len(DEMO_SAMPLE_ORDERS)}},
        upsert=True,
    )
    return driver_creds


# Δείγμα ανεβασμένων παραγγελιών FleetDeck store demo: (διεύθυνση, κατάσταση, πριν από λεπτά)
DEMO_STORE_UPLOADS = [
    ("Εγνατία 140", "delivered", 45),
    ("Αριστοτέλους 5", "waiting", 4),
]


async def seed_store_demo(uid: str, store_name: str, city: str, create_company) -> str:
    """FleetDeck store demo: ενεργή συνεργασία με demo εταιρεία διανομής (auto-create
    αν δεν υπάρχει) + δείγμα ανεβασμένων παραγγελιών ώστε η ροή να είναι παρουσιάσιμη.
    Επιστρέφει το όνομα της συνεργαζόμενης εταιρείας.

    Το `create_company(city)` το δίνει ο καλών (admin) και επιστρέφει την ομάδα
    ({id, name, city}) μιας υπάρχουσας ή νέας demo εταιρείας: η δημιουργία
    λογαριασμού users δεν ανήκει στο fleet domain."""
    from fleet.company import add_event, next_order_number

    now = datetime.now(timezone.utc)
    # Υπάρχουσα ενεργή συνεργασία (reset) → κράτα την· αλλιώς βρες/φτιάξε demo εταιρεία
    part = await db.fleet_partnerships.find_one(
        {"store_user_id": uid, "status": "active"}, {"_id": 0}
    )
    if not part:
        team = await create_company(city)
        part = {
            "id": str(uuid.uuid4()),
            "store_user_id": uid,
            "store_name": store_name,
            "store_city": city,
            "team_id": team["id"],
            "team_name": team["name"],
            "team_city": team.get("city") or "",
            "status": "active",
            "requested_at": now.isoformat(),
            "responded_at": now.isoformat(),
            "ended_at": None,
        }
        await db.fleet_partnerships.insert_one({**part})
        await add_event(part["team_id"], f"🤝 Συνεργασία με «{store_name}» (demo)")
    driver = await db.fleet_members.find_one(
        {"team_id": part["team_id"], "role": "driver"}, {"_id": 0, "id": 1, "name": 1}
    )
    for address, status, mins in DEMO_STORE_UPLOADS:
        created = (now - timedelta(minutes=mins)).isoformat()
        delivered = status == "delivered"
        order = {
            "id": str(uuid.uuid4()),
            "team_id": part["team_id"],
            "team_name": part["team_name"],
            "store_user_id": uid,
            "number": await next_order_number(part["team_id"]),
            "pickup_name": store_name,
            "address": address,
            "phone": "",
            "notes": "",
            "urgent": False,
            "problem": None,
            "status": status,
            "publish_at": None,
            "driver_id": driver["id"] if delivered and driver else None,
            "driver_name": driver["name"] if delivered and driver else None,
            "created_by": store_name,
            "lat": None,
            "lng": None,
            "created_at": created,
            "claimed_at": created if delivered and driver else None,
            "delivered_at": (now - timedelta(minutes=max(mins - 25, 1))).isoformat()
            if delivered else None,
        }
        await db.fleet_orders.insert_one(order)
        if status == "waiting":
            await add_event(
                part["team_id"], f"Νέα παραγγελία #{order['number']} · {store_name}"
            )
    return part["team_name"]
