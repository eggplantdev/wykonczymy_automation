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
pnpm migrate:create     # Create new Payload migration
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

All mutations use `withAction()` wrapper (`src/lib/actions/`):

- `'use server'` directive
- `requireAuth()` guard
- Perf logging via `perfStart()`
- Returns `ActionResultT` (success/error)
- Auto cache revalidation via tags

### Data Fetching

- Server components use `getPayload({ config })` or `fetchReferenceData()` (cached)
- Financial calculations use raw SQL via `@vercel/postgres`
- Cache: Next.js `'use cache'` + `cacheLife()` + `cacheTag()` from `src/lib/cache/`
- Tags: `CACHE_TAGS.cashRegisters`, `.investments`, `.users`, `.transfers`

### Forms

- **TanStack React Form** (not React Hook Form) with `useAppForm()` hook
- **Zod** for validation schemas
- Optimistic updates via `useOptimisticFormStore` (Zustand) — fire-and-forget pattern

### Transfer Business Logic

Transfer types: `INVESTOR_DEPOSIT`, `COMPANY_FUNDING`, `INVESTMENT_EXPENSE`, `ACCOUNT_FUNDING`, `EMPLOYEE_EXPENSE`, `REGISTER_TRANSFER`, `PAYOUT`, `OTHER`, `CANCELLATION`. Cancellation creates audit trail (original marked `cancelled: true`, new CANCELLATION row links back). Cash register balances recalculated via Payload hooks on transfer create/delete.

## Tech Stack Specifics

- **pnpm 10.27.0** as package manager, `"type": "module"` in package.json
- **Payload 3.73.0** — `(payload)/layout.tsx` must include `importMap`, `serverFunction`, `handleServerFunctions` (copy from template)
- **Vercel Postgres** (Neon) + **Vercel Blob** for media storage
- **React Compiler** enabled (`reactCompiler: true` in next.config)
- **Zod 4** for all validation
- Tests in `src/__tests__/`, Vitest config aliases `@/*` → `./src/*`

## Environment Variables

Required (validated at startup via `src/lib/env.ts`):
`NEXT_PUBLIC_FRONTEND_URL`, `DB_POSTGRES_URL`, `PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_HOST`, `META_APP_SECRET`, `META_APP_ID`, `META_APP_TOKEN`, `META_VERIFY_TOKEN`
