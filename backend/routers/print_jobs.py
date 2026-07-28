"""Print Bridge: ουρά εκτυπώσεων (print_jobs) για καταστήματα χωρίς kiosk PC.

Το web app (από οποιαδήποτε συσκευή — PC, tablet, iPad, κινητό) δημιουργεί
print_jobs αντί να ανοίξει browser print dialog όταν ο λογαριασμός έχει
print_mode="bridge". Η desktop εφαρμογή OrderDeck Print Bridge (tray app στο
PC του εκτυπωτή) κάνει poll με το bridge token του καταστήματος, τυπώνει
raw ESC/POS στον θερμικό εκτυπωτή και κάνει ack.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from core import db, get_current_user, require_owner, require_feature

router = APIRouter()

MAX_TEXT_LEN = 20000  # ανά ticket — μια απόδειξη είναι λίγα KB
JOB_TTL_HOURS = 24  # τα παλιά jobs καθαρίζονται στο poll


# ============ Δημιουργία job από το web app (JWT καταστήματος) ============
class PrintJobIn(BaseModel):
    # Κάθε στοιχείο = ένα φυσικό ticket (κόβεται μετά από το καθένα).
    # Τα αντίγραφα/ετικέτες τα παράγει το frontend ως ξεχωριστά texts.
    texts: List[str] = Field(min_length=1, max_length=10)
    kind: Literal["receipt", "kitchen", "zreport", "test"] = "receipt"


@router.post("/print/jobs")
async def create_print_job(body: PrintJobIn, user: dict = Depends(get_current_user)):
    for t in body.texts:
        if len(t) > MAX_TEXT_LEN:
            raise HTTPException(400, "Πολύ μεγάλο περιεχόμενο εκτύπωσης")
    job = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "kind": body.kind,
        "texts": body.texts,
        "status": "pending",
        "error": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "printed_at": None,
    }
    await db.print_jobs.insert_one(job)
    job.pop("_id", None)
    return {"id": job["id"], "status": "pending"}


@router.get("/print/jobs/{jid}")
async def get_print_job(jid: str, user: dict = Depends(get_current_user)):
    """Κατάσταση job — το χρησιμοποιεί η «Δοκιμαστική εκτύπωση» των ρυθμίσεων."""
    job = await db.print_jobs.find_one(
        {"id": jid, "user_id": user["id"]}, {"_id": 0, "texts": 0}
    )
    if not job:
        raise HTTPException(404, "Δεν βρέθηκε")
    return job


# ============ Bridge token (μόνο ιδιοκτήτης, στις Ρυθμίσεις) ============
@router.get("/print/bridge/token")
async def get_bridge_token(user: dict = Depends(require_feature("settings", require_owner))):
    u = await db.users.find_one(
        {"id": user["id"]},
        {"_id": 0, "print_bridge_token": 1, "print_bridge_last_seen": 1},
    )
    return {
        "token": (u or {}).get("print_bridge_token"),
        "last_seen": (u or {}).get("print_bridge_last_seen"),
    }


@router.post("/print/bridge/token")
async def rotate_bridge_token(user: dict = Depends(require_feature("settings", require_owner))):
    """Δημιουργία/αντικατάσταση token — το παλιό παύει να ισχύει αμέσως."""
    token = "odb_" + uuid.uuid4().hex + uuid.uuid4().hex[:8]
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"print_bridge_token": token, "print_bridge_last_seen": None}},
    )
    return {"token": token}


# ============ Endpoints της desktop εφαρμογής (auth με X-Bridge-Token) ============
async def bridge_store(x_bridge_token: Optional[str] = Header(None)) -> dict:
    if not x_bridge_token:
        raise HTTPException(401, "Λείπει το bridge token")
    u = await db.users.find_one(
        {"print_bridge_token": x_bridge_token},
        {"_id": 0, "id": 1, "restaurant_name": 1},
    )
    if not u:
        raise HTTPException(401, "Άκυρο bridge token")
    return u


@router.get("/print/bridge/jobs")
async def bridge_poll_jobs(store: dict = Depends(bridge_store)):
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"id": store["id"]}, {"$set": {"print_bridge_last_seen": now.isoformat()}}
    )
    # Καθαρισμός παλιών jobs του καταστήματος (ό,τι κι αν απέγιναν)
    cutoff = (now - timedelta(hours=JOB_TTL_HOURS)).isoformat()
    await db.print_jobs.delete_many({"user_id": store["id"], "created_at": {"$lt": cutoff}})
    jobs = await db.print_jobs.find(
        {"user_id": store["id"], "status": "pending"},
        {"_id": 0, "user_id": 0},
    ).sort("created_at", 1).to_list(10)
    return {"store_name": store.get("restaurant_name") or "", "jobs": jobs}


class BridgeAckIn(BaseModel):
    status: Literal["printed", "failed"]
    error: Optional[str] = None


@router.post("/print/bridge/jobs/{jid}/ack")
async def bridge_ack_job(jid: str, body: BridgeAckIn, store: dict = Depends(bridge_store)):
    res = await db.print_jobs.update_one(
        {"id": jid, "user_id": store["id"]},
        {
            "$set": {
                "status": body.status,
                "error": (body.error or "")[:500] or None,
                "printed_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Δεν βρέθηκε")
    return {"ok": True}
