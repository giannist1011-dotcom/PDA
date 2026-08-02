"""Web Push (VAPID) — ειδοποιήσεις σε κλειστό/κλειδωμένο κινητό (FleetDeck).

Οι συνδρομές ζουν στο push_subscriptions (team_id + surface: driver/dispatcher).
Η αποστολή γίνεται fire-and-forget σε background task (η pywebpush είναι sync →
asyncio.to_thread) ώστε να μην καθυστερεί ποτέ το request. Νεκρές συνδρομές
(404/410 από το push service) διαγράφονται αυτόματα.

Χωρίς VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY στο env το feature είναι ανενεργό:
τα endpoints επιστρέφουν key=null και το frontend κρύβει το UI.
"""
import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from core import db

VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
VAPID_CONTACT = os.environ.get("VAPID_CONTACT", "").strip() or "mailto:contact@orderdeck.gr"

logger = logging.getLogger("orderdeck.push")

# Κρατάμε reference στα background tasks — αλλιώς ο GC μπορεί να τα σκοτώσει
_bg_tasks = set()


def push_enabled() -> bool:
    return bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)


async def save_subscription(
    team_id: str, member_id: str, surface: str, subscription: dict
) -> None:
    """Upsert με κλειδί το endpoint: ίδια συσκευή που ξανακάνει subscribe
    (ή αλλάζει μέλος/επιφάνεια) ενημερώνει την υπάρχουσα εγγραφή."""
    endpoint = (subscription or {}).get("endpoint") or ""
    if not endpoint:
        return
    await db.push_subscriptions.update_one(
        {"endpoint": endpoint},
        {
            "$set": {
                "team_id": team_id,
                "member_id": member_id,
                "surface": surface,
                "subscription": subscription,
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        },
        upsert=True,
    )


async def delete_subscription(team_id: str, endpoint: str) -> None:
    await db.push_subscriptions.delete_one({"team_id": team_id, "endpoint": endpoint})


def _send_one(subscription: dict, data: str) -> bool:
    """Sync αποστολή ενός push. Επιστρέφει False όταν η συνδρομή είναι νεκρή."""
    from pywebpush import WebPushException, webpush

    try:
        webpush(
            subscription_info=subscription,
            data=data,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_CONTACT},
            ttl=600,
        )
        return True
    except WebPushException as e:
        code = getattr(getattr(e, "response", None), "status_code", None)
        if code in (404, 410):
            return False  # η συσκευή έκανε unsubscribe / καθαρίστηκε
        logger.warning("web push failed (%s): %s", code, e)
        return True
    except Exception as e:  # λάθος κλειδιά, δίκτυο κ.λπ. — ποτέ δεν ρίχνει request
        logger.warning("web push error: %s", e)
        return True


async def _send_to_docs(docs: list, payload: dict) -> None:
    data = json.dumps(payload, ensure_ascii=False)
    dead = []
    for d in docs:
        ok = await asyncio.to_thread(_send_one, d["subscription"], data)
        if not ok:
            dead.append(d["id"])
    if dead:
        await db.push_subscriptions.delete_many({"id": {"$in": dead}})


async def notify_push(
    team_id: str,
    surface: str,
    title: str,
    body: str,
    url: str,
    member_ids: Optional[list] = None,
    exclude_member_id: Optional[str] = None,
) -> None:
    """Στέλνει push σε όλες τις συνδρομές της ομάδας/επιφάνειας (προαιρετικά
    μόνο σε συγκεκριμένα μέλη). Η αποστολή τρέχει σε background task."""
    if not push_enabled():
        return
    q = {"team_id": team_id, "surface": surface}
    if member_ids is not None:
        if not member_ids:
            return
        q["member_id"] = {"$in": member_ids}
    if exclude_member_id:
        q.setdefault("member_id", {"$ne": exclude_member_id})
    docs = await db.push_subscriptions.find(q, {"_id": 0}).to_list(500)
    if not docs:
        return
    payload = {"title": title, "body": body, "url": url}
    task = asyncio.create_task(_send_to_docs(docs, payload))
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)
