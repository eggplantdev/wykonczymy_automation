# AGENTS.md

Repository guidance for coding agents working in this project.

## Source Of Truth

This file consolidates:

- project-specific guidance from `CLAUDE.md`
- portable global Claude rules from `~/.claude/rules/*.md`

Do not treat Claude-specific permissions, plugins, sound hooks, or desktop UI toggles as repository behavior.

## Global Agent Behavior

- Be direct, technical, and concise. No praise, filler, or empty reassurance.
- Use macOS-compatible shell examples unless the user explicitly asks for something else.
- Change as little code as possible to solve the task.
- Stay within scope and avoid touching unrelated code.
- Preserve existing comments.
- Use English for code and documentation.
- Do not invent libraries or APIs.
- When proposing terminal commands, explain what they do.

## Planning For Non-Trivial Tasks

For substantial changes, prefer this sequence:

1. Clarify architecture, data model, integration points, and breaking-change risk.
2. Criticize weak assumptions or requirement gaps before implementing.
3. Define a concrete technical approach.
4. Break implementation into small milestones.

## Response Style For Code Explanations

When answering code-related questions:

1. Start with intuition before implementation details.
2. Keep explanations concrete and practical. Pair abstract ideas with a simple example or scenario.
3. Explain why a given approach is used, including trade-offs and likely pitfalls.
4. Compare with alternative approaches, technologies, or patterns when that helps learning.
5. If the user is in learning mode, prefer ending with a small question, scenario, or exercise to confirm understanding.

Goal: build active understanding, not just passive recall.

If the conversation is in English and the user's phrasing is awkward, add a short correction note at the end only when the wording actually needs refinement.

## General Code Style

### Paradigm

- Prefer functional and declarative patterns over classes
- Prefer iteration and modularization over duplication
- Prefer immutability unless the project already uses a mutable pattern intentionally

### Naming

- Classes: `PascalCase`
- Variables and functions: `camelCase`
- Files: `kebab-case`
- Directories: `snake_case` only if already established by the repo, otherwise prefer existing project conventions
- Environment variables: `UPPERCASE`
- Booleans: use auxiliary verbs like `isLoading` or `hasError`

### File Structure

Default order:

1. Types and imports
2. Exported component or main export
3. Subcomponents
4. Helpers
5. Static content and constants

### Functions

- Keep functions focused and short where practical
- Prefer early returns over nested conditionals
- Extract reusable logic
- Prefer `map`, `filter`, and `reduce` where they improve clarity
- Prefer default parameters over defensive null checks
- Prefer an object parameter when a function would otherwise take many positional arguments

### Constants

- Avoid magic numbers
- Group related primitives into named constants or composite structures

## TypeScript

- Use TypeScript for all code
- Prefer `type` over `interface`
- Avoid `any`
- Avoid `enum`; prefer literal unions or `as const` maps
- Suffix shared type names with `T`
- Prefer `undefined` over `null` for optional values
- Use optional chaining and nullish coalescing
- Avoid non-null assertions except in tests
- Use descriptive generic names when a single letter is unclear

Project override:

- Do not add `readonly` to type properties, props, or parameters in this repo
- If you touch a file that contains unnecessary `readonly`, remove it

## React

- Use declarative JSX
- Favor named exports
- Prefer one component per file
- Use the `function` keyword for components
- Prefer early returns
- Avoid unnecessary `useEffect`
- Use Zustand selectors instead of destructuring the whole store

## Next.js

- Use the App Router
- Prefer Server Components by default
- Add `'use client'` only when needed
- Keep API routes in `app/api`
- Use `loading.tsx` and `error.tsx` where appropriate
- Prefer static generation or cache-friendly server fetching where possible

## Styling

- Use Tailwind and Shadcn patterns already established in the repo
- Prefer `rem` and `%` over `px`
- Use semantic HTML
- Ensure icon-only buttons have `aria-label`
- Keep touch targets at least `44x44`
- Use mobile-first responsive styles

## Project Stack Rules

## Project Overview

Business management dashboard for cash registers, transfers, investments, and employees.

- Framework: Next.js 16.1.6
- CMS: Payload CMS 3.73.0
- Language: Polish UI, English code

## Common Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm format:fix
pnpm typecheck
pnpm test
pnpm test -- src/__tests__/some-file.test.ts
pnpm generate:types
pnpm migrate:create
docker compose up -d
```

Local Postgres runs on port `5433`.

## Architecture

### Route Groups

- `src/app/(frontend)` - main authenticated app
- `src/app/(auth)` - login page
- `src/app/(payload)` - Payload admin panel and API routes

### Important Directories

- `src/collections` - Payload collection configs
- `src/access` - role-based access control
- `src/lib/actions` - server actions for mutations
- `src/lib/queries` - server-side fetching and cached reference data
- `src/lib/auth` - JWT auth and roles
- `src/lib/db` - raw SQL financial calculations
- `src/lib/cache` - cache tags and revalidation helpers
- `src/components/forms` - TanStack React Form setup
- `src/components/ui` - Shadcn UI components
- `src/stores` - Zustand stores
- `src/types` - shared TypeScript types
- `src/migrations` - Payload migrations

## Auth And Roles

JWT auth is handled through Payload using the `payload-token` cookie with a 24 hour lifetime.

Roles:

- `ADMIN`
- `OWNER`
- `MANAGER`
- `EMPLOYEE`

Role hierarchy is defined in `src/lib/auth/roles.ts`. Access control functions live in `src/access`.

## Mutation Pattern

All mutations should go through `protectedAction()` in `src/lib/actions`.

Expected pattern:

- `'use server'`
- `requireAuth()`
- perf logging via `perfStart()`
- return `ActionResultT`
- trigger cache revalidation where needed

## Data Fetching And Cache

- Server components use `getPayload({ config })` or `fetchReferenceData()`
- Financial calculations use raw SQL via `@vercel/postgres`
- Cache uses `unstable_cache` with tag-based invalidation
- `cacheComponents` and `'use cache'` are disabled because of a documented Vercel bug
- Revalidation uses `revalidateTag(tag, 'max')`

Known cache tags:

- `CACHE_TAGS.cashRegisters`
- `CACHE_TAGS.investments`
- `CACHE_TAGS.users`
- `CACHE_TAGS.transfers`

## Forms

- Use TanStack React Form, not React Hook Form
- Use the custom `useAppForm()` hook
- Use Zod 4 for validation
- Optimistic updates use `useOptimisticFormStore` with Zustand

## Transfer Business Logic

Transfer types:

- `INVESTOR_DEPOSIT`
- `COMPANY_FUNDING`
- `INVESTMENT_EXPENSE`
- `ACCOUNT_FUNDING`
- `EMPLOYEE_EXPENSE`
- `REGISTER_TRANSFER`
- `PAYOUT`
- `OTHER`
- `CANCELLATION`

Cancellation is modeled as an audit trail:

- the original transfer is marked `cancelled: true`
- a new `CANCELLATION` row is created
- the cancellation links back to the original row

Cash register balances are recalculated via Payload hooks on transfer create and delete.

## Project-Specific Code Style

- Do not add `readonly` to type properties, props, or parameters
- When editing a file that already contains unnecessary `readonly`, remove it

## Stack Notes

- Package manager: `pnpm` 10.27.0
- `package.json` uses `"type": "module"`
- React Compiler is enabled
- Tests live in `src/__tests__`
- Vitest aliases `@/*` to `./src/*`

Payload-specific note:

- `src/app/(payload)/layout.tsx` must include `importMap`, `serverFunction`, and `handleServerFunctions`

## Database Backups

Two backup layers are expected:

1. Neon point-in-time restore with a 6 hour window
2. Automated backups through a pre-push hook and a GitHub Actions workflow

Restore flow:

```bash
gunzip wykonczymy-backup-YYYYMMDD-HHMMSS.sql.gz
psql "$DB_POSTGRES_URL" < wykonczymy-backup-YYYYMMDD-HHMMSS.sql
```

Required GitHub Actions secrets:

- `POSTGRES_URL`
- `FTP_HOST`
- `FTP_USER`
- `FTP_PASS`

## Environment Variables

Validated in `src/lib/env.ts`:

- `NEXT_PUBLIC_FRONTEND_URL`
- `DB_POSTGRES_URL`
- `PAYLOAD_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `EMAIL_USER`
- `EMAIL_PASS`
- `EMAIL_HOST`
- `META_APP_SECRET`
- `META_APP_ID`
- `META_APP_TOKEN`
- `META_VERIFY_TOKEN`
