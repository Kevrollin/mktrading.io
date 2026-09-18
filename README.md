# MKTrading

MKTrading is a digital trading platform. This repository currently contains **Milestone 1: Foundation + Public Marketing Site** — a Next.js/TypeScript scaffold, a light/dark design-token system, a reusable accessible component library, and the complete informational public website.

## Current scope

This milestone is a pure frontend build: no server, no database, no authentication logic, and no real payment/crypto/KYC integration. All market data on the site is hardcoded, deterministic sample data, clearly labeled as such — it is not live and does not represent real prices. `/login` and `/register` are honest placeholders, not functional forms.

Explicitly out of scope for this milestone: authentication, the trading terminal, user dashboard, wallet/ledger, and admin system. Those follow in later milestones.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4 (tokens defined in `app/globals.css`)
- `next-themes` for light/dark (default: system preference)
- Radix UI primitives (accordion, tabs, tooltip, dialog) for accessible interaction
- `lucide-react` for icons

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run lint   # ESLint
npm run build  # production build + type check
```

## Project structure

- `app/` — routes (App Router)
- `components/ui/` — generic, reusable primitives (Button, Card, Badge, Callout, etc.)
- `components/layout/` — header, footer, navigation
- `components/marketing/` — domain-specific public-site components (market cards, step flows, legal-content renderer, etc.)
- `lib/` — utilities, constants, sample market data, and legal-content copy
- `types/` — shared TypeScript types
