# Πεινώκιο POS – PRD

## Original Problem Statement
Multi-tenant Greek restaurant PDA/POS SaaS with per-store isolation, role-based profiles (Ιδιοκτήτης / Υπάλληλος), Greek dark-mode UI.

## Users / Personas
- Store owner / manager (Ιδιοκτήτης — full access, incl. PIN management)
- Counter staff (Υπάλληλος — PDA + schedule view only)

## Core Requirements
- Multi-tenant with JWT Bearer auth
- Two-tier auth: store login (email+password) → profile selection (Ιδιοκτήτης / Υπάλληλος) with 4-digit PINs
- Owner: full access (PDA, Στατιστικά, Διαχείριση μενού, Ελλείψεις, Πρόγραμμα, Ρυθμίσεις)
- Employee: PDA + Πρόγραμμα (read-only) only
- Restaurant-branded PDA (name + profile badge in header)
- Menu management: categories, items, per-item option groups (single/multi/required), Πεινώκιο-style sandwich options
- POS order flow with option-group modal, source tagging, 80mm receipt print, auto-incrementing order number/day
- Phone-order details: Παράδοση (name/phone/address/floor) or Takeaway (name/phone); saved & printed
- Analytics with Από/Έως range filter
- Stock management (Ελλείψεις): availability toggle + notes; unavailable items greyed in PDA; shopping list
- Weekly staff schedule: employees, shifts per day, week navigation

## Architecture
- Backend: FastAPI + Motor (MongoDB); JWT Bearer with `profile` claim; require_owner dependency for sensitive endpoints
- Frontend: React + React Router + Tailwind + shadcn/ui + Recharts; AppShell with role-filtered burger drawer
- Design: Dark, orange (#FF6B00) accent, Outfit/Manrope/JetBrains Mono fonts

### Endpoints
- Auth: /api/auth/{register,login,me}
- Profile: POST /api/profile/select, POST /api/profile/exit, PUT /api/profile/pin
- Menu: /api/menu/config, categories CRUD, items CRUD (+PATCH /{id}/availability), PUT /menu/customization
- Orders: /api/orders/next-number, POST /api/orders (with optional delivery), GET /api/orders, GET /api/analytics
- Shopping: /api/shopping (CRUD)
- Employees: /api/employees (CRUD, cascades shifts)
- Shifts: PUT /api/shifts (upsert), GET /api/shifts?week_start, DELETE /api/shifts

### Collections
users (+owner/employee_pin_hash, *_pin_set flags), categories, items (+available, unavailable_note, option_groups), orders (+delivery), shopping, employees, shifts (unique index user_id+employee_id+week_start+day)

## Implemented (2026-02)
- V1 (single-tenant POS) — done
- V2 (multi-tenant SaaS with auth + menu management) — done
- V3 (burger nav + Ελλείψεις + Πρόγραμμα) — done
- V4 (profile PIN system + Ρυθμίσεις + option groups + phone delivery + menu delete AlertDialog fix) — done
- Testing: 17/17 backend + 100% frontend E2E verified (iteration 4)

## Backlog
- P1: Password reset flow
- P1: Order edit / void after submission
- P1: Split payments (cash/card)
- P2: Time-clock (per-employee PIN clock-in/out from PDA)
- P2: Payroll / hours summary from shifts
- P2: CSV export for orders/analytics
- P2: Thermal ESC/POS direct printing
- P2: Multi-branch (one owner, many stores)
- P2: Split server.py into routers (currently ~780 lines)
