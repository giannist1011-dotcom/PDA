"""OrderDeck Fleet — αυτόνομες εταιρείες διανομής (Phase 1: standalone).

Δικές τους οντότητες (fleet_teams / fleet_members / fleet_orders / fleet_events),
δικό τους JWT (claim kind="fleet" — δεν περνάει από το get_current_user των μαγαζιών).
Σχεδιασμένο ώστε ένα fleet_team να μπορεί ΑΡΓΟΤΕΡΑ να συνδεθεί με μαγαζιά
(Phase 2) — τίποτα εδώ δεν το αποκλείει (π.χ. μελλοντικό πεδίο linked_store_ids).
"""
import logging
import secrets
import uuid
from datetime import date as date_cls, datetime, timezone, timedelta
from typing import Literal, Optional

import jwt as pyjwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from shared.core import (
    JWT_ALG,
    JWT_SECRET,
    JWT_TTL_HOURS,
    athens_day_expr,
    athens_hour_expr,
    athens_today,
    create_token,
    db,
    get_current_user,
    hash_password,
    local_day_range,
    pin_lock_message,
    pin_locked_for,
    public_user,
    rate_limit,
    register_pin_attempt,
    to_athens,
    verify_password,
)
from shared.notifications import (
    VAPID_PUBLIC_KEY,
    delete_subscription,
    notify_push,
    push_enabled,
    save_subscription,
)

router = APIRouter()
logger = logging.getLogger("orderdeck.fleet")

FLEET_ROLES = ["fleet_admin", "driver"]
ORDER_STATUSES = ["waiting", "pickup", "enroute", "delivered", "cancelled"]
# Ροή οδηγού: παραλαβή → διαδρομή → παραδόθηκε
DRIVER_NEXT = {"pickup": "enroute", "enroute": "delivered"}

# Χωρίς διφορούμενους χαρακτήρες (0/O, 1/I) — γράφεται εύκολα από κινητό
INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
TEMP_PW_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"


def new_invite_code() -> str:
    return "".join(secrets.choice(INVITE_ALPHABET) for _ in range(6))


def new_temp_password() -> str:
    return "".join(secrets.choice(TEMP_PW_ALPHABET) for _ in range(6))


def normalize_identifier(raw: str) -> tuple:
    """Τηλέφωνο ή email διανομέα → (πεδίο, κανονικοποιημένη τιμή)."""
    s = (raw or "").strip()
    if "@" in s:
        if "." not in s.split("@")[-1]:
            raise HTTPException(400, "Μη έγκυρο email")
        return "email", s.lower()
    digits = "".join(c for c in s if c.isdigit())
    if len(digits) < 10:
        raise HTTPException(400, "Μη έγκυρο τηλέφωνο ή email")
    return "phone", digits


# ============ AUTH ============
def create_fleet_token(
    team_id: str,
    member_id: Optional[str] = None,
    role: Optional[str] = None,
    member_name: Optional[str] = None,
) -> str:
    payload = {
        "sub": team_id,
        "kind": "fleet",
        "member_id": member_id,
        "role": role,
        "member_name": member_name,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_TTL_HOURS),
        "type": "access",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_fleet_team(authorization: Optional[str] = Header(None)) -> dict:
    """Team-level auth (πριν την επιλογή μέλους). Δέχεται ΜΟΝΟ fleet tokens."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    if payload.get("kind") != "fleet":
        raise HTTPException(401, "Invalid token")
    team = await db.fleet_teams.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not team:
        raise HTTPException(401, "Team not found")
    if team.get("disabled"):
        raise HTTPException(403, "Ο λογαριασμός έχει απενεργοποιηθεί")
    member_id = payload.get("member_id")
    role = payload.get("role")
    member_name = payload.get("member_name")
    is_admin_driver = False
    admin_display_name = None
    if member_id:
        m = await db.fleet_members.find_one({"id": member_id, "team_id": team["id"]}, {"_id": 0})
        if m:
            role, member_name = m["role"], m["name"]
            # Προφίλ οδηγού που ανήκει σε διαχειριστή («Λειτουργία διανομέα»)
            is_admin_driver = bool(m.get("admin_member_id"))
            # Προσωπικό όνομα διαχειριστή — η ταυτότητα του driver προφίλ του
            if m["role"] == "fleet_admin":
                admin_display_name = (m.get("display_name") or "").strip()
        else:
            # Το μέλος διαγράφηκε όσο ζούσε το token → επιστροφή σε επιλογή μέλους
            member_id = role = member_name = None
    team["member_id"] = member_id
    team["role"] = role
    team["member_name"] = member_name
    team["is_admin_driver"] = is_admin_driver
    team["admin_display_name"] = admin_display_name
    return team


async def get_fleet_member(team: dict = Depends(get_fleet_team)) -> dict:
    if not team.get("member_id"):
        raise HTTPException(403, "Απαιτείται επιλογή μέλους με PIN")
    return team


async def require_fleet_admin(team: dict = Depends(get_fleet_member)) -> dict:
    if team.get("role") != "fleet_admin":
        raise HTTPException(403, "Απαιτείται πρόσβαση διαχείρισης")
    return team


def create_driver_token(account_id: str) -> str:
    """Token προσωπικού λογαριασμού διανομέα (πριν την επιλογή εταιρείας)."""
    payload = {
        "sub": account_id,
        "kind": "fleet_driver",
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_TTL_HOURS),
        "type": "access",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_fleet_account(authorization: Optional[str] = Header(None)) -> dict:
    """Auth προσωπικού λογαριασμού διανομέα (kind=fleet_driver)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    if payload.get("kind") != "fleet_driver":
        raise HTTPException(401, "Invalid token")
    account = await db.fleet_accounts.find_one({"id": payload["sub"]}, {"_id": 0})
    if not account:
        raise HTTPException(401, "Ο λογαριασμός δεν βρέθηκε")
    return account


def public_team(t: dict, include_invite: bool = False) -> dict:
    out = {
        "id": t["id"],
        "name": t["name"],
        "city": t.get("city") or "",
        "address": t.get("address") or "",
        "phone": t.get("phone") or "",
        "lat": t.get("lat"),
        "lng": t.get("lng"),
        "email": t.get("email"),
        "member_id": t.get("member_id"),
        "role": t.get("role"),
        "member_name": t.get("member_name"),
        "is_admin_driver": bool(t.get("is_admin_driver")),
        "admin_display_name": t.get("admin_display_name") or "",
    }
    if include_invite:
        out["invite_code"] = t.get("invite_code")
    return out


def public_member(m: dict) -> dict:
    return {k: v for k, v in m.items() if k not in ("_id", "team_id", "pin_hash")}


def public_order(o: dict) -> dict:
    return {k: v for k, v in o.items() if k not in ("_id", "team_id")}


# Γενικές ετικέτες ρόλου — ΔΕΝ εμφανίζονται ποτέ ως ταυτότητα σε οδηγούς/παραγγελίες
GENERIC_ADMIN_LABELS = ("Διαχείριση", "Διαχειριστής", "Συντονιστής", "Συντονίστρια")


def admin_identity(team: dict) -> str:
    """Πώς υπογράφει η διαχείριση σε ό,τι βλέπουν οδηγοί/παραγγελίες (created_by,
    ροή, προβλήματα): προσωπικό όνομα («Το όνομά μου») → μη γενικό όνομα μέλους →
    όνομα εταιρείας. Ποτέ ετικέτα ρόλου."""
    name = (team.get("admin_display_name") or "").strip()
    if not name:
        mn = (team.get("member_name") or "").strip()
        if mn and mn not in GENERIC_ADMIN_LABELS:
            name = mn
    return name or (team.get("name") or "").strip() or "Διαχείριση"


def valid_pin(pin: Optional[str]) -> bool:
    return bool(pin) and pin.isdigit() and len(pin) == 4


async def mirror_status_to_pos(order: dict, status: str, driver_name: Optional[str] = None):
    """Κάθε αλλαγή κατάστασης μιας ανεβασμένης παραγγελίας γυρνά στην κάρτα του
    POS, ΜΟΝΟ μέσω της ρητής σύνδεσης (source_pos_order_id) και της διεπαφής του
    pos domain. Χωρίς σύνδεση (χειροκίνητο ανέβασμα) δεν γίνεται τίποτα."""
    pos_id = order.get("source_pos_order_id")
    store_uid = order.get("store_user_id")
    if not pos_id or not store_uid:
        return
    from pos import api as pos_api
    try:
        await pos_api.set_fleet_status(store_uid, pos_id, status, driver_name)
    except Exception as e:
        logger.warning("pos status mirror failed for fleet order %s: %s", order.get("id"), e)


async def add_event(team_id: str, text: str):
    await db.fleet_events.insert_one({
        "id": str(uuid.uuid4()),
        "team_id": team_id,
        "text": text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# URLs που ανοίγει το tap στην ειδοποίηση (notificationclick στο sw.js)
DRIVER_URL = "/fleet/driver"
DISPATCH_URL = "/fleet"


def order_push_body(o: dict) -> str:
    """Σύντομο σώμα ειδοποίησης: κατάστημα παραλαβής · διεύθυνση (+ όροφος)."""
    addr = o.get("address") or ""
    if addr and (o.get("floor") or "").strip():
        addr = f"{addr} ({o['floor'].strip()})"
    return " · ".join(x for x in [o.get("pickup_name"), addr] if x)


async def push_on_shift_drivers(team_id: str, title: str, body: str):
    """Push σε ΟΛΟΥΣ τους οδηγούς της ομάδας που είναι σε βάρδια."""
    if not push_enabled():
        return
    ids = [
        m["id"]
        async for m in db.fleet_members.find(
            {"team_id": team_id, "role": "driver", "on_shift": True}, {"id": 1}
        )
    ]
    await notify_push(team_id, "driver", title, body, DRIVER_URL, member_ids=ids)


async def next_order_number(team_id: str) -> int:
    """Ατομικός per-team/per-day αύξων αριθμός παραγγελίας (upsert + $inc)."""
    doc = await db.fleet_counters.find_one_and_update(
        {"team_id": team_id, "day": athens_today()},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    return int(doc["seq"]) if doc else 1


async def publish_due_scheduled(match: dict):
    """Δημοσιεύει προγραμματισμένες παραγγελίες καταστημάτων που έφτασε η ώρα τους
    (status scheduled → waiting + αριθμός + push). Καλείται lazily από τα polling
    endpoints (πίνακας καταστήματος, πίνακας εταιρείας, οθόνη οδηγού) ώστε η
    δημοσίευση να γίνεται και με κλειστό το tab του καταστήματος. Το update_one
    φιλτράρει σε status=scheduled — δύο ταυτόχρονα polls δεν τη δημοσιεύουν διπλά."""
    now = datetime.now(timezone.utc).isoformat()
    due = await db.fleet_orders.find(
        {**match, "status": "scheduled", "publish_at": {"$lte": now}}, {"_id": 0}
    ).to_list(100)
    for o in due:
        number = await next_order_number(o["team_id"])
        res = await db.fleet_orders.update_one(
            {"id": o["id"], "status": "scheduled"},
            {"$set": {"status": "waiting", "number": number, "created_at": now}},
        )
        if not res.modified_count:
            continue
        await mirror_status_to_pos(o, "waiting", None)
        prefix = "⚡ Επείγουσα παραγγελία" if o.get("urgent") else "Νέα παραγγελία"
        await add_event(o["team_id"], f"{prefix} #{number} · {o['pickup_name']}")
        await push_on_shift_drivers(o["team_id"], f"{prefix} #{number}", order_push_body(o))


# ============ MODELS ============
class FleetRegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    city: str = Field(default="", max_length=60)
    email: EmailStr
    password: str = Field(min_length=4)
    admin_name: str = Field(default="Διαχειριστής", max_length=40)
    admin_pin: str = Field(min_length=4, max_length=4)


class FleetLoginIn(BaseModel):
    email: EmailStr
    password: str


class MemberSelectIn(BaseModel):
    member_id: str
    pin: str = Field(min_length=4, max_length=4)


class MemberIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    role: Literal["fleet_admin", "driver"]
    pin: Optional[str] = None  # 4 ψηφία — διαχειριστές (επιλογή μέλους στη συσκευή)
    phone_or_email: Optional[str] = None  # διανομείς — προσωπικός λογαριασμός


class DriverLoginIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=80)  # τηλέφωνο ή email
    password: str = Field(min_length=1, max_length=64)


class DriverPasswordIn(BaseModel):
    password: str = Field(min_length=6, max_length=64)


class DriverSelectIn(BaseModel):
    member_id: str


# Χωρίς ποσό/πληρωμή: τα χρήματα είναι υπόθεση του μαγαζιού, όχι της εταιρείας.
# Παλιές παραγγελίες με amount/payment στη βάση απλώς δεν τα εμφανίζουν πια.
class FleetOrderIn(BaseModel):
    pickup_name: str = Field(min_length=1, max_length=80)
    address: str = Field(min_length=1, max_length=160)
    notes: str = Field(default="", max_length=300)
    urgent: bool = False
    # Συντεταγμένες της διεύθυνσης (από επιλογή πρότασης ή auto-geocode στη
    # φόρμα) — None όταν η διεύθυνση δεν βρέθηκε: η παραγγελία μένει εκτός χάρτη
    lat: Optional[float] = None
    lng: Optional[float] = None
    # ΣΗΜΕΙΟ ΠΑΡΑΛΑΒΗΣ — κείμενο + pin. Έρχεται είτε από συνεργαζόμενο μαγαζί
    # (όνομα/διεύθυνση/pin των ρυθμίσεών του) είτε από ελεύθερη διεύθυνση με
    # χάρτη. Ο οδηγός το βλέπει στην κάρτα και στον χάρτη του.
    pickup_address: str = Field(default="", max_length=160)
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None


class FleetOrderEditIn(BaseModel):
    pickup_name: str = Field(min_length=1, max_length=80)
    address: str = Field(min_length=1, max_length=160)
    notes: str = Field(default="", max_length=300)
    lat: Optional[float] = None
    lng: Optional[float] = None
    pickup_address: str = Field(default="", max_length=160)
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None


class StatusIn(BaseModel):
    status: Literal["waiting", "pickup", "enroute", "delivered"]


class AssignIn(BaseModel):
    member_id: Optional[str] = None  # None → επιστροφή σε αναμονή (αποδέσμευση)


class UrgentIn(BaseModel):
    urgent: bool


class ShiftIn(BaseModel):
    on: bool


class ProblemIn(BaseModel):
    reason: Literal["no_answer", "wrong_address", "other"]
    text: str = Field(default="", max_length=300)


PROBLEM_LABELS = {
    "no_answer": "Δεν απαντάει",
    "wrong_address": "Λάθος διεύθυνση",
    "other": "Άλλο",
}
EDIT_FIELD_LABELS = {
    "pickup_name": "Παραλαβή",
    "address": "Διεύθυνση",
    "notes": "Σημείωση",
}
# Το σημείο παραλαβής ακολουθεί πάντα το «Παραλαβή από» — αλλάζει μαζί του,
# χωρίς δική του ετικέτα στην ειδοποίηση του οδηγού
PICKUP_POINT_FIELDS = ("pickup_address", "pickup_lat", "pickup_lng")


# ============ UNIFIED AUTH (account_type στους users — όχι παράλληλο σύστημα) ============
def team_kind_for_user(u: dict) -> str:
    """Η ΤΑΥΤΟΤΗΤΑ της ομάδας κρίνεται ΜΟΝΟ από το account_type του λογαριασμού:

    · «company» → εταιρεία διανομής (users.account_type=fleet_company). ΜΟΝΟ αυτές
      εμφανίζονται στις λίστες εταιρειών (συνεργασίες, admin, χάρτης).
    · «store»   → η δική του ομάδα ενός ΚΑΤΑΣΤΗΜΑΤΟΣ (πλάνο OrderDeck Fleet). Ποτέ
      στις λίστες εταιρειών — το μαγαζί δεν είναι εταιρεία διανομής.

    ΠΟΤΕ από πλάνο ή όνομα: το πλάνο λέει τι μπορεί να κάνει ο λογαριασμός, όχι τι είναι.
    """
    return "company" if u.get("account_type") == "fleet_company" else "store"


def owns_delivery_team(u: dict) -> bool:
    """Ποιοι λογαριασμοί δικαιούνται ΔΙΚΗ τους ομάδα διανομής: οι εταιρείες και τα
    καταστήματα με πλάνο OrderDeck Fleet. Το πλάνο «fleet» (FleetDeck καταστήματος)
    ΔΕΝ έχει ομάδα — ανεβάζει παραγγελίες σε συνεργαζόμενες εταιρείες."""
    if u.get("account_type") == "fleet_company":
        return True
    return (u.get("plan") or "orderdeck") == "orderdeck_fleet"


async def ensure_fleet_team_for_user(u: dict, admin_name: str = "Διαχειριστής") -> dict:
    """Βρίσκει ή δημιουργεί το fleet_team ενός unified λογαριασμού (users.account_type).

    Καλείται από την εγγραφή (store plan με Fleet, /fleet/signup) και lazily από το
    /fleet/exchange — καλύπτει και λογαριασμούς που παίρνουν Fleet αργότερα από τον admin.
    Το πρώτο μέλος-διαχειριστής κληρονομεί το PIN ιδιοκτήτη του λογαριασμού.
    """
    if not owns_delivery_team(u):
        raise HTTPException(403, "Ο λογαριασμός δεν διαθέτει δική του ομάδα διανομής")
    kind = team_kind_for_user(u)
    team = await db.fleet_teams.find_one({"owner_user_id": u["id"]}, {"_id": 0})
    if team:
        # Self-healing: παλιά ομάδα χωρίς/με λάθος kind παίρνει την ταυτότητα του κατόχου
        if team.get("kind") != kind:
            await db.fleet_teams.update_one({"id": team["id"]}, {"$set": {"kind": kind}})
            team["kind"] = kind
        return team
    email = u["email"]
    if await db.fleet_teams.find_one({"email": email}):
        # Legacy standalone εταιρεία με το ίδιο email — δεν την υιοθετούμε σιωπηλά
        raise HTTPException(
            409, "Υπάρχει ήδη εταιρεία FleetDeck με αυτό το email — επικοινωνήστε με την υποστήριξη"
        )
    now = datetime.now(timezone.utc).isoformat()
    invite = new_invite_code()
    while await db.fleet_teams.find_one({"invite_code": invite}):
        invite = new_invite_code()
    team = {
        "id": str(uuid.uuid4()),
        "name": u.get("restaurant_name") or "Ομάδα διανομής",
        "city": u.get("store_city") or u.get("city") or "",
        "email": email,
        "owner_user_id": u["id"],
        "kind": kind,
        "invite_code": invite,
        "created_at": now,
    }
    await db.fleet_teams.insert_one(team)
    team.pop("_id", None)
    await db.fleet_members.insert_one({
        "id": str(uuid.uuid4())[:8],
        "team_id": team["id"],
        "name": (admin_name or "").strip() or "Διαχειριστής",
        "role": "fleet_admin",
        "pin_hash": u.get("owner_pin_hash") or hash_password("0000"),
        "created_at": now,
    })
    return team


class FleetSignupIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    city: str = Field(default="", max_length=60)
    contact_name: str = Field(default="", max_length=80)
    phone: str = Field(default="", max_length=20)
    email: EmailStr
    password: str = Field(min_length=4)
    plan: Literal["fleet15", "fleet30"] = "fleet15"
    admin_pin: str = Field(min_length=4, max_length=4)


@router.post("/fleet/signup")
async def fleet_signup(body: FleetSignupIn, request: Request):
    """Εγγραφή εταιρείας διανομής στο ΕΝΙΑΙΟ auth (users, account_type=fleet_company).

    Δημιουργεί λογαριασμό users + fleet_team + μέλος-διαχειριστή. Τιμολόγηση χειροκίνητη
    (όπως η συνδρομή μαγαζιών) — κανένα payment εδώ.
    """
    rate_limit(request, "fleet_signup", limit=5, window_seconds=3600)
    email = body.email.lower()
    if not valid_pin(body.admin_pin):
        raise HTTPException(400, "Το PIN διαχειριστή πρέπει να είναι 4 ψηφία")
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Το email χρησιμοποιείται ήδη")
    if await db.fleet_teams.find_one({"email": email}):
        raise HTTPException(400, "Το email χρησιμοποιείται ήδη")
    now = datetime.now(timezone.utc).isoformat()
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_password(body.password),
        "account_type": "fleet_company",
        "plan": body.plan,
        "restaurant_name": body.name.strip(),  # όνομα εταιρείας — κοινό πεδίο εμφάνισης
        "full_name": body.contact_name.strip(),
        "phone": body.phone.strip(),
        "city": body.city.strip(),
        "store_city": body.city.strip(),
        "website": "",
        "tables_enabled": False,
        "customization": {},
        "owner_pin_hash": hash_password(body.admin_pin),
        "employee_pin_hash": hash_password("0000"),
        "owner_pin_set": True,
        "employee_pin_set": False,
        "created_at": now,
    }
    await db.users.insert_one(doc)
    team = await ensure_fleet_team_for_user(doc, admin_name=body.contact_name)
    return {
        "token": create_token(uid, email),
        "fleet_token": create_fleet_token(team["id"]),
        "team": public_team(team),
        "user": public_user(doc),
    }


@router.post("/fleet/exchange")
async def fleet_exchange(user: dict = Depends(get_current_user)):
    """Unified JWT (users) → team-level fleet token, χωρίς δεύτερο login.

    Επιτρέπεται μόνο σε λογαριασμούς που περιλαμβάνουν ΔΙΚΗ ΤΟΥΣ ομάδα διανομής
    (fleet_company ή store plan orderdeck_fleet). Τα καταστήματα με πλάνο «fleet»
    ΔΕΝ έχουν δική τους ομάδα — χρησιμοποιούν το FleetDeck καταστήματος
    (/store/fleet, routers/store_fleet.py) με συνεργαζόμενες εταιρείες.
    """
    if user.get("account_type") != "fleet_company" and user.get("plan") != "orderdeck_fleet":
        raise HTTPException(403, "Ο λογαριασμός σας δεν περιλαμβάνει το FleetDeck")
    team = await ensure_fleet_team_for_user(user)
    return {"token": create_fleet_token(team["id"]), "team": public_team(team)}


# ============ TEAM AUTH ROUTES ============
@router.post("/fleet/register")
async def fleet_register(body: FleetRegisterIn, request: Request):
    rate_limit(request, "fleet_register", limit=5, window_seconds=3600)
    email = body.email.lower()
    if await db.fleet_teams.find_one({"email": email}):
        raise HTTPException(400, "Το email χρησιμοποιείται ήδη")
    if not valid_pin(body.admin_pin):
        raise HTTPException(400, "Το PIN πρέπει να είναι 4 ψηφία")
    now = datetime.now(timezone.utc).isoformat()
    tid = str(uuid.uuid4())
    # Μοναδικό invite code (unique index) — retry σε απίθανη σύγκρουση
    invite = new_invite_code()
    while await db.fleet_teams.find_one({"invite_code": invite}):
        invite = new_invite_code()
    team = {
        "id": tid,
        "name": body.name.strip(),
        "city": body.city.strip(),
        "email": email,
        "password_hash": hash_password(body.password),
        # Αυτόνομη (legacy) εγγραφή εταιρείας — χωρίς λογαριασμό users από πίσω
        "kind": "company",
        "invite_code": invite,
        "created_at": now,
    }
    await db.fleet_teams.insert_one(team)
    await db.fleet_members.insert_one({
        "id": str(uuid.uuid4())[:8],
        "team_id": tid,
        "name": body.admin_name.strip() or "Διαχειριστής",
        "role": "fleet_admin",
        "pin_hash": hash_password(body.admin_pin),
        "created_at": now,
    })
    return {"token": create_fleet_token(tid), "team": public_team(team)}


@router.post("/fleet/login")
async def fleet_login(body: FleetLoginIn, request: Request):
    rate_limit(request, "fleet_login", limit=10, window_seconds=60)
    team = await db.fleet_teams.find_one({"email": body.email.lower()})
    # Unified ομάδες (owner_user_id) δεν έχουν δικό τους password — μπαίνουν από το κύριο login
    if not team or not team.get("password_hash") or not verify_password(body.password, team["password_hash"]):
        raise HTTPException(401, "Λάθος email ή κωδικός")
    if team.get("disabled"):
        raise HTTPException(403, "Ο λογαριασμός έχει απενεργοποιηθεί")
    return {"token": create_fleet_token(team["id"]), "team": public_team(team)}


@router.get("/fleet/me")
async def fleet_me(team: dict = Depends(get_fleet_team)):
    return public_team(team, include_invite=team.get("role") == "fleet_admin")


class FleetCompanyIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    city: str = Field(default="", max_length=60)
    address: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=60)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)


@router.put("/fleet/settings/company")
async def fleet_update_company(body: FleetCompanyIn, team: dict = Depends(require_fleet_admin)):
    """Στοιχεία επιχείρησης εταιρείας — όνομα, πόλη, διεύθυνση + pin, τηλέφωνα.

    Η πόλη/pin κεντράρουν χάρτες & προτάσεις διευθύνσεων και το city ταιριάζει
    με το store_city των καταστημάτων στην αναζήτηση συνεργασιών."""
    fields = {
        "name": body.name.strip(),
        "city": body.city.strip(),
        "address": body.address.strip(),
        "phone": body.phone.strip(),
        "lat": body.lat,
        "lng": body.lng,
    }
    await db.fleet_teams.update_one({"id": team["id"]}, {"$set": fields})
    # Τα snapshots όνομα/πόλη στις συνεργασίες ακολουθούν (τα βλέπουν τα μαγαζιά)
    await db.fleet_partnerships.update_many(
        {"team_id": team["id"]},
        {"$set": {"team_name": fields["name"], "team_city": fields["city"]}},
    )
    # Unified λογαριασμός: καθρέφτισμα στα κοινά πεδία εμφάνισης του users
    if team.get("owner_user_id"):
        await db.users.update_one(
            {"id": team["owner_user_id"]},
            {"$set": {
                "restaurant_name": fields["name"],
                "city": fields["city"],
                "store_city": fields["city"],
                "phone": fields["phone"],
            }},
        )
    return public_team({**team, **fields}, include_invite=True)


# ============ MEMBERS ============
@router.get("/fleet/members")
async def fleet_list_members(team: dict = Depends(get_fleet_team)):
    docs = await db.fleet_members.find(
        {"team_id": team["id"]}, {"_id": 0, "team_id": 0, "pin_hash": 0}
    ).sort("created_at", 1).to_list(200)
    return docs


@router.post("/fleet/members")
async def fleet_create_member(body: MemberIn, team: dict = Depends(require_fleet_admin)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4())[:8],
        "team_id": team["id"],
        "name": body.name.strip(),
        "role": body.role,
        "created_at": now,
    }
    if body.role == "fleet_admin":
        if not valid_pin(body.pin):
            raise HTTPException(400, "Απαιτείται 4-ψήφιο PIN")
        doc["pin_hash"] = hash_password(body.pin)
        await db.fleet_members.insert_one(doc)
        return public_member(doc)

    # Διανομέας: η εταιρεία δημιουργεί λογαριασμό + σύνδεση (membership) σε ένα βήμα.
    if not body.phone_or_email:
        raise HTTPException(400, "Απαιτείται τηλέφωνο ή email διανομέα")
    field, value = normalize_identifier(body.phone_or_email)
    account = await db.fleet_accounts.find_one({field: value})
    temp_password = None
    if account:
        # Υπάρχων λογαριασμός (π.χ. από άλλη εταιρεία) → μόνο νέα σύνδεση, όχι διπλότυπο
        if await db.fleet_members.find_one(
            {"team_id": team["id"], "account_id": account["id"]}
        ):
            raise HTTPException(400, "Ο διανομέας είναι ήδη μέλος της εταιρίας σας")
    else:
        temp_password = new_temp_password()
        account = {
            "id": str(uuid.uuid4()),
            "account_type": "driver",
            field: value,  # μόνο το πεδίο που δόθηκε — τα sparse unique indexes δεν δέχονται null
            "name": doc["name"],
            "password_hash": hash_password(temp_password),
            "must_change_password": True,
            "created_at": now,
        }
        await db.fleet_accounts.insert_one(account)
    doc["account_id"] = account["id"]
    doc["identifier"] = value
    await db.fleet_members.insert_one(doc)
    await add_event(team["id"], f"Ο/Η {doc['name']} προστέθηκε στην ομάδα")
    return {
        **public_member(doc),
        "existing_account": temp_password is None,
        "temp_password": temp_password,
    }


@router.post("/fleet/members/{mid}/reset-password")
async def fleet_reset_member_password(mid: str, team: dict = Depends(require_fleet_admin)):
    """Νέος προσωρινός κωδικός διανομέα — υποχρεωτική αλλαγή στην επόμενη είσοδο."""
    m = await db.fleet_members.find_one({"id": mid, "team_id": team["id"]})
    if not m:
        raise HTTPException(404, "Το μέλος δεν βρέθηκε")
    if not m.get("account_id"):
        raise HTTPException(400, "Το μέλος δεν έχει προσωπικό λογαριασμό διανομέα")
    temp = new_temp_password()
    await db.fleet_accounts.update_one(
        {"id": m["account_id"]},
        {"$set": {"password_hash": hash_password(temp), "must_change_password": True}},
    )
    return {"temp_password": temp, "identifier": m.get("identifier")}


@router.put("/fleet/members/{mid}")
async def fleet_update_member(mid: str, body: MemberIn, team: dict = Depends(require_fleet_admin)):
    target = await db.fleet_members.find_one({"id": mid, "team_id": team["id"]})
    if not target:
        raise HTTPException(404, "Το μέλος δεν βρέθηκε")
    if target["role"] == "fleet_admin" and body.role != "fleet_admin":
        admins = await db.fleet_members.count_documents(
            {"team_id": team["id"], "role": "fleet_admin"}
        )
        if admins <= 1:
            raise HTTPException(400, "Πρέπει να υπάρχει τουλάχιστον ένα προφίλ διαχείρισης")
    update = {"name": body.name.strip(), "role": body.role}
    if body.pin:
        if not valid_pin(body.pin):
            raise HTTPException(400, "Το PIN πρέπει να είναι 4 ψηφία")
        update["pin_hash"] = hash_password(body.pin)
    await db.fleet_members.update_one({"id": mid, "team_id": team["id"]}, {"$set": update})
    return {"id": mid, "name": update["name"], "role": update["role"]}


@router.delete("/fleet/members/{mid}")
async def fleet_delete_member(mid: str, team: dict = Depends(require_fleet_admin)):
    target = await db.fleet_members.find_one({"id": mid, "team_id": team["id"]})
    if not target:
        raise HTTPException(404, "Το μέλος δεν βρέθηκε")
    if target["id"] == team.get("member_id"):
        raise HTTPException(400, "Δεν μπορείτε να διαγράψετε το ενεργό σας μέλος")
    if target["role"] == "fleet_admin":
        admins = await db.fleet_members.count_documents(
            {"team_id": team["id"], "role": "fleet_admin"}
        )
        if admins <= 1:
            raise HTTPException(400, "Δεν μπορεί να διαγραφεί το τελευταίο προφίλ διαχείρισης")
    await db.fleet_members.delete_one({"id": mid, "team_id": team["id"]})
    return {"ok": True}


async def select_member_with_pin(team_id: str, member_id: str, pin: str) -> dict:
    """Κοινό PIN check με lockout (5 λάθη → 5') — ίδιο pattern με τα προφίλ μαγαζιών."""
    m = await db.fleet_members.find_one({"id": member_id, "team_id": team_id})
    if not m:
        raise HTTPException(404, "Το μέλος δεν βρέθηκε")
    locked = pin_locked_for(m)
    if locked:
        raise HTTPException(429, pin_lock_message(locked))
    matched = verify_password(pin, m.get("pin_hash", ""))
    res = await register_pin_attempt(
        db.fleet_members, {"id": m["id"], "team_id": team_id}, m, matched
    )
    if not res["ok"]:
        if res.get("locked_for"):
            raise HTTPException(429, pin_lock_message(res["locked_for"]))
        raise HTTPException(401, f"Λάθος κωδικός — απομένουν {res['attempts_left']} προσπάθειες")
    return m


@router.post("/fleet/member/select")
async def fleet_member_select(body: MemberSelectIn, team: dict = Depends(get_fleet_team)):
    if not body.pin.isdigit():
        raise HTTPException(400, "Ο κωδικός πρέπει να είναι 4 ψηφία")
    m = await select_member_with_pin(team["id"], body.member_id, body.pin)
    return {
        "token": create_fleet_token(team["id"], m["id"], m["role"], m["name"]),
        "member_id": m["id"],
        "role": m["role"],
        "member_name": m["name"],
    }


@router.post("/fleet/member/exit")
async def fleet_member_exit(team: dict = Depends(get_fleet_team)):
    return {"token": create_fleet_token(team["id"])}


# ============ DRIVER ACCOUNT (προσωπικός λογαριασμός — είσοδος από το κινητό) ============
# Σημ.: το invite-code self-signup αφαιρέθηκε από τη ροή οδηγών — η παραγωγή
# invite codes (fleet_teams.invite_code) παραμένει για μελλοντικό self-service.
async def driver_memberships(account_id: str) -> list:
    """Ενεργές συνδέσεις του λογαριασμού με εταιρείες (χωρίς απενεργοποιημένες)."""
    ms = await db.fleet_members.find(
        {"account_id": account_id}, {"_id": 0, "id": 1, "team_id": 1, "name": 1}
    ).sort("created_at", 1).to_list(50)
    out = []
    for m in ms:
        t = await db.fleet_teams.find_one(
            {"id": m["team_id"]}, {"_id": 0, "name": 1, "city": 1, "disabled": 1}
        )
        if t and not t.get("disabled"):
            out.append({
                "member_id": m["id"],
                "team_name": t["name"],
                "city": t.get("city") or "",
            })
    return out


@router.post("/fleet/driver/login")
async def fleet_driver_login(body: DriverLoginIn, request: Request):
    """Είσοδος διανομέα με τηλέφωνο/email + κωδικό (προσωρινό ή δικό του)."""
    rate_limit(request, "fleet_driver_login", limit=10, window_seconds=60)
    field, value = normalize_identifier(body.identifier)
    account = await db.fleet_accounts.find_one({field: value})
    if not account or not verify_password(body.password, account["password_hash"]):
        raise HTTPException(401, "Λάθος στοιχεία σύνδεσης")
    return {
        "token": create_driver_token(account["id"]),
        "name": account["name"],
        "must_change_password": bool(account.get("must_change_password")),
        "memberships": await driver_memberships(account["id"]),
    }


@router.post("/fleet/driver/change-password")
async def fleet_driver_change_password(
    body: DriverPasswordIn, account: dict = Depends(get_fleet_account)
):
    await db.fleet_accounts.update_one(
        {"id": account["id"]},
        {"$set": {"password_hash": hash_password(body.password), "must_change_password": False}},
    )
    return {"ok": True}


@router.post("/fleet/driver/select")
async def fleet_driver_select(body: DriverSelectIn, account: dict = Depends(get_fleet_account)):
    """Επιλογή εταιρείας → πλήρες fleet token (team + member), ίδιο με το PIN select."""
    if account.get("must_change_password"):
        raise HTTPException(403, "Απαιτείται αλλαγή κωδικού πρώτα")
    m = await db.fleet_members.find_one({"id": body.member_id, "account_id": account["id"]})
    if not m:
        raise HTTPException(404, "Η σύνδεση με την εταιρεία δεν βρέθηκε")
    team = await db.fleet_teams.find_one({"id": m["team_id"]}, {"_id": 0})
    if not team or team.get("disabled"):
        raise HTTPException(403, "Η εταιρεία δεν είναι διαθέσιμη")
    return {
        "token": create_fleet_token(m["team_id"], m["id"], m["role"], m["name"]),
        "team_name": team["name"],
        "member_name": m["name"],
    }


# ============ ADMIN ΩΣ ΟΔΗΓΟΣ ============
class AdminDisplayNameIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)


@router.post("/fleet/admin/display-name")
async def fleet_admin_display_name(
    body: AdminDisplayNameIn, team: dict = Depends(require_fleet_admin)
):
    """Προσωπικό όνομα του διαχειριστή («Το όνομά μου») — ΞΕΧΩΡΙΣΤΟ από το όνομα
    εταιρείας. Είναι η ταυτότητα του driver προφίλ του (header, πίνακας, ροή,
    στατιστικά). Συγχρονίζει και το ήδη δημιουργημένο driver προφίλ του."""
    name = body.name.strip()
    await db.fleet_members.update_one(
        {"id": team["member_id"], "team_id": team["id"]},
        {"$set": {"display_name": name}},
    )
    await db.fleet_members.update_one(
        {"team_id": team["id"], "admin_member_id": team["member_id"]},
        {"$set": {"name": name}},
    )
    return {"ok": True, "admin_display_name": name}


@router.post("/fleet/admin/driver-mode")
async def fleet_admin_driver_mode(team: dict = Depends(require_fleet_admin)):
    """«Λειτουργία διανομέα»: βρίσκει ή δημιουργεί το προσωπικό driver membership
    του διαχειριστή (σημαδεμένο με admin_member_id) και επιστρέφει driver token.
    Το session διαχειριστή μένει ανέπαφο — ξεχωριστό κλειδί ανά επιφάνεια στο frontend."""
    # Το προφίλ οδηγού φέρει το ΟΝΟΜΑ του ανθρώπου (όπως κάθε διανομέας) — ποτέ
    # το όνομα εταιρείας ή τη γενική ετικέτα. Προτεραιότητα: display_name («Το
    # όνομά μου») → μη γενικό όνομα μέλους → ονοματεπώνυμο επαφής του λογαριασμού.
    name = (team.get("admin_display_name") or "").strip()
    if not name:
        name = (team.get("member_name") or "").strip()
        if name in GENERIC_ADMIN_LABELS:
            name = ""
    if not name and team.get("owner_user_id"):
        u = await db.users.find_one(
            {"id": team["owner_user_id"]}, {"_id": 0, "full_name": 1}
        )
        name = ((u or {}).get("full_name") or "").strip()
    if not name:
        # Χωρίς προσωπικό όνομα πουθενά → όνομα εταιρείας, ποτέ ετικέτα ρόλου
        name = (team.get("name") or "").strip() or "Διαχείριση"
    m = await db.fleet_members.find_one(
        {"team_id": team["id"], "admin_member_id": team["member_id"]}, {"_id": 0}
    )
    if not m:
        m = {
            "id": str(uuid.uuid4())[:8],
            "team_id": team["id"],
            "name": name,
            "role": "driver",
            "admin_member_id": team["member_id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.fleet_members.insert_one(m)
        m.pop("_id", None)
        await add_event(team["id"], f"Ο/Η {m['name']} μπήκε σε λειτουργία διανομέα")
    elif m.get("name") != name:
        # Ο διαχειριστής μετονομάστηκε — το προσωπικό driver προφίλ ακολουθεί
        await db.fleet_members.update_one(
            {"id": m["id"], "team_id": team["id"]}, {"$set": {"name": name}}
        )
        m["name"] = name
    return {
        "token": create_fleet_token(team["id"], m["id"], "driver", m["name"]),
        "member_id": m["id"],
        "member_name": m["name"],
    }


# ============ ORDERS ============
@router.post("/fleet/orders")
async def fleet_create_order(body: FleetOrderIn, team: dict = Depends(require_fleet_admin)):
    now = datetime.now(timezone.utc).isoformat()
    number = await next_order_number(team["id"])
    doc = {
        "id": str(uuid.uuid4()),
        "team_id": team["id"],
        "number": number,
        "pickup_name": body.pickup_name.strip(),
        "pickup_address": body.pickup_address.strip(),
        "pickup_lat": body.pickup_lat,
        "pickup_lng": body.pickup_lng,
        "address": body.address.strip(),
        "notes": body.notes.strip(),
        "urgent": bool(body.urgent),
        "problem": None,
        "status": "waiting",
        "driver_id": None,
        "driver_name": None,
        "created_by": admin_identity(team),
        "lat": body.lat,
        "lng": body.lng,
        "created_at": now,
        "claimed_at": None,
        "delivered_at": None,
    }
    await db.fleet_orders.insert_one(doc)
    prefix = "⚡ Επείγουσα παραγγελία" if doc["urgent"] else "Νέα παραγγελία"
    await add_event(team["id"], f"{prefix} #{number} · {doc['pickup_name']}")
    await push_on_shift_drivers(team["id"], f"{prefix} #{number}", order_push_body(doc))
    return public_order(doc)


@router.get("/fleet/board")
async def fleet_board(date: Optional[str] = None, team: dict = Depends(require_fleet_admin)):
    """Ο πίνακας του διαχειριστή: παραγγελίες ημέρας + feed + οδηγοί + εκκρεμή
    αιτήματα συνεργασίας καταστημάτων (ένα poll)."""
    await publish_due_scheduled({"team_id": team["id"]})
    day = date or athens_today()
    start, end = local_day_range(day)
    # Οι «scheduled» (προγραμματισμένες καταστημάτων) δεν εμφανίζονται πριν δημοσιευτούν
    orders = await db.fleet_orders.find(
        {
            "team_id": team["id"],
            "status": {"$ne": "scheduled"},
            "created_at": {"$gte": start, "$lt": end},
        },
        {"_id": 0, "team_id": 0},
    ).sort("created_at", -1).to_list(500)
    partnership_requests = await db.fleet_partnerships.find(
        {"team_id": team["id"], "status": "pending"}, {"_id": 0}
    ).sort("requested_at", 1).to_list(50)
    events = await db.fleet_events.find(
        {"team_id": team["id"], "created_at": {"$gte": start, "$lt": end}},
        {"_id": 0, "team_id": 0},
    ).sort("created_at", -1).to_list(40)
    drivers = await db.fleet_members.find(
        {"team_id": team["id"], "role": "driver"},
        {"_id": 0, "id": 1, "name": 1, "on_shift": 1},
    ).sort("created_at", 1).to_list(200)
    for d in drivers:
        d["on_shift"] = bool(d.get("on_shift"))
    return {
        "date": day,
        "orders": orders,
        "events": events,
        "drivers": drivers,
        "partnership_requests": partnership_requests,
    }


# ============ ΣΥΝΕΡΓΑΣΙΕΣ ΚΑΤΑΣΤΗΜΑΤΩΝ ============
class PartnershipRespondIn(BaseModel):
    accept: bool


@router.get("/fleet/partnerships")
async def fleet_partnerships(team: dict = Depends(require_fleet_admin)):
    """Αιτήματα & ενεργές συνεργασίες καταστημάτων της εταιρείας."""
    docs = await db.fleet_partnerships.find(
        {"team_id": team["id"], "status": {"$in": ["pending", "active"]}}, {"_id": 0}
    ).sort("requested_at", 1).to_list(200)
    return {
        "pending": [p for p in docs if p["status"] == "pending"],
        "active": [p for p in docs if p["status"] == "active"],
    }


@router.get("/fleet/partner-stores")
async def fleet_partner_stores(team: dict = Depends(require_fleet_admin)):
    """Τα ΣΥΝΕΡΓΑΖΟΜΕΝΑ μαγαζιά της εταιρείας με τα στοιχεία επικοινωνίας και το
    pin των ρυθμίσεών τους + πόσες παραγγελίες έστειλαν σήμερα.

    Τα τροφοδοτεί η σελίδα «Μαγαζιά» (χάρτης + λίστα) και το dropdown «Παραλαβή
    από» της φόρμας του διαχειριστή. Το `users` είναι shared collection — εδώ
    διαβάζονται ΜΟΝΟ τα δημόσια στοιχεία καταστήματος, κανένα δεδομένο POS."""
    parts = await db.fleet_partnerships.find(
        {"team_id": team["id"], "status": "active"}, {"_id": 0}
    ).sort("requested_at", 1).to_list(200)
    if not parts:
        return {"stores": []}
    uids = [p["store_user_id"] for p in parts]
    users = {
        u["id"]: u
        async for u in db.users.find(
            {"id": {"$in": uids}},
            {"_id": 0, "id": 1, "restaurant_name": 1, "store_address": 1,
             "store_city": 1, "store_phone": 1, "store_lat": 1, "store_lng": 1},
        )
    }
    start, end = local_day_range(athens_today())
    counts = {}
    async for row in db.fleet_orders.aggregate([
        {"$match": {
            "team_id": team["id"],
            "store_user_id": {"$in": uids},
            "created_at": {"$gte": start, "$lt": end},
            "status": {"$ne": "cancelled"},
        }},
        {"$group": {"_id": "$store_user_id", "n": {"$sum": 1}}},
    ]):
        counts[row["_id"]] = row["n"]
    stores = []
    for p in parts:
        u = users.get(p["store_user_id"]) or {}
        stores.append({
            "partnership_id": p["id"],
            "store_user_id": p["store_user_id"],
            # Το όνομα των ρυθμίσεων του μαγαζιού είναι το τρέχον· η συνεργασία
            # κρατά snapshot από τη στιγμή του αιτήματος (fallback)
            "name": (u.get("restaurant_name") or p.get("store_name") or "").strip(),
            "address": (u.get("store_address") or "").strip(),
            "city": (u.get("store_city") or p.get("store_city") or "").strip(),
            "phone": (u.get("store_phone") or "").strip(),
            "lat": u.get("store_lat"),
            "lng": u.get("store_lng"),
            "orders_today": counts.get(p["store_user_id"], 0),
        })
    stores.sort(key=lambda s: s["name"].lower())
    return {"stores": stores}


@router.post("/fleet/partnerships/{pid}/respond")
async def fleet_respond_partnership(
    pid: str, body: PartnershipRespondIn, team: dict = Depends(require_fleet_admin)
):
    """Αποδοχή/απόρριψη αιτήματος συνεργασίας καταστήματος. Με αποδοχή η
    συνεργασία είναι ενεργή — το κατάστημα μπορεί να ανεβάζει παραγγελίες."""
    p = await db.fleet_partnerships.find_one(
        {"id": pid, "team_id": team["id"], "status": "pending"}, {"_id": 0}
    )
    if not p:
        raise HTTPException(404, "Το αίτημα δεν βρέθηκε")
    status = "active" if body.accept else "declined"
    await db.fleet_partnerships.update_one(
        {"id": pid, "team_id": team["id"]},
        {"$set": {"status": status, "responded_at": datetime.now(timezone.utc).isoformat()}},
    )
    if body.accept:
        await add_event(team["id"], f"🤝 Ενεργή συνεργασία με «{p['store_name']}»")
    else:
        await add_event(team["id"], f"Το αίτημα συνεργασίας του «{p['store_name']}» απορρίφθηκε")
    return {"ok": True, "status": status}


@router.get("/fleet/driver/board")
async def fleet_driver_board(team: dict = Depends(get_fleet_member)):
    """Η οθόνη του οδηγού: ελεύθερες + δικές του σημερινές παραγγελίες (ένα poll)."""
    await publish_due_scheduled({"team_id": team["id"]})
    start, end = local_day_range(athens_today())
    day_q = {"team_id": team["id"], "created_at": {"$gte": start, "$lt": end}}
    # Οι επείγουσες (⚡) πρώτες, μετά οι παλαιότερες
    available = await db.fleet_orders.find(
        {**day_q, "status": "waiting"}, {"_id": 0, "team_id": 0}
    ).sort([("urgent", -1), ("created_at", 1)]).to_list(200)
    mine = await db.fleet_orders.find(
        {**day_q, "driver_id": team["member_id"], "status": {"$in": ["pickup", "enroute"]}},
        {"_id": 0, "team_id": 0},
    ).sort("created_at", 1).to_list(200)
    delivered = await db.fleet_orders.find(
        {**day_q, "driver_id": team["member_id"], "status": "delivered"},
        {"_id": 0, "team_id": 0},
    ).sort("created_at", -1).to_list(200)
    me = await db.fleet_members.find_one(
        {"id": team["member_id"], "team_id": team["id"]}, {"_id": 0, "on_shift": 1}
    )
    return {
        "available": available,
        "mine": mine,
        "delivered": delivered,
        "delivered_today": len(delivered),
        "on_shift": bool(me and me.get("on_shift")),
    }


@router.post("/fleet/orders/{oid}/claim")
async def fleet_claim_order(oid: str, team: dict = Depends(get_fleet_member)):
    """ΑΤΟΜΙΚΟ claim: μόνο ένας οδηγός παίρνει την παραγγελία (find_one_and_update
    πάνω σε status=waiting) — ο δεύτερος βλέπει 409 «πάρθηκε»."""
    now = datetime.now(timezone.utc).isoformat()
    doc = await db.fleet_orders.find_one_and_update(
        {"id": oid, "team_id": team["id"], "status": "waiting", "driver_id": None},
        {"$set": {
            "status": "pickup",
            "driver_id": team["member_id"],
            "driver_name": team["member_name"],
            "claimed_at": now,
        }},
        return_document=True,
    )
    if not doc:
        exists = await db.fleet_orders.find_one({"id": oid, "team_id": team["id"]}, {"id": 1})
        if not exists:
            raise HTTPException(404, "Η παραγγελία δεν βρέθηκε")
        raise HTTPException(409, "Η παραγγελία πάρθηκε από άλλον οδηγό")
    await mirror_status_to_pos(doc, "pickup", team["member_name"])
    await add_event(team["id"], f"Ο/Η {team['member_name']} πήρε την #{doc['number']}")
    return public_order(doc)


@router.post("/fleet/orders/{oid}/status")
async def fleet_order_status(oid: str, body: StatusIn, team: dict = Depends(get_fleet_member)):
    o = await db.fleet_orders.find_one({"id": oid, "team_id": team["id"]})
    if not o:
        raise HTTPException(404, "Η παραγγελία δεν βρέθηκε")
    if o["status"] == "cancelled":
        raise HTTPException(400, "Η παραγγελία έχει ακυρωθεί")
    if team["role"] != "fleet_admin":
        # Οδηγός: μόνο τις δικές του και μόνο το επόμενο βήμα της ροής
        if o.get("driver_id") != team["member_id"]:
            raise HTTPException(403, "Δεν είναι δική σας παραγγελία")
        if DRIVER_NEXT.get(o["status"]) != body.status:
            raise HTTPException(400, "Μη έγκυρη αλλαγή κατάστασης")
    update = {"status": body.status}
    if body.status == "delivered":
        update["delivered_at"] = datetime.now(timezone.utc).isoformat()
        update["problem"] = None  # η παράδοση κλείνει και τυχόν ανοιχτό πρόβλημα
    if body.status == "waiting":
        # Επιστροφή σε αναμονή (admin) → αποδέσμευση οδηγού + καθαρό πρόβλημα
        update.update({"driver_id": None, "driver_name": None, "claimed_at": None, "problem": None})
    await db.fleet_orders.update_one({"id": oid, "team_id": team["id"]}, {"$set": update})
    await mirror_status_to_pos(
        o, body.status, None if body.status == "waiting" else o.get("driver_name")
    )
    labels = {"waiting": "σε αναμονή", "pickup": "σε παραλαβή",
              "enroute": "σε διαδρομή", "delivered": "παραδόθηκε"}
    who = o.get("driver_name") or (
        admin_identity(team) if team["role"] == "fleet_admin" else team["member_name"]
    )
    await add_event(team["id"], f"Η #{o['number']} {labels[body.status]} ({who})")
    return {"ok": True, "status": body.status}


@router.post("/fleet/orders/{oid}/assign")
async def fleet_assign_order(oid: str, body: AssignIn, team: dict = Depends(require_fleet_admin)):
    o = await db.fleet_orders.find_one({"id": oid, "team_id": team["id"]})
    if not o:
        raise HTTPException(404, "Η παραγγελία δεν βρέθηκε")
    if o["status"] in ("delivered", "cancelled"):
        raise HTTPException(400, "Η παραγγελία έχει ολοκληρωθεί")
    if body.member_id is None:
        await db.fleet_orders.update_one(
            {"id": oid, "team_id": team["id"]},
            {"$set": {"status": "waiting", "driver_id": None, "driver_name": None,
                      "claimed_at": None, "problem": None}},
        )
        await mirror_status_to_pos(o, "waiting", None)
        await add_event(team["id"], f"Η #{o['number']} επέστρεψε σε αναμονή")
        return {"ok": True}
    m = await db.fleet_members.find_one({"id": body.member_id, "team_id": team["id"]})
    if not m:
        raise HTTPException(404, "Ο οδηγός δεν βρέθηκε")
    await db.fleet_orders.update_one(
        {"id": oid, "team_id": team["id"]},
        {"$set": {
            "driver_id": m["id"],
            "driver_name": m["name"],
            "claimed_at": datetime.now(timezone.utc).isoformat(),
            "problem": None,  # νέος οδηγός → καθαρή αρχή
            # Αν ήταν σε αναμονή, η ανάθεση την προχωράει σε παραλαβή
            **({"status": "pickup"} if o["status"] == "waiting" else {}),
        }},
    )
    await mirror_status_to_pos(o, "pickup" if o["status"] == "waiting" else o["status"], m["name"])
    await add_event(team["id"], f"Η #{o['number']} ανατέθηκε στον/στην {m['name']}")
    await notify_push(
        team["id"], "driver",
        f"Σας ανατέθηκε η #{o['number']}",
        order_push_body(o),
        DRIVER_URL,
        member_ids=[m["id"]],
    )
    return {"ok": True}


@router.post("/fleet/orders/{oid}/cancel")
async def fleet_cancel_order(oid: str, team: dict = Depends(require_fleet_admin)):
    o = await db.fleet_orders.find_one({"id": oid, "team_id": team["id"]})
    if not o:
        raise HTTPException(404, "Η παραγγελία δεν βρέθηκε")
    if o["status"] in ("delivered", "cancelled"):
        raise HTTPException(400, "Η παραγγελία έχει ολοκληρωθεί")
    await db.fleet_orders.update_one(
        {"id": oid, "team_id": team["id"]}, {"$set": {"status": "cancelled"}}
    )
    await mirror_status_to_pos(o, "cancelled", o.get("driver_name"))
    await add_event(team["id"], f"Η #{o['number']} ακυρώθηκε")
    # Μετά το claim: ενημέρωση του οδηγού της + των υπόλοιπων συσκευών διαχείρισης
    if o.get("driver_id"):
        await notify_push(
            team["id"], "driver",
            f"Η #{o['number']} ακυρώθηκε",
            order_push_body(o),
            DRIVER_URL,
            member_ids=[o["driver_id"]],
        )
        await notify_push(
            team["id"], "dispatcher",
            f"Η #{o['number']} ακυρώθηκε",
            order_push_body(o),
            DISPATCH_URL,
            exclude_member_id=team["member_id"],
        )
    return {"ok": True}


@router.put("/fleet/orders/{oid}")
async def fleet_edit_order(
    oid: str, body: FleetOrderEditIn, team: dict = Depends(require_fleet_admin)
):
    """Επεξεργασία παραγγελίας από τον διαχειριστή. Πριν το claim ελεύθερη· μετά,
    η αποθήκευση σημαδεύει updated_at/updated_fields ώστε ο οδηγός να δει
    ειδοποίηση («Η #Χ ενημερώθηκε») με τα αλλαγμένα πεδία στο επόμενο poll."""
    o = await db.fleet_orders.find_one({"id": oid, "team_id": team["id"]})
    if not o:
        raise HTTPException(404, "Η παραγγελία δεν βρέθηκε")
    if o["status"] in ("delivered", "cancelled"):
        raise HTTPException(400, "Η παραγγελία έχει ολοκληρωθεί")
    changed = [
        f for f in EDIT_FIELD_LABELS
        if getattr(body, f).strip() != (o.get(f) or "")
    ]
    # Το σημείο παραλαβής (κείμενο + pin) γράφεται όποτε διαφέρει — δεν παράγει
    # δική του ετικέτα, ακολουθεί το «Παραλαβή από»
    pickup_point = {
        "pickup_address": body.pickup_address.strip(),
        "pickup_lat": body.pickup_lat,
        "pickup_lng": body.pickup_lng,
    }
    pickup_moved = any(pickup_point[f] != o.get(f) for f in PICKUP_POINT_FIELDS)
    if not changed:
        # Ίδιο κείμενο αλλά ήρθαν (νέες) συντεταγμένες — π.χ. re-save για να
        # αποκτήσει pin παλιά παραγγελία: αποθήκευση χωρίς ειδοποίηση οδηγού
        quiet = {}
        if body.lat is not None and (o.get("lat") != body.lat or o.get("lng") != body.lng):
            quiet.update({"lat": body.lat, "lng": body.lng})
        if pickup_moved:
            quiet.update(pickup_point)
        if quiet:
            await db.fleet_orders.update_one(
                {"id": oid, "team_id": team["id"]}, {"$set": quiet}
            )
        return {"ok": True, "changed": []}
    update = {f: getattr(body, f).strip() for f in changed}
    if pickup_moved:
        update.update(pickup_point)
    if "address" in changed:
        # Νέα διεύθυνση → νέες συντεταγμένες (ή None αν δεν βρέθηκε — εκτός χάρτη)
        update["lat"] = body.lat
        update["lng"] = body.lng
    if o.get("driver_id"):
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        update["updated_fields"] = changed
    await db.fleet_orders.update_one({"id": oid, "team_id": team["id"]}, {"$set": update})
    labels = ", ".join(EDIT_FIELD_LABELS[f] for f in changed)
    await add_event(team["id"], f"Η #{o['number']} ενημερώθηκε ({labels})")
    if o.get("driver_id"):
        await notify_push(
            team["id"], "driver",
            f"Η #{o['number']} ενημερώθηκε",
            f"Άλλαξε: {labels}",
            DRIVER_URL,
            member_ids=[o["driver_id"]],
        )
    return {"ok": True, "changed": changed}


@router.post("/fleet/orders/{oid}/urgent")
async def fleet_set_urgent(oid: str, body: UrgentIn, team: dict = Depends(require_fleet_admin)):
    """«⚡ Επείγον»: καρφιτσώνει την παραγγελία πρώτη στις «Ελεύθερες» των οδηγών."""
    o = await db.fleet_orders.find_one({"id": oid, "team_id": team["id"]})
    if not o:
        raise HTTPException(404, "Η παραγγελία δεν βρέθηκε")
    if o["status"] in ("delivered", "cancelled"):
        raise HTTPException(400, "Η παραγγελία έχει ολοκληρωθεί")
    await db.fleet_orders.update_one(
        {"id": oid, "team_id": team["id"]}, {"$set": {"urgent": bool(body.urgent)}}
    )
    if body.urgent:
        await add_event(team["id"], f"⚡ Η #{o['number']} σημάνθηκε ως επείγουσα")
        # Push μόνο όσο είναι ελεύθερη — αν έχει ήδη οδηγό δεν αφορά τους άλλους
        if o["status"] == "waiting":
            await push_on_shift_drivers(
                team["id"],
                f"⚡ Η #{o['number']} είναι πλέον επείγουσα",
                order_push_body(o),
            )
    else:
        await add_event(team["id"], f"Η #{o['number']} δεν είναι πια επείγουσα")
    return {"ok": True, "urgent": bool(body.urgent)}


# ============ ΠΡΟΒΛΗΜΑΤΑ ΠΑΡΑΔΟΣΗΣ ============
@router.post("/fleet/orders/{oid}/problem")
async def fleet_report_problem(oid: str, body: ProblemIn, team: dict = Depends(get_fleet_member)):
    """Ο οδηγός σημαίνει πρόβλημα σε claimed παραγγελία του (Δεν απαντάει /
    Λάθος διεύθυνση / Άλλο + κείμενο) → σημαία στον πίνακα + ροή. Η επίλυση
    γίνεται από τον διαχειριστή (επεξεργασία, αποδέσμευση ή ακύρωση)."""
    o = await db.fleet_orders.find_one({"id": oid, "team_id": team["id"]})
    if not o:
        raise HTTPException(404, "Η παραγγελία δεν βρέθηκε")
    if o["status"] not in ("pickup", "enroute"):
        raise HTTPException(400, "Η παραγγελία δεν είναι σε εξέλιξη")
    if team["role"] != "fleet_admin" and o.get("driver_id") != team["member_id"]:
        raise HTTPException(403, "Δεν είναι δική σας παραγγελία")
    who = admin_identity(team) if team["role"] == "fleet_admin" else team["member_name"]
    problem = {
        "reason": body.reason,
        "text": body.text.strip(),
        "by": who,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    await db.fleet_orders.update_one(
        {"id": oid, "team_id": team["id"]}, {"$set": {"problem": problem}}
    )
    label = PROBLEM_LABELS[body.reason]
    extra = f" — {problem['text']}" if problem["text"] else ""
    await add_event(
        team["id"], f"⚠️ Πρόβλημα στην #{o['number']}: {label}{extra} ({who})"
    )
    await notify_push(
        team["id"], "dispatcher",
        f"⚠️ Πρόβλημα στην #{o['number']}",
        f"{label}{extra} — {who}",
        DISPATCH_URL,
    )
    return {"ok": True}


@router.post("/fleet/orders/{oid}/problem/resolve")
async def fleet_resolve_problem(oid: str, team: dict = Depends(require_fleet_admin)):
    o = await db.fleet_orders.find_one({"id": oid, "team_id": team["id"]})
    if not o:
        raise HTTPException(404, "Η παραγγελία δεν βρέθηκε")
    if not o.get("problem"):
        return {"ok": True}
    await db.fleet_orders.update_one(
        {"id": oid, "team_id": team["id"]}, {"$set": {"problem": None}}
    )
    await add_event(team["id"], f"Το πρόβλημα της #{o['number']} επιλύθηκε")
    return {"ok": True}


# ============ ΒΑΡΔΙΕΣ ΟΔΗΓΩΝ ============
@router.post("/fleet/driver/shift")
async def fleet_driver_shift(body: ShiftIn, team: dict = Depends(get_fleet_member)):
    """«Ξεκινάω/Τέλος βάρδιας»: on_shift στο μέλος (πράσινη κουκκίδα στον πίνακα,
    ειδοποιήσεις νέων παραγγελιών μόνο σε βάρδια). Οι ολοκληρωμένες βάρδιες
    γράφονται στο fleet_shifts και τροφοδοτούν τα στατιστικά του οδηγού."""
    m = await db.fleet_members.find_one({"id": team["member_id"], "team_id": team["id"]})
    if not m:
        raise HTTPException(404, "Το μέλος δεν βρέθηκε")
    now = datetime.now(timezone.utc).isoformat()
    if body.on and not m.get("on_shift"):
        await db.fleet_members.update_one(
            {"id": m["id"], "team_id": team["id"]},
            {"$set": {"on_shift": True, "shift_started_at": now}},
        )
        await add_event(team["id"], f"🟢 Ο/Η {team['member_name']} ξεκίνησε βάρδια")
    elif not body.on and m.get("on_shift"):
        await db.fleet_members.update_one(
            {"id": m["id"], "team_id": team["id"]},
            {"$set": {"on_shift": False, "shift_started_at": None}},
        )
        if m.get("shift_started_at"):
            await db.fleet_shifts.insert_one({
                "id": str(uuid.uuid4()),
                "team_id": team["id"],
                "member_id": m["id"],
                "member_name": team["member_name"],
                "started_at": m["shift_started_at"],
                "ended_at": now,
            })
        await add_event(team["id"], f"Ο/Η {team['member_name']} τελείωσε τη βάρδια")
    return {"on_shift": bool(body.on)}


# ============ ΟΔΗΓΟΣ: ΣΤΑΤΙΣΤΙΚΑ & ΙΣΤΟΡΙΚΟ ============
@router.get("/fleet/driver/stats")
async def fleet_driver_stats(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    team: dict = Depends(get_fleet_member),
):
    """Στατιστικά του ίδιου του οδηγού: σύνολο παραδόσεων, σήμερα/εβδομάδα,
    κορυφαία καταστήματα παραλαβής (όλων των εποχών) + ανάλυση περιόδου
    (ανά ημέρα / ανά κατάστημα / ανά βάρδια) για την οθόνη «Στατιστικά»."""
    q = {"team_id": team["id"], "driver_id": team["member_id"], "status": "delivered"}
    total = await db.fleet_orders.count_documents(q)
    today = athens_today()
    t_start, t_end = local_day_range(today)
    d = date_cls.fromisoformat(today)
    week_start = (d - timedelta(days=d.weekday())).isoformat()
    w_start, _ = local_day_range(week_start)
    today_n = await db.fleet_orders.count_documents(
        {**q, "created_at": {"$gte": t_start, "$lt": t_end}}
    )
    week_n = await db.fleet_orders.count_documents(
        {**q, "created_at": {"$gte": w_start, "$lt": t_end}}
    )
    top = await db.fleet_orders.aggregate([
        {"$match": q},
        {"$group": {"_id": "$pickup_name", "orders": {"$sum": 1}}},
        {"$sort": {"orders": -1, "_id": 1}},
        {"$limit": 8},
    ]).to_list(8)

    # Ώρες βάρδιας (σήμερα/εβδομάδα): κλειστές βάρδιες + η τρέχουσα ανοιχτή
    def _hours(sessions, floor_iso):
        secs = 0
        for s in sessions:
            try:
                a = datetime.fromisoformat(max(s["started_at"], floor_iso))
                b = datetime.fromisoformat(s["ended_at"])
                secs += max(0, (b - a).total_seconds())
            except (KeyError, ValueError, TypeError):
                continue
        return round(secs / 3600, 1)

    shifts = await db.fleet_shifts.find(
        {"team_id": team["id"], "member_id": team["member_id"], "ended_at": {"$gte": w_start}},
        {"_id": 0, "started_at": 1, "ended_at": 1},
    ).to_list(200)
    me = await db.fleet_members.find_one(
        {"id": team["member_id"], "team_id": team["id"]},
        {"_id": 0, "on_shift": 1, "shift_started_at": 1},
    )
    if me and me.get("on_shift") and me.get("shift_started_at"):
        shifts.append({
            "started_at": me["shift_started_at"],
            "ended_at": datetime.now(timezone.utc).isoformat(),
        })
    # ---- Ανάλυση περιόδου (φίλτρο της οθόνης «Στατιστικά») ----
    # Default: τελευταίες 7 ημέρες, ίδια λογική με το PeriodFilter του OrderDeck.
    p_to = date_to or today
    p_from = date_from or (date_cls.fromisoformat(p_to) - timedelta(days=6)).isoformat()
    p_start, p_end = local_day_range(p_from, p_to)
    p_q = {**q, "created_at": {"$gte": p_start, "$lt": p_end}}
    facets = await db.fleet_orders.aggregate([
        {"$match": p_q},
        {"$facet": {
            "by_day": [
                {"$group": {"_id": athens_day_expr(), "orders": {"$sum": 1}}},
                {"$sort": {"_id": 1}},
                {"$limit": 400},
            ],
            "by_store": [
                {"$group": {"_id": "$pickup_name", "orders": {"$sum": 1}}},
                {"$sort": {"orders": -1, "_id": 1}},
                {"$limit": 10},
            ],
            "total": [{"$count": "n"}],
        }},
    ]).to_list(1)
    pf = facets[0] if facets else {}

    # Παραδόσεις ανά βάρδια: οι χρονοσφραγίδες παράδοσης της περιόδου μπαίνουν
    # στη βάρδια που τις περιέχει (κλειστές βάρδιες + η τρέχουσα ανοιχτή).
    stamps = sorted(
        o["delivered_at"]
        for o in await db.fleet_orders.find(p_q, {"_id": 0, "delivered_at": 1}).to_list(2000)
        if o.get("delivered_at")
    )
    p_shifts = await db.fleet_shifts.find(
        {
            "team_id": team["id"],
            "member_id": team["member_id"],
            "ended_at": {"$gte": p_start},
            "started_at": {"$lt": p_end},
        },
        {"_id": 0, "started_at": 1, "ended_at": 1},
    ).sort("started_at", -1).to_list(60)
    if me and me.get("on_shift") and me.get("shift_started_at"):
        p_shifts.insert(0, {
            "started_at": me["shift_started_at"],
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "open": True,
        })

    def _shift_row(s):
        try:
            a = to_athens(s["started_at"])
            b = to_athens(s["ended_at"])
        except (KeyError, ValueError, TypeError):
            return None
        return {
            "day": a.date().isoformat(),
            "start": a.strftime("%H:%M"),
            "end": None if s.get("open") else b.strftime("%H:%M"),
            "hours": round(max(0, (b - a).total_seconds()) / 3600, 1),
            "orders": sum(1 for t in stamps if s["started_at"] <= t <= s["ended_at"]),
        }

    return {
        "date_from": p_from,
        "date_to": p_to,
        "total": total,
        "today": today_n,
        "week": week_n,
        "shift_hours_today": _hours([s for s in shifts if s["ended_at"] >= t_start], t_start),
        "shift_hours_week": _hours(shifts, w_start),
        "top_stores": [{"name": r["_id"] or "—", "orders": r["orders"]} for r in top],
        "period_total": (pf.get("total") or [{}])[0].get("n", 0),
        "by_day": [{"day": r["_id"], "orders": r["orders"]} for r in pf.get("by_day", []) if r.get("_id")],
        "by_store": [{"name": r["_id"] or "—", "orders": r["orders"]} for r in pf.get("by_store", [])],
        "by_shift": [r for r in (_shift_row(s) for s in p_shifts[:30]) if r],
    }


@router.get("/fleet/driver/orders")
async def fleet_driver_orders(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = 0,
    limit: int = 30,
    team: dict = Depends(get_fleet_member),
):
    """Ιστορικό παραγγελιών του οδηγού (claimed/παραδομένες) με φίλτρο ημέρας ή
    εύρους + pagination — όχι μόνο οι σημερινές."""
    q = {
        "team_id": team["id"],
        "driver_id": team["member_id"],
        "status": {"$in": ["pickup", "enroute", "delivered"]},
    }
    # Μερικό εύρος επιτρεπτό: μόνο «από» ή μόνο «έως» (όπως το PeriodFilter)
    if date_from and date_to:
        start, end = local_day_range(date_from, date_to)
        q["created_at"] = {"$gte": start, "$lt": end}
    elif date_from:
        q["created_at"] = {"$gte": local_day_range(date_from)[0]}
    elif date_to:
        q["created_at"] = {"$lt": local_day_range(date_to)[1]}
    skip = max(0, skip)
    limit = max(1, min(limit, 100))
    total = await db.fleet_orders.count_documents(q)
    docs = await db.fleet_orders.find(q, {"_id": 0, "team_id": 0}).sort(
        "created_at", -1
    ).skip(skip).limit(limit).to_list(limit)
    return {"orders": docs, "total": total}


# ============ AUTOCOMPLETE ============
# Το «Παραλαβή από» ΔΕΝ είναι πια ελεύθερο κείμενο με autocomplete παλιών
# ονομάτων: επιλέγεται συνεργαζόμενο μαγαζί (/fleet/partner-stores) ή ελεύθερη
# διεύθυνση με pin, ώστε το σημείο παραλαβής να έχει πάντα τοποθεσία.
@router.get("/fleet/address-book")
async def fleet_address_book(team: dict = Depends(get_fleet_member)):
    """Πρόσφατες διευθύνσεις της ομάδας για το AddressAutocomplete (μορφή address book)."""
    docs = await db.fleet_orders.find(
        {"team_id": team["id"]}, {"_id": 0, "address": 1, "lat": 1, "lng": 1}
    ).sort("created_at", -1).to_list(400)
    seen, out = set(), []
    for d in docs:
        a = (d.get("address") or "").strip()
        if a and a.lower() not in seen:
            seen.add(a.lower())
            out.append({"address": a, "name": None, "lat": d.get("lat"), "lng": d.get("lng")})
        if len(out) >= 200:
            break
    return out


# ============ ΣΤΑΤΙΣΤΙΚΑ ============
@router.get("/fleet/stats")
async def fleet_stats(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    team: dict = Depends(require_fleet_admin),
):
    """Στατιστικά εταιρείας για περίοδο: πλήθη ανά κατάσταση, ανά οδηγό, ανά
    κατάστημα παραλαβής + μέσος χρόνος παράδοσης (καταχώρηση → παράδοση).
    Χωρίς ποσά — τα χρήματα είναι υπόθεση του καταστήματος."""
    day_from = date_from or athens_today()
    day_to = date_to or day_from
    start, end = local_day_range(day_from, day_to)
    # Οι μη δημοσιευμένες προγραμματισμένες δεν μετράνε πουθενά
    match = {
        "team_id": team["id"],
        "status": {"$ne": "scheduled"},
        "created_at": {"$gte": start, "$lt": end},
    }
    # Λεπτά καταχώρηση → παράδοση, υπολογισμένα στη Mongo (τα created_at/
    # delivered_at είναι ISO strings)
    minutes_expr = {
        "$divide": [
            {"$subtract": [
                {"$dateFromString": {"dateString": "$delivered_at"}},
                {"$dateFromString": {"dateString": "$created_at"}},
            ]},
            60000,
        ]
    }
    delivered_match = {"status": "delivered", "delivered_at": {"$ne": None}}
    facets = {
        "by_status": [{"$group": {"_id": "$status", "n": {"$sum": 1}}}],
        "total": [{"$count": "n"}],
        "avg_minutes": [
            {"$match": delivered_match},
            {"$group": {"_id": None, "avg": {"$avg": minutes_expr}}},
        ],
        "drivers": [
            {"$match": {"driver_id": {"$ne": None}, "status": {"$ne": "cancelled"}}},
            {"$group": {
                "_id": {"driver_id": "$driver_id", "driver_name": "$driver_name"},
                "orders": {"$sum": 1},
                "delivered": {"$sum": {"$cond": [{"$eq": ["$status", "delivered"]}, 1, 0]}},
                "avg_minutes": {"$avg": {
                    "$cond": [{"$eq": ["$status", "delivered"]}, minutes_expr, None]
                }},
            }},
            {"$sort": {"orders": -1}},
            {"$limit": 100},
        ],
        "stores": [
            {"$group": {
                "_id": "$pickup_name",
                "orders": {"$sum": 1},
                "delivered": {"$sum": {"$cond": [{"$eq": ["$status", "delivered"]}, 1, 0]}},
            }},
            {"$sort": {"orders": -1}},
            {"$limit": 10},
        ],
        # Παραγγελίες ανά ελληνική ημέρα (διάγραμμα) και ανά ώρα (ώρες αιχμής)
        "by_day": [
            {"$group": {
                "_id": athens_day_expr(),
                "orders": {"$sum": 1},
                "delivered": {"$sum": {"$cond": [{"$eq": ["$status", "delivered"]}, 1, 0]}},
            }},
            {"$sort": {"_id": 1}},
            {"$limit": 400},
        ],
        "by_hour": [
            {"$group": {"_id": athens_hour_expr(), "orders": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
        ],
    }
    res = await db.fleet_orders.aggregate([{"$match": match}, {"$facet": facets}]).to_list(1)
    f = res[0] if res else {}

    def rnd(v):
        return round(v, 1) if isinstance(v, (int, float)) else None

    return {
        "date_from": day_from,
        "date_to": day_to,
        "total": (f.get("total") or [{}])[0].get("n", 0),
        "by_status": {r["_id"]: r["n"] for r in f.get("by_status", []) if r.get("_id")},
        "avg_minutes": rnd((f.get("avg_minutes") or [{}])[0].get("avg")),
        "drivers": [
            {
                "driver_id": r["_id"].get("driver_id"),
                "driver_name": r["_id"].get("driver_name") or "—",
                "orders": r["orders"],
                "delivered": r["delivered"],
                "avg_minutes": rnd(r.get("avg_minutes")),
            }
            for r in f.get("drivers", [])
        ],
        "stores": [
            {"name": r["_id"] or "—", "orders": r["orders"], "delivered": r["delivered"]}
            for r in f.get("stores", [])
        ],
        "by_day": [
            {"day": r["_id"], "orders": r["orders"], "delivered": r["delivered"]}
            for r in f.get("by_day", [])
            if r.get("_id")
        ],
        "by_hour": [
            {"hour": r["_id"], "orders": r["orders"]}
            for r in f.get("by_hour", [])
            if r.get("_id") is not None
        ],
    }


# ============ DAY SUMMARY ============
@router.get("/fleet/day-summary")
async def fleet_day_summary(
    date: Optional[str] = None,
    date_to: Optional[str] = None,
    team: dict = Depends(require_fleet_admin),
):
    """Πλήθη παραγγελιών ανά οδηγό για ημέρα ή εύρος ημερών — χωρίς ποσά (τα
    χρήματα είναι υπόθεση του μαγαζιού). Περιλαμβάνει και οδηγούς χωρίς
    παραγγελίες στην περίοδο (π.χ. το driver προφίλ του διαχειριστή)."""
    day_from = date or athens_today()
    day_to = date_to or day_from
    start, end = local_day_range(day_from, day_to)
    rows = await db.fleet_orders.aggregate([
        {"$match": {
            "team_id": team["id"],
            "driver_id": {"$ne": None},
            "status": {"$ne": "cancelled"},
            "created_at": {"$gte": start, "$lt": end},
        }},
        {"$group": {
            "_id": {"driver_id": "$driver_id", "driver_name": "$driver_name"},
            "orders": {"$sum": 1},
            "delivered": {"$sum": {"$cond": [{"$eq": ["$status", "delivered"]}, 1, 0]}},
        }},
        {"$sort": {"orders": -1}},
    ]).to_list(200)
    out = [
        {
            "driver_id": r["_id"].get("driver_id"),
            "driver_name": r["_id"].get("driver_name") or "—",
            "orders": r["orders"],
            "delivered": r["delivered"],
        }
        for r in rows
    ]
    seen = {r["driver_id"] for r in out}
    members = await db.fleet_members.find(
        {"team_id": team["id"], "role": "driver"}, {"_id": 0, "id": 1, "name": 1}
    ).sort("created_at", 1).to_list(200)
    out.extend(
        {"driver_id": m["id"], "driver_name": m["name"], "orders": 0, "delivered": 0}
        for m in members
        if m["id"] not in seen
    )
    return {"date": day_from, "date_to": day_to, "drivers": out}


# ============ WEB PUSH ============
class PushSubscribeIn(BaseModel):
    surface: Literal["driver", "dispatcher"]
    subscription: dict


class PushUnsubscribeIn(BaseModel):
    endpoint: str


@router.get("/fleet/push/vapid-key")
async def fleet_push_vapid_key(team: dict = Depends(get_fleet_member)):
    """Δημόσιο VAPID κλειδί για το pushManager.subscribe — null όταν το feature
    δεν έχει ρυθμιστεί στο env (το frontend κρύβει το UI)."""
    return {"key": VAPID_PUBLIC_KEY or None}


@router.post("/fleet/push/subscribe")
async def fleet_push_subscribe(body: PushSubscribeIn, team: dict = Depends(get_fleet_member)):
    if not push_enabled():
        raise HTTPException(503, "Οι ειδοποιήσεις push δεν είναι διαθέσιμες")
    await save_subscription(team["id"], team["member_id"], body.surface, body.subscription)
    return {"ok": True}


@router.post("/fleet/push/unsubscribe")
async def fleet_push_unsubscribe(body: PushUnsubscribeIn, team: dict = Depends(get_fleet_member)):
    await delete_subscription(team["id"], body.endpoint)
    return {"ok": True}
