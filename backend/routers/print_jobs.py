"""Ουρά εκτυπώσεων (print_jobs) για συσκευές χωρίς συνδεδεμένο εκτυπωτή.

Το web app (από οποιαδήποτε συσκευή — PC, tablet, iPad, κινητό) δημιουργεί
print_jobs αντί να ανοίξει browser print dialog. Δύο καταναλωτές της ουράς:

- print_mode="bridge": η desktop εφαρμογή OrderDeck Print Bridge (tray app στο
  PC του εκτυπωτή) κάνει poll με το bridge token του καταστήματος, τυπώνει
  raw ESC/POS στον θερμικό εκτυπωτή και κάνει ack (endpoints /print/bridge/*).
- print_mode="kiosk_relay": ο «σταθμός εκτύπωσης» είναι το ίδιο το web app στο
  kiosk PC (Chrome --kiosk-printing) — κάνει poll με το JWT του καταστήματος,
  claim-άρει jobs ατομικά, τα τυπώνει με window.print() και κάνει ack
  (endpoints /print/relay/*). Χωρίς desktop εφαρμογή.
"""
import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from core import db, get_current_user, require_owner, require_feature

router = APIRouter()

# ============ SSE: ειδοποίηση σταθμού τη στιγμή που δημιουργείται job ============
# In-process pub/sub ανά κατάστημα (ένα instance στο Render — αρκεί). Αν ο σταθμός
# δεν έχει ανοιχτό stream, το notify είναι no-op και τα jobs τα βρίσκει το poll.
_relay_listeners: dict[str, set] = {}
SSE_HEARTBEAT_SEC = 20  # κρατάει ζωντανή τη σύνδεση μέσα από proxies


def _relay_notify(user_id: str):
    for q in _relay_listeners.get(user_id, ()):
        try:
            q.put_nowait(1)
        except Exception:
            pass

MAX_TEXT_LEN = 20000  # ανά ticket — μια απόδειξη είναι λίγα KB
MAX_PAYLOAD_LEN = 30000  # δομημένο payload (order/slip/report) για το relay
JOB_TTL_HOURS = 24  # τα παλιά jobs καθαρίζονται στο poll
RELAY_CLAIM_RECOVER_SEC = 120  # claimed χωρίς ack → ξανά pending (κόλλησε ο σταθμός)
RELAY_PENDING_EXPIRE_MIN = 30  # pending που δεν τυπώθηκε ποτέ → failed (μην τυπωθεί backlog ωρών)
RELAY_BATCH = 5  # μέγιστα jobs ανά poll του σταθμού


# ============ Δημιουργία job από το web app (JWT καταστήματος) ============
class PrintJobIn(BaseModel):
    # Κάθε στοιχείο = ένα φυσικό ticket (κόβεται μετά από το καθένα).
    # Τα αντίγραφα/ετικέτες τα παράγει το frontend ως ξεχωριστά texts.
    texts: List[str] = Field(default_factory=list, max_length=10)
    kind: Literal["receipt", "kitchen", "zreport", "test"] = "receipt"
    # Kiosk Relay: δομημένα δεδομένα (order/slip/report) — ο σταθμός τα αποδίδει
    # με τα κανονικά receipt components για πλήρη ποιότητα εκτύπωσης.
    payload: Optional[dict] = None


@router.post("/print/jobs")
async def create_print_job(body: PrintJobIn, user: dict = Depends(get_current_user)):
    if not body.texts and not body.payload:
        raise HTTPException(400, "Κενή εκτύπωση")
    for t in body.texts:
        if len(t) > MAX_TEXT_LEN:
            raise HTTPException(400, "Πολύ μεγάλο περιεχόμενο εκτύπωσης")
    if body.payload is not None and len(json.dumps(body.payload)) > MAX_PAYLOAD_LEN:
        raise HTTPException(400, "Πολύ μεγάλο περιεχόμενο εκτύπωσης")
    job = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "kind": body.kind,
        "texts": body.texts,
        "payload": body.payload,
        "status": "pending",
        "error": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "claimed_at": None,
        "printed_at": None,
    }
    # Ένα γρήγορο insert και τίποτα άλλο πριν την απάντηση — η συσκευή που
    # πάτησε «εκτύπωση» δεν περιμένει. Το notify είναι σύγχρονο in-memory (μs).
    await db.print_jobs.insert_one(job)
    _relay_notify(user["id"])
    return {"id": job["id"], "status": "pending"}


@router.get("/print/jobs/stream")
async def print_jobs_stream(user: dict = Depends(get_current_user)):
    """SSE stream του σταθμού εκτύπωσης: event `job` μόλις δημιουργηθεί print_job
    του καταστήματος. Ο σταθμός κάνει αμέσως relay poll (το claim μένει ατομικό
    στο /print/relay/poll). Δηλωμένο ΠΡΙΝ το /print/jobs/{jid} για να μην
    πιαστεί το «stream» ως job id."""
    user_id = user["id"]
    queue: asyncio.Queue = asyncio.Queue()
    _relay_listeners.setdefault(user_id, set()).add(queue)

    async def gen():
        try:
            yield "retry: 2000\n\n"
            while True:
                try:
                    await asyncio.wait_for(queue.get(), timeout=SSE_HEARTBEAT_SEC)
                    # burst από πολλά jobs → ένα event (ο σταθμός θα τα πάρει όλα σε ένα poll)
                    while not queue.empty():
                        queue.get_nowait()
                    yield "event: job\ndata: 1\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            listeners = _relay_listeners.get(user_id)
            if listeners is not None:
                listeners.discard(queue)
                if not listeners:
                    _relay_listeners.pop(user_id, None)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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
        {"_id": 0, "user_id": 0, "payload": 0},
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


# ============ Kiosk Relay — ο σταθμός εκτύπωσης είναι το web app στο kiosk PC ============
# Auth: κανονικό JWT καταστήματος (οποιοδήποτε προφίλ — το kiosk PC είναι το ταμείο).

def _athens_midnight_utc_iso() -> str:
    """Αρχή της σημερινής ημέρας (ώρα Ελλάδας) σε UTC isoformat — για το «N εκτυπώσεις σήμερα»."""
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo("Europe/Athens")
    except Exception:
        tz = timezone.utc
    midnight = datetime.now(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight.astimezone(timezone.utc).isoformat()


@router.post("/print/relay/poll")
async def relay_poll(user: dict = Depends(get_current_user)):
    """Poll του σταθμού εκτύπωσης: claim-άρει ατομικά έως RELAY_BATCH pending jobs
    (ένα job δεν τυπώνεται ποτέ δύο φορές — αλλάζει σε claimed ΠΡΙΝ επιστραφεί)
    και επιστρέφει αποτυχημένα + μετρητή ημέρας για το status indicator."""
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"print_relay_last_seen": now.isoformat()}}
    )
    # Καθαρισμός παλιών jobs (ίδιο TTL με το bridge)
    cutoff = (now - timedelta(hours=JOB_TTL_HOURS)).isoformat()
    await db.print_jobs.delete_many({"user_id": user["id"], "created_at": {"$lt": cutoff}})
    # Ανάκτηση: claimed που δεν έγιναν ποτέ ack (κόλλησε/έκλεισε ο σταθμός) → ξανά pending
    stuck = (now - timedelta(seconds=RELAY_CLAIM_RECOVER_SEC)).isoformat()
    await db.print_jobs.update_many(
        {"user_id": user["id"], "status": "claimed", "claimed_at": {"$lt": stuck}},
        {"$set": {"status": "pending", "claimed_at": None}},
    )
    # Μπαγιάτικα pending (ο σταθμός ήταν κλειστός ώρα) → failed, όχι εκτύπωση backlog
    expired = (now - timedelta(minutes=RELAY_PENDING_EXPIRE_MIN)).isoformat()
    await db.print_jobs.update_many(
        {"user_id": user["id"], "status": "pending", "created_at": {"$lt": expired}},
        {"$set": {"status": "failed", "error": "Έληξε — ο σταθμός ήταν κλειστός όταν στάλθηκε"}},
    )
    # Ατομικό claim: pending → claimed πριν δοθεί στον σταθμό
    jobs = []
    for _ in range(RELAY_BATCH):
        job = await db.print_jobs.find_one_and_update(
            {"user_id": user["id"], "status": "pending"},
            {"$set": {"status": "claimed", "claimed_at": now.isoformat()}},
            sort=[("created_at", 1)],
            projection={"_id": 0, "user_id": 0},
            return_document=ReturnDocument.AFTER,
        )
        if not job:
            break
        jobs.append(job)
    failed = await db.print_jobs.find(
        {"user_id": user["id"], "status": "failed"},
        {"_id": 0, "user_id": 0, "texts": 0, "payload": 0},
    ).sort("created_at", -1).to_list(10)
    printed_today = await db.print_jobs.count_documents(
        {"user_id": user["id"], "status": "printed", "printed_at": {"$gte": _athens_midnight_utc_iso()}}
    )
    return {"jobs": jobs, "failed": failed, "printed_today": printed_today}


class RelayAckIn(BaseModel):
    status: Literal["printed", "failed"]
    error: Optional[str] = None


@router.post("/print/relay/jobs/{jid}/ack")
async def relay_ack_job(jid: str, body: RelayAckIn, user: dict = Depends(get_current_user)):
    res = await db.print_jobs.update_one(
        {"id": jid, "user_id": user["id"]},
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


@router.post("/print/relay/jobs/{jid}/retry")
async def relay_retry_job(jid: str, user: dict = Depends(get_current_user)):
    """Επανεκτύπωση αποτυχημένου job από τον σταθμό — γίνεται ξανά pending
    (με φρέσκο created_at ώστε να μην ξανακοπεί ως ληγμένο) και το επόμενο
    poll το claim-άρει κανονικά."""
    res = await db.print_jobs.update_one(
        {"id": jid, "user_id": user["id"], "status": "failed"},
        {
            "$set": {
                "status": "pending",
                "error": None,
                "claimed_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Δεν βρέθηκε")
    return {"ok": True}


@router.get("/print/relay/status")
async def relay_status(user: dict = Depends(get_current_user)):
    """Πότε έκανε τελευταίο poll ο σταθμός — για το warning banner στις άλλες
    συσκευές («Ο σταθμός εκτύπωσης φαίνεται κλειστός»)."""
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "print_relay_last_seen": 1})
    return {"last_seen": (u or {}).get("print_relay_last_seen")}
