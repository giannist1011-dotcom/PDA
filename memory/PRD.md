# Πεινώκιο POS – PRD

## Original Problem Statement
Full Greek-language React restaurant PDA (Point-of-Sale) app for a takeaway called "Πεινώκιο". Counter-facing app for Windows PC/tablet. Dark mode, no authentication, all text in Greek.

## Users
- Restaurant counter staff (single-role, open access).

## Core Requirements
- Menu browsing by category with tap-to-add items.
- Order panel on the right (items, quantities, total).
- Order source tagging: Ταμείο / Τηλέφωνο / efood / Box.
- Auto-incrementing order number per day.
- Print receipt via browser print dialog (80mm formatted).
- Order history persisted in MongoDB.
- Analytics dashboard with "Από" / "Έως" date range filter: total orders, revenue, avg order, by-source, popular items, hourly breakdown.
- Sandwich customization modal: bread (single), extras (multi), sauces (multi), double-meat (+1.50€, only Χοιρινό/Κοτόπουλο/Πανσέτα).

## Architecture
- Backend: FastAPI + Motor (MongoDB) at 0.0.0.0:8001, all routes prefixed /api.
  - Endpoints: GET /api/orders/next-number, POST /api/orders, GET /api/orders, GET /api/analytics.
- Frontend: React + React Router + Tailwind + shadcn/ui + Recharts.
- Design: Dark mode, orange (#FF6B00) accent, Outfit/Manrope/JetBrains Mono fonts.

## Implemented (2026-02)
- Complete backend with 4 endpoints + Pydantic models.
- Complete PDA view with 7 categories and 42 menu items.
- Sandwich customization modal with dynamic double-meat pricing.
- Order panel with qty +/-, remove, clear, source toggle, submit + print.
- Receipt component with print-only visibility (@media print).
- Analytics dashboard with date range filter, presets (Σήμερα/7/30 μέρες), 4 stat cards, hourly bar chart, source pie chart, popular items table.
- 8/8 backend pytest tests pass; frontend flows validated end-to-end.

## Backlog
- P1: Order edit / void after submission.
- P1: Split payments (cash/card) at checkout.
- P2: Printer via dedicated ESC/POS integration (thermal printer).
- P2: Item availability toggle (86-list) with real-time updates.
- P2: Export analytics to CSV/Excel.
- P2: Delivery driver assignment for Τηλέφωνο orders.
