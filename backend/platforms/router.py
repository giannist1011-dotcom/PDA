"""Παραγγελίες πλατφορμών delivery (efood / Box / Wolt).

Ροή: εισερχόμενη (pending) → ΑΠΟΔΟΧΗ με χρόνο παράδοσης → δημιουργείται κανονική
παραγγελία POS (μπαίνει σε Ιστορικό/Z/Στατιστικά με πηγή «efood/Box/Wolt») →
«ΚΑΘ' ΟΔΟΝ» → ολοκλήρωση. Κάθε ενέργεια περνά από τον connector της πλατφόρμας
(platform_integrations.py) — σήμερα τοπικός, αύριο πραγματικό API χωρίς αλλαγή εδώ.

Ρυθμίσεις ανά κατάστημα (users.platform_settings): ενεργοποίηση πλατφόρμας,
κατάσταση «Ανοιχτό στο …» και προαιρετικός δικός του ήχος ειδοποίησης.
"""
import base64
import binascii
import logging
import os
import random
import secrets
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel, Field

from shared.core import db, require_staff, require_owner, require_feature, actor_name
from fleet import api as fleet_api
from pos import api as pos_api
from platforms.sounds import platform_sound_wav
from platforms.integrations import (
    CLOSED_STATUSES,
    DEFAULT_READY_MINUTES,
    OPEN_STATUSES,
    PLATFORMS,
    PLATFORM_LABELS,
    PLATFORM_SOURCE,
    READY_PRESETS,
    STATUS_ACCEPTED,
    STATUS_DONE,
    STATUS_OUT,
    STATUS_PENDING,
    STATUS_REJECTED,
    PlatformUnavailable,
    capabilities_for,
    due_at_from,
    get_connector,
    receive_order,
)

router = APIRouter()
logger = logging.getLogger("orderdeck.platforms")

# Μέγιστο μέγεθος custom ήχου (base64) — ~700KB αρκούν για μερικά δευτερόλεπτα mp3
MAX_SOUND_B64 = 700_000
ALLOWED_SOUND_MIME = ("audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm")

PlatformId = Literal["efood", "box", "wolt"]


def _platform_or_404(platform: str) -> str:
    if platform not in PLATFORMS:
        raise HTTPException(404, "Άγνωστη πλατφόρμα")
    return platform


def _settings_of(user: dict) -> dict:
    """Ρυθμίσεις πλατφορμών του λογαριασμού με συμπληρωμένα defaults."""
    stored = user.get("platform_settings") or {}
    out = {}
    for p in PLATFORMS:
        s = stored.get(p) or {}
        out[p] = {
            "enabled": bool(s.get("enabled", False)),
            "store_open": bool(s.get("store_open", True)),
            "sound": s.get("sound") or None,
            "sound_name": s.get("sound_name") or "",
        }
    return out


def _public_settings(user: dict) -> list:
    s = _settings_of(user)
    return [
        {
            "platform": p,
            "label": PLATFORM_LABELS[p],
            "enabled": s[p]["enabled"],
            "store_open": s[p]["store_open"],
            "capabilities": capabilities_for(p, user),
            "has_custom_sound": bool(s[p]["sound"]),
            "sound_name": s[p]["sound_name"],
            # Αλλάζει όταν αλλάξει ο ήχος → το frontend ξαναφορτώνει (cache busting)
            "sound_version": (s[p]["sound"] or "default")[-16:],
        }
        for p in PLATFORMS
    ]


async def _fresh_user(user: dict) -> dict:
    doc = await db.users.find_one({"id": user["id"]}, {"_id": 0, "platform_settings": 1})
    return {**user, "platform_settings": (doc or {}).get("platform_settings") or {}}


# ============ ΡΥΘΜΙΣΕΙΣ ============
@router.get("/platforms/settings")
async def platform_settings(user: dict = Depends(require_staff)):
    fresh = await _fresh_user(user)
    return {
        "platforms": _public_settings(fresh),
        "ready_presets": list(READY_PRESETS),
        "default_ready_minutes": DEFAULT_READY_MINUTES,
        "can_test_orders": _test_orders_allowed(user),
    }


class PlatformToggleIn(BaseModel):
    enabled: bool


@router.put("/platforms/{platform}/enabled")
async def toggle_platform(
    platform: str,
    body: PlatformToggleIn,
    user: dict = Depends(require_feature("settings", require_owner)),
):
    """Εμφάνιση/απόκρυψη της καρτέλας της πλατφόρμας στις Παραγγελίες."""
    _platform_or_404(platform)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {f"platform_settings.{platform}.enabled": bool(body.enabled)}},
    )
    return {"platform": platform, "enabled": bool(body.enabled)}


class StoreOpenIn(BaseModel):
    is_open: bool


@router.put("/platforms/{platform}/store-open")
async def set_store_open(
    platform: str,
    body: StoreOpenIn,
    user: dict = Depends(require_feature("platforms", require_staff)),
):
    """«Ανοιχτό στο efood»: περνά από τον connector — αν η πλατφόρμα δεν το
    υποστηρίζει επιστρέφεται 409 και το UI το δείχνει απενεργοποιημένο."""
    _platform_or_404(platform)
    conn = get_connector(platform, user)
    try:
        await conn.set_store_open(bool(body.is_open))
    except PlatformUnavailable as e:
        raise HTTPException(409, e.message)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {f"platform_settings.{platform}.store_open": bool(body.is_open)}},
    )
    return {"platform": platform, "store_open": bool(body.is_open)}


# ============ ΗΧΟΙ ΕΙΔΟΠΟΙΗΣΗΣ ============
@router.get("/platforms/{platform}/sound")
async def get_platform_sound(platform: str, user: dict = Depends(require_staff)):
    """Ο ήχος της πλατφόρμας: ο δικός του καταστήματος αν έχει ανέβει, αλλιώς ο
    προεπιλεγμένος που παράγει ο server. Το app τον κατεβάζει μία φορά και τον
    κρατά cached ως blob."""
    _platform_or_404(platform)
    fresh = await _fresh_user(user)
    custom = _settings_of(fresh)[platform]["sound"]
    if custom:
        try:
            head, b64 = custom.split(",", 1)
            mime = head.split(";")[0].replace("data:", "") or "audio/mpeg"
            return Response(content=base64.b64decode(b64), media_type=mime)
        except (ValueError, binascii.Error):
            pass  # χαλασμένο data URL — γύρνα στον προεπιλεγμένο
    return Response(content=platform_sound_wav(platform), media_type="audio/wav")


class SoundIn(BaseModel):
    data_url: str = Field(min_length=20)
    name: Optional[str] = Field(default=None, max_length=80)


@router.put("/platforms/{platform}/sound")
async def upload_platform_sound(
    platform: str,
    body: SoundIn,
    user: dict = Depends(require_feature("settings", require_owner)),
):
    _platform_or_404(platform)
    if not body.data_url.startswith("data:"):
        raise HTTPException(400, "Μη έγκυρο αρχείο ήχου")
    if len(body.data_url) > MAX_SOUND_B64:
        raise HTTPException(400, "Το αρχείο ήχου είναι πολύ μεγάλο (έως ~500KB)")
    mime = body.data_url.split(";")[0].replace("data:", "")
    if mime not in ALLOWED_SOUND_MIME:
        raise HTTPException(400, "Δεκτά αρχεία: mp3, wav, ogg")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            f"platform_settings.{platform}.sound": body.data_url,
            f"platform_settings.{platform}.sound_name": (body.name or "").strip(),
        }},
    )
    return {"platform": platform, "has_custom_sound": True}


@router.delete("/platforms/{platform}/sound")
async def reset_platform_sound(
    platform: str, user: dict = Depends(require_feature("settings", require_owner))
):
    """Επαναφορά στον προεπιλεγμένο ήχο του OrderDeck για την πλατφόρμα."""
    _platform_or_404(platform)
    await db.users.update_one(
        {"id": user["id"]},
        {"$unset": {
            f"platform_settings.{platform}.sound": "",
            f"platform_settings.{platform}.sound_name": "",
        }},
    )
    return {"platform": platform, "has_custom_sound": False}


# ============ ΠΑΡΑΓΓΕΛΙΕΣ ============
def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    doc.pop("raw", None)
    return doc


@router.get("/platforms/orders")
async def list_platform_orders(
    platform: Optional[str] = None,
    user: dict = Depends(require_feature("platforms", require_staff)),
):
    """Ενεργές παραγγελίες όλων (ή μίας) πλατφόρμας: εισερχόμενες + σε εξέλιξη.
    Ένα poll τροφοδοτεί ταυτόχρονα καρτέλες, badges, ήχο και popup."""
    q = {"user_id": user["id"], "status": {"$in": list(OPEN_STATUSES)}}
    if platform:
        q["platform"] = _platform_or_404(platform)
    docs = await db.platform_orders.find(q).sort("received_at", 1).to_list(300)
    return {"orders": [_clean(d) for d in docs], "as_of": datetime.now(timezone.utc).isoformat()}


@router.get("/platforms/orders/recent")
async def recent_platform_orders(
    platform: str,
    skip: int = 0,
    limit: int = 20,
    user: dict = Depends(require_feature("platforms", require_staff)),
):
    """«Πρόσφατες παραγγελίες» της πλατφόρμας — ολοκληρωμένες & απορριφθείσες."""
    _platform_or_404(platform)
    q = {
        "user_id": user["id"],
        "platform": platform,
        "status": {"$in": list(CLOSED_STATUSES)},
    }
    limit = max(1, min(limit, 50))
    docs = await db.platform_orders.find(q).sort("received_at", -1).skip(max(0, skip)).limit(limit).to_list(limit)
    total = await db.platform_orders.count_documents(q)
    return {"orders": [_clean(d) for d in docs], "total": total}


async def _get_order(user: dict, oid: str) -> dict:
    doc = await db.platform_orders.find_one({"id": oid, "user_id": user["id"]})
    if not doc:
        raise HTTPException(404, "Η παραγγελία δεν βρέθηκε")
    return doc


async def _create_pos_order(user: dict, po: dict, due_at: str) -> dict:
    """Η αποδεκτή παραγγελία πλατφόρμας γίνεται ΚΑΝΟΝΙΚΗ παραγγελία POS, ώστε να
    μετράει παντού (Ιστορικό, Z, Στατιστικά) με πηγή «efood/Box/Wolt»."""
    label = PLATFORM_LABELS[po["platform"]].upper()
    ref = f"{label} #{po['platform_order_id']}"
    items = []
    for it in po.get("items", []):
        opts = it.get("options") or []
        items.append({
            "item_id": "",
            "name": it["name"],
            "category": PLATFORM_LABELS[po["platform"]],
            "unit_price": it["unit_price"],
            "quantity": it["quantity"],
            "line_total": it["line_total"],
            "customization": {
                "selections": [{
                    "group_id": "platform",
                    "group_name": "Επιλογές",
                    "choices": [{"name": o, "price": 0.0} for o in opts],
                    "pool": [],
                }]
            } if opts else None,
        })
    cust = po.get("customer") or {}
    # Η εγγραφή στο orders ανήκει στο POS domain — περνά από τη διεπαφή του
    return await pos_api.create_external_order(
        user,
        source=PLATFORM_SOURCE[po["platform"]],
        items=items,
        subtotal=po.get("subtotal", 0),
        total=po.get("total", 0),
        note=po.get("note"),
        delivery_fee=po.get("delivery_fee"),
        delivery={
            "delivery_type": po.get("delivery_type") or "delivery",
            "name": cust.get("name") or None,
            "phone": cust.get("phone") or None,
            "address": cust.get("address") or None,
            "floor": cust.get("floor") or None,
        },
        platform=po["platform"],
        platform_ref=ref,
        platform_order_id=po["platform_order_id"],
        platform_due_at=due_at,
    )


class AcceptIn(BaseModel):
    ready_minutes: int = Field(default=DEFAULT_READY_MINUTES, ge=5, le=180)


@router.post("/platforms/orders/{oid}/accept")
async def accept_platform_order(
    oid: str,
    body: AcceptIn,
    user: dict = Depends(require_feature("platforms", require_staff)),
):
    po = await _get_order(user, oid)
    if po["status"] != STATUS_PENDING:
        raise HTTPException(409, "Η παραγγελία έχει ήδη απαντηθεί")
    conn = get_connector(po["platform"], user)
    try:
        extra = await conn.accept(po, body.ready_minutes)
    except PlatformUnavailable as e:
        raise HTTPException(409, e.message)
    now = datetime.now(timezone.utc)
    due = due_at_from(body.ready_minutes, now)
    order = await _create_pos_order(user, po, due)
    fields = {
        "status": STATUS_ACCEPTED,
        "accepted_at": now.isoformat(),
        "accepted_by": actor_name(user),
        "ready_minutes": body.ready_minutes,
        "due_at": due,
        "order_id": order["id"],
        "order_number": order["order_number"],
        **(extra or {}),
    }
    await db.platform_orders.update_one({"id": oid}, {"$set": fields})
    return {"platform_order": _clean({**po, **fields}), "order": order}


class RejectIn(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=200)


@router.post("/platforms/orders/{oid}/reject")
async def reject_platform_order(
    oid: str,
    body: RejectIn,
    user: dict = Depends(require_feature("platforms", require_staff)),
):
    po = await _get_order(user, oid)
    if po["status"] != STATUS_PENDING:
        raise HTTPException(409, "Η παραγγελία έχει ήδη απαντηθεί")
    conn = get_connector(po["platform"], user)
    try:
        await conn.reject(po, body.reason)
    except PlatformUnavailable as e:
        raise HTTPException(409, e.message)
    fields = {
        "status": STATUS_REJECTED,
        "rejected_reason": (body.reason or "").strip() or None,
        "rejected_by": actor_name(user),
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.platform_orders.update_one({"id": oid}, {"$set": fields})
    return _clean({**po, **fields})


class ReadyTimeIn(BaseModel):
    ready_minutes: int = Field(ge=5, le=180)


@router.post("/platforms/orders/{oid}/ready-time")
async def change_ready_time(
    oid: str,
    body: ReadyTimeIn,
    user: dict = Depends(require_feature("platforms", require_staff)),
):
    """Αλλαγή χρόνου παράδοσης μετά την αποδοχή — μετακινεί το countdown."""
    po = await _get_order(user, oid)
    if po["status"] not in (STATUS_ACCEPTED, STATUS_OUT):
        raise HTTPException(409, "Δεν αλλάζει χρόνος σε αυτή την κατάσταση")
    conn = get_connector(po["platform"], user)
    try:
        await conn.set_ready_time(po, body.ready_minutes)
    except PlatformUnavailable as e:
        raise HTTPException(409, e.message)
    base = po.get("accepted_at")
    try:
        base_dt = datetime.fromisoformat(base) if base else datetime.now(timezone.utc)
    except (TypeError, ValueError):
        base_dt = datetime.now(timezone.utc)
    fields = {"ready_minutes": body.ready_minutes, "due_at": due_at_from(body.ready_minutes, base_dt)}
    await db.platform_orders.update_one({"id": oid}, {"$set": fields})
    if po.get("order_id"):
        await pos_api.set_platform_due_at(user["id"], po["order_id"], fields["due_at"])
    return _clean({**po, **fields})


@router.post("/platforms/orders/{oid}/out-for-delivery")
async def out_for_delivery(
    oid: str, user: dict = Depends(require_feature("platforms", require_staff))
):
    """«ΚΑΘ' ΟΔΟΝ» — η κατάσταση φεύγει προς την πλατφόρμα και, αν η παραγγελία
    έχει ανέβει σε εταιρεία διανομής, ενημερώνεται και το FleetDeck."""
    po = await _get_order(user, oid)
    if po["status"] != STATUS_ACCEPTED:
        raise HTTPException(409, "Μόνο αποδεκτή παραγγελία μπαίνει καθ' οδόν")
    conn = get_connector(po["platform"], user)
    try:
        await conn.set_out_for_delivery(po)
    except PlatformUnavailable as e:
        raise HTTPException(409, e.message)
    now = datetime.now(timezone.utc).isoformat()
    fields = {"status": STATUS_OUT, "out_for_delivery_at": now}
    await db.platform_orders.update_one({"id": oid}, {"$set": fields})
    # FleetDeck: αν η ΙΔΙΑ παραγγελία POS έχει ανέβει σε συνεργαζόμενη εταιρεία
    # διανομής, σημειώνεται κι εκεί ότι έφυγε. Η ταύτιση γίνεται ΜΟΝΟ με τη ρητή
    # σύνδεση (source_pos_order_id) — ποτέ με τηλέφωνο/διεύθυνση.
    if po.get("order_id"):
        await fleet_api.mark_out_for_delivery(user["id"], po["order_id"], po["platform"])
    return _clean({**po, **fields})


@router.post("/platforms/orders/{oid}/complete")
async def complete_platform_order(
    oid: str, user: dict = Depends(require_feature("platforms", require_staff))
):
    """Ολοκλήρωση — φεύγει από τις «Σε εξέλιξη» και πάει στις «Πρόσφατες»."""
    po = await _get_order(user, oid)
    if po["status"] not in (STATUS_ACCEPTED, STATUS_OUT):
        raise HTTPException(409, "Η παραγγελία δεν είναι σε εξέλιξη")
    fields = {"status": STATUS_DONE, "completed_at": datetime.now(timezone.utc).isoformat()}
    await db.platform_orders.update_one({"id": oid}, {"$set": fields})
    return _clean({**po, **fields})


# ============ ΔΟΚΙΜΑΣΤΙΚΗ ΠΑΡΑΓΓΕΛΙΑ (dev/demo) ============
# Χωρίς πραγματικά API πλατφορμών, αυτό είναι το μοναδικό «εισερχόμενο κανάλι»:
# επιτρέπεται σε demo λογαριασμούς, με το admin password, ή με PLATFORM_TEST_ORDERS=1.
def _test_orders_allowed(user: dict, admin_password: Optional[str] = None) -> bool:
    if user.get("is_demo"):
        return True
    if os.environ.get("PLATFORM_TEST_ORDERS", "").strip() in ("1", "true", "yes"):
        return True
    expected = os.environ.get("PROMO_ADMIN_PASSWORD", "")
    return bool(admin_password and expected and secrets.compare_digest(admin_password, expected))


TEST_NAMES = ["Γιώργος Π.", "Μαρία Κ.", "Νίκος Α.", "Ελένη Δ.", "Κώστας Μ.", "Σοφία Ρ."]
TEST_STREETS = ["Ερμού 42", "Πατησίων 118", "Αγ. Δημητρίου 7", "Κύπρου 23", "Ηρώων Πολυτεχνείου 9"]
TEST_OPTIONS = ["χωρίς κρεμμύδι", "extra τζατζίκι", "από όλα", "χωρίς ντομάτα", "διπλή μερίδα"]


class TestOrderIn(BaseModel):
    platform: PlatformId
    items_count: int = Field(default=0, ge=0, le=8)


@router.post("/platforms/test-order")
async def create_test_order(
    body: TestOrderIn,
    user: dict = Depends(require_feature("platforms", require_staff)),
    x_admin_password: Optional[str] = Header(default=None),
):
    """Παράγει ρεαλιστική εισερχόμενη παραγγελία από το ΠΡΑΓΜΑΤΙΚΟ μενού του
    μαγαζιού, ώστε να δοκιμαστεί όλη η ροή: badge → ήχος → popup → αποδοχή →
    countdown → καθ' οδόν → εκτύπωση."""
    if not _test_orders_allowed(user, x_admin_password):
        raise HTTPException(403, "Οι δοκιμαστικές παραγγελίες δεν είναι ενεργές σε αυτόν τον λογαριασμό")
    menu = await pos_api.available_menu_items(user["id"])
    n = body.items_count or random.randint(1, 3)
    picks = random.sample(menu, min(n, len(menu))) if menu else []
    if not picks:
        picks = [{"name": "Δοκιμαστικό είδος", "price": 4.5}]
    items = []
    for m in picks:
        qty = random.randint(1, 2)
        price = round(float(m.get("price") or 0) or 4.5, 2)
        items.append({
            "name": m["name"],
            "quantity": qty,
            "unit_price": price,
            "line_total": round(price * qty, 2),
            "options": random.sample(TEST_OPTIONS, random.randint(0, 2)),
        })
    subtotal = round(sum(i["line_total"] for i in items), 2)
    fee = round(float(user.get("delivery_fee") or 0), 2)
    payload = {
        "platform_order_id": f"{body.platform[:1].upper()}{random.randint(10000, 99999)}",
        "delivery_type": "delivery",
        "payment": random.choice(["card", "cash"]),
        "customer": {
            "name": random.choice(TEST_NAMES),
            "phone": f"69{random.randint(10000000, 99999999)}",
            "address": f"{random.choice(TEST_STREETS)}, {user.get('store_city') or 'Αθήνα'}",
            "floor": str(random.randint(1, 5)),
        },
        "note": random.choice(["", "", "Κουδούνι χαλασμένο", "Χωρίς μαχαιροπίρουνα"]),
        "items": items,
        "subtotal": subtotal,
        "delivery_fee": fee,
        "total": round(subtotal + fee, 2),
        "is_test": True,
    }
    doc = await receive_order(db, user["id"], body.platform, payload)
    logger.info("ΔΟΚΙΜΑΣΤΙΚΗ παραγγελία %s για %s", doc["platform_order_id"], body.platform)
    return _clean(doc)
