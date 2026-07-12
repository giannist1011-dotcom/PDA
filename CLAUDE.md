# Πεινώκιο POS — Project Guide

## Τι είναι
Multi-tenant SaaS POS/PDA για ελληνικά καταστήματα εστίασης (takeaway & τραπέζια). Όλο το UI στα ΕΛΛΗΝΙΚΑ, dark mode.

## Stack & Deploy
- Frontend: React (CRA + craco), Tailwind, shadcn/ui, lucide-react — φάκελος /frontend
- Backend: FastAPI — /backend/server.py (μονολιθικό αρχείο), presets/seed στο /backend
- DB: MongoDB Atlas (motor async driver)
- Deploy: push στο main → Netlify (frontend) + Render (backend) auto-deploy. Env vars: MONGO_URL, DB_NAME, JWT_SECRET (Render) / REACT_APP_BACKEND_URL (Netlify)
- Auth: JWT store login (email+password) → επιλογή προφίλ → 4ψήφιο PIN (bcrypt hashed)

## Δομή frontend
- /frontend/src/pages — μία σελίδα ανά feature (PDA, MenuManagement, Stock, Schedule, Statistics, Expenses, History, ...)
- /frontend/src/components — κοινά (AppShell με burger menu, OrderPanel, CustomizationModal, Receipt, ...)
- /frontend/src/lib/api.js — ΟΛΕΣ οι κλήσεις API (πρόσθεσε εδώ νέες, μην κάνεις fetch απευθείας στα components)
- Routes στο /frontend/src/App.js

## Κανόνες — ΠΑΝΤΑ
1. Κάθε νέο query/endpoint scoped σε user_id — ΠΟΤΕ δεδομένα άλλου λογαριασμού
2. Permissions ανά ρόλο: Ιδιοκτήτης=όλα, Υπεύθυνος=χωρίς στατιστικά/έξοδα/ρυθμίσεις + διαχειρίζεται προφίλ σερβιτόρων, Υπάλληλος=PDA/Ελλείψεις/Πρόγραμμα(view)/Ιστορικό/Κλείσιμο ημέρας, Σερβιτόρος=μόνο Τραπέζια
3. Νέα σελίδα → μπαίνει στο burger menu (AppShell) με σωστό role check + route στο App.js
4. Χρήματα: ευρώ, format με κόμμα (8,50 €)
5. Ελληνικά labels παντού, συνέπεια με το υπάρχον dark UI (ίδια tokens/χρώματα)
6. Pagination σε κάθε λίστα που μεγαλώνει — ποτέ unbounded fetch
7. Indexes σε νέα Mongo collections (user_id + ό,τι φιλτράρεται)
8. Στο τέλος κάθε task: commit + push στο main
9. Πριν τελειώσεις: verify ότι το frontend κάνει build (npm run build)

## Τρέχουσα φάση
Sprint 3: σύστημα ρόλων/προφίλ → τραπέζια → ροή εγγραφής με presets (Σουβλατζίδικο/Καφετέρια/Πιτσαρία/Burger) → εικονίδιο επιχείρησης στο header. Έπονται: landing page, δημόσιοι κατάλογοι, AI features, PWA offline.
