# OrderDeck — Project Guide

> Πρώην "Πεινώκιο POS". Το "Πεινώκιο" παραμένει μόνο ως όνομα του demo μαγαζιού (seed data) — δεν είναι πια το brand.

## Τι είναι
Multi-tenant SaaS POS/PDA για ελληνικά καταστήματα εστίασης (takeaway & τραπέζια). Όλο το UI στα ΕΛΛΗΝΙΚΑ, dark mode.

## Stack & Deploy
- Frontend: React (CRA + craco), Tailwind, shadcn/ui, lucide-react — φάκελος /frontend
- Backend: FastAPI — /backend, σπασμένο σε **DOMAINS** (όχι πια flat routers/):
  - server.py → μόνο app setup, CORS, include_routers, startup (Mongo indexes + migrations)
  - **shared/** → core.py (db client, auth helpers/JWT/PIN gate), auth.py (register/login/προφίλ), printing.py (print jobs/bridge/relay), notifications.py (web push), geocoding.py (Nominatim + geocode_cache)
  - **pos/** → orders.py, menu.py, tables.py, stock.py, schedule.py, stats.py, expenses.py, checklist.py, public_menu.py, onboarding.py, billing.py, ai.py, seeding.py, presets/, seed_data.py
  - **fleet/** → company.py (εταιρείες διανομής: ομάδες/οδηγοί/παραγγελίες), store.py (FleetDeck καταστήματος: συνεργασίες + ανέβασμα), demo.py (seeding δειγμάτων)
  - **platforms/** → router.py (efood/Box/Wolt: ρυθμίσεις, αποδοχή/απόρριψη/καθ' οδόν), integrations.py (connectors + capabilities — ΜΟΝΟ εδώ η σύνδεση με πραγματικά API), sounds.py (συνθετικοί ήχοι, κανένα proprietary asset)
  - **admin/** → shops.py, admins.py, fleet_accounts.py, overview.py, announcements.py, promo.py (X-Admin-Password = env PROMO_ADMIN_PASSWORD, ΟΧΙ JWT μαγαζιού), stock_photos.py
  - Νέο endpoint → στο αρχείο του σωστού domain, νέο index → στο startup του server.py
- DB: MongoDB Atlas (motor async driver)
- Deploy: push στο main → Netlify (frontend) + Render (backend) auto-deploy. Env vars: MONGO_URL, DB_NAME, JWT_SECRET, PROMO_ADMIN_PASSWORD (Render) / REACT_APP_BACKEND_URL (Netlify)
- Auth: JWT store login (email+password) → επιλογή προφίλ → 4ψήφιο PIN (bcrypt hashed)

## Δομή frontend
- /frontend/src/components — χωρισμένα κατά domain: **pos/** (OrderPanel, MenuGrid, Receipt, ...), **fleet/** (OrderCard, EditOrderModal, utils — κοινά σε εταιρεία & κατάστημα), **platforms/** (PlatformSettings, PlatformOrderPopup, order/), **shared/** (AppShell, AdminShell, PinGateModal, AddressAutocomplete, printing/, ...). Το `components/ui` + `components/icons` (shadcn) μένουν κοινά.
- /frontend/src/context — **shared/AuthContext**, **fleet/FleetAuthContext**, **platforms/PlatformOrdersContext**
- /frontend/src/pages — μία σελίδα ανά feature (PDA, MenuManagement, Stock, Schedule, Analytics, Expenses, History, ...)
- Οι μεγάλες σελίδες είναι σπασμένες σε υποφακέλους pages/<feature>/ (π.χ. pages/history/OrdersTab.jsx, pages/pda/, pages/menu/): το X.jsx μένει στη θέση του ως entry του route (ίδιο default export), τα επιμέρους components/modals/tabs ζουν στον υποφάκελο. Helpers κοινοί σε 2+ αρχεία του φακέλου → pages/<feature>/utils.js
- /frontend/src/components — κοινά (AppShell με burger menu, OrderPanel, CustomizationModal, Receipt, ...)
- /frontend/src/lib/api.js — ΟΛΕΣ οι κλήσεις API (πρόσθεσε εδώ νέες, μην κάνεις fetch απευθείας στα components)
- Routes στο /frontend/src/App.js

## Κανόνες — ΠΑΝΤΑ
0. ΠΛΟΗΓΗΣΗ: Διάβασε ΠΡΩΤΑ το PROJECT_MAP.md και πήγαινε κατευθείαν στο σωστό αρχείο/γραμμή — ΜΗΝ εξερευνάς αρχεία στην τύχη και ΜΗΝ διαβάζεις ολόκληρα μεγάλα αρχεία όταν ο χάρτης δείχνει το σημείο. Στο ΤΕΛΟΣ κάθε task που άλλαξε δομή (νέα endpoints/components/αρχεία), ξανατρέξε `node scripts/generate_map.js` και commit το ενημερωμένο PROJECT_MAP.md. (Σημ.: το script είναι σε Node, όχι Python — δεν υπάρχει python στο dev μηχάνημα· το node είναι στο `C:\Program Files\nodejs` αν λείπει από το PATH.)
0.5. **ΟΡΙΑ DOMAIN — ΚΑΘΕ DOMAIN ΜΙΛΑΕΙ ΣΕ ΑΛΛΟ ΜΟΝΟ ΜΕΣΩ ΤΟΥ INTERFACE ΤΟΥ** (`pos/api.py`, `fleet/api.py`, `platforms/api.py`, `admin/api.py`). Συγκεκριμένα:
   - ΠΟΤΕ `db.<collection>` άλλου domain (π.χ. το platforms δεν αγγίζει `db.orders`, το pos δεν αγγίζει `db.fleet_orders`) — μόνο `users`/`profiles` είναι κοινά (shared)
   - ΠΟΤΕ import εσωτερικού module άλλου domain (`from fleet.company import ...` μέσα από pos/ ή platforms/) — μόνο `from fleet import api as fleet_api`
   - Χρειάζεσαι κάτι που δεν υπάρχει; **Πρόσθεσε συνάρτηση στο `api.py` του domain που ΚΑΤΕΧΕΙ τα δεδομένα**, μην παρακάμψεις το όριο
   - Το `shared/` είναι για όλους· τα api modules κάνουν lazy imports μέσα στις συναρτήσεις για να μη γίνονται κύκλοι
   - Έλεγχος πριν το commit: `node scripts/check_backend_imports.js` (χωρίς python στο μηχάνημα, αυτό είναι ο μόνος στατικός έλεγχος του backend — ΤΡΕΞΕ ΤΟΝ)
   - **Σύνδεση POS ↔ FleetDeck**: μόνο μέσω `orders.fleet_order_id` ↔ `fleet_orders.source_pos_order_id`. ΠΟΤΕ ταύτιση παραγγελιών με τηλέφωνο/διεύθυνση/όνομα πελάτη.
1. Κάθε νέο query/endpoint scoped σε user_id — ΠΟΤΕ δεδομένα άλλου λογαριασμού
2. Permissions ανά ρόλο: Ιδιοκτήτης=όλα, Υπεύθυνος=χωρίς στατιστικά/έξοδα/ρυθμίσεις + διαχειρίζεται προφίλ σερβιτόρων, Υπάλληλος=PDA/Ελλείψεις/Πρόγραμμα(view)/Ιστορικό/Κλείσιμο ημέρας, Σερβιτόρος=μόνο Τραπέζια
3. Νέα σελίδα → μπαίνει στο burger menu (AppShell) με σωστό role check + route στο App.js
4. Χρήματα: ευρώ, format με κόμμα (8,50 €)
5. Ελληνικά labels παντού, συνέπεια με το υπάρχον dark UI (ίδια tokens/χρώματα)
6. Pagination σε κάθε λίστα που μεγαλώνει — ποτέ unbounded fetch
7. Indexes σε νέα Mongo collections (user_id + ό,τι φιλτράρεται)
8. Κανένα page πάνω από ~400 γραμμές — σπάσε σε components σε υποφάκελο pages/<feature>/ (καθαρή μετακίνηση: state/effects μένουν στη σελίδα, τα children παίρνουν props)
9. Στο τέλος κάθε task: commit + push στο main
10. ΠΡΙΝ ΑΠΟ ΚΑΘΕ COMMIT/PUSH: τρέξε `node scripts/check_backend_imports.js` (backend: imports + όρια domain) ΚΑΙ `CI=true npx craco build` στο frontend και βεβαιώσου ότι περνάει ΚΑΘΑΡΟ. Το Netlify χτίζει με CI=true, που μετατρέπει ΟΛΑ τα warnings σε errors (unused imports, missing useEffect deps, ambiguous Tailwind classes, missing modules). Ένα σκέτο `npm run build` περνάει τοπικά αλλά ΑΠΟΤΥΓΧΑΝΕΙ στο Netlify. Επίσης: μην προσθέτεις npm packages που απαιτούν node core modules (crypto, fs, path) — δεν υπάρχουν στον browser με webpack 5· χρησιμοποίησε native browser APIs (π.χ. crypto.subtle). Τρέχε ΠΑΝΤΑ npm/build commands με κομμένο output: `npm install --silent 2>&1 | tail -5`, `CI=true npx craco build 2>&1 | tail -20`. Ποτέ πλήρες build/install log στο context.
11. ΠΟΤΕ multi-agent workflows, subagents, ή adversarial verify agents εκτός αν ζητηθεί ρητά. Όλα τα tasks single-agent, σειριακά. Verification = CI=true build (κομμένο output) + τεστ του χρήστη στο live. Κανένα ScheduleWakeup/auto-resume χωρίς ρητή εντολή.

## Τρέχουσα φάση
Sprint 3: σύστημα ρόλων/προφίλ → τραπέζια → ροή εγγραφής με presets (Σουβλατζίδικο/Καφετέρια/Πιτσαρία/Burger) → εικονίδιο επιχείρησης στο header. Έπονται: landing page, δημόσιοι κατάλογοι, AI features, PWA offline.
