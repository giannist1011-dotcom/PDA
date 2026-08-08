#!/usr/bin/env node
/**
 * Στατικός έλεγχος του backend χωρίς Python (δεν υπάρχει στο dev μηχάνημα):
 *  1. κάθε `from X import a, b` δείχνει σε υπαρκτό module και σε ονόματα που
 *     ορίζονται εκεί (ή γίνονται re-export)
 *  2. κανένα module δεν έμεινε με παλιά διαδρομή (routers.*, core, push, ...)
 *  3. ΟΡΙΑ DOMAIN: κανένα domain δεν αγγίζει collections άλλου domain και δεν
 *     κάνει import εσωτερικά modules άλλου domain (μόνο <domain>.api)
 *
 * Τρέξε: node scripts/check_backend_imports.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "backend");
const errors = [];
const warnings = [];

// ---------- ΟΡΙΑ DOMAIN ----------
// Ποιο domain «κατέχει» ποια collections. Ό,τι δεν αναφέρεται είναι shared.
const OWNERS = {
  pos: ["orders", "items", "categories", "photos", "shopping", "shortage_prints",
        "stock_categories", "stock_items", "employees", "shifts", "expenses",
        "expense_categories", "day_reports", "tables", "table_tabs",
        "checklist_templates", "checklist_ticks", "ai_usage", "ai_briefs"],
  fleet: ["fleet_teams", "fleet_members", "fleet_orders", "fleet_events",
          "fleet_accounts", "fleet_shifts", "fleet_roster_shifts", "fleet_counters",
          "fleet_partnerships"],
  platforms: ["platform_orders"],
  shared: ["users", "profiles", "geocode_cache", "print_jobs", "push_subscriptions"],
  admin: ["admin_audit", "admin_users", "admin_city_geo", "announcements",
          "promo_codes", "demo_leads", "stock_photos"],
};
// admin/ είναι το back-office της πλατφόρμας: του επιτρέπεται ΜΟΝΟ ό,τι δηλώνεται
// εδώ ρητά. Οτιδήποτε άλλο περνά από το <domain>.api.
const ALLOWED_CROSS = {
  // shared/core.purge_user_data καθαρίζει τα δικά του collections
  "shared/core.py": [],
  // η ουρά εκτυπώσεων ζει στο shared και σερβίρει όλα τα domains
  "shared/printing.py": [],
};
const DOMAINS = ["pos", "fleet", "platforms", "shared", "admin"];
const ownerOf = {};
for (const [d, colls] of Object.entries(OWNERS)) for (const c of colls) ownerOf[c] = d;

// ---------- συλλογή modules ----------
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["__pycache__", "tests", ".venv"].includes(e.name)) continue;
      walk(p, out);
    } else if (e.name.endsWith(".py")) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const modules = new Map(); // "pos.orders" -> {file, defs:Set}
const DEF_RE = /^(?:async\s+)?def\s+([A-Za-z_]\w*)|^class\s+([A-Za-z_]\w*)|^([A-Z_][A-Z0-9_]*)\s*(?::[^=]+)?=|^([a-z_]\w*)\s*(?::[^=]+)?=/;

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const mod = rel.replace(/\.py$/, "").replace(/\//g, ".").replace(/\.__init__$/, "");
  const defs = new Set();
  const src = fs.readFileSync(file, "utf8");
  for (const line of src.split("\n")) {
    const m = line.match(DEF_RE);
    if (m) defs.add(m[1] || m[2] || m[3] || m[4]);
    // re-exports: `from x import y` στο ίδιο module κάνει το y διαθέσιμο
    const im = line.match(/^\s*from\s+[\w.]+\s+import\s+(.+)$/);
    if (im && !im[1].includes("(")) {
      for (const part of im[1].split(","))
        defs.add(part.trim().split(/\s+as\s+/).pop().trim());
    }
    const im2 = line.match(/^\s*import\s+([\w.]+)(?:\s+as\s+(\w+))?/);
    if (im2) defs.add(im2[2] || im2[1].split(".")[0]);
  }
  // multi-line `from x import (\n a,\n b,\n)`
  const multi = src.matchAll(/^\s*from\s+[\w.]+\s+import\s+\(([^)]*)\)/gm);
  for (const mm of multi)
    for (const part of mm[1].split(","))
      if (part.trim()) defs.add(part.trim().split(/\s+as\s+/).pop().trim());
  modules.set(mod, { file, rel, defs, src });
}

const LOCAL_ROOTS = new Set([...DOMAINS, "server"]);

// ---------- 1+2: imports ----------
for (const [mod, info] of modules) {
  const lines = info.src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*from\s+([\w.]+)\s+import\s+(.*)$/);
    if (!m) continue;
    const target = m[1];
    const rootPkg = target.split(".")[0];
    if (!LOCAL_ROOTS.has(rootPkg)) {
      // παλιές διαδρομές που δεν υπάρχουν πια
      if (["routers", "core", "push", "seed_data", "presets",
           "platform_integrations", "platform_sounds"].includes(rootPkg))
        errors.push(`${info.rel}:${i + 1} παλιά διαδρομή import: ${target}`);
      continue;
    }
    if (!modules.has(target)) {
      errors.push(`${info.rel}:${i + 1} άγνωστο module: ${target}`);
      continue;
    }
    let names = m[2].trim();
    if (names.startsWith("(")) {
      let j = i, buf = "";
      while (j < lines.length && !lines[j].includes(")")) { buf += lines[j] + " "; j++; }
      buf += lines[j] || "";
      names = buf.replace(/^[\s\S]*?\(/, "").replace(/\)[\s\S]*$/, "");
    }
    if (names.trim() === "*") continue;
    for (let raw of names.split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (!name) continue;
      const t = modules.get(target);
      // υπο-module (π.χ. `from pos import api`)
      if (modules.has(`${target}.${name}`)) continue;
      if (!t.defs.has(name))
        errors.push(`${info.rel}:${i + 1} το ${target} δεν ορίζει «${name}»`);
    }
  }
}

// ---------- 3: όρια domain ----------
for (const [mod, info] of modules) {
  const domain = mod.split(".")[0];
  if (!DOMAINS.includes(domain)) continue;
  const isApi = mod.endsWith(".api");
  const lines = info.src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // collections άλλου domain
    for (const cm of line.matchAll(/\bdb\.([a-z_]+)\b/g)) {
      const coll = cm[1];
      const owner = ownerOf[coll];
      if (!owner) { warnings.push(`${info.rel}:${i + 1} άγνωστο collection «${coll}»`); continue; }
      if (owner === domain) continue;
      if (owner === "shared" && ["users", "profiles"].includes(coll)) continue; // κοινός λογαριασμός
      const allow = ALLOWED_CROSS[info.rel];
      if (allow && allow.includes(coll)) continue;
      errors.push(
        `${info.rel}:${i + 1} ΠΑΡΑΒΙΑΣΗ ΟΡΙΟΥ: το domain «${domain}» αγγίζει το db.${coll} (ανήκει στο «${owner}») — χρησιμοποίησε το ${owner}.api`
      );
    }
    // import εσωτερικού module άλλου domain
    const im = line.match(/^\s*from\s+([\w.]+)\s+import\s/);
    if (im) {
      const t = im[1], tRoot = t.split(".")[0];
      if (!DOMAINS.includes(tRoot) || tRoot === domain) continue;
      if (tRoot === "shared") continue; // το shared είναι για όλους
      if (t === tRoot || t === `${tRoot}.api`) continue; // η διεπαφή
      errors.push(
        `${info.rel}:${i + 1} ΠΑΡΑΒΙΑΣΗ ΟΡΙΟΥ: import εσωτερικού «${t}» — επιτρέπεται μόνο το ${tRoot}.api`
      );
    }
  }
  if (isApi) continue;
}

// ---------- αναφορά ----------
for (const w of warnings) console.log("⚠ " + w);
if (errors.length) {
  console.error(`\n✗ ${errors.length} πρόβλημα(τα):\n`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log(`✓ ${modules.size} modules — imports OK, όρια domain OK`);
