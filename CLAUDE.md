---
description:
alwaysApply: true
---

# When answering code-related questions, follow these rules:

1. **Intuition first:** When explaining concepts, make them understandable for someone who is still learning.
2. **Concrete and practical:** Back every complex abstract concept (formulas, architecture) with a simple, concrete example or scenario.
3. **"Why":** Don't just explain how it works; explain _why_ we chose this approach, what trade-offs are involved, and what potential mistakes/pitfalls exist.
4. **Broader perspective:** Compare discussed concepts with other technologies, languages, and frameworks that solve similar problems differently, so I learn alternative approaches to architecture and patterns. Especially design patterns, always explain if a pattern is used or something close to a pattern - user wants to make learnig design patterns a priority.
5. **Active learning rule:** Never end a response with just a period. **ALWAYS** end with a specific question, "what if" scenario, or a small problem to solve to test my understanding. Do not continue until I give the correct answer — if I'm wrong, explain why and ask again in a different way.

**Goal:** Build intuition and active understanding, not just passive knowledge.

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Business management dashboard (cash registers, transfers, investments, employees) built with **Next.js 16.1.6** + **Payload CMS 3.73.0**. Polish-language app with English code.

## Commands

```bash
pnpm dev                # Dev server with Turbopack
pnpm build              # Payload generate:importmap + generate:types + migrate + next build
pnpm lint               # ESLint
pnpm format:fix         # Prettier
pnpm typecheck          # tsc --noEmit
pnpm test               # Vitest (single run)
pnpm test:watch         # Vitest watch mode
pnpm test -- src/__tests__/some-file.test.ts  # Run single test file
pnpm generate:types     # Regenerate Payload types → src/payload-types.ts
pnpm migrate:create     # Create new Payload migration — ALWAYS use this first, then tweak FK constraints if needed. Never write migrations from scratch (easy to miss Payload internal tables like payload_locked_documents_rels).
```

Local DB: `docker compose up -d` (Postgres 17 on port 5433).

## Architecture

### Route Groups (`src/app/`)

- `(frontend)` — Main authenticated app (dashboard, transfers, investments, employees)
- `(auth)` — Login page
- `(payload)` — Payload CMS admin panel and API routes

### Key Directories (`src/`)

| Directory           | Purpose                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `collections/`      | Payload collection configs (users, cash-registers, transfers, investments, other-categories, media) |
| `access/`           | Payload access control functions (role-based)                                                       |
| `lib/actions/`      | Server actions — all mutations go through here                                                      |
| `lib/queries/`      | Server-side data fetching (cached reference data, SQL queries)                                      |
| `lib/auth/`         | JWT auth helpers, role definitions                                                                  |
| `lib/db/`           | Raw SQL via Vercel Postgres (balance calculations)                                                  |
| `lib/cache/`        | Cache tags and revalidation helpers                                                                 |
| `components/forms/` | TanStack React Form components with custom `useAppForm()` hook                                      |
| `components/ui/`    | Shadcn UI components                                                                                |
| `stores/`           | Zustand stores                                                                                      |
| `types/`            | Shared TypeScript types                                                                             |
| `migrations/`       | Payload DB migrations                                                                               |

### Auth & Roles

JWT-based auth via Payload (`payload-token` cookie, 24h). Roles: `ADMIN`, `OWNER`, `MANAGER`, `EMPLOYEE`. Role hierarchy defined in `src/lib/auth/roles.ts`. Access control functions in `src/access/`.

### Server Action Pattern

All mutations use `protectedAction()` wrapper (`src/lib/actions/`):

- `'use server'` directive
- `requireAuth()` guard
- Perf logging via `perfStart()`
- Returns `ActionResultT` (success/error)
- Auto cache revalidation via tags

### Data Fetching

- Server components use `getPayload({ config })` or `fetchReferenceData()` (cached)
- Financial calculations use raw SQL via `@vercel/postgres`
- Cache: `unstable_cache` from `next/cache` with tag-based invalidation (`cacheComponents` / `'use cache'` disabled due to Vercel bug — see `docs/vercel-server-action-bug-report.md`)
- Tags: `CACHE_TAGS.cashRegisters`, `.investments`, `.users`, `.transfers`
- Revalidation uses two different functions depending on context:
  - **Server Actions** (`lib/actions/`, `lib/cache/revalidate.ts`): use `updateTag()` — forces immediate cache expiration
  - **Payload hooks** (`hooks/`): use `revalidateTag()` — because hooks run in Route Handler context where `updateTag` throws. Never import `lib/cache/revalidate.ts` from Payload hooks.

### Forms

- **TanStack React Form** (not React Hook Form) with `useAppForm()` hook
- **Zod** for validation schemas
- Optimistic updates via `useOptimisticFormStore` (Zustand) — fire-and-forget pattern

### Transfer Business Logic

Transfer types: `INVESTOR_DEPOSIT`, `COMPANY_FUNDING`, `INVESTMENT_EXPENSE`, `ACCOUNT_FUNDING`, `EMPLOYEE_EXPENSE`, `REGISTER_TRANSFER`, `PAYOUT`, `OTHER`, `CANCELLATION`. Cancellation creates audit trail (original marked `cancelled: true`, new CANCELLATION row links back). Cash register balances recalculated via Payload hooks on transfer create/delete.

## Code Style (project-specific)

- Do not add `readonly` to type properties, props, or parameters
- When editing a file that has unnecessary `readonly`, remove it

## Tech Stack Specifics

- **pnpm 10.27.0** as package manager, `"type": "module"` in package.json
- **Payload 3.73.0** — `(payload)/layout.tsx` must include `importMap`, `serverFunction`, `handleServerFunctions` (copy from template)
- **Vercel Postgres** (Neon) + **Vercel Blob** for media storage
- **React Compiler** enabled (`reactCompiler: true` in next.config)
- **Zod 4** for all validation
- Tests in `src/__tests__/`, Vitest config aliases `@/*` → `./src/*`

## Database Backup Strategy

Two layers of protection:

1. **Neon point-in-time restore** — 6-hour rollback window (built into Neon)
2. **Automated backups** — two mechanisms:
   - **Pre-push hook**: `db:dump` runs on every push to prod (local SQL dump)
   - **GitHub Actions** (`.github/workflows/db-backup.yml`): Daily `pg_dump` at 2:00 AM UTC, compressed with gzip, uploaded via FTPS to remote server. Retains 7 days of backups.

### Restore from backup

```bash
gunzip wykonczymy-backup-YYYYMMDD-HHMMSS.sql.gz
psql "$DB_POSTGRES_URL" < wykonczymy-backup-YYYYMMDD-HHMMSS.sql
```

### GitHub Actions secrets required

`POSTGRES_URL`, `FTP_HOST`, `FTP_USER`, `FTP_PASS`

## Environment Variables

Required (validated at startup via `src/lib/env.ts`):
`NEXT_PUBLIC_FRONTEND_URL`, `DB_POSTGRES_URL`, `PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_HOST`, `META_APP_SECRET`, `META_APP_ID`, `META_APP_TOKEN`, `META_VERIFY_TOKEN`
