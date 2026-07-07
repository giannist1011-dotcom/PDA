# Πεινώκιο POS – PRD

## Original Problem Statement
Multi-tenant Greek restaurant PDA/POS SaaS. Each account = one restaurant/store with fully isolated menu, orders and analytics. Dark mode, all text in Greek.

## Users / Personas
- Restaurant owner/manager (menu management, stock/shortages, staff schedule)
- Counter staff (uses PDA to take orders)

## Core Requirements
- Multi-tenant with JWT Bearer auth
- Restaurant-branded PDA (name in header, per-store data)
- Menu management with categories, items and customization options
- POS order flow with sandwich customization modal, source tagging, 80mm receipt print
- Analytics with Από/Έως date range filter
- Stock management (Ελλείψεις): availability toggle + notes; unavailable items greyed out in PDA; shopping list with buy checkboxes
- Weekly staff schedule (Πρόγραμμα υπαλλήλων): employees, shifts per day, week navigation

## Architecture
- Backend: FastAPI + Motor (MongoDB), JWT Bearer, all routes /api-prefixed
- Frontend: React + React Router + Tailwind + shadcn/ui + Recharts, AppShell with burger drawer nav
- Design: Dark mode, orange (#FF6B00) accent, Outfit/Manrope/JetBrains Mono fonts

### Endpoints
- Auth: /api/auth/{register,login,me}
- Menu: /api/menu/config, /api/menu/categories, /api/menu/items (+PATCH /{id}/availability), /api/menu/customization
- Orders: /api/orders/next-number, /api/orders, /api/analytics
- Shopping: /api/shopping (list/create/update/delete)
- Employees: /api/employees (list/create/update/delete – cascades shifts)
- Shifts: PUT /api/shifts (upsert), GET /api/shifts?week_start, DELETE /api/shifts?…

### Collections
users, categories, items (+ available/unavailable_note), orders, shopping, employees, shifts (unique index user_id+employee_id+week_start+day)

## Implemented (2026-02)
- V1 (single-tenant POS) – done
- V2 (multi-tenant SaaS with auth + menu management) – done
- V3 (burger navigation drawer + Ελλείψεις page with availability & shopping list + Πρόγραμμα υπαλλήλων weekly schedule) – done
- Testing: 15/15 backend pytest passing, all frontend flows verified end-to-end

## Backlog
- P1: Password reset flow (email link)
- P1: Order edit / void after submission
- P1: Split payments (cash/card)
- P2: Staff roles (owner/cashier)
- P2: CSV export for orders/analytics
- P2: Thermal ESC/POS direct printing
- P2: Multi-branch (one owner, many stores)
- P2: Payroll/hours summary from shifts
- P2: Push shift schedule to employees via SMS/email
