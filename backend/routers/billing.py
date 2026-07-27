"""Συνδρομή (self-service ιδιοκτήτη): τρέχον πλάνο, add-ons, αιτήματα αλλαγής.

Η χρέωση είναι χειροκίνητη (μέχρι να μπει Stripe): το αίτημα αποθηκεύεται στον
λογαριασμό (billing_request) και εμφανίζεται στο admin panel για έγκριση.
"""
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import db, require_owner

router = APIRouter()

# Τιμοκατάλογος (πληροφοριακά — η χρέωση γίνεται χειροκίνητα από τον διαχειριστή).
# FleetDeck/OrderDeck Fleet: χωρίς σταθερή τιμή εδώ (κλιμακωτή/συνδυαστική) → None.
PLAN_PRICES_EUR = {"orderdeck": "20,00"}
# Το FleetDeck έγινε αυτόνομο πλάνο — μοναδικό add-on πλέον το DeckPilot AI,
# «Σύντομα διαθέσιμο»: χωρίς τιμή στο UI μέχρι να βγει ο AI βοηθός.
ADDONS = {
    "deckpilot": {"label": "DeckPilot AI", "coming_soon": True},
}


def _subscription_view(u: dict) -> dict:
    addons_state = u.get("addons") or {}
    plan = u.get("plan") or "orderdeck"
    return {
        "plan": plan,
        "plan_price_eur": PLAN_PRICES_EUR.get(plan),
        "subscription_expires_at": u.get("subscription_expires_at"),
        "payment_status": u.get("payment_status") or "pending",
        "addons": {
            key: {**meta, "active": bool(addons_state.get(key))}
            for key, meta in ADDONS.items()
        },
        "pending_request": u.get("billing_request"),
    }


@router.get("/billing/subscription")
async def get_subscription(user: dict = Depends(require_owner)):
    u = await db.users.find_one(
        {"id": user["id"]},
        {"_id": 0, "plan": 1, "subscription_expires_at": 1, "payment_status": 1,
         "addons": 1, "billing_request": 1},
    )
    return _subscription_view(u or {})


class BillingChangeIn(BaseModel):
    addon: Literal["deckpilot"]
    action: Literal["add", "remove"]


@router.post("/billing/request-change")
async def request_billing_change(body: BillingChangeIn, user: dict = Depends(require_owner)):
    """Αίτημα ενεργοποίησης/απενεργοποίησης add-on — εγκρίνεται χειροκίνητα από τον
    διαχειριστή της πλατφόρμας. Ένα εκκρεμές αίτημα κάθε φορά (το νέο αντικαθιστά)."""
    if ADDONS[body.addon].get("coming_soon"):
        raise HTTPException(400, "Το add-on θα είναι σύντομα διαθέσιμο")
    req = {
        "id": str(uuid.uuid4())[:8],
        "addon": body.addon,
        "addon_label": ADDONS[body.addon]["label"],
        "action": body.action,
        "status": "pending",
        "requested_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.update_one({"id": user["id"]}, {"$set": {"billing_request": req}})
    return {"ok": True, "pending_request": req}


@router.delete("/billing/request-change")
async def cancel_billing_request(user: dict = Depends(require_owner)):
    """Ακύρωση του εκκρεμούς αιτήματος από τον ίδιο τον ιδιοκτήτη."""
    res = await db.users.update_one(
        {"id": user["id"], "billing_request": {"$ne": None}},
        {"$set": {"billing_request": None}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Δεν υπάρχει εκκρεμές αίτημα")
    return {"ok": True}
