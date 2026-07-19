# OrderDeck — Project Guide

> Πρώην "Πεινώκιο POS". Το "Πεινώκιο" παραμένει μόνο ως όνομα του demo μαγαζιού (seed data) — δεν είναι πια το brand.

## Τι είναι
Multi-tenant SaaS POS/PDA για ελληνικά καταστήματα εστίασης (takeaway & τραπέζια). Όλο το UI στα ΕΛΛΗΝΙΚΑ, dark mode.

## Stack & Deploy
- Frontend: React (CRA + craco), Tailwind, shadcn/ui, lucide-react — φάκελος /frontend
- Backend: FastAPI — /backend, σπασμένο σε routers:
  - server.py → μόνο app setup, CORS, include_routers, startup (Mongo indexes + demo account)
  - core.py → db client, auth helpers (JWT, get_current_user, require_owner/require_manager, PIN gate), seeding
  - routers/auth.py → register/login/me, προφίλ, επιλογή προφίλ με PIN, verify-owner-pin
  - routers/menu.py → κατηγορίες, είδη, bulk, customization, φωτογραφίες
  - routers/orders.py → παραγγελίες, scheduled, ιστορικό, πελάτες (+ shared Order/OrderItem models)
  - routers/tables.py → τραπέζια/καρτέλες, settings/business & settings/tables
  - routers/stock.py → ελλείψεις, shopping list
  - routers/schedule.py → employees, βάρδιες
  - routers/stats.py → analytics, day-summary/κλείσιμο ημέρας
  - routers/expenses.py → έξοδα + κατηγορίες εξόδων
  - routers/promo.py → εκπτωτικοί κωδικοί: admin CRUD (X-Admin-Password header = env PROMO_ADMIN_PASSWORD, ΟΧΙ JWT μαγαζιού) + public /promo/validate για το wizard εγγραφής
  - presets/ και seed_data.py ως έχουν. Νέο endpoint → στον αντίστοιχο router, νέο index → στο startup του server.py
- DB: MongoDB Atlas (motor async driver)
- Deploy: push στο main → Netlify (frontend) + Render (backend) auto-deploy. Env vars: MONGO_URL, DB_NAME, JWT_SECRET, PROMO_ADMIN_PASSWORD (Render) / REACT_APP_BACKEND_URL (Netlify)
- Auth: JWT store login (email+password) → επιλογή προφίλ → 4ψήφιο PIN (bcrypt hashed)

## Δομή frontend
- /frontend/src/pages — μία σελίδα ανά feature (PDA, MenuManagement, Stock, Schedule, Statistics, Expenses, History, ...)
- /frontend/src/components — κοινά (AppShell με burger menu, OrderPanel, CustomizationModal, Receipt, ...)
- /frontend/src/lib/api.js — ΟΛΕΣ οι κλήσεις API (πρόσθεσε εδώ νέες, μην κάνεις fetch απευθείας στα components)
- Routes στο /frontend/src/App.js

## Κανόνες — ΠΑΝΤΑ
0. ΠΛΟΗΓΗΣΗ: Διάβασε ΠΡΩΤΑ το PROJECT_MAP.md και πήγαινε κατευθείαν στο σωστό αρχείο/γραμμή — ΜΗΝ εξερευνάς αρχεία στην τύχη και ΜΗΝ διαβάζεις ολόκληρα μεγάλα αρχεία όταν ο χάρτης δείχνει το σημείο. Στο ΤΕΛΟΣ κάθε task που άλλαξε δομή (νέα endpoints/components/αρχεία), ξανατρέξε `node scripts/generate_map.js` και commit το ενημερωμένο PROJECT_MAP.md. (Σημ.: το script είναι σε Node, όχι Python — δεν υπάρχει python στο dev μηχάνημα· το node είναι στο `C:\Program Files\nodejs` αν λείπει από το PATH.)
1. Κάθε νέο query/endpoint scoped σε user_id — ΠΟΤΕ δεδομένα άλλου λογαριασμού
2. Permissions ανά ρόλο: Ιδιοκτήτης=όλα, Υπεύθυνος=χωρίς στατιστικά/έξοδα/ρυθμίσεις + διαχειρίζεται προφίλ σερβιτόρων, Υπάλληλος=PDA/Ελλείψεις/Πρόγραμμα(view)/Ιστορικό/Κλείσιμο ημέρας, Σερβιτόρος=μόνο Τραπέζια
3. Νέα σελίδα → μπαίνει στο burger menu (AppShell) με σωστό role check + route στο App.js
4. Χρήματα: ευρώ, format με κόμμα (8,50 €)
5. Ελληνικά labels παντού, συνέπεια με το υπάρχον dark UI (ίδια tokens/χρώματα)
6. Pagination σε κάθε λίστα που μεγαλώνει — ποτέ unbounded fetch
7. Indexes σε νέα Mongo collections (user_id + ό,τι φιλτράρεται)
8. Στο τέλος κάθε task: commit + push στο main
9. ΠΡΙΝ ΑΠΟ ΚΑΘΕ COMMIT/PUSH: τρέξε `CI=true npx craco build` στο frontend και βεβαιώσου ότι περνάει ΚΑΘΑΡΟ. Το Netlify χτίζει με CI=true, που μετατρέπει ΟΛΑ τα warnings σε errors (unused imports, missing useEffect deps, ambiguous Tailwind classes, missing modules). Ένα σκέτο `npm run build` περνάει τοπικά αλλά ΑΠΟΤΥΓΧΑΝΕΙ στο Netlify. Επίσης: μην προσθέτεις npm packages που απαιτούν node core modules (crypto, fs, path) — δεν υπάρχουν στον browser με webpack 5· χρησιμοποίησε native browser APIs (π.χ. crypto.subtle). Τρέχε ΠΑΝΤΑ npm/build commands με κομμένο output: `npm install --silent 2>&1 | tail -5`, `CI=true npx craco build 2>&1 | tail -20`. Ποτέ πλήρες build/install log στο context.

## Τρέχουσα φάση
Sprint 3: σύστημα ρόλων/προφίλ → τραπέζια → ροή εγγραφής με presets (Σουβλατζίδικο/Καφετέρια/Πιτσαρία/Burger) → εικονίδιο επιχείρησης στο header. Έπονται: landing page, δημόσιοι κατάλογοι, AI features, PWA offline.
