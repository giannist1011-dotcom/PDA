"""ΔΗΜΟΣΙΑ ΔΙΕΠΑΦΗ του domain «platforms» (efood / Box / Wolt).

ΚΑΝΟΝΑΣ: κανένα άλλο domain δεν αγγίζει το platform_orders απευθείας. Το
platforms μιλάει στο POS ΜΟΝΟ μέσω του pos.api και στο FleetDeck ΜΟΝΟ μέσω
του fleet.api.
"""
from shared.core import db


async def purge_store_data(user_id: str) -> None:
    """Διαγραφή λογαριασμού: οι εισερχόμενες παραγγελίες πλατφορμών του μαγαζιού."""
    await db.platform_orders.delete_many({"user_id": user_id})
