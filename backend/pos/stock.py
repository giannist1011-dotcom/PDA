"""Ελλείψεις (stock) & λίστα αγορών (shopping list)."""
import unicodedata
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from shared.core import db, require_staff, require_manager, actor_name

router = APIRouter()


# ============ ΚΑΤΗΓΟΡΙΑ «ΑΛΛΑ» & MIGRATION ΑΠΟ ΤΗΝ ΠΑΛΙΑ ΕΠΙΠΕΔΗ ΔΟΜΗ ============
OTHER_CATEGORY_NAME = "Άλλα"


async def ensure_other_category(user_id: str) -> dict:
    """Η κατηγορία «Άλλα»: εκεί προσγειώνονται τα παλιά είδη ελλείψεων χωρίς
    κατηγορία και ό,τι προστίθεται χειροκίνητα στη λίστα αγορών."""
    cat = await db.stock_categories.find_one(
        {"user_id": user_id, "name": OTHER_CATEGORY_NAME}, {"_id": 0, "user_id": 0}
    )
    if cat:
        return cat
    count = await db.stock_categories.count_documents({"user_id": user_id})
    doc = {
        "id": str(uuid.uuid4())[:8],
        "user_id": user_id,
        "name": OTHER_CATEGORY_NAME,
        "order": count,
    }
    await db.stock_categories.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


async def migrate_flat_shortages(user_id: str) -> None:
    """Ό,τι έμεινε χωρίς (έγκυρη) κατηγορία → «Άλλα». Τίποτα δεν χάνεται."""
    cat_ids = [
        c["id"]
        async for c in db.stock_categories.find({"user_id": user_id}, {"_id": 0, "id": 1})
    ]
    item_q = {"user_id": user_id, "category_id": {"$nin": cat_ids}}
    shop_q = {"user_id": user_id, "category_id": {"$in": [None, ""]}}
    orphan_items = await db.stock_items.count_documents(item_q)
    orphan_shop = await db.shopping.count_documents(shop_q)
    if not orphan_items and not orphan_shop:
        return
    other = await ensure_other_category(user_id)
    if orphan_items:
        await db.stock_items.update_many(item_q, {"$set": {"category_id": other["id"]}})
    if orphan_shop:
        await db.shopping.update_many(
            shop_q,
            {"$set": {"category_id": other["id"], "category_name": other["name"]}},
        )


# ============ SHOPPING LIST ============
class ShoppingItemIn(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    category_id: Optional[str] = None


# ============ PRINT HISTORY (ιστορικό εκτυπώσεων λίστας αγορών) ============
PRINT_HISTORY_KEEP_DAYS = 90  # κρατάμε τουλάχιστον 30 ημέρες — καθαρίζουμε στις 90


class ShortagePrintItemIn(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    bought: bool = False
    # Κατηγορία τη στιγμή της εκτύπωσης (snapshot). Κενό στις παλιές εγγραφές —
    # το ιστορικό/επανεκτύπωση δουλεύει ακριβώς όπως πριν.
    category: str = Field(default="", max_length=80)


class ShortagePrintIn(BaseModel):
    items: list[ShortagePrintItemIn] = Field(min_length=1, max_length=1000)


@router.post("/shopping/print")
async def record_shopping_print(body: ShortagePrintIn, user: dict = Depends(require_manager)):
    """Καταγραφή εκτύπωσης της λίστας αγορών: snapshot ειδών + ποιος/πότε τύπωσε."""
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "printed_at": now.isoformat(),
        "printed_by": actor_name(user),
        "items": [
            {
                "text": it.text.strip(),
                "bought": bool(it.bought),
                "category": (it.category or "").strip(),
            }
            for it in body.items
        ],
    }
    await db.shortage_prints.insert_one(doc)
    # Lazy καθαρισμός: ό,τι είναι παλαιότερο από PRINT_HISTORY_KEEP_DAYS φεύγει
    cutoff = (now - timedelta(days=PRINT_HISTORY_KEEP_DAYS)).isoformat()
    await db.shortage_prints.delete_many(
        {"user_id": user["id"], "printed_at": {"$lt": cutoff}}
    )
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@router.get("/shopping/prints")
async def list_shopping_prints(
    skip: int = 0, limit: int = 20, user: dict = Depends(require_staff)
):
    limit = max(1, min(limit, 50))
    skip = max(0, skip)
    docs = await db.shortage_prints.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("printed_at", -1).skip(skip).to_list(limit)
    return docs


# ============ ΠΑΡΑΛΛΑΓΕΣ ΕΙΔΟΥΣ (variants) ============
# Ένα είδος ελλείψεων μπορεί προαιρετικά να έχει παραλλαγές (π.χ. Σακούλες →
# 35άρες / 40άρες / 45άρες), όπως ακριβώς οι επιλογές ενός προϊόντος καταλόγου.
# Χωρίς παραλλαγές το είδος συμπεριφέρεται όπως πάντα: tap = επιλογή.
MAX_VARIANTS = 30


class VariantIn(BaseModel):
    id: Optional[str] = None
    name: str = Field(min_length=1, max_length=80)


def normalize_variants(raw: Optional[list[VariantIn]]) -> list[dict]:
    """Καθαρή λίστα {id, name}: κρατά τα υπάρχοντα ids (ώστε να μη χάνονται οι
    ήδη επιλεγμένες παραλλαγές σε μετονομασία/αναδιάταξη) και δίνει νέα στα νέα."""
    out: list[dict] = []
    seen_ids: set[str] = set()
    seen_names: set[str] = set()
    for v in raw or []:
        name = (v.name or "").strip()
        if not name or name.lower() in seen_names:
            continue
        vid = (v.id or "").strip() or str(uuid.uuid4())[:8]
        if vid in seen_ids:
            vid = str(uuid.uuid4())[:8]
        seen_ids.add(vid)
        seen_names.add(name.lower())
        out.append({"id": vid, "name": name})
        if len(out) >= MAX_VARIANTS:
            break
    return out


def shopping_text(item_name: str, variant_names: list[str]) -> str:
    """«Σακούλες: 35άρες, 45άρες» — μία γραμμή, ίδια και στην οθόνη και στο χαρτί."""
    if variant_names:
        return f"{item_name}: {', '.join(variant_names)}"
    return item_name


def pick_variants(item: dict, variant_ids: Optional[list[str]]) -> list[dict]:
    """Οι επιλεγμένες παραλλαγές με τη σειρά που τις όρισε ο ιδιοκτήτης.
    variant_ids=None → όλες (χρησιμοποιείται από την «Επιλογή όλων» κατηγορίας)."""
    variants = item.get("variants") or []
    if not variants:
        return []
    if variant_ids is None:
        return list(variants)
    wanted = set(variant_ids)
    return [v for v in variants if v.get("id") in wanted]


# ============ STOCK (INDEPENDENT INVENTORY) ============
class StockCategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    order: int = 0


class StockItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category_id: str
    available: bool = True
    note: str = ""
    variants: list[VariantIn] = Field(default_factory=list, max_length=MAX_VARIANTS)


class StockItemPatchIn(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
    available: Optional[bool] = None
    note: Optional[str] = None
    variants: Optional[list[VariantIn]] = Field(default=None, max_length=MAX_VARIANTS)


class StockReorderIn(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=2000)


@router.get("/stock/config")
async def stock_config(user: dict = Depends(require_staff)):
    await migrate_flat_shortages(user["id"])
    cats = await db.stock_categories.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("order", 1).to_list(500)
    items = await db.stock_items.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).to_list(2000)
    # Σειρά μέσα στην κατηγορία: «order» (νέα είδη/reorder), παλιά χωρίς order → created_at
    items.sort(key=lambda i: (i.get("order") or 0, i.get("created_at") or ""))
    return {"categories": cats, "items": items}


@router.post("/stock/categories/reorder")
async def reorder_stock_categories(
    body: StockReorderIn, user: dict = Depends(require_manager)
):
    """Νέα σειρά κατηγοριών ελλείψεων: η θέση στη λίστα ids γίνεται το order."""
    for idx, cid in enumerate(body.ids):
        await db.stock_categories.update_one(
            {"id": cid, "user_id": user["id"]}, {"$set": {"order": idx}}
        )
    return {"ok": True}


@router.post("/stock/items/reorder")
async def reorder_stock_items(body: StockReorderIn, user: dict = Depends(require_manager)):
    """Νέα σειρά ειδών μέσα σε μία κατηγορία ελλείψεων."""
    for idx, iid in enumerate(body.ids):
        await db.stock_items.update_one(
            {"id": iid, "user_id": user["id"]}, {"$set": {"order": idx}}
        )
    return {"ok": True}


@router.post("/stock/categories")
async def create_stock_category(body: StockCategoryIn, user: dict = Depends(require_manager)):
    count = await db.stock_categories.count_documents({"user_id": user["id"]})
    doc = {
        "id": str(uuid.uuid4())[:8],
        "user_id": user["id"],
        "name": body.name.strip(),
        "order": body.order if body.order else count,
    }
    await db.stock_categories.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@router.put("/stock/categories/{cid}")
async def update_stock_category(cid: str, body: StockCategoryIn, user: dict = Depends(require_manager)):
    r = await db.stock_categories.update_one(
        {"id": cid, "user_id": user["id"]},
        {"$set": {"name": body.name.strip(), "order": body.order}},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    # Η λίστα αγορών κρατά snapshot του ονόματος κατηγορίας — κράτα το συγχρονισμένο
    await db.shopping.update_many(
        {"user_id": user["id"], "category_id": cid},
        {"$set": {"category_name": body.name.strip()}},
    )
    return {"id": cid, "name": body.name.strip(), "order": body.order}


@router.delete("/stock/categories/{cid}")
async def delete_stock_category(cid: str, user: dict = Depends(require_manager)):
    # cascade: remove shopping entries created from items in this category
    stock_ids = [
        d["id"] async for d in db.stock_items.find(
            {"user_id": user["id"], "category_id": cid}, {"_id": 0, "id": 1}
        )
    ]
    if stock_ids:
        await db.shopping.delete_many({"user_id": user["id"], "source_stock_id": {"$in": stock_ids}})
    await db.stock_items.delete_many({"user_id": user["id"], "category_id": cid})
    r = await db.stock_categories.delete_one({"id": cid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    # Χειροκίνητες εγγραφές της λίστας αγορών σε αυτή την κατηγορία → «Άλλα»
    leftover = await db.shopping.count_documents({"user_id": user["id"], "category_id": cid})
    if leftover:
        other = await ensure_other_category(user["id"])
        await db.shopping.update_many(
            {"user_id": user["id"], "category_id": cid},
            {"$set": {"category_id": other["id"], "category_name": other["name"]}},
        )
    return {"ok": True}


@router.post("/stock/items")
async def create_stock_item(body: StockItemIn, user: dict = Depends(require_manager)):
    cat = await db.stock_categories.find_one({"id": body.category_id, "user_id": user["id"]})
    if not cat:
        raise HTTPException(404, "Η κατηγορία δεν βρέθηκε")
    order = await db.stock_items.count_documents(
        {"user_id": user["id"], "category_id": body.category_id}
    )
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": body.name.strip(),
        "category_id": body.category_id,
        "order": order,
        "available": bool(body.available),
        "note": body.note.strip(),
        "variants": normalize_variants(body.variants),
        "selected_variant_ids": [],
        "shopping_item_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.stock_items.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@router.patch("/stock/items/{iid}")
async def update_stock_item(iid: str, body: StockItemPatchIn, user: dict = Depends(require_staff)):
    current = await db.stock_items.find_one({"id": iid, "user_id": user["id"]}, {"_id": 0, "user_id": 0})
    if not current:
        raise HTTPException(404, "Not found")
    update = {}
    if body.name is not None:
        update["name"] = body.name.strip()
    if body.category_id is not None:
        cat = await db.stock_categories.find_one({"id": body.category_id, "user_id": user["id"]})
        if not cat:
            raise HTTPException(404, "Η κατηγορία δεν βρέθηκε")
        update["category_id"] = body.category_id
    if body.available is not None:
        update["available"] = bool(body.available)
    if body.note is not None:
        update["note"] = body.note.strip()
    if body.variants is not None:
        variants = normalize_variants(body.variants)
        update["variants"] = variants
        # Οι ήδη επιλεγμένες παραλλαγές που εξακολουθούν να υπάρχουν παραμένουν
        # επιλεγμένες — προσθήκη/μετονομασία παραλλαγής δεν χαλάει την επιλογή.
        alive = {v["id"] for v in variants}
        update["selected_variant_ids"] = [
            vid for vid in (current.get("selected_variant_ids") or []) if vid in alive
        ]
    if not update:
        raise HTTPException(400, "Nothing to update")
    await db.stock_items.update_one({"id": iid, "user_id": user["id"]}, {"$set": update})
    # keep linked shopping entry (text + κατηγορία) in sync
    sid = current.get("shopping_item_id")
    if sid and ("name" in update or "category_id" in update or "variants" in update):
        merged = {**current, **update}
        selected = pick_variants(merged, merged.get("selected_variant_ids") or [])
        sync = {
            "text": shopping_text(merged.get("name", ""), [v["name"] for v in selected]),
            "variants": [v["name"] for v in selected],
        }
        if "category_id" in update:
            cat = await db.stock_categories.find_one(
                {"id": update["category_id"], "user_id": user["id"]}, {"_id": 0, "name": 1}
            )
            sync["category_id"] = update["category_id"]
            sync["category_name"] = (cat or {}).get("name", OTHER_CATEGORY_NAME)
        await db.shopping.update_one({"id": sid, "user_id": user["id"]}, {"$set": sync})
    return {"id": iid, **update}


class StockShoppingIn(BaseModel):
    needs: bool
    # Ποιες παραλλαγές λείπουν. None = όλες (είδη χωρίς παραλλαγές το αγνοούν).
    variant_ids: Optional[list[str]] = None


@router.post("/stock/categories/{cid}/shopping")
async def toggle_stock_category_shopping(
    cid: str, body: StockShoppingIn, user: dict = Depends(require_staff)
):
    """Ολόκληρη κατηγορία στη λίστα αγορών (ή έξω από αυτήν) με μία κίνηση."""
    cat = await db.stock_categories.find_one(
        {"id": cid, "user_id": user["id"]}, {"_id": 0, "id": 1, "name": 1}
    )
    if not cat:
        raise HTTPException(404, "Η κατηγορία δεν βρέθηκε")
    items = await db.stock_items.find(
        {"user_id": user["id"], "category_id": cid},
        {"_id": 0, "id": 1, "name": 1, "shopping_item_id": 1, "variants": 1},
    ).to_list(2000)
    if not body.needs:
        sids = [i["shopping_item_id"] for i in items if i.get("shopping_item_id")]
        if sids:
            await db.shopping.delete_many({"user_id": user["id"], "id": {"$in": sids}})
            await db.stock_items.update_many(
                {"user_id": user["id"], "category_id": cid},
                {"$set": {"shopping_item_id": None, "selected_variant_ids": []}},
            )
        return {
            "category_id": cid,
            "links": {i["id"]: None for i in items},
            "selections": {i["id"]: [] for i in items},
            "shopping_items": [],
        }

    now = datetime.now(timezone.utc).isoformat()
    links: dict[str, str] = {}
    selections: dict[str, list[str]] = {}
    new_docs = []
    for it in items:
        sid = it.get("shopping_item_id")
        if sid:
            links[it["id"]] = sid
            continue
        # «Επιλογή όλων» → για τα είδη με παραλλαγές μπαίνουν όλες οι παραλλαγές
        variants = it.get("variants") or []
        names = [v["name"] for v in variants]
        selections[it["id"]] = [v["id"] for v in variants]
        sid = str(uuid.uuid4())
        links[it["id"]] = sid
        new_docs.append(
            {
                "id": sid,
                "user_id": user["id"],
                "text": shopping_text(it["name"], names),
                "variants": names,
                "bought": False,
                "source_stock_id": it["id"],
                "category_id": cid,
                "category_name": cat["name"],
                "created_at": now,
            }
        )
    if new_docs:
        await db.shopping.insert_many(new_docs)
        for doc in new_docs:
            await db.stock_items.update_one(
                {"id": doc["source_stock_id"], "user_id": user["id"]},
                {
                    "$set": {
                        "shopping_item_id": doc["id"],
                        "selected_variant_ids": selections.get(doc["source_stock_id"], []),
                    }
                },
            )
    return {
        "category_id": cid,
        "links": links,
        "selections": selections,
        "shopping_items": [
            {k: v for k, v in d.items() if k not in ("_id", "user_id")} for d in new_docs
        ],
    }


@router.post("/stock/items/{iid}/shopping")
async def toggle_stock_item_shopping(
    iid: str, body: StockShoppingIn, user: dict = Depends(require_staff)
):
    item = await db.stock_items.find_one({"id": iid, "user_id": user["id"]})
    if not item:
        raise HTTPException(404, "Not found")
    existing_id = item.get("shopping_item_id")
    has_variants = bool(item.get("variants"))
    selected = pick_variants(item, body.variant_ids) if body.needs else []
    # Είδος με παραλλαγές και καμία επιλεγμένη → ισοδυναμεί με αφαίρεση
    if body.needs and (not has_variants or selected):
        selected_ids = [v["id"] for v in selected]
        names = [v["name"] for v in selected]
        text = shopping_text(item["name"], names)
        if existing_id:
            existing = await db.shopping.find_one(
                {"id": existing_id, "user_id": user["id"]}, {"_id": 0, "user_id": 0}
            )
            if existing:
                # Ξαναάνοιγμα του picker → ενημέρωση της ίδιας εγγραφής, όχι διπλή
                await db.shopping.update_one(
                    {"id": existing_id, "user_id": user["id"]},
                    {"$set": {"text": text, "variants": names}},
                )
                await db.stock_items.update_one(
                    {"id": iid, "user_id": user["id"]},
                    {"$set": {"selected_variant_ids": selected_ids}},
                )
                return {
                    "item_id": iid,
                    "shopping_item_id": existing_id,
                    "selected_variant_ids": selected_ids,
                    "shopping_item": {**existing, "text": text, "variants": names},
                }
        cat = await db.stock_categories.find_one(
            {"id": item.get("category_id"), "user_id": user["id"]}, {"_id": 0, "name": 1}
        )
        sid = str(uuid.uuid4())
        shopping_doc = {
            "id": sid,
            "user_id": user["id"],
            "text": text,
            "variants": names,
            "bought": False,
            "source_stock_id": iid,
            "category_id": item.get("category_id"),
            "category_name": (cat or {}).get("name", OTHER_CATEGORY_NAME),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.shopping.insert_one(shopping_doc)
        await db.stock_items.update_one(
            {"id": iid, "user_id": user["id"]},
            {"$set": {"shopping_item_id": sid, "selected_variant_ids": selected_ids}},
        )
        return {
            "item_id": iid,
            "shopping_item_id": sid,
            "selected_variant_ids": selected_ids,
            "shopping_item": {k: v for k, v in shopping_doc.items() if k not in ("_id", "user_id")},
        }
    # needs=false (ή καμία παραλλαγή επιλεγμένη) → remove linked shopping entry
    if existing_id:
        await db.shopping.delete_one({"id": existing_id, "user_id": user["id"]})
    await db.stock_items.update_one(
        {"id": iid, "user_id": user["id"]},
        {"$set": {"shopping_item_id": None, "selected_variant_ids": []}},
    )
    return {"item_id": iid, "shopping_item_id": None, "selected_variant_ids": []}



# ============ ΜΕΤΑΤΡΟΠΗ ΠΑΛΙΩΝ ΕΙΔΩΝ ΣΕ ΠΑΡΑΛΛΑΓΕΣ ============
# Παλιότερα το «Σακούλες 35άρες / 40άρες / 45άρες» ήταν τρία ξεχωριστά είδη.
# Εδώ τα εντοπίζουμε και (μετά από έγκριση του ιδιοκτήτη) τα ενώνουμε σε ένα
# είδος «Σακούλες» με τρεις παραλλαγές. Το ιστορικό εκτυπώσεων δεν αγγίζεται.
def _fold(s: str) -> str:
    """Πεζά χωρίς τόνους — για να ταιριάζει «Νερό» με «νερο»."""
    return "".join(
        c for c in unicodedata.normalize("NFD", (s or "").lower()) if not unicodedata.combining(c)
    )


@router.get("/stock/variant-suggestions")
async def stock_variant_suggestions(user: dict = Depends(require_manager)):
    """Ομάδες ειδών της ίδιας κατηγορίας που μοιράζονται την πρώτη λέξη."""
    cats = await db.stock_categories.find(
        {"user_id": user["id"]}, {"_id": 0, "id": 1, "name": 1, "order": 1}
    ).sort("order", 1).to_list(500)
    items = await db.stock_items.find(
        {"user_id": user["id"]}, {"_id": 0, "id": 1, "name": 1, "category_id": 1, "order": 1, "variants": 1}
    ).to_list(2000)
    items.sort(key=lambda i: (i.get("order") or 0))
    buckets: dict[tuple[str, str], list[dict]] = {}
    for it in items:
        if it.get("variants"):
            continue  # έχει ήδη παραλλαγές — δεν το πειράζουμε
        parts = (it.get("name") or "").split()
        if len(parts) < 2:
            continue
        key = (it.get("category_id") or "", _fold(parts[0]))
        buckets.setdefault(key, []).append(
            {"id": it["id"], "name": it["name"], "base": parts[0], "variant": " ".join(parts[1:])}
        )
    cat_names = {c["id"]: c["name"] for c in cats}
    groups = []
    for (cid, _key), members in buckets.items():
        if len(members) < 2:
            continue
        groups.append(
            {
                "category_id": cid,
                "category_name": cat_names.get(cid, OTHER_CATEGORY_NAME),
                "base_name": members[0]["base"],
                "items": [{"id": m["id"], "name": m["name"], "variant": m["variant"]} for m in members],
            }
        )
    groups.sort(key=lambda g: (g["category_name"], g["base_name"]))
    return {"groups": groups}


class MergeGroupIn(BaseModel):
    item_ids: list[str] = Field(min_length=2, max_length=MAX_VARIANTS)
    base_name: str = Field(min_length=1, max_length=120)


class MergeVariantsIn(BaseModel):
    groups: list[MergeGroupIn] = Field(min_length=1, max_length=100)


@router.post("/stock/items/merge-variants")
async def merge_stock_items_to_variants(
    body: MergeVariantsIn, user: dict = Depends(require_manager)
):
    """Ενώνει τα είδη κάθε ομάδας σε ένα είδος με παραλλαγές.
    Κρατά το πρώτο είδος (θέση/κατηγορία του) και σβήνει τα υπόλοιπα."""
    merged = 0
    removed_ids: list[str] = []
    kept: list[dict] = []
    for g in body.groups:
        docs = await db.stock_items.find(
            {"user_id": user["id"], "id": {"$in": g.item_ids}}, {"_id": 0, "user_id": 0}
        ).to_list(MAX_VARIANTS)
        if len(docs) < 2:
            continue
        by_id = {d["id"]: d for d in docs}
        ordered = [by_id[i] for i in g.item_ids if i in by_id]
        if len({d.get("category_id") for d in ordered}) != 1:
            raise HTTPException(400, "Τα είδη μιας ομάδας πρέπει να είναι στην ίδια κατηγορία")
        base = g.base_name.strip()
        keep = ordered[0]
        drop = ordered[1:]
        variants = normalize_variants(
            [
                VariantIn(name=(d["name"][len(base):].strip() or d["name"]))
                if _fold(d["name"]).startswith(_fold(base))
                else VariantIn(name=d["name"])
                for d in ordered
            ]
        )
        # Οι εγγραφές των διαγραφόμενων ειδών φεύγουν από τη λίστα αγορών
        drop_ids = [d["id"] for d in drop]
        drop_sids = [d["shopping_item_id"] for d in drop if d.get("shopping_item_id")]
        if drop_sids:
            await db.shopping.delete_many({"user_id": user["id"], "id": {"$in": drop_sids}})
        await db.stock_items.delete_many({"user_id": user["id"], "id": {"$in": drop_ids}})
        await db.stock_items.update_one(
            {"id": keep["id"], "user_id": user["id"]},
            {"$set": {"name": base, "variants": variants, "selected_variant_ids": []}},
        )
        # Το ενωμένο είδος ξεκινά χωρίς επιλογές: η παλιά του εγγραφή στη λίστα φεύγει
        if keep.get("shopping_item_id"):
            await db.shopping.delete_one({"id": keep["shopping_item_id"], "user_id": user["id"]})
            await db.stock_items.update_one(
                {"id": keep["id"], "user_id": user["id"]}, {"$set": {"shopping_item_id": None}}
            )
        removed_ids.extend(drop_ids)
        kept.append({**keep, "name": base, "variants": variants, "selected_variant_ids": [], "shopping_item_id": None})
        merged += 1
    return {"merged": merged, "removed_item_ids": removed_ids, "items": kept}


@router.delete("/stock/items/{iid}")
async def delete_stock_item(iid: str, user: dict = Depends(require_manager)):
    item = await db.stock_items.find_one({"id": iid, "user_id": user["id"]}, {"_id": 0, "shopping_item_id": 1})
    if item and item.get("shopping_item_id"):
        await db.shopping.delete_one({"id": item["shopping_item_id"], "user_id": user["id"]})
    r = await db.stock_items.delete_one({"id": iid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@router.get("/shopping")
async def list_shopping(user: dict = Depends(require_staff)):
    docs = await db.shopping.find(
        {"user_id": user["id"]}, {"_id": 0, "user_id": 0}
    ).sort("created_at", 1).to_list(1000)
    return docs


@router.post("/shopping/reset")
async def reset_shopping(user: dict = Depends(require_manager)):
    """Wipe entire shopping list and clear shopping_item_id on all stock items."""
    result = await db.shopping.delete_many({"user_id": user["id"]})
    await db.stock_items.update_many(
        {"user_id": user["id"], "shopping_item_id": {"$ne": None}},
        {"$set": {"shopping_item_id": None}},
    )
    return {"ok": True, "deleted": result.deleted_count}


@router.post("/shopping")
async def add_shopping(body: ShoppingItemIn, user: dict = Depends(require_manager)):
    cat = None
    if body.category_id:
        cat = await db.stock_categories.find_one(
            {"id": body.category_id, "user_id": user["id"]}, {"_id": 0, "id": 1, "name": 1}
        )
    if not cat:
        cat = await ensure_other_category(user["id"])
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "text": body.text.strip(),
        "bought": False,
        "category_id": cat["id"],
        "category_name": cat["name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.shopping.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


class ShoppingUpdateIn(BaseModel):
    text: Optional[str] = None
    bought: Optional[bool] = None


@router.put("/shopping/{sid}")
async def update_shopping(sid: str, body: ShoppingUpdateIn, user: dict = Depends(require_manager)):
    update = {}
    if body.text is not None:
        update["text"] = body.text.strip()
    if body.bought is not None:
        update["bought"] = bool(body.bought)
    if not update:
        raise HTTPException(400, "Nothing to update")
    r = await db.shopping.update_one({"id": sid, "user_id": user["id"]}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": sid, **update}


@router.delete("/shopping/{sid}")
async def delete_shopping(sid: str, user: dict = Depends(require_manager)):
    r = await db.shopping.delete_one({"id": sid, "user_id": user["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Not found")
    # if this shopping entry was linked from a stock item, clear the link
    await db.stock_items.update_many(
        {"user_id": user["id"], "shopping_item_id": sid},
        {"$set": {"shopping_item_id": None}},
    )
    return {"ok": True}
