"""Επίπεδο ενσωμάτωσης πλατφορμών delivery (efood / Box / Wolt).

ΚΑΜΙΑ πραγματική σύνδεση με API πλατφόρμας δεν υπάρχει ακόμη. Ό,τι κάνει το POS
περνά από έναν connector· σήμερα όλοι είναι ο NullConnector (τοπική λειτουργία).
Όταν αύριο υπάρξει πραγματικό API, γράφεται ΜΟΝΟ μια υποκλάση εδώ και δηλώνεται
με register_connector — τίποτα στο router/UI δεν αλλάζει.

Καθαρή εσωτερική διεπαφή:
  receive_order()          εισερχόμενη παραγγελία (πλατφόρμα → POS)
  accept()/reject()        απάντηση στην παραγγελία
  set_ready_time()         αλλαγή χρόνου παράδοσης
  set_out_for_delivery()   «καθ' οδόν»
  set_store_open()         άνοιγμα/κλείσιμο καταστήματος στην πλατφόρμα

Κάθε connector δηλώνει capabilities: ό,τι δεν υποστηρίζει η πλατφόρμα γυρίζει
PlatformUnavailable και το UI το δείχνει απενεργοποιημένο («μη διαθέσιμο από
την πλατφόρμα») αντί να αποτύχει σιωπηλά.
"""
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger("orderdeck.platforms")

PLATFORMS = ("efood", "box", "wolt")
PLATFORM_LABELS = {"efood": "efood", "box": "Box", "wolt": "Wolt"}
# Η «Πηγή» με την οποία γράφεται η παραγγελία στο POS (Ιστορικό, Z, Στατιστικά)
PLATFORM_SOURCE = {"efood": "efood", "box": "Box", "wolt": "Wolt"}
# Προεπιλεγμένος χρόνος παράδοσης + τα presets των κουμπιών
DEFAULT_READY_MINUTES = 30
READY_PRESETS = (20, 30, 40, 50)

# Καταστάσεις: εκκρεμής → αποδεκτή → καθ' οδόν → ολοκληρωμένη· ή απορριφθείσα
STATUS_PENDING = "pending"
STATUS_ACCEPTED = "accepted"
STATUS_OUT = "out_for_delivery"
STATUS_DONE = "delivered"
STATUS_REJECTED = "rejected"
OPEN_STATUSES = (STATUS_PENDING, STATUS_ACCEPTED, STATUS_OUT)
CLOSED_STATUSES = (STATUS_DONE, STATUS_REJECTED)


class PlatformUnavailable(Exception):
    """Η ενέργεια δεν υποστηρίζεται (ακόμη) από την πλατφόρμα."""

    def __init__(self, message: str = "μη διαθέσιμο από την πλατφόρμα"):
        super().__init__(message)
        self.message = message


class PlatformConnector:
    """Βάση κάθε σύνδεσης πλατφόρμας. Οι μέθοδοι επιστρέφουν dict με ό,τι πρέπει
    να γραφτεί επιπλέον στην παραγγελία (π.χ. remote ids) — {} όταν δεν χρειάζεται."""

    platform = ""
    # Τι υποστηρίζει πραγματικά η πλατφόρμα. Ο NullConnector δηλώνει store_open=False:
    # χωρίς API δεν μπορούμε να ανοίξουμε/κλείσουμε μαγαζί στο efood από εδώ.
    capabilities = {
        "accept": True,
        "reject": True,
        "ready_time": True,
        "out_for_delivery": True,
        "store_open": False,
    }

    def __init__(self, user: dict):
        self.user = user

    def supports(self, key: str) -> bool:
        return bool(self.capabilities.get(key))

    def _require(self, key: str) -> None:
        if not self.supports(key):
            raise PlatformUnavailable()

    async def accept(self, order: dict, ready_minutes: int) -> dict:
        self._require("accept")
        return {}

    async def reject(self, order: dict, reason: Optional[str] = None) -> dict:
        self._require("reject")
        return {}

    async def set_ready_time(self, order: dict, ready_minutes: int) -> dict:
        self._require("ready_time")
        return {}

    async def set_out_for_delivery(self, order: dict) -> dict:
        self._require("out_for_delivery")
        return {}

    async def set_store_open(self, is_open: bool) -> dict:
        self._require("store_open")
        return {}


class NullConnector(PlatformConnector):
    """Χωρίς σύνδεση: όλες οι ενέργειες μένουν τοπικές στο OrderDeck.

    Οι αλλαγές κατάστασης καταγράφονται κανονικά (και φτάνουν στο FleetDeck αν η
    παραγγελία ανέβει εκεί) — απλώς δεν ταξιδεύουν προς την πλατφόρμα.
    """

    async def accept(self, order: dict, ready_minutes: int) -> dict:
        logger.info(
            "platform=%s order=%s ΑΠΟΔΟΧΗ (%s') — τοπικά, χωρίς σύνδεση πλατφόρμας",
            self.platform, order.get("platform_order_id"), ready_minutes,
        )
        return {}

    async def reject(self, order: dict, reason: Optional[str] = None) -> dict:
        logger.info(
            "platform=%s order=%s ΑΠΟΡΡΙΨΗ (%s) — τοπικά",
            self.platform, order.get("platform_order_id"), reason or "—",
        )
        return {}


_REGISTRY: dict[str, type] = {}


def register_connector(platform: str, cls: type) -> None:
    _REGISTRY[platform] = cls


def get_connector(platform: str, user: dict) -> PlatformConnector:
    cls = _REGISTRY.get(platform)
    if cls is None:
        cls = type(f"Null{platform.title()}", (NullConnector,), {"platform": platform})
        _REGISTRY[platform] = cls
    return cls(user)


def capabilities_for(platform: str, user: dict) -> dict:
    return dict(get_connector(platform, user).capabilities)


# ============ ΕΙΣΕΡΧΟΜΕΝΗ ΠΑΡΑΓΓΕΛΙΑ (πλατφόρμα → POS) ============
def normalize_incoming(user_id: str, platform: str, payload: dict) -> dict:
    """Κανονικοποιεί ό,τι στέλνει ο connector σε ΕΝΑ σχήμα platform_orders.

    Το μοναδικό σημείο που ξέρει τη μορφή του εγγράφου — connectors και δοκιμαστικές
    παραγγελίες περνούν από εδώ, οπότε το υπόλοιπο σύστημα βλέπει πάντα το ίδιο.
    """
    now = datetime.now(timezone.utc)
    items = []
    for raw in payload.get("items") or []:
        qty = int(raw.get("quantity") or 1)
        unit = round(float(raw.get("unit_price") or 0), 2)
        items.append({
            "name": str(raw.get("name") or "Είδος")[:120],
            "quantity": qty,
            "unit_price": unit,
            "line_total": round(float(raw.get("line_total") or unit * qty), 2),
            "options": [str(o)[:80] for o in (raw.get("options") or [])][:20],
            "note": (raw.get("note") or None),
        })
    subtotal = round(
        float(payload.get("subtotal") or sum(i["line_total"] for i in items)), 2
    )
    delivery_fee = round(float(payload.get("delivery_fee") or 0), 2)
    discount = round(float(payload.get("discount") or 0), 2)
    total = round(float(payload.get("total") or subtotal + delivery_fee - discount), 2)
    cust = payload.get("customer") or {}
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "platform": platform,
        "platform_order_id": str(payload.get("platform_order_id") or "")[:40]
        or f"{platform[:1].upper()}{random.randint(100000, 999999)}",
        "status": STATUS_PENDING,
        "delivery_type": "takeaway" if payload.get("delivery_type") == "takeaway" else "delivery",
        "payment": "cash" if payload.get("payment") == "cash" else "card",
        "customer": {
            "name": (cust.get("name") or "")[:80],
            "phone": (cust.get("phone") or "")[:40],
            "address": (cust.get("address") or "")[:200],
            "floor": (cust.get("floor") or "")[:40],
            "bell": (cust.get("bell") or "")[:40],
        },
        "note": (payload.get("note") or "")[:300],
        "items": items,
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "discount": discount,
        "total": total,
        "received_at": now.isoformat(),
        "accepted_at": None,
        "ready_minutes": None,
        "due_at": None,
        "out_for_delivery_at": None,
        "completed_at": None,
        "rejected_reason": None,
        # Σύνδεση με την παραγγελία του POS που δημιουργείται στην ΑΠΟΔΟΧΗ
        "order_id": None,
        "order_number": None,
        "is_test": bool(payload.get("is_test")),
        # Ό,τι έστειλε η πλατφόρμα, αυτούσιο — για μελλοντικό debugging connectors
        "raw": payload.get("raw") or {},
    }


async def receive_order(db, user_id: str, platform: str, payload: dict) -> dict:
    """Καταχώρηση εισερχόμενης παραγγελίας. Το ΜΟΝΟ σημείο εισόδου: εδώ θα
    καλέσει ο webhook/poller κάθε μελλοντικού connector."""
    doc = normalize_incoming(user_id, platform, payload)
    await db.platform_orders.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


def due_at_from(minutes: int, base: Optional[datetime] = None) -> str:
    return ((base or datetime.now(timezone.utc)) + timedelta(minutes=minutes)).isoformat()
