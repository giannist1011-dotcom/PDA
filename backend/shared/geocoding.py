"""Γεωκωδικοποίηση διευθύνσεων (Nominatim) — SHARED domain.

Κάθε domain που χρειάζεται συντεταγμένες από διεύθυνση περνά από εδώ· κανένα
domain δεν καλεί το Nominatim απευθείας. Το cache (geocode_cache) ανήκει σε
αυτό το module και σε κανένα άλλο.
"""
import asyncio
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional

import requests

from shared.core import db

logger = logging.getLogger("orderdeck.geocoding")

GEOCODE_MAX_NEW_PER_CALL = 5   # σεβασμός στο rate limit του Nominatim (1 req/s)

# Αριθμός σπιτιού στο τέλος της οδού: 1-4 ψηφία + προαιρετικό γράμμα («12», «12Β»)
HOUSE_NUM_RE = re.compile(r"\s+\d{1,4}\s*[A-Za-zΑ-Ωα-ωΆΈΉΊΌΎΏάέήίόύώ]?\.?$")


def nominatim_lookup(query: str, viewbox: Optional[str] = None, bounded: bool = False):
    """Sync κλήση στο Nominatim — τρέχει σε thread για να μην μπλοκάρει το event loop."""
    params = {"format": "json", "limit": 1, "q": query, "countrycodes": "gr"}
    if viewbox:
        # Προτίμηση αποτελεσμάτων κοντά στο κατάστημα· bounded=1 = ΜΟΝΟ μέσα στο κουτί
        params["viewbox"] = viewbox
        if bounded:
            params["bounded"] = 1
    r = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params=params,
        headers={
            # Το Nominatim απαιτεί αναγνωρίσιμο User-Agent με στοιχεία επικοινωνίας
            "User-Agent": "OrderDeck-POS/1.0 ("
            + os.environ.get("GEOCODE_CONTACT", "contact@orderdeck.gr")
            + ")",
            "Accept-Language": "el",
        },
        timeout=8,
    )
    r.raise_for_status()
    results = r.json()
    if results:
        return float(results[0]["lat"]), float(results[0]["lon"])
    logger.info("geocode: no Nominatim result for %r (bounded=%s)", query, bounded)
    return None, None


def street_only(address: str) -> Optional[str]:
    """«Περγάμου 12, Κοζάνη» → «Περγάμου, Κοζάνη» — None αν δεν υπάρχει αριθμός.

    Οι ελληνικές επαρχιακές πόλεις σπάνια έχουν αριθμούς σπιτιών στο OSM: όταν
    αποτύχει η πλήρης διεύθυνση, το pin της ίδιας της οδού είναι αρκετό.
    """
    head, sep, tail = address.partition(",")
    stripped = HOUSE_NUM_RE.sub("", head.strip()).strip()
    if not stripped or stripped == head.strip():
        return None
    return (stripped + sep + tail).strip()


def store_viewbox(user: dict) -> Optional[str]:
    """~13km κουτί γύρω από τις συντεταγμένες του καταστήματος (αν έχουν οριστεί)."""
    lat, lng = user.get("store_lat"), user.get("store_lng")
    if lat is None or lng is None:
        return None
    d = 0.12
    return f"{lng - d},{lat + d},{lng + d},{lat - d}"


async def geocode_cached(user: dict, address: str, budget: dict):
    """Επιστρέφει (lat, lng, status) όπου status: "ok" | "failed" | "pending".

    "failed" = η διεύθυνση γεωκωδικοποιήθηκε αλλά δεν βρέθηκε (cached μόνιμα)·
    "pending" = δεν έχει γίνει ακόμα lookup (budget/προσωρινό σφάλμα) — retry στο επόμενο poll.
    """
    user_id = user["id"]
    key = cache_key(address)
    cached = await db.geocode_cache.find_one({"user_id": user_id, "address": key})
    if cached:
        lat, lng = cached.get("lat"), cached.get("lng")
        return lat, lng, ("ok" if lat is not None else "failed")
    if budget["new"] >= GEOCODE_MAX_NEW_PER_CALL:
        return None, None, "pending"  # θα γίνει στο επόμενο poll
    budget["new"] += 1
    # Οι νέες παραγγελίες αποθηκεύουν ήδη πλήρη διεύθυνση "οδός, πόλη" — το lookup
    # τη χρησιμοποιεί ως έχει. Fallback: παλιές παραγγελίες χωρίς πόλη παίρνουν
    # την πόλη του μαγαζιού, αλλιώς το Nominatim γυρνάει ομώνυμο δρόμο αλλού.
    # Αν όμως υπάρχει ήδη κόμμα, το frontend έχει βάλει πόλη (ίσως ΑΛΛΗ από του
    # μαγαζιού — παράδοση εκτός πόλης)· δεν προσθέτουμε δεύτερη.
    query = address.strip()
    city = (user.get("store_city") or "").strip()
    if city and "," not in query and city.lower() not in query.lower():
        query = f"{query}, {city}"
    viewbox = store_viewbox(user)
    try:
        lat, lng = await asyncio.to_thread(nominatim_lookup, query, viewbox)
        if lat is None and viewbox:
            # Fallback: σκέτη διεύθυνση, αυστηρά μέσα στο κουτί γύρω από το μαγαζί
            await asyncio.sleep(1)
            lat, lng = await asyncio.to_thread(nominatim_lookup, address.strip(), viewbox, True)
        if lat is None:
            # Τελευταίο fallback: ΜΟΝΟ η οδός χωρίς αριθμό σπιτιού — ο αριθμός
            # λείπει από το OSM στις περισσότερες επαρχιακές πόλεις
            street = street_only(query)
            if street:
                await asyncio.sleep(1)
                lat, lng = await asyncio.to_thread(nominatim_lookup, street, viewbox)
                if lat is not None:
                    query = street
    except Exception as e:
        logger.warning("geocode: lookup error for %r: %s", address, e)
        return None, None, "pending"  # προσωρινό σφάλμα — δεν κάνουμε cache, retry στο επόμενο poll
    await db.geocode_cache.update_one(
        {"user_id": user_id, "address": key},
        {"$set": {"lat": lat, "lng": lng, "q": query,
                  "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    await asyncio.sleep(1)  # Nominatim: max 1 αίτημα/δευτερόλεπτο
    return lat, lng, ("ok" if lat is not None else "failed")


def cache_key(address: str) -> str:
    """Κανονικοποιημένο κλειδί του geocode_cache — ίδιο σε γράψιμο και διάβασμα."""
    return " ".join((address or "").strip().lower().split())


async def cached_points(user_id: str, addresses: list[str]) -> dict:
    """{normalized address → (lat, lng)} για όσες διευθύνσεις υπάρχουν ήδη στο
    cache — χωρίς νέο lookup (χρήση από χάρτες/heatmap)."""
    keys = [cache_key(a) for a in addresses if (a or "").strip()]
    if not keys:
        return {}
    out = {}
    async for c in db.geocode_cache.find(
        {"user_id": user_id, "address": {"$in": keys}, "lat": {"$ne": None}},
        {"_id": 0, "address": 1, "lat": 1, "lng": 1},
    ):
        out[c["address"]] = (c["lat"], c["lng"])
    return out


async def clear_cache(user_id: str) -> None:
    await db.geocode_cache.delete_many({"user_id": user_id})


def warm_geocode(user: dict, delivery: Optional[dict]):
    """Fire-and-forget geocode μόλις αποθηκευτεί/εκτυπωθεί παραγγελία παράδοσης,
    ώστε το pin να εμφανίζεται αμέσως στο πρώτο poll του χάρτη."""
    addr = (delivery or {}).get("address")
    if (delivery or {}).get("delivery_type") != "delivery" or not (addr or "").strip():
        return

    async def run():
        try:
            await geocode_cached(user, addr, {"new": 0})
        except Exception as e:
            logger.warning("geocode: warm-geocode failed for %r: %s", addr, e)

    asyncio.create_task(run())
