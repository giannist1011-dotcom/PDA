#!/usr/bin/env node
/* Παράγει το PROJECT_MAP.md στο root — συμπαγής χάρτης πλοήγησης του repo.
   Τρέξιμο: node scripts/generate_map.js
   (Δεν υπάρχει python στο dev μηχάνημα — γι' αυτό Node, όχι .py) */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");
const read = (p) => fs.readFileSync(p, "utf8");
const toLines = (s) => s.split(/\r?\n/);

/* ---------------- BACKEND: endpoints ανά router ---------------- */

function docstringAfter(ls, defIdx) {
  // βρες το τέλος της υπογραφής (γραμμή που κλείνει με ':'), μετά ψάξε docstring
  let end = defIdx;
  for (; end < Math.min(defIdx + 15, ls.length); end++) {
    if (/:\s*(#.*)?$/.test(ls[end])) break;
  }
  for (let j = end + 1; j < Math.min(end + 3, ls.length); j++) {
    const t = ls[j].trim();
    if (!t) continue;
    const m = t.match(/^[rub]*("""|''')(.*)$/);
    if (!m) break; // πρώτη ουσιαστική γραμμή δεν είναι docstring
    let text = m[2].replace(/("""|''')\s*$/, "").trim();
    if (!text && j + 1 < ls.length) text = ls[j + 1].trim().replace(/("""|''')\s*$/, "").trim();
    const words = text.split(/\s+/).filter(Boolean);
    return words.slice(0, 8).join(" ") + (words.length > 8 ? "…" : "");
  }
  return "";
}

function parseRouter(file) {
  const ls = toLines(read(file));
  const eps = [];
  for (let i = 0; i < ls.length; i++) {
    const m = ls[i].match(/^@router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/);
    if (!m) continue;
    for (let j = i + 1; j < Math.min(i + 8, ls.length); j++) {
      const d = ls[j].match(/^(?:async\s+)?def\s+(\w+)/);
      if (d) {
        eps.push({
          method: m[1].toUpperCase(),
          path: m[2],
          fn: d[1],
          line: j + 1,
          doc: docstringAfter(ls, j),
        });
        break;
      }
    }
  }
  return eps;
}

/* ---------------- BACKEND: Mongo collections ---------------- */

const NOT_COLLECTIONS = new Set(["command", "client", "name", "list_collection_names"]);

function collectCollections() {
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!["__pycache__", "venv", ".venv", "node_modules"].includes(e.name)) walk(p);
      } else if (e.name.endsWith(".py")) files.push(p);
    }
  })(path.join(ROOT, "backend"));

  const map = new Map(); // collection -> Set(files)
  for (const p of files.sort()) {
    for (const m of read(p).matchAll(/\bdb\.([a-z_][a-z0-9_]*)\b/g)) {
      if (NOT_COLLECTIONS.has(m[1])) continue;
      if (!map.has(m[1])) map.set(m[1], new Set());
      map.get(m[1]).add(rel(p).replace(/^backend\//, ""));
    }
  }
  return map;
}

/* ---------------- FRONTEND: σύνοψη αρχείου jsx ---------------- */

function summarizeJsx(p) {
  const ls = toLines(read(p));
  const defs = [];
  // Κεφαλαίο πρώτο γράμμα = component (τα ALL_CAPS σταθερές κόβονται ήδη από το σχήμα τιμής)
  const isComponentName = (n) => /^[A-Z]/.test(n);
  for (let i = 0; i < ls.length; i++) {
    let m =
      ls[i].match(/^export\s+default\s+(?:async\s+)?function\s+([A-Za-z_]\w*)/) ||
      ls[i].match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_]\w*)/);
    if (!m)
      m = ls[i].match(
        /^(?:export\s+)?const\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?(?:\(|[\w$]+\s*=>|(?:React\.)?forwardRef|memo\()/
      );
    if (m && (isComponentName(m[1]) || /^use[A-Z]/.test(m[1]))) defs.push(`${m[1]}@${i + 1}`);
  }
  return { count: ls.length, defs };
}

function frontendSection(dirName, excludeDirs = []) {
  const base = path.join(ROOT, "frontend", "src", dirName);
  const out = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) {
        if (!excludeDirs.includes(f)) walk(p); // ui/, icons/ εκτός χάρτη
        continue;
      }
      if (!/\.(jsx?|tsx?)$/.test(f)) continue;
      const { count, defs } = summarizeJsx(p);
      const name = path.relative(base, p).replace(/\\/g, "/");
      out.push(`- ${name} (${count} γρ)${defs.length ? ": " + defs.join(", ") : ""}`);
    }
  })(base);
  return out;
}

/* ---------------- FRONTEND: lib/api.js ---------------- */

function parseApiJs() {
  const ls = toLines(read(path.join(ROOT, "frontend", "src", "lib", "api.js")));
  const out = [];
  for (let i = 0; i < ls.length; i++) {
    const m = ls[i].match(/^export\s+(?:const|(?:async\s+)?function)\s+([A-Za-z_]\w*)\s*(?:=\s*(?:async\s*)?)?(\([^)]*\))?/);
    if (!m) continue;
    if (/axios\.create/.test(ls[i])) { out.push(`- ${m[1]} — axios instance (baseURL /api)`); continue; }
    let args = m[2] || "";
    if (!args) {
      const a = ls[i].match(/=\s*(?:async\s*)?([\w$]+)\s*=>/);
      if (a) args = `(${a[1]})`;
    }
    let call = "";
    for (let j = i; j < Math.min(i + 6, ls.length); j++) {
      // μετά την πρώτη γραμμή δεκτές μόνο indented συνέχειες — αλλιώς πέρασε σε επόμενο statement
      if (j > i && !/^\s+\S/.test(ls[j])) break;
      const c = ls[j].match(/(?:\bapi)?\s*\.(get|post|put|patch|delete)\(\s*[`"']([^`"']+)[`"']/);
      if (c) { call = ` → ${c[1].toUpperCase()} ${c[2]}`; break; }
    }
    out.push(`- ${m[1]}${args || "()"}${call}`);
  }
  return out;
}

/* ---------------- FRONTEND: routes από App.js ---------------- */

function parseRoutes() {
  const src = read(path.join(ROOT, "frontend", "src", "App.js"));
  const out = [];
  for (const m of src.matchAll(/<Route\b[\s\S]*?\/>/g)) {
    const block = m[0];
    const pm = block.match(/path="([^"]+)"/);
    if (!pm) continue;
    let comp = null;
    for (const cm of block.matchAll(/<([A-Z]\w*)/g)) {
      if (cm[1] !== "Route" && cm[1] !== "ProtectedRoute") { comp = cm[1]; break; }
    }
    if (!comp || comp === "Navigate" || comp === "LegacyRedirect") continue;
    let roles = "";
    const rm = block.match(/roles={\[([^\]]+)\]}/);
    if (rm) roles = ` [${[...rm[1].matchAll(/"(\w+)"/g)].map((x) => x[1]).join(",")}]`;
    else if (/requireOwner/.test(block)) roles = " [owner]";
    out.push(`- ${pm[1]} → ${comp}${roles}`);
  }
  return out;
}

/* ---------------- Συναρμολόγηση ---------------- */

const out = [];
out.push("# PROJECT_MAP — αυτόματα παραγόμενο, ΜΗΝ το επεξεργάζεσαι με το χέρι (τρέξε: node scripts/generate_map.js)");
out.push("");
out.push("Backend: όλα τα endpoints σερβίρονται με prefix `/api` (server.py). Μορφή: METHOD /path → function @γραμμή — περιγραφή.");
out.push("Frontend: Name@γραμμή = component/hook ορισμένο στο αρχείο. Εκτός χάρτη: components/ui, components/icons (shadcn/boilerplate).");
out.push("");

out.push("## ΧΑΡΤΗΣ DOMAIN — ο ΚΑΝΟΝΑΣ πριν από κάθε αλλαγή");
out.push("");
out.push("**Κάθε domain μιλάει σε άλλο ΜΟΝΟ μέσω του interface του (`<domain>/api.py`).**");
out.push("Κανένα domain δεν διαβάζει/γράφει collections άλλου domain και δεν κάνει import");
out.push("εσωτερικά του modules. Ο έλεγχος είναι αυτόματος: `node scripts/check_backend_imports.js`.");
out.push("");
out.push("| domain | φάκελος | collections | interface |");
out.push("| --- | --- | --- | --- |");
out.push("| POS | `backend/pos/` | orders, items, categories, photos, stock_*, shopping, employees, shifts, expenses*, day_reports, tables, table_tabs, checklist_*, ai_* | `pos/api.py` |");
out.push("| FleetDeck | `backend/fleet/` | fleet_teams, fleet_members, fleet_orders, fleet_events, fleet_accounts, fleet_shifts, fleet_counters, fleet_partnerships | `fleet/api.py` |");
out.push("| Πλατφόρμες | `backend/platforms/` | platform_orders | `platforms/api.py` |");
out.push("| Admin (back-office) | `backend/admin/` | admin_*, announcements, promo_codes, demo_leads, stock_photos | `admin/api.py` |");
out.push("| Shared | `backend/shared/` | users, profiles, print_jobs, geocode_cache, push_subscriptions | core / auth / printing / notifications / geocoding |");
out.push("");
out.push("Frontend (ίδιος διαχωρισμός): `components/pos|fleet|platforms|shared`, `context/shared|fleet|platforms`.");
out.push("Το `components/ui` + `components/icons` (shadcn) και το `lib/api.js` μένουν κοινά.");
out.push("");
out.push("**Σύνδεση POS ↔ FleetDeck** — αμφίδρομη και ρητή, καμία ταύτιση με τηλέφωνο/διεύθυνση:");
out.push("`orders.fleet_order_id` ↔ `fleet_orders.source_pos_order_id`. Το ανέβασμα δέχεται");
out.push("`pos_order_id` στο `POST /store/fleet/orders`· από εκεί περνούν «καθ' οδόν»,");
out.push("ενημερώσεις προς οδηγό, ακυρώσεις και ο συγχρονισμός κατάστασης πίσω στην κάρτα POS.");
out.push("");

out.push("## AI FEATURES — ΚΡΥΜΜΕΝΑ (global kill switch)");
out.push("");
out.push("DeckPilot & Ημερήσιο Brief είναι **dormant**: ο κώδικας υπάρχει ολόκληρος αλλά");
out.push("δεν εμφανίζεται πουθενά και τα `/api/ai/*` γυρνάνε 403 σε όλους — ούτε στα demo.");
out.push("Ο διακόπτης είναι το env var **`AI_FEATURES_GLOBAL`** (Render), default OFF.");
out.push("Έλεγχος στο `shared/core.py → ai_features_global()`, το οποίο:");
out.push("- μηδενίζει το `ai_features_enabled` στο `public_user()` → κρύβεται μόνο του κάθε UI σημείο");
out.push("  (drawer links, DeckPilot FAB στο AppShell, `requiresAI` routes στο ProtectedRoute)");
out.push("- κόβει με 403 το `pos/ai.py → require_ai_features`");
out.push("- κρύβει το add-on «DeckPilot AI» από τη συνδρομή (`pos/billing.py → visible_addons()`)");
out.push("- κρύβει το per-store AI toggle στο admin panel (`ai_features_global` στο shop detail)");
out.push("  και μπλοκάρει κάθε αλλαγή AI πεδίων μέσω `PATCH /admin/shops/{uid}`");
out.push("- σταματά τους αυτόματους κανόνες «demo = AI on» (`pos/seeding.py`, `shared/auth.py`,");
out.push("  `admin/fleet_accounts.py`) — ήταν αυτοί που ξανά-άναβαν το toggle σε κάθε restart");
out.push("");
out.push("**Επαναφορά όταν ετοιμαστεί:** βάλε `AI_FEATURES_GLOBAL=1` στο Render. Όλα τα UI");
out.push("σημεία επανεμφανίζονται μόνα τους — δεν χρειάζεται καμία αλλαγή κώδικα.");
out.push("");

out.push("## BACKEND — endpoints (backend/<domain>/*.py)");
const DOMAIN_DIRS = ["shared", "pos", "fleet", "platforms", "admin"];
let epCount = 0;
for (const d of DOMAIN_DIRS) {
  const dir = path.join(ROOT, "backend", d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(".py") || f === "__init__.py") continue;
    const eps = parseRouter(path.join(dir, f));
    if (!eps.length) continue;
    epCount += eps.length;
    out.push(`### ${d}/${f}`);
    for (const e of eps) out.push(`- ${e.method} ${e.path} → ${e.fn} @${e.line}${e.doc ? " — " + e.doc : ""}`);
  }
}
out.push("");

out.push("## BACKEND — interfaces domain (η ΜΟΝΗ επιτρεπτή διέλευση)");
for (const d of DOMAIN_DIRS) {
  const f = path.join(ROOT, "backend", d, "api.py");
  if (!fs.existsSync(f)) continue;
  const fns = toLines(read(f))
    .map((l, i) => [l.match(/^(?:async\s+)?def\s+([a-z]\w*)\s*\(/), i])
    .filter(([m]) => m && !m[1].startsWith("_"))
    .map(([m, i]) => `${m[1]}@${i + 1}`);
  if (fns.length) out.push(`- ${d}/api.py: ${fns.join(", ")}`);
}
out.push("");

out.push("## BACKEND — Mongo collections (paths σχετικά με backend/)");
const cols = collectCollections();
for (const c of [...cols.keys()].sort()) out.push(`- ${c}: ${[...cols.get(c)].sort().join(", ")}`);
out.push("");

out.push("## FRONTEND — routes (frontend/src/App.js)");
out.push(...parseRoutes());
out.push("");

out.push("## FRONTEND — pages (frontend/src/pages)");
out.push(...frontendSection("pages"));
out.push("");

out.push("## FRONTEND — components (frontend/src/components)");
out.push(...frontendSection("components", ["ui", "icons"]));
out.push("");

out.push("## FRONTEND — lib/api.js (exported)");
out.push(...parseApiJs());
out.push("");

const target = path.join(ROOT, "PROJECT_MAP.md");
fs.writeFileSync(target, out.join("\n"));
console.log(`PROJECT_MAP.md: ${out.length} γραμμές, ${epCount} endpoints, ${cols.size} collections`);
