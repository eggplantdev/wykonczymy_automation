# Lead Capture — FB Lead Ads Webhook → Leads Store — Plan Brief

> Full plan: `context/changes/leads-capture-fb-webhook/plan.md`
> Design spec: `context/reference/superpowers/archive/2026-07-06-leads-capture-design.md`

## What & Why

Build the first increment of a centralized store of everyone who has shown interest in the company.
The FB Lead Ads webhook already fires and fetches lead data but only `console.log`s it — leads are
captured nowhere. This turns it into a resilient capture path (verify → store → notify) plus a table
to actually see and triage them. The UI presents them as **form submissions** (`/zgloszenia`,
"Zgłoszenia") since each row is one submission; the code slug stays `leads` (source-agnostic).

## Starting Point

`src/app/(frontend)/api/webhooks/facebook-leads/route.ts` does the Meta handshake and logs fetched
`field_data`. No HMAC verification, no `leads` collection, no notification, no UI. The table stack,
email adapter, migration workflow, and access helpers all already exist to build against.

## Desired End State

A production lead is signature-verified, persisted to a new `leads` collection (idempotent), and
triggers an internal heads-up email. A Management user opens `/zgloszenia`, sees every submission with notify /
auto-reply status, and toggles a follow-up status `new ↔ contacted` inline. Malformed or emailless
leads raise a safety-net alert; a mail failure leaves the lead stored with `notifyStatus = 'failed'`.

## Key Decisions Made

| Decision             | Choice                                               | Why                                                          | Source |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------------ | ------ |
| Data model           | Append-only source-agnostic event log                | One row per submission; source #2 (own forms) plugs in later | Frame  |
| Extraction           | Type-driven (EMAIL/PHONE/FULL_NAME) + regex fallback | Only Meta-typed fields are safe as columns; rest stays raw   | Frame  |
| Ordering             | Store-then-notify                                    | A mail failure must never lose a captured lead               | Frame  |
| Admin labels         | Bilingual `{ en, pl }`                               | Actual repo convention (investments/transfers), not moodbox  | Plan   |
| Read access          | Management (Admin/Owner/Manager)                     | Managers do the outreach; consistent with investments        | Plan   |
| Editable status      | Two-state toggle `new/contacted`                     | Reuses the investments optimistic-toggle component wholesale | Plan   |
| Test scope           | All 5 risk tests (2 integration)                     | Integration tests guard the silent-loss modes by design      | Plan   |
| `clients` collection | Deferred (direction = option B)                      | An investment ≠ a client identity; build after leads flow    | Plan   |

## Scope

**In scope:** HMAC verification · `leads` collection + hand-written migration · pure verify/normalize/schema
units · store-then-notify via `payload.sendEmail` · Zod safety-net alert · `/leady` table with editable
contactStatus · all 5 risk tests.

**Out of scope:** `clients` collection, lead-facing auto-reply, Sentry, notification bell/websockets,
`failed`-notification retry cron, historical backfill, prod migration/deploy/push.

## Architecture / Approach

Webhook route stays thin and orchestrates focused units under `src/lib/leads/`
(`verify-signature`, `fetch-lead`, `lead-schema`, `normalize-lead`, `store-lead`, `notify`). Read side
mirrors the investments table stack: `queries/leads.ts` → `tables/leads.tsx` → `(frontend)/leady/page.tsx`,
with an inline status toggle via a `protectedAction`. Route-handler context uses `revalidateTag`; the
Server-Action status update uses `updateTag`.

## Phases at a Glance

| Phase                                   | What it delivers                         | Key risk                                               |
| --------------------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| 1. Data model & config                  | `leads` collection + migration + env var | Hand-written migration (enum order, compound index)    |
| 2. Pure units (TDD)                     | verify / normalize / schema + unit tests | Normalization picking the wrong field / dropping email |
| 3. Persistence, notify & webhook wiring | Full capture flow + 2 integration tests  | HMAC over raw body; store-before-notify ordering       |
| 4. Submissions table view               | `/zgloszenia` page with editable status  | Route-handler vs server-action revalidation mismatch   |

**Prerequisites:** local docker Postgres (5433); `META_*` env vars present; `.local/fb-leads` dump for fixtures.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- Extraction reliability depends on Meta field types being consistent across forms — mitigated by the
  regex fallback + safety-net alert, proven against the 62-lead dump.
- Integration tests assume a usable Payload Local API test-DB path; if none exists yet, standing one up
  is part of Phase 3.
- HMAC correctness hinges on hashing the exact raw bytes — the plan mandates `request.text()` before parse.

## Success Criteria (Summary)

- A live test lead lands in `/zgloszenia` with a heads-up email and `notifyStatus = 'sent'`; a re-fire
  creates no duplicate.
- A bad signature is rejected (403) and nothing is stored; a stubbed mail failure leaves the lead
  persisted with `notifyStatus = 'failed'`.
- All five risk tests green; typecheck / lint / build clean.
