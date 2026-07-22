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

# Τιμοκατάλογος (πληροφοριακά — η χρέωση γίνεται χειροκίνητα από τον διαχειριστή)
PLAN_PRICE_EUR = "20,00"
ADDONS = {
    "deckpilot": {"label": "DeckPilot AI", "price_eur": "9,90"},
    "fleet": {"label": "Fleet", "price_eur": "5,00"},
}


def _subscription_view(u: dict) -> dict:
    addons_state = u.get("addons") or {}
    plan = u.get("plan") or "trial"
    return {
        "plan": plan,
        "plan_price_eur": PLAN_PRICE_EUR,
        "subscription_expires_at": u.get("subscription_expires_at"),
        "payment_status": u.get("payment_status") or "pending",
        "addons": {
            key: {
                **meta,
                # Το παλιό πλάνο "pro_deckpilot" μετρά ως ενεργό DeckPilot add-on
                "active": bool(addons_state.get(key))
                or (key == "deckpilot" and plan == "pro_deckpilot"),
            }
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
    addon: Literal["deckpilot", "fleet"]
    action: Literal["add", "remove"]


@router.post("/billing/request-change")
async def request_billing_change(body: BillingChangeIn, user: dict = Depends(require_owner)):
    """Αίτημα ενεργοποίησης/απενεργοποίησης add-on — εγκρίνεται χειροκίνητα από τον
    διαχειριστή της πλατφόρμας. Ένα εκκρεμές αίτημα κάθε φορά (το νέο αντικαθιστά)."""
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
