"""ΔΗΜΟΣΙΑ ΔΙΕΠΑΦΗ του domain «admin» (back-office πλατφόρμας).

ΚΑΝΟΝΑΣ: κανένα άλλο domain δεν αγγίζει τα collections του admin
(promo_codes, demo_leads, stock_photos, announcements, admin_*) απευθείας.
Το admin, από την πλευρά του, διαβάζει τα υπόλοιπα domains ΜΟΝΟ μέσω των
δικών τους api modules — δεν έχει προνόμιο παράκαμψης.
"""
from datetime import datetime, timezone
from typing import Optional

from shared.core import db


# ============ ΕΚΠΤΩΤΙΚΟΙ ΚΩΔΙΚΟΙ (εγγραφή) ============
async def redeem_promo(code: str) -> dict:
    """Εξαργύρωση κωδικού κατά την εγγραφή — σφάλμα αν δεν ισχύει."""
    from admin.promo import redeem_promo as _r
    return await _r(code)


def promo_description(p: dict) -> str:
    from admin.promo import promo_description as _d
    return _d(p)


# ============ LEADS ============
async def record_demo_lead(email: str, business_name: str, business_type: str) -> None:
    """Lead capture από το demo — ξεχωριστό collection, διατηρείται και μετά τη
    διαγραφή του demo λογαριασμού."""
    import uuid
    await db.demo_leads.insert_one({
        "id": str(uuid.uuid4()),
        "email": (email or "").lower(),
        "business_name": (business_name or "").strip(),
        "business_type": business_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ============ ΒΙΒΛΙΟΘΗΚΗ ΦΩΤΟΓΡΑΦΙΩΝ ORDERDECK ============
async def get_stock_photo(stock_id: str) -> Optional[dict]:
    """Μία φωτογραφία της κοινής βιβλιοθήκης — None αν δεν υπάρχει."""
    return await db.stock_photos.find_one({"id": stock_id}, {"_id": 0})
