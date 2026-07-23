"""OrderDeck Fleet — αυτόνομες εταιρείες διανομής (Phase 1: standalone).

Δικές τους οντότητες (fleet_teams / fleet_members / fleet_orders / fleet_events),
δικό τους JWT (claim kind="fleet" — δεν περνάει από το get_current_user των μαγαζιών).
Σχεδιασμένο ώστε ένα fleet_team να μπορεί ΑΡΓΟΤΕΡΑ να συνδεθεί με μαγαζιά
(Phase 2) — τίποτα εδώ δεν το αποκλείει (π.χ. μελλοντικό πεδίο linked_store_ids).
"""
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Literal, Optional

import jwt as pyjwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from core import (
    JWT_ALG,
    JWT_SECRET,
    JWT_TTL_HOURS,
    athens_today,
    db,
    hash_password,
    local_day_range,
    pin_lock_message,
    pin_locked_for,
    rate_limit,
    register_pin_attempt,
    verify_password,
)

router = APIRouter()

FLEET_ROLES = ["fleet_admin", "driver"]
ORDER_STATUSES = ["waiting", "pickup", "enroute", "delivered", "cancelled"]
# Ροή οδηγού: παραλαβή → διαδρομή → παραδόθηκε
DRIVER_NEXT = {"pickup": "enroute", "enroute": "delivered"}
PAYMENTS = ["cash", "card", "paid"]

# Χωρίς διφορούμενους χαρακτήρες (0/O, 1/I) — γράφεται εύκολα από κινητό
INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_invite_code() -> str:
    return "".join(secrets.choice(INVITE_ALPHABET) for _ in range(6))


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
    if member_id:
        m = await db.fleet_members.find_one({"id": member_id, "team_id": team["id"]}, {"_id": 0})
        if m:
            role, member_name = m["role"], m["name"]
        else:
            # Το μέλος διαγράφηκε όσο ζούσε το token → επιστροφή σε επιλογή μέλους
            member_id = role = member_name = None
    team["member_id"] = member_id
    team["role"] = role
    team["member_name"] = member_name
    return team


async def get_fleet_member(team: dict = Depends(get_fleet_team)) -> dict:
    if not team.get("member_id"):
        raise HTTPException(403, "Απαιτείται επιλογή μέλους με PIN")
    return team


async def require_fleet_admin(team: dict = Depends(get_fleet_member)) -> dict:
    if team.get("role") != "fleet_admin":
        raise HTTPException(403, "Απαιτείται πρόσβαση συντονιστή")
    return team


def public_team(t: dict, include_invite: bool = False) -> dict:
    out = {
        "id": t["id"],
        "name": t["name"],
        "city": t.get("city") or "",
        "email": t.get("email"),
        "member_id": t.get("member_id"),
        "role": t.get("role"),
        "member_name": t.get("member_name"),
    }
    if include_invite:
        out["invite_code"] = t.get("invite_code")
    return out


def public_member(m: dict) -> dict:
    return {k: v for k, v in m.items() if k not in ("_id", "team_id", "pin_hash")}


def public_order(o: dict) -> dict:
    return {k: v for k, v in o.items() if k not in ("_id", "team_id")}


def valid_pin(pin: Optional[str]) -> bool:
    return bool(pin) and pin.isdigit() and len(pin) == 4


async def add_event(team_id: str, text: str):
    await db.fleet_events.insert_one({
        "id": str(uuid.uuid4()),
        "team_id": team_id,
        "text": text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def next_order_number(team_id: str) -> int:
    """Ατομικός per-team/per-day αύξων αριθμός παραγγελίας (upsert + $inc)."""
    doc = await db.fleet_counters.find_one_and_update(
        {"team_id": team_id, "day": athens_today()},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    return int(doc["seq"]) if doc else 1


# ============ MODELS ============
class FleetRegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    city: str = Field(default="", max_length=60)
    email: EmailStr
    password: str = Field(min_length=4)
    admin_name: str = Field(default="Συντονιστής", max_length=40)
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
    pin: Optional[str] = None  # 4 ψηφία — υποχρεωτικό στη δημιουργία


class InviteCodeIn(BaseModel):
    invite_code: str = Field(min_length=1, max_length=12)


class JoinIn(BaseModel):
    invite_code: str = Field(min_length=1, max_length=12)
    name: str = Field(min_length=1, max_length=40)
    pin: str = Field(min_length=4, max_length=4)


class CodeSelectIn(BaseModel):
    invite_code: str = Field(min_length=1, max_length=12)
    member_id: str
    pin: str = Field(min_length=4, max_length=4)


class FleetOrderIn(BaseModel):
    pickup_name: str = Field(min_length=1, max_length=80)
    address: str = Field(min_length=1, max_length=160)
    amount: float = Field(ge=0)
    payment: Literal["cash", "card", "paid"] = "cash"
    notes: str = Field(default="", max_length=300)


class StatusIn(BaseModel):
    status: Literal["waiting", "pickup", "enroute", "delivered"]


class AssignIn(BaseModel):
    member_id: Optional[str] = None  # None → επιστροφή σε αναμονή (αποδέσμευση)


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
        "invite_code": invite,
        "created_at": now,
    }
    await db.fleet_teams.insert_one(team)
    await db.fleet_members.insert_one({
        "id": str(uuid.uuid4())[:8],
        "team_id": tid,
        "name": body.admin_name.strip() or "Συντονιστής",
        "role": "fleet_admin",
        "pin_hash": hash_password(body.admin_pin),
        "created_at": now,
    })
    return {"token": create_fleet_token(tid), "team": public_team(team)}


@router.post("/fleet/login")
async def fleet_login(body: FleetLoginIn, request: Request):
    rate_limit(request, "fleet_login", limit=10, window_seconds=60)
    team = await db.fleet_teams.find_one({"email": body.email.lower()})
    if not team or not verify_password(body.password, team["password_hash"]):
        raise HTTPException(401, "Λάθος email ή κωδικός")
    if team.get("disabled"):
        raise HTTPException(403, "Ο λογαριασμός έχει απενεργοποιηθεί")
    return {"token": create_fleet_token(team["id"]), "team": public_team(team)}


@router.get("/fleet/me")
async def fleet_me(team: dict = Depends(get_fleet_team)):
    return public_team(team, include_invite=team.get("role") == "fleet_admin")


# ============ MEMBERS ============
@router.get("/fleet/members")
async def fleet_list_members(team: dict = Depends(get_fleet_team)):
    docs = await db.fleet_members.find(
        {"team_id": team["id"]}, {"_id": 0, "team_id": 0, "pin_hash": 0}
    ).sort("created_at", 1).to_list(200)
    return docs


@router.post("/fleet/members")
async def fleet_create_member(body: MemberIn, team: dict = Depends(require_fleet_admin)):
    if not valid_pin(body.pin):
        raise HTTPException(400, "Απαιτείται 4-ψήφιο PIN")
    doc = {
        "id": str(uuid.uuid4())[:8],
        "team_id": team["id"],
        "name": body.name.strip(),
        "role": body.role,
        "pin_hash": hash_password(body.pin),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.fleet_members.insert_one(doc)
    return public_member(doc)


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
            raise HTTPException(400, "Πρέπει να υπάρχει τουλάχιστον ένας συντονιστής")
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
            raise HTTPException(400, "Δεν μπορεί να διαγραφεί ο τελευταίος συντονιστής")
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


# ============ DRIVER JOIN (public — invite code από το κινητό) ============
@router.post("/fleet/code")
async def fleet_code_lookup(body: InviteCodeIn, request: Request):
    """Έλεγχος invite code: όνομα εταιρείας + λίστα οδηγών για επανασύνδεση."""
    rate_limit(request, "fleet_code", limit=20, window_seconds=300)
    team = await db.fleet_teams.find_one({"invite_code": body.invite_code.strip().upper()})
    if not team or team.get("disabled"):
        raise HTTPException(404, "Ο κωδικός πρόσκλησης δεν βρέθηκε")
    drivers = await db.fleet_members.find(
        {"team_id": team["id"], "role": "driver"}, {"_id": 0, "id": 1, "name": 1}
    ).sort("created_at", 1).to_list(200)
    return {"team_name": team["name"], "city": team.get("city") or "", "drivers": drivers}


@router.post("/fleet/join")
async def fleet_join(body: JoinIn, request: Request):
    """Νέος οδηγός: invite code + όνομα + PIN → μπαίνει κατευθείαν συνδεδεμένος."""
    rate_limit(request, "fleet_join", limit=10, window_seconds=3600)
    team = await db.fleet_teams.find_one({"invite_code": body.invite_code.strip().upper()})
    if not team or team.get("disabled"):
        raise HTTPException(404, "Ο κωδικός πρόσκλησης δεν βρέθηκε")
    if not valid_pin(body.pin):
        raise HTTPException(400, "Το PIN πρέπει να είναι 4 ψηφία")
    name = body.name.strip()
    if await db.fleet_members.find_one({"team_id": team["id"], "name": name}):
        raise HTTPException(400, "Υπάρχει ήδη μέλος με αυτό το όνομα — επιλέξτε το από τη λίστα")
    doc = {
        "id": str(uuid.uuid4())[:8],
        "team_id": team["id"],
        "name": name,
        "role": "driver",
        "pin_hash": hash_password(body.pin),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.fleet_members.insert_one(doc)
    await add_event(team["id"], f"Ο/Η {name} μπήκε στην ομάδα")
    return {
        "token": create_fleet_token(team["id"], doc["id"], "driver", name),
        "team_name": team["name"],
        "member_name": name,
    }


@router.post("/fleet/code/select")
async def fleet_code_select(body: CodeSelectIn, request: Request):
    """Επανασύνδεση οδηγού από το κινητό: invite code + επιλογή ονόματος + PIN."""
    rate_limit(request, "fleet_code", limit=20, window_seconds=300)
    team = await db.fleet_teams.find_one({"invite_code": body.invite_code.strip().upper()})
    if not team or team.get("disabled"):
        raise HTTPException(404, "Ο κωδικός πρόσκλησης δεν βρέθηκε")
    m = await select_member_with_pin(team["id"], body.member_id, body.pin)
    return {
        "token": create_fleet_token(team["id"], m["id"], m["role"], m["name"]),
        "team_name": team["name"],
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
        "address": body.address.strip(),
        "amount": round(float(body.amount), 2),
        "payment": body.payment,
        "notes": body.notes.strip(),
        "status": "waiting",
        "driver_id": None,
        "driver_name": None,
        "created_by": team.get("member_name") or "",
        "created_at": now,
        "claimed_at": None,
        "delivered_at": None,
    }
    await db.fleet_orders.insert_one(doc)
    await add_event(team["id"], f"Νέα παραγγελία #{number} · {doc['pickup_name']}")
    return public_order(doc)


@router.get("/fleet/board")
async def fleet_board(date: Optional[str] = None, team: dict = Depends(require_fleet_admin)):
    """Ο πίνακας του συντονιστή: παραγγελίες ημέρας + feed + οδηγοί (ένα poll)."""
    day = date or athens_today()
    start, end = local_day_range(day)
    orders = await db.fleet_orders.find(
        {"team_id": team["id"], "created_at": {"$gte": start, "$lt": end}},
        {"_id": 0, "team_id": 0},
    ).sort("created_at", -1).to_list(500)
    events = await db.fleet_events.find(
        {"team_id": team["id"], "created_at": {"$gte": start, "$lt": end}},
        {"_id": 0, "team_id": 0},
    ).sort("created_at", -1).to_list(40)
    drivers = await db.fleet_members.find(
        {"team_id": team["id"], "role": "driver"}, {"_id": 0, "id": 1, "name": 1}
    ).sort("created_at", 1).to_list(200)
    return {"date": day, "orders": orders, "events": events, "drivers": drivers}


@router.get("/fleet/driver/board")
async def fleet_driver_board(team: dict = Depends(get_fleet_member)):
    """Η οθόνη του οδηγού: ελεύθερες + δικές του σημερινές παραγγελίες (ένα poll)."""
    start, end = local_day_range(athens_today())
    day_q = {"team_id": team["id"], "created_at": {"$gte": start, "$lt": end}}
    available = await db.fleet_orders.find(
        {**day_q, "status": "waiting"}, {"_id": 0, "team_id": 0}
    ).sort("created_at", 1).to_list(200)
    mine = await db.fleet_orders.find(
        {**day_q, "driver_id": team["member_id"], "status": {"$in": ["pickup", "enroute"]}},
        {"_id": 0, "team_id": 0},
    ).sort("created_at", 1).to_list(200)
    delivered = await db.fleet_orders.count_documents(
        {**day_q, "driver_id": team["member_id"], "status": "delivered"}
    )
    return {"available": available, "mine": mine, "delivered_today": delivered}


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
    if body.status == "waiting":
        # Επιστροφή σε αναμονή (admin) → αποδέσμευση οδηγού
        update.update({"driver_id": None, "driver_name": None, "claimed_at": None})
    await db.fleet_orders.update_one({"id": oid, "team_id": team["id"]}, {"$set": update})
    labels = {"waiting": "σε αναμονή", "pickup": "σε παραλαβή",
              "enroute": "σε διαδρομή", "delivered": "παραδόθηκε"}
    who = o.get("driver_name") or team["member_name"]
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
            {"$set": {"status": "waiting", "driver_id": None, "driver_name": None, "claimed_at": None}},
        )
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
            # Αν ήταν σε αναμονή, η ανάθεση την προχωράει σε παραλαβή
            **({"status": "pickup"} if o["status"] == "waiting" else {}),
        }},
    )
    await add_event(team["id"], f"Η #{o['number']} ανατέθηκε στον/στην {m['name']}")
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
    await add_event(team["id"], f"Η #{o['number']} ακυρώθηκε")
    return {"ok": True}


# ============ AUTOCOMPLETE ============
@router.get("/fleet/pickup-names")
async def fleet_pickup_names(team: dict = Depends(get_fleet_member)):
    """Ονόματα καταστημάτων παραλαβής που έχουν ξαναχρησιμοποιηθεί (autocomplete)."""
    names = await db.fleet_orders.distinct("pickup_name", {"team_id": team["id"]})
    return sorted(n for n in names if n)[:100]


@router.get("/fleet/address-book")
async def fleet_address_book(team: dict = Depends(get_fleet_member)):
    """Πρόσφατες διευθύνσεις της ομάδας για το AddressAutocomplete (μορφή address book)."""
    docs = await db.fleet_orders.find(
        {"team_id": team["id"]}, {"_id": 0, "address": 1}
    ).sort("created_at", -1).to_list(400)
    seen, out = set(), []
    for d in docs:
        a = (d.get("address") or "").strip()
        if a and a.lower() not in seen:
            seen.add(a.lower())
            out.append({"address": a, "name": None, "lat": None, "lng": None})
        if len(out) >= 200:
            break
    return out


# ============ DAY SUMMARY ============
@router.get("/fleet/day-summary")
async def fleet_day_summary(date: Optional[str] = None, team: dict = Depends(require_fleet_admin)):
    """Απλά σύνολα ημέρας ανά οδηγό: παραδόσεις + μετρητά που μάζεψε."""
    day = date or athens_today()
    start, end = local_day_range(day)
    rows = await db.fleet_orders.aggregate([
        {"$match": {
            "team_id": team["id"],
            "status": "delivered",
            "created_at": {"$gte": start, "$lt": end},
        }},
        {"$group": {
            "_id": {"driver_id": "$driver_id", "driver_name": "$driver_name"},
            "orders": {"$sum": 1},
            "total": {"$sum": "$amount"},
            "cash": {"$sum": {"$cond": [{"$eq": ["$payment", "cash"]}, "$amount", 0]}},
        }},
        {"$sort": {"orders": -1}},
    ]).to_list(200)
    return {
        "date": day,
        "drivers": [
            {
                "driver_id": r["_id"].get("driver_id"),
                "driver_name": r["_id"].get("driver_name") or "—",
                "orders": r["orders"],
                "total": round(r["total"], 2),
                "cash": round(r["cash"], 2),
            }
            for r in rows
        ],
    }
