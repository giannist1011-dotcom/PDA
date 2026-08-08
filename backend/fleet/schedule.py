"""FleetDeck — εβδομαδιαίο πρόγραμμα μελών εταιρείας (διαχειριστής + διανομείς).

Ίδια σημειολογία με το πρόγραμμα του OrderDeck (pos/schedule.py): οι βάρδιες
αποθηκεύονται ανά week_start (Δευτέρα), οι παλιές εβδομάδες μένουν ως ιστορικό
και είναι ΜΟΝΟ για προβολή. Ξεχωριστή collection από το `fleet_shifts` — εκείνο
κρατά τις ΠΡΑΓΜΑΤΙΚΕΣ βάρδιες («Ξεκινάω/Τέλος βάρδιας») για τα στατιστικά, εδώ
είναι ο ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΣ.
"""
import uuid
from datetime import date as date_cls, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from shared.core import athens_now, db

from fleet.company import require_fleet_admin

router = APIRouter()


def _current_week_start() -> str:
    """Η Δευτέρα της τρέχουσας εβδομάδας (ημέρα Ελλάδας, YYYY-MM-DD)."""
    today = athens_now().date()
    return (today - timedelta(days=today.weekday())).isoformat()


def _prev_week_start(week_start: str) -> str:
    try:
        d = date_cls.fromisoformat(week_start)
    except ValueError:
        raise HTTPException(400, "Μη έγκυρη εβδομάδα")
    return (d - timedelta(days=7)).isoformat()


def _reject_past_week(week_start: str):
    if week_start < _current_week_start():
        raise HTTPException(
            403, "Το πρόγραμμα περασμένων εβδομάδων είναι μόνο για προβολή"
        )


class RosterShiftIn(BaseModel):
    member_id: str
    week_start: str          # YYYY-MM-DD (Δευτέρα)
    day: int = Field(ge=0, le=6)  # 0=Δευ .. 6=Κυρ
    start: str               # HH:MM
    end: str                 # HH:MM


class RosterAutofillIn(BaseModel):
    week_start: str
    source_week_start: Optional[str] = None


@router.get("/fleet/schedule/weeks")
async def fleet_list_schedule_weeks(team: dict = Depends(require_fleet_admin)):
    """Εβδομάδες με καταχωρημένες βάρδιες — για το ιστορικό."""
    weeks = await db.fleet_roster_shifts.distinct("week_start", {"team_id": team["id"]})
    return {"weeks": sorted(weeks, reverse=True), "current": _current_week_start()}


@router.get("/fleet/schedule")
async def fleet_list_schedule(week_start: str, team: dict = Depends(require_fleet_admin)):
    return await db.fleet_roster_shifts.find(
        {"team_id": team["id"], "week_start": week_start},
        {"_id": 0, "team_id": 0},
    ).to_list(1000)


@router.put("/fleet/schedule")
async def fleet_upsert_schedule_shift(
    body: RosterShiftIn, team: dict = Depends(require_fleet_admin)
):
    _reject_past_week(body.week_start)
    member = await db.fleet_members.find_one({"id": body.member_id, "team_id": team["id"]})
    if not member:
        raise HTTPException(404, "Το μέλος δεν βρέθηκε")
    key = {
        "team_id": team["id"],
        "member_id": body.member_id,
        "week_start": body.week_start,
        "day": body.day,
    }
    await db.fleet_roster_shifts.update_one(
        key,
        {
            "$set": {"start": body.start.strip(), "end": body.end.strip()},
            "$setOnInsert": {"id": str(uuid.uuid4()), **key},
        },
        upsert=True,
    )
    return await db.fleet_roster_shifts.find_one(key, {"_id": 0, "team_id": 0})


@router.delete("/fleet/schedule")
async def fleet_delete_schedule_shift(
    member_id: str,
    week_start: str,
    day: int,
    team: dict = Depends(require_fleet_admin),
):
    _reject_past_week(week_start)
    r = await db.fleet_roster_shifts.delete_one({
        "team_id": team["id"],
        "member_id": member_id,
        "week_start": week_start,
        "day": day,
    })
    return {"ok": True, "deleted": r.deleted_count}


@router.post("/fleet/schedule/autofill")
async def fleet_autofill_schedule(
    body: RosterAutofillIn, team: dict = Depends(require_fleet_admin)
):
    """Αντιγράφει τις βάρδιες της προηγούμενης εβδομάδας στην εβδομάδα-στόχο
    (ίδιες μέρες/ώρες/άτομα). Μέλη που δεν υπάρχουν πια παραλείπονται."""
    _reject_past_week(body.week_start)
    source = body.source_week_start or _prev_week_start(body.week_start)
    if source == body.week_start:
        raise HTTPException(400, "Η εβδομάδα προέλευσης πρέπει να είναι διαφορετική")
    src = await db.fleet_roster_shifts.find(
        {"team_id": team["id"], "week_start": source}, {"_id": 0}
    ).to_list(1000)
    member_ids = {
        m["id"]
        for m in await db.fleet_members.find(
            {"team_id": team["id"]}, {"_id": 0, "id": 1}
        ).to_list(200)
    }
    copied = 0
    skipped = 0
    for s in src:
        if s.get("member_id") not in member_ids:
            skipped += 1
            continue
        key = {
            "team_id": team["id"],
            "member_id": s["member_id"],
            "week_start": body.week_start,
            "day": s["day"],
        }
        await db.fleet_roster_shifts.update_one(
            key,
            {
                "$set": {"start": s["start"], "end": s["end"]},
                "$setOnInsert": {"id": str(uuid.uuid4()), **key},
            },
            upsert=True,
        )
        copied += 1
    return {"copied": copied, "skipped": skipped, "source_week_start": source}
