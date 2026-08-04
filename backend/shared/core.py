"""Shared core for OrderDeck: db client, auth helpers, common dependencies, seeding."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import time
import uuid
import logging
import bcrypt
import jwt
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException, Depends, Header, Request
from motor.motor_asyncio import AsyncIOMotorClient


logger = logging.getLogger("orderdeck")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
JWT_TTL_HOURS = 24 * 30  # 30 days for POS convenience

# Mongo
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]


# ============ HELPERS ============
from zoneinfo import ZoneInfo

ATHENS = ZoneInfo("Europe/Athens")
ATHENS_TZ = "Europe/Athens"  # για $dateToString της Mongo


def athens_now() -> datetime:
    return datetime.now(timezone.utc).astimezone(ATHENS)


def athens_today() -> str:
    """Η τρέχουσα ημερολογιακή ημέρα στην Ελλάδα (YYYY-MM-DD)."""
    return athens_now().date().isoformat()


def local_day_range(day_from: str, day_to: Optional[str] = None) -> tuple[str, str]:
    """Μετατρέπει τοπικές (Ελλάδα) ημέρες σε UTC ISO όρια για query στο created_at.

    Επιστρέφει (utc_start, utc_end) για χρήση ως $gte/$lt — σωστό και σε
    χειμερινή/θερινή ώρα. Πάντα φιλτράρουμε created_at με αυτά τα όρια,
    ΠΟΤΕ με σκέτο f"{day}T00:00:00+00:00" (UTC ημέρα ≠ ελληνική ημέρα).
    """
    start = datetime.fromisoformat(f"{day_from}T00:00:00").replace(tzinfo=ATHENS)
    end = datetime.fromisoformat(f"{day_to or day_from}T00:00:00").replace(tzinfo=ATHENS) + timedelta(days=1)
    return (
        start.astimezone(timezone.utc).isoformat(),
        end.astimezone(timezone.utc).isoformat(),
    )


# Εκφράσεις aggregation για ομαδοποίηση ανά ελληνική ημέρα/ώρα. Τα created_at/
# delivered_at είναι ISO strings, οπότε περνάνε πρώτα από $dateFromString.
def athens_day_expr(field: str = "$created_at") -> dict:
    """Η ελληνική ημέρα (YYYY-MM-DD) ενός ISO string πεδίου."""
    return {
        "$dateToString": {
            "date": {"$dateFromString": {"dateString": field}},
            "format": "%Y-%m-%d",
            "timezone": ATHENS_TZ,
        }
    }


def athens_hour_expr(field: str = "$created_at") -> dict:
    """Ώρα (0-23) ελληνικής ώρας ενός ISO string πεδίου."""
    return {
        "$toInt": {
            "$dateToString": {
                "date": {"$dateFromString": {"dateString": field}},
                "format": "%H",
                "timezone": ATHENS_TZ,
            }
        }
    }


def to_athens(iso: str) -> datetime:
    dt_obj = datetime.fromisoformat(iso)
    if dt_obj.tzinfo is None:
        dt_obj = dt_obj.replace(tzinfo=timezone.utc)
    return dt_obj.astimezone(ATHENS)


# ============ ΕΡΓΑΣΙΜΗ ΗΜΕΡΑ (business day) ============
# Η «ημέρα» του μαγαζιού ΔΕΝ είναι η ημερολογιακή: αν κλείνει 02:00, οι
# παραγγελίες της 01:30 ανήκουν στην ΠΡΟΗΓΟΥΜΕΝΗ ημέρα. Το όριο (cutoff) είναι
# λεπτά μετά τα μεσάνυχτα και βγαίνει από το ωράριο (store_hours): το πιο αργό
# κλείσιμο βάρδιας που περνά τα μεσάνυχτα. Χωρίς ωράριο → 06:00.
WEEK_DAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
BUSINESS_DAY_FALLBACK_MIN = 6 * 60   # 06:00 όταν δεν έχει οριστεί ωράριο
BUSINESS_DAY_MAX_CUTOFF_MIN = 12 * 60  # ασφαλιστικό πλαφόν (ποτέ μετά το μεσημέρι)

GR_DAY_LONG = ("Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο", "Κυριακή")
GR_DAY_SHORT = ("Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ", "Κυρ")


def hhmm_to_min(s) -> Optional[int]:
    """"HH:MM" → λεπτά μετά τα μεσάνυχτα (None αν δεν είναι έγκυρο)."""
    try:
        h, m = str(s).strip().split(":")
        h, m = int(h), int(m)
        if 0 <= h <= 23 and 0 <= m <= 59:
            return h * 60 + m
    except Exception:
        pass
    return None


def _day_ranges(hours: dict, day_key: str) -> list:
    d = (hours or {}).get(day_key) or {}
    if d.get("closed"):
        return []
    out = []
    for r in d.get("ranges") or []:
        s, e = hhmm_to_min(r.get("start")), hhmm_to_min(r.get("end"))
        if s is not None and e is not None:
            out.append((s, e))
    return out


def business_day_cutoff(user: dict) -> int:
    """Το όριο της εργάσιμης ημέρας σε λεπτά μετά τα μεσάνυχτα."""
    hours = user.get("store_hours") or {}
    latest, any_range = 0, False
    for key in WEEK_DAY_KEYS:
        for s, e in _day_ranges(hours, key):
            any_range = True
            if e <= s:  # overnight: κλείνει την επόμενη ημερολογιακή ημέρα
                latest = max(latest, e)
    if not any_range:
        return BUSINESS_DAY_FALLBACK_MIN
    return min(latest, BUSINESS_DAY_MAX_CUTOFF_MIN)


def business_day_range(day_from: str, cutoff_min: int, day_to: Optional[str] = None) -> tuple[str, str]:
    """Εργάσιμες ημέρες (Ελλάδα) → UTC ISO όρια για query στο created_at."""
    start = datetime.fromisoformat(f"{day_from}T00:00:00").replace(tzinfo=ATHENS) + timedelta(minutes=cutoff_min)
    end = (
        datetime.fromisoformat(f"{day_to or day_from}T00:00:00").replace(tzinfo=ATHENS)
        + timedelta(days=1, minutes=cutoff_min)
    )
    return (
        start.astimezone(timezone.utc).isoformat(),
        end.astimezone(timezone.utc).isoformat(),
    )


def business_day_of(iso: str, cutoff_min: int) -> str:
    """Σε ποια εργάσιμη ημέρα (YYYY-MM-DD) ανήκει ένα ISO timestamp."""
    return (to_athens(iso) - timedelta(minutes=cutoff_min)).date().isoformat()


def business_today(cutoff_min: int) -> str:
    """Η ΤΡΕΧΟΥΣΑ εργάσιμη ημέρα του μαγαζιού."""
    return (athens_now() - timedelta(minutes=cutoff_min)).date().isoformat()


def business_day_expr(cutoff_min: int, field: str = "$created_at") -> dict:
    """Aggregation: η εργάσιμη ημέρα (YYYY-MM-DD) ενός ISO string πεδίου."""
    return {
        "$dateToString": {
            "date": {
                "$subtract": [
                    {"$dateFromString": {"dateString": field, "onError": None, "onNull": None}},
                    cutoff_min * 60 * 1000,
                ]
            },
            "format": "%Y-%m-%d",
            "timezone": ATHENS_TZ,
            "onNull": None,
        }
    }


def business_day_bounds(user: dict, day: str, cutoff_min: Optional[int] = None) -> dict:
    """Άνοιγμα → κλείσιμο της εργάσιμης ημέρας, για την κεφαλίδα του Z.

    {'start': ISO τοπικό, 'end': ISO τοπικό, 'label': 'Τρίτη 30/07 17:00 — Τετ 31/07 02:00'}
    """
    cutoff = business_day_cutoff(user) if cutoff_min is None else cutoff_min
    d = datetime.fromisoformat(f"{day}T00:00:00").date()
    ranges = _day_ranges(user.get("store_hours") or {}, WEEK_DAY_KEYS[d.weekday()])
    if ranges:
        start_min = min(s for s, _ in ranges)
        end_min, end_next = 0, False
        for s, e in ranges:
            nxt = e <= s
            if (nxt, e) > (end_next, end_min):
                end_min, end_next = e, nxt
    else:  # κλειστά ή χωρίς ωράριο → το ίδιο το όριο της ημέρας
        start_min, end_min, end_next = cutoff, cutoff, True

    start_dt = datetime.fromisoformat(f"{day}T00:00:00") + timedelta(minutes=start_min)
    end_dt = datetime.fromisoformat(f"{day}T00:00:00") + timedelta(
        days=1 if end_next else 0, minutes=end_min
    )
    fmt = lambda dt: f"{dt.day:02d}/{dt.month:02d} {dt.hour:02d}:{dt.minute:02d}"
    return {
        "start": start_dt.isoformat(),
        "end": end_dt.isoformat(),
        "label": (
            f"{GR_DAY_LONG[start_dt.weekday()]} {fmt(start_dt)}"
            f" — {GR_DAY_SHORT[end_dt.weekday()]} {fmt(end_dt)}"
        ),
    }


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))


PROFILE_ROLES = ["owner", "manager", "employee", "waiter"]
LEGACY_ROLE_NAMES = {"owner": "Ιδιοκτήτης", "employee": "Υπάλληλος"}

# ============ PER-PROFILE FEATURE PERMISSIONS ============
# Restrict-only: κόβουν πρόσβαση ΜΕΣΑ στα όρια του ρόλου, δεν χαρίζουν παραπάνω.
# Απουσία κλειδιού στο profile.perms = επιτρέπεται (default: όλα ενεργά).
FEATURE_KEYS = [
    "history",        # Ιστορικό παραγγελιών
    "analytics",      # Στατιστικά
    "expenses",       # Έξοδα
    "settings",       # Ρυθμίσεις
    "menu",           # Διαχείριση μενού & φωτογραφίες
    "day_close",      # Κλείσιμο ημέρας / Z-report
    "discounts",      # Εκπτώσεις στο ταμείο
    "cancel_orders",  # Ακύρωση/διαγραφή/επεξεργασία παραγγελιών
    "platforms",      # Παραγγελίες πλατφορμών (efood/Box/Wolt)
]


def profile_can(user: dict, key: str) -> bool:
    """Ο Ιδιοκτήτης έχει ΠΑΝΤΑ τα πάντα — δεν μπορεί να κλειδωθεί απ' έξω."""
    if user.get("role") == "owner":
        return True
    perms = user.get("perms") or {}
    return perms.get(key, True) is not False


def require_feature(key: str, base_dep=None):
    """Dependency factory: ρόλος (base_dep) + per-profile δικαίωμα λειτουργίας."""
    base = base_dep or get_current_user

    async def dep(user: dict = Depends(base)) -> dict:
        if not profile_can(user, key):
            raise HTTPException(403, "Το προφίλ σας δεν έχει πρόσβαση σε αυτή τη λειτουργία")
        return user

    return dep


def create_token(
    user_id: str,
    email: str,
    profile_id: Optional[str] = None,
    role: Optional[str] = None,
    profile_name: Optional[str] = None,
) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "profile": role,  # legacy claim name — carries the role
        "profile_id": profile_id,
        "profile_name": profile_name,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_TTL_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    # store_logo can be a ~2MB base64 blob — never load it on every authed request
    user = await db.users.find_one(
        {"id": payload["sub"]}, {"_id": 0, "password_hash": 0, "store_logo": 0}
    )
    if not user:
        raise HTTPException(401, "User not found")
    if user.get("disabled"):
        raise HTTPException(
            403,
            "Ο λογαριασμός σας έχει απενεργοποιηθεί. Επικοινωνήστε με την υποστήριξη του OrderDeck.",
        )
    role = payload.get("profile")  # legacy tokens carry "owner"/"employee" here
    profile_id = payload.get("profile_id")
    profile_name = payload.get("profile_name")
    perms = {}
    if profile_id:
        prof = await db.profiles.find_one(
            {"id": profile_id, "user_id": user["id"]}, {"_id": 0}
        )
        if prof:
            role = prof["role"]
            profile_name = prof["name"]
            perms = prof.get("perms") or {}
        else:
            # profile deleted while the token was live → force re-selection
            role = None
            profile_id = None
            profile_name = None
    user["profile"] = role  # legacy key: pages check "owner"
    user["role"] = role
    user["profile_id"] = profile_id
    user["profile_name"] = profile_name
    user["perms"] = perms  # per-profile feature permissions (restrict-only)
    return user


async def require_owner(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "owner":
        raise HTTPException(403, "Απαιτείται πρόσβαση ιδιοκτήτη")
    return user


async def require_manager(user: dict = Depends(get_current_user)) -> dict:
    """Owner or manager (Υπεύθυνος)."""
    if user.get("role") not in ("owner", "manager"):
        raise HTTPException(403, "Απαιτείται πρόσβαση ιδιοκτήτη ή υπευθύνου")
    return user


async def require_staff(user: dict = Depends(get_current_user)) -> dict:
    """Όλοι εκτός σερβιτόρου (ο σερβιτόρος έχει μόνο Τραπέζια)."""
    if user.get("role") not in ("owner", "manager", "employee"):
        raise HTTPException(403, "Δεν επιτρέπεται για αυτόν τον ρόλο")
    return user


def actor_name(user: dict) -> str:
    return user.get("profile_name") or LEGACY_ROLE_NAMES.get(user.get("role"), "") or "—"


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "restaurant_name": u["restaurant_name"],
        # Προαιρετικό όνομα για την κεφαλίδα της απόδειξης — κενό = restaurant_name
        "receipt_name": u.get("receipt_name") or "",
        # Πλάνο λογαριασμού — τα υπάρχοντα μαγαζιά είναι by default OrderDeck (μόνο POS)
        "account_type": u.get("account_type") or "store",
        "plan": u.get("plan") or "orderdeck",
        "created_at": u.get("created_at"),
        "profile": u.get("profile"),  # role (legacy key)
        "role": u.get("role") or u.get("profile"),
        "profile_id": u.get("profile_id"),
        "profile_name": u.get("profile_name"),
        "owner_pin_set": bool(u.get("owner_pin_set", False)),
        "employee_pin_set": bool(u.get("employee_pin_set", False)),
        "tables_enabled": bool(u.get("tables_enabled", False)),
        "business_type": u.get("business_type") or "souvlaki",
        "store_phone": u.get("store_phone") or "",
        "store_address": u.get("store_address") or "",
        "store_city": u.get("store_city") or "",
        "store_lat": u.get("store_lat"),
        "store_lng": u.get("store_lng"),
        "delivery_radius_km": u.get("delivery_radius_km") or 6,
        "store_hours": u.get("store_hours") or {},
        # Όριο εργάσιμης ημέρας (λεπτά μετά τα μεσάνυχτα) — το frontend το
        # χρησιμοποιεί για «σήμερα» σε Ιστορικό/Στατιστικά/Κλείσιμο ημέρας
        "business_day_cutoff": business_day_cutoff(u),
        "google_review_link": u.get("google_review_link") or "",
        # Ρυθμίσεις καταλόγου/παραγγελιών — το POS τα χρειάζεται για χρέωση delivery + ελάχιστη
        "min_order": u.get("min_order"),
        "delivery_fee": u.get("delivery_fee"),
        "print_copies": u.get("print_copies", 1),
        "print_copy_labels": bool(u.get("print_copy_labels", False)),
        "print_double": bool(u.get("print_double", False)),
        "print_mode": u.get("print_mode") or "browser",
        # Το ίδιο το token επιστρέφεται μόνο από owner-only endpoint (routers/print_jobs.py)
        "print_bridge_configured": bool(u.get("print_bridge_token")),
        "is_demo": bool(u.get("is_demo", False)),
        "demo_expires_at": u.get("demo_expires_at"),
        "ai_features_enabled": bool(u.get("ai_features_enabled", False)),
        # Ενεργές πλατφόρμες delivery — το UI ξέρει από την πρώτη στιγμή αν πρέπει
        # να δείξει καρτέλες/popup, χωρίς επιπλέον κλήση (λεπτομέρειες: /platforms/settings)
        "platforms_enabled": [
            p for p in ("efood", "box", "wolt")
            if ((u.get("platform_settings") or {}).get(p) or {}).get("enabled")
        ],
        "perms": u.get("perms") or {},
    }


# ============ PROFILES MIGRATION ============
async def ensure_profiles_migrated(user_id: str):
    """Legacy accounts had two fixed PINs — turn them into real profiles once."""
    count = await db.profiles.count_documents({"user_id": user_id})
    if count > 0:
        return
    u = await db.users.find_one({"id": user_id})
    if not u:
        return
    now = datetime.now(timezone.utc).isoformat()
    await db.profiles.insert_many([
        {
            "id": str(uuid.uuid4())[:8],
            "user_id": user_id,
            "name": "Ιδιοκτήτης",
            "role": "owner",
            "pin_hash": u.get("owner_pin_hash") or hash_password("0000"),
            "created_at": now,
        },
        {
            "id": str(uuid.uuid4())[:8],
            "user_id": user_id,
            "name": "Υπάλληλος",
            "role": "employee",
            "pin_hash": u.get("employee_pin_hash") or hash_password("0000"),
            "created_at": now,
        },
    ])


# ============ RATE LIMITING (in-memory — single instance) ============
_rate_buckets: dict = defaultdict(deque)


def client_ip(request: Request) -> str:
    """IP πελάτη — πίσω από το Render proxy έρχεται στο X-Forwarded-For."""
    fwd = request.headers.get("x-forwarded-for") or ""
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(request: Request, bucket: str, limit: int, window_seconds: int):
    """Απλό sliding-window όριο ανά (bucket, IP). Raises 429 όταν ξεπεραστεί."""
    now = time.monotonic()
    key = (bucket, client_ip(request))
    q = _rate_buckets[key]
    while q and q[0] <= now - window_seconds:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(429, "Πολλές προσπάθειες — δοκιμάστε ξανά σε λίγο")
    q.append(now)
    # Συντήρηση μνήμης: πέτα άδεια κλειδιά όταν μαζευτούν πολλά
    if len(_rate_buckets) > 10000:
        for k in [k for k, v in _rate_buckets.items() if not v]:
            del _rate_buckets[k]


# ============ PIN LOCKOUT (κοινό για owner-PIN gate & επιλογή προφίλ) ============
PIN_MAX_FAILS = 5
PIN_LOCK_SECONDS = 300  # 5 minutes


def pin_locked_for(doc: dict) -> int:
    """Δευτερόλεπτα που απομένουν αν το doc είναι κλειδωμένο από λάθος PIN, αλλιώς 0."""
    lock_until = doc.get("pin_lock_until")
    if not lock_until:
        return 0
    try:
        lu = datetime.fromisoformat(lock_until)
    except (ValueError, TypeError):
        return 0
    return max(0, int((lu - datetime.now(timezone.utc)).total_seconds()))


async def register_pin_attempt(coll, query: dict, doc: dict, matched: bool) -> dict:
    """Κοινός μετρητής αποτυχιών PIN: 5 συνεχόμενα λάθη → κλείδωμα 5', reset σε επιτυχία.

    Επιστρέφει {"ok": True} / {"ok": False, "attempts_left": n} / {"ok": False, "locked_for": s}.
    """
    if matched:
        await coll.update_one(
            query, {"$set": {"pin_fail_count": 0, "pin_lock_until": None}}
        )
        return {"ok": True}
    fails = int(doc.get("pin_fail_count") or 0) + 1
    if fails >= PIN_MAX_FAILS:
        lock_until = datetime.now(timezone.utc) + timedelta(seconds=PIN_LOCK_SECONDS)
        await coll.update_one(
            query,
            {"$set": {"pin_fail_count": 0, "pin_lock_until": lock_until.isoformat()}},
        )
        return {"ok": False, "locked_for": PIN_LOCK_SECONDS}
    await coll.update_one(query, {"$set": {"pin_fail_count": fails}})
    return {"ok": False, "attempts_left": PIN_MAX_FAILS - fails}


def pin_lock_message(seconds: int) -> str:
    if seconds >= 60:
        return f"Πολλές λάθος προσπάθειες — δοκιμάστε ξανά σε {(seconds + 59) // 60} λεπτά"
    return f"Πολλές λάθος προσπάθειες — δοκιμάστε ξανά σε {seconds} δευτερόλεπτα"


async def check_owner_pin(user_id: str, pin: str) -> dict:
    """Verify an owner/manager profile PIN with a 5-fail / 5-minute lockout, per account."""
    u = await db.users.find_one({"id": user_id})
    if not u:
        return {"ok": False, "attempts_left": 0}
    locked = pin_locked_for(u)
    if locked:
        return {"ok": False, "locked_for": locked}
    await ensure_profiles_migrated(user_id)
    supervisors = await db.profiles.find(
        {"user_id": user_id, "role": {"$in": ["owner", "manager"]}}
    ).to_list(100)
    matched = bool(pin) and any(
        verify_password(pin, p.get("pin_hash", "")) for p in supervisors
    )
    return await register_pin_attempt(db.users, {"id": user_id}, u, matched)


async def require_owner_or_pin(user: dict, pin: Optional[str]):
    """Owner/manager roles act directly; other roles need a valid owner/manager PIN."""
    if user.get("role") in ("owner", "manager"):
        return
    res = await check_owner_pin(user["id"], pin or "")
    if not res.get("ok"):
        if res.get("locked_for"):
            raise HTTPException(423, f"Κλειδωμένο για {res['locked_for']} δευτερόλεπτα")
        raise HTTPException(403, "Απαιτείται PIN ιδιοκτήτη ή υπευθύνου")



# ============ DEMO ACCOUNTS (per-visitor, auto-expiring) ============
DEMO_TTL_HOURS = 3

# Collections που ανήκουν στο shared domain (λογαριασμός + προφίλ + εκτυπώσεις).
# Τα υπόλοιπα τα καθαρίζει ΤΟ ΚΑΘΕ DOMAIN μόνο του, μέσω του purge_store_data
# της διεπαφής του — το shared δεν ξέρει τα collections των άλλων.
# (Το promo_codes είναι global, το demo_leads κρατιέται σκόπιμα για follow-up.)
SHARED_PER_USER_COLLECTIONS = ["profiles", "print_jobs", "geocode_cache"]


async def purge_shared_user_data(user_id: str) -> None:
    """Μόνο τα shared collections ενός λογαριασμού (προφίλ, ουρά εκτυπώσεων)."""
    for coll in SHARED_PER_USER_COLLECTIONS:
        await db[coll].delete_many({"user_id": user_id})


async def purge_user_data(user_id: str) -> None:
    """Διαγράφει ΟΛΑ τα δεδομένα ενός λογαριασμού από όλα τα domains + τον ίδιο τον χρήστη."""
    from fleet import api as fleet_api
    from platforms import api as platforms_api
    from pos import api as pos_api

    await purge_shared_user_data(user_id)
    await pos_api.purge_store_data(user_id)
    await fleet_api.purge_store_data(user_id)
    await platforms_api.purge_store_data(user_id)
    await db.users.delete_one({"id": user_id})


async def cleanup_expired_demos() -> int:
    """Βρίσκει demo λογαριασμούς με demo_expires_at < τώρα και τους διαγράφει ολοκληρωτικά."""
    now_iso = datetime.now(timezone.utc).isoformat()
    expired = await db.users.find(
        {"is_demo": True, "demo_expires_at": {"$lt": now_iso}}, {"id": 1}
    ).to_list(1000)
    for u in expired:
        await purge_user_data(u["id"])
    if expired:
        logger.info("Purged %d expired demo account(s)", len(expired))
    return len(expired)
