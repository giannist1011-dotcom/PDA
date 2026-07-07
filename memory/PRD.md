# Πεινώκιο POS - Product Requirements Document

## Problem Statement
Build a full Greek-language React restaurant PDA app for a takeaway called "Πεινώκιο". Counter-facing Point of Sale used on Windows PC/tablet. Two-panel layout, sandwich customization, order sourcing, MongoDB history, analytics dashboard with date range filter.

## Architecture
- **Backend**: FastAPI + Motor (async MongoDB)
- **Frontend**: React 19 + React Router + Tailwind + shadcn/ui + Recharts + Sonner
- **DB**: MongoDB (collection: `orders`)
- **Dark theme**: Deep Obsidian (#0D0D0D) + Amber Orange (#FF6B00), Outfit/Manrope/JetBrains Mono fonts

## User Personas
- Counter staff at a Greek fast-food takeaway - fast entry, minimal clicks
- Owner - daily/range analytics

## Core Requirements (implemented)
1. Menu browsing by 7 categories (Ορεκτικά, Αλοιφές, Τεμάχια, Σάντουιτς, Μερίδες, Αναψυκτικά, Μπύρες/Ποτά)
2. Two-panel POS layout with tap-to-add items
3. Sandwich customization modal (bread single-select, extras multi, sauces multi, double meat +1.50€ for eligible items)
4. Order source tagging (Ταμείο / Τηλέφωνο / efood / Box)
5. Auto-incrementing order number per day
6. Browser print receipt (80mm formatted)
7. Order history saved to MongoDB
8. Analytics dashboard with Από/Έως date range, presets (Σήμερα/7 μέρες/30 μέρες), stat cards, hourly bar, source pie, top items table

## What's Been Implemented (2026-02)
- Full backend: /api/orders (POST/GET), /api/orders/next-number, /api/analytics
- PDA page (/) with full menu, order flow, customization modal, print
- Analytics page (/analytics) with date range and charts
- Dark mode UI, Greek typography, touch-friendly (h-16 targets)
- Testing: 100% pass on backend (pytest 8/8) and frontend (Playwright)

## Backlog (Future)
- P1: Kitchen display / KDS view for orders in flight
- P1: Customer database + phone number recall for Τηλέφωνο orders
- P1: Cash drawer opening / receipt printer (ESC/POS) integration
- P2: Multi-user with PIN roles (cashier vs manager)
- P2: Delivery zone/pricing
- P2: Discount codes and offers
- P2: Export analytics to CSV/Excel
- P2: Inventory tracking

## Next Tasks
- Gather user feedback on real device (tablet touch experience)
- Add printer integration if physical receipt printer available
