#!/usr/bin/env node
/**
 * One-off: προσθήκη αναψυκτικών στο μενού του Πεινώκιο, με φωτογραφίες από το
 * Open Food Facts (ανοιχτή άδεια — τα barcodes είναι επιβεβαιωμένα ένα-ένα, ΔΕΝ
 * γίνεται scraping τυχαίων εικόνων από το web).
 *
 * Οι φωτογραφίες αποθηκεύονται ΑΚΡΙΒΩΣ όπως οι ανεβασμένες του μαγαζιού:
 * doc στο collection `photos` με `data_url` (base64) και σύνδεση στο προϊόν
 * μέσω `photo_id` — το /menu/config το μετατρέπει σε `photo_url`.
 *
 * Τιμές: 0,00 € (το μοντέλο MenuItemIn απαιτεί price ≥ 0 — δεν επιτρέπεται
 * κενό) — ο ιδιοκτήτης τις συμπληρώνει από τη Διαχείριση Μενού.
 *
 * Χρήση:
 *   npm install --no-save --silent mongodb
 *   MONGO_URL="mongodb+srv://..." DB_NAME="..." node scripts/add_peinokio_drinks.js [email]
 *   ... --dry-run   → μόνο έλεγχος/αναφορά, καμία εγγραφή
 *
 * Είναι idempotent: προϊόν με το ίδιο όνομα στην ίδια κατηγορία δεν ξαναμπαίνει.
 */

const { MongoClient } = require("mongodb");
const crypto = require("crypto");

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME;
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const email = (args.find((a) => !a.startsWith("--")) || "demo@peinokio.gr").toLowerCase();

const UA = "OrderDeckPhotoFetch/1.0 (https://orderdeck.gr)";
const OFF_IMG = "https://images.openfoodfacts.org/images/products/";

// Τα 7 αναψυκτικά. `off` = barcode + διαδρομή εικόνας στο Open Food Facts
// (null = δεν υπάρχει εικόνα εκεί → μπαίνει χωρίς φωτογραφία).
const DRINKS = [
  {
    name: "Coca-Cola Zero 500ml",
    off: { barcode: "5449000131836", img: "544/900/013/1836/front_en.673.400.jpg" },
  },
  {
    name: "Coca-Cola Zero 1,5lt",
    off: { barcode: "5000112615050", img: "500/011/261/5050/front_fr.3.400.jpg" },
  },
  {
    name: "Σουρωτή 330ml",
    off: { barcode: "5201277250043", img: "520/127/725/0043/front_en.14.400.jpg" },
  },
  {
    name: "Κλιάφα Πορτοκαλάδα (με ανθρακικό)",
    off: { barcode: "5201275000367", img: "520/127/500/0367/front_en.3.400.jpg" },
  },
  // Υπάρχει στο OFF (5201275001364, «Orange juice without carbon», Kliafa 330ml)
  // αλλά ΧΩΡΙΣ φωτογραφία στη βάση τους.
  { name: "Κλιάφα Πορτοκαλάδα χωρίς ανθρακικό", off: null },
  // Δεν υπάρχει καθόλου στο OFF.
  { name: "Κλιάφα Γκαζόζα", off: null },
  {
    name: "Κλιάφα Βυσσινάδα",
    off: { barcode: "5201275000466", img: "520/127/500/0466/front_en.5.400.jpg" },
  },
];

if (!MONGO_URL || !DB_NAME) {
  console.error("Χρειάζονται env vars MONGO_URL και DB_NAME (ίδιες με το Render).");
  process.exit(1);
}

const nowIso = () => new Date().toISOString();
const norm = (s) => String(s || "").trim().toLowerCase();

async function fetchDataUrl(path, attempts = 4) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(OFF_IMG + path, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get("content-type") || "";
      if (!type.startsWith("image/")) throw new Error(`content-type ${type}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) throw new Error(`πολύ μικρό αρχείο (${buf.length}B)`);
      return { dataUrl: `data:${type};base64,${buf.toString("base64")}`, bytes: buf.length };
    } catch (e) {
      if (i === attempts) {
        console.warn(`   ! αποτυχία λήψης εικόνας (${path}): ${e.message}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  return null;
}

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  const users = db.collection("users");
  const cats = db.collection("categories");
  const itemsCol = db.collection("items");
  const photosCol = db.collection("photos");

  try {
    const user = await users.findOne({ email });
    if (!user) {
      console.error(`Δεν βρέθηκε λογαριασμός με email ${email}`);
      process.exit(1);
    }
    const uid = user.id;
    console.log(`Μαγαζί: ${user.restaurant_name || email} (user ${uid})${DRY ? "  [DRY RUN]" : ""}`);

    // ---- κατηγορία Αναψυκτικά ----
    const allCats = await cats.find({ user_id: uid }, { projection: { _id: 0 } }).toArray();
    const drinksCat =
      allCats.find((c) => norm(c.name).startsWith("αναψυκτικ")) ||
      allCats.find((c) => c.id === "anapsyktika");
    if (!drinksCat) {
      console.error(
        "Δεν βρέθηκε κατηγορία «Αναψυκτικά». Κατηγορίες: " +
          allCats.map((c) => c.name).join(", ")
      );
      process.exit(1);
    }
    console.log(`Κατηγορία: ${drinksCat.name} (${drinksCat.id})`);

    // ---- αρίθμηση: συνεχίζουμε από τον μεγαλύτερο αριθμητικό κωδικό ----
    const allItems = await itemsCol.find({ user_id: uid }, { projection: { _id: 0 } }).toArray();
    const used = new Set(
      allItems.map((i) => norm(i.code)).filter(Boolean)
    );
    const numeric = allItems
      .map((i) => String(i.code || "").trim())
      .filter((c) => /^\d+$/.test(c))
      .map(Number);
    let next = numeric.length ? Math.max(...numeric) + 1 : 1;
    const nextCode = () => {
      while (used.has(String(next))) next += 1;
      const c = String(next);
      used.add(c);
      next += 1;
      return c;
    };

    let sortOrder = allItems.filter((i) => i.category === drinksCat.id).length;

    const added = [];
    const skipped = [];
    const noPhoto = [];

    for (const d of DRINKS) {
      const existing = allItems.find((i) => norm(i.name) === norm(d.name));
      if (existing) {
        skipped.push(`${d.name} (υπάρχει ήδη, κωδ. ${existing.code || "–"})`);
        continue;
      }

      let photoId = null;
      if (d.off) {
        const img = await fetchDataUrl(d.off.img);
        if (img) {
          photoId = crypto.randomUUID();
          const photoDoc = {
            id: photoId,
            user_id: uid,
            filename: d.name,
            data_url: img.dataUrl,
            size_bytes: img.dataUrl.length,
            source: "openfoodfacts",
            source_barcode: d.off.barcode,
            created_at: nowIso(),
          };
          if (!DRY) await photosCol.insertOne(photoDoc);
          console.log(
            `   φωτό OK: ${d.name} ← OFF ${d.off.barcode} (${Math.round(img.bytes / 1024)}KB)`
          );
        } else {
          noPhoto.push(`${d.name} (η λήψη από OFF απέτυχε)`);
        }
      } else {
        noPhoto.push(`${d.name} (δεν υπάρχει φωτογραφία στο Open Food Facts)`);
      }

      const code = nextCode();
      const doc = {
        id: crypto.randomUUID(),
        user_id: uid,
        name: d.name,
        price: 0, // placeholder — απαιτείται τιμή για την αποθήκευση
        category: drinksCat.id,
        customizable: false,
        double_meat_eligible: false,
        available: true,
        unavailable_note: "",
        option_groups: [],
        photo_id: photoId,
        allergens: "",
        code,
        sort_order: sortOrder++,
      };
      if (!DRY) await itemsCol.insertOne(doc);
      added.push(`${code}  ${d.name}${photoId ? "  📷" : ""}`);
    }

    if (added.length && !DRY) await users.updateOne({ id: uid }, { $set: { onb_menu: true } });

    // ---- αναφορές ----
    console.log(`\n=== ΠΡΟΣΤΕΘΗΚΑΝ (${added.length}) ===`);
    added.forEach((l) => console.log("  " + l));
    if (skipped.length) {
      console.log(`\n=== ΠΑΡΑΛΕΙΦΘΗΚΑΝ (${skipped.length}) ===`);
      skipped.forEach((l) => console.log("  " + l));
    }
    console.log(`\n=== ΧΩΡΙΣ ΦΩΤΟΓΡΑΦΙΑ — ο ιδιοκτήτης να τραβήξει δική του (${noPhoto.length}) ===`);
    noPhoto.forEach((l) => console.log("  " + l));

    // Έλεγχος ΟΛΩΝ των προϊόντων του μαγαζιού για φωτογραφία
    const finalItems = await itemsCol.find({ user_id: uid }, { projection: { _id: 0 } }).toArray();
    const validPhotoIds = new Set(
      (
        await photosCol.find({ user_id: uid }, { projection: { _id: 0, id: 1 } }).toArray()
      ).map((p) => p.id)
    );
    const catName = Object.fromEntries(allCats.map((c) => [c.id, c.name]));
    const catOrder = Object.fromEntries(allCats.map((c) => [c.id, c.order ?? 999]));
    const missing = finalItems
      .filter((i) => !i.photo_id || !validPhotoIds.has(i.photo_id))
      .sort(
        (a, b) =>
          (catOrder[a.category] ?? 999) - (catOrder[b.category] ?? 999) ||
          (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
    console.log(
      `\n=== ΠΡΟΪΟΝΤΑ ΧΩΡΙΣ ΦΩΤΟΓΡΑΦΙΑ: ${missing.length} από ${finalItems.length} ===`
    );
    let lastCat = null;
    for (const i of missing) {
      if (i.category !== lastCat) {
        lastCat = i.category;
        console.log(`\n  ${catName[i.category] || i.category}`);
      }
      console.log(`    ${String(i.code || "–").padStart(4)}  ${i.name}`);
    }
    if (DRY) console.log("\n[DRY RUN] Καμία εγγραφή δεν έγινε.");
  } finally {
    await client.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
