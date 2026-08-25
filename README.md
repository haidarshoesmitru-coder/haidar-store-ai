# Haidar Store AI

Production foundation — Sprint 1. See `sprint-1-foundation-notes.md` (shared alongside this repo)
for the full folder-by-folder rationale.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run prisma:generate
npm run prisma:migrate       # creates roles/users tables
npx tsx prisma/seed.ts       # seeds staff/manager/admin roles
npm run dev
curl http://localhost:3000/api/health   # confirms app + DB are up
```

## What's here (Sprint 1 scope)

- Next.js App Router + strict TypeScript foundation
- Tailwind CSS on top of a deliberate design-token palette (`src/app/globals.css` + `tailwind.config.ts`)
- Config/env validation, structured logging, error handling framework
- Prisma + Repository Pattern (Role/User only — full catalog/order schema
  ships module-by-module in later sprints)
- Auth (NextAuth, database sessions) + RBAC foundation (staff < manager < admin)
- API base architecture (`createApiHandler`) — every future route builds on this
- Health check endpoint (`GET /api/health`) — confirms app + DB connectivity
- Shared UI foundation (Button, Input, Card, Skeleton, Error/Empty states)
- Error/loading/not-found boundaries at the app root

## What's deliberately NOT here yet

Product management, categories, inventory, orders, AI chat, WhatsApp
integration, admin dashboard, customer features — all out of Sprint 1 scope
by design. Each lands as its own module in `src/features/`, following the
pattern already established in `src/features/auth/`.

## Folder map

```
src/
  app/            Next.js routes only — no business logic
  features/       one folder per domain module (auth today)
  shared/         cross-cutting: config, lib, ui, types, validation, utils
  server/         server-only concerns: auth, middleware
  repositories/   generic repository base
prisma/           schema + seed
```
