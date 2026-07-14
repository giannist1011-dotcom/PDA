"""Κοινή βιβλιοθήκη stock φωτογραφιών προϊόντων (OrderDeck).

Οι stock φωτογραφίες είναι ΚΟΙΝΟΧΡΗΣΤΕΣ (χωρίς user_id), οργανωμένες ανά τύπο
επιχείρησης (business_type). Τις διαχειρίζεται ΜΟΝΟ ο διαχειριστής του OrderDeck
μέσω του ίδιου admin password gate με τους εκπτωτικούς κωδικούς (X-Admin-Password).

Τα μαγαζιά τις βλέπουν read-only, φιλτραρισμένες στον δικό τους business_type,
και όταν επιλέξουν μία γίνεται προσωπικό αντίγραφο (δες menu.import_stock_photo).
"""
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from core import db, get_current_user
from routers.promo import require_admin

router = APIRouter()

BusinessType = Literal["souvlaki", "cafe", "pizzeria", "burger"]


# ============ MODELS ============
class StockPhotoIn(BaseModel):
    business_type: BusinessType
    product_label: str = Field(min_length=1, max_length=80)
    data_url: str = Field(min_length=10, max_length=6_000_000)  # cap ~6MB base64


def public_stock_photo(p: dict) -> dict:
    return {
        "id": p["id"],
        "business_type": p["business_type"],
        "product_label": p.get("product_label", ""),
        "data_url": p["data_url"],
        "uploaded_at": p.get("uploaded_at"),
    }


# ============ ADMIN (ξεχωριστό password, όχι λογαριασμοί μαγαζιών) ============
@router.get("/admin/stock-photos")
async def admin_list_stock_photos(
    business_type: Optional[str] = None,
    x_admin_password: Optional[str] = Header(None),
):
    require_admin(x_admin_password)
    q = {}
    if business_type:
        q["business_type"] = business_type
    docs = (
        await db.stock_photos.find(q, {"_id": 0})
        .sort("uploaded_at", -1)
        .to_list(2000)
    )
    return [public_stock_photo(d) for d in docs]


@router.post("/admin/stock-photos")
async def admin_create_stock_photo(
    body: StockPhotoIn, x_admin_password: Optional[str] = Header(None)
):
    require_admin(x_admin_password)
    if not body.data_url.startswith("data:image/"):
        raise HTTPException(400, "Δεν είναι εικόνα (data URL)")
    doc = {
        "id": str(uuid.uuid4()),
        "business_type": body.business_type,
        "product_label": body.product_label.strip(),
        "data_url": body.data_url,
        "size_bytes": len(body.data_url),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.stock_photos.insert_one(doc)
    return public_stock_photo(doc)


@router.delete("/admin/stock-photos/{pid}")
async def admin_delete_stock_photo(
    pid: str, x_admin_password: Optional[str] = Header(None)
):
    require_admin(x_admin_password)
    res = await db.stock_photos.delete_one({"id": pid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Η φωτογραφία δεν βρέθηκε")
    return {"ok": True}


# ============ ΜΑΓΑΖΙΑ (read-only, φιλτραρισμένες στον τύπο τους) ============
@router.get("/stock-photos")
async def list_stock_photos_for_shop(user: dict = Depends(get_current_user)):
    bt = user.get("business_type") or "souvlaki"
    docs = (
        await db.stock_photos.find({"business_type": bt}, {"_id": 0})
        .sort("uploaded_at", -1)
        .to_list(2000)
    )
    return [public_stock_photo(d) for d in docs]
