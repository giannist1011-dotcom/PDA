#!/usr/bin/env node
// One-off: reset του owner PIN ενός tenant.
// Ίδιο σχήμα hashing με το backend (bcrypt — το python bcrypt.checkpw
// επαληθεύει κανονικά $2a$/$2b$ hashes του bcryptjs).
//
// Χρήση:
//   npm install --no-save --silent mongodb bcryptjs
//   MONGO_URL="mongodb+srv://..." DB_NAME="..." node scripts/reset_owner_pin.js [email] [pin]
//
// Defaults: email=demo@peinokio.gr (tenant Πεινώκιο), pin=4161

const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME;
const email = (process.argv[2] || "demo@peinokio.gr").toLowerCase();
const pin = process.argv[3] || "4161";

if (!MONGO_URL || !DB_NAME) {
  console.error("Χρειάζονται env vars MONGO_URL και DB_NAME (ίδιες με το Render).");
  process.exit(1);
}
if (!/^\d{4}$/.test(pin)) {
  console.error("Το PIN πρέπει να είναι 4 ψηφία.");
  process.exit(1);
}

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  try {
    const user = await db.collection("users").findOne({ email });
    if (!user) {
      console.error(`Δεν βρέθηκε λογαριασμός με email ${email}`);
      process.exit(1);
    }

    const pinHash = bcrypt.hashSync(pin, 10);

    // Legacy πεδίο στο user doc + καθάρισμα τυχόν PIN lockout
    await db.collection("users").updateOne(
      { id: user.id },
      {
        $set: {
          owner_pin_hash: pinHash,
          owner_pin_set: true,
          pin_fail_count: 0,
          pin_lock_until: null,
        },
      }
    );

    // Το login/PIN gate ελέγχει τα profiles — ενημέρωση του προφίλ Ιδιοκτήτη
    const res = await db.collection("profiles").updateMany(
      { user_id: user.id, role: "owner" },
      { $set: { pin_hash: pinHash, pin_fail_count: 0, pin_lock_until: null } }
    );

    console.log(
      `OK: PIN ιδιοκτήτη → ${pin} για ${email} (user ${user.id}), ` +
        `${res.modifiedCount} προφίλ owner ενημερώθηκαν.`
    );
    if (res.matchedCount === 0) {
      console.warn(
        "Προσοχή: δεν βρέθηκε προφίλ με role 'owner' — ενημερώθηκε μόνο το legacy owner_pin_hash."
      );
    }
  } finally {
    await client.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
