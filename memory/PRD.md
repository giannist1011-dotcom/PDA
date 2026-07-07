# Πεινώκιο POS – PRD

## Original Problem Statement
Multi-tenant Greek restaurant PDA/POS SaaS. Started as a single-store app for takeaway "Πεινώκιο"; extended so any restaurant can register and manage their own menu, orders and analytics — all scoped per account. Dark mode, all text in Greek.

## Users / Personas
- Restaurant owner/manager (registers store, manages menu & customization options)
- Counter staff (uses PDA to take orders and print receipts)

## Core Requirements
- Multi-tenant: one account = one restaurant/store, all data scoped by user_id.
- JWT Bearer auth (register + login + me) with 30-day tokens in localStorage.
- Header shows the logged-in restaurant's name.
- Menu management: CRUD categories, CRUD items (name/price/category/customizable flag/double-meat-eligible flag), edit customization options (bread, extras, sauces, double-meat surcharge).
- PDA POS: category tabs, tap-to-add, sandwich customization modal, order panel with qty/source/total, 80mm receipt print, auto-incrementing order number per store per day.
- Analytics: "Από" / "Έως" date range filter + presets, total orders/revenue/avg, by-source pie, popular items table, hourly bar chart. All scoped per user.
- Πεινώκιο data seeded to demo account (demo@peinokio.gr / demo1234) and used as starter template for new registrations.

## Architecture
- Backend: FastAPI + Motor (MongoDB) at 0.0.0.0:8001, all routes prefixed /api. JWT Bearer (PyJWT + bcrypt).
- Frontend: React + React Router + Tailwind + shadcn/ui + Recharts. Axios instance with token interceptor.
- Design: Dark mode, orange (#FF6B00) accent, Outfit/Manrope/JetBrains Mono fonts.

### Endpoints
- POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
- GET /api/menu/config
- POST /api/menu/categories, PUT /api/menu/categories/{id}, DELETE /api/menu/categories/{id}
- POST /api/menu/items, PUT /api/menu/items/{id}, DELETE /api/menu/items/{id}
- PUT /api/menu/customization
- GET /api/orders/next-number, POST /api/orders, GET /api/orders
- GET /api/analytics

### Collections
- users (email uniq, password_hash bcrypt, restaurant_name, customization)
- categories (user_id, id, name, order)
- items (user_id, id, name, price, category, customizable, double_meat_eligible)
- orders (user_id, id, order_number, items, subtotal, total, source, created_at)

## Implemented (2026-02)
- V1 (single-tenant): PDA, sandwich modal, order flow, printing, analytics with Από/Έως — done.
- V2 (multi-tenant SaaS): auth (register/login/me), per-user data scoping, menu management UI, restaurant name in header, demo account with pre-seeded Πεινώκιο menu, starter menu on register — done.
- Testing: 10/10 backend pytest tests pass; full frontend e2e verified.

## Backlog
- P1: Order edit / void after submission (per store).
- P1: Split payments (cash/card).
- P1: Password reset flow (magic link / email).
- P2: Staff roles (owner/cashier) per store.
- P2: Item availability toggle (86-list) with real-time sync.
- P2: Export analytics to CSV/Excel.
- P2: Thermal ESC/POS direct printing.
- P2: Multi-branch support (one owner, many stores).
