# Worker account (EX-985) — Plan Brief

> Full plan: `context/changes/2026-10-05-worker-account/plan.md`
> Research: `context/changes/2026-10-05-worker-account/research.md`

## What & Why

An EMPLOYEE logs in and lands on his own `/pracownicy/<id>`, read-only. The page shows his kasy with
saldo, his sprzęt, every transfer that touches him, and his kosztorysy with ready `/z/` report links.
The manager no longer hands out links, and the worker no longer goes through the kasa view.

## Starting Point

Today an EMPLOYEE is redirected to his `WORKER` kasa, or gets a 404 if he has none (28/49). The worker
page is management-only and shows payouts only. Report links exist only after a manager clicks.

## Desired End State

The worker sees only his own page. Any other worker page and any `/kasa/[id]` give 404, and the page
has no control that would refuse him. A manager and the worker see the same transfer scope, and
Faktury/Drukuj never cover more than that scope. Every etap assignment yields a link, and existing
pairs are backfilled.

## Key Decisions Made

| Decision            | Choice                                                                             | Why                                                           | Source           |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------- |
| Transfer scope      | `worker = id OR kasa ∈ his kasy`, for the manager too                              | One list, zaliczki and wydatki visible                        | change.md        |
| Composition         | `{ ...urlFilters, and: [scope] }` + `and` in `where-to-sql`                        | `and: [scope, url]` breaks the sum tile and top-level readers | Research         |
| Worker without kasy | Scope without kasa branches                                                        | `IN ()` is a Postgres syntax error                            | Research         |
| Faktury/Drukuj      | Available; new action rebuilds the scope on the server from worker id + URL params | A client `Where` would expose the whole table                 | Owner / Plan     |
| `/kasa/[id]`        | Management only; EMPLOYEE gets 404                                                 | The kasa view for workers is retired                          | Owner            |
| Link mint           | In `insertStageMembers`, `ON CONFLICT DO NOTHING`, unconditional                   | Single write chokepoint, same transaction                     | Research / Owner |
| Backfill            | SQL migration, `gen_random_uuid()` tokens                                          | No pgcrypto; token format never validated                     | Owner            |
| Manager menu        | Rotation only; block reason shown as a note next to the link                       | Logged-in worker always sees the current link                 | Owner            |
| Kosztorys list      | `active` / `planowana` / `quote`, not trashed                                      | Owner: no completed                                           | Owner            |
| Investment links    | Kept for EMPLOYEE (bounce to his page)                                             | Decision 3                                                    | Owner            |

## Scope

**In scope:** `and` translator, scope builder, page and kasa gates, equipment read gate, read-only
rendering, worker-scoped Faktury/Drukuj, auto-mint, backfill migration, rotation-only menu, kosztorys
list, AGENTS.md phone exception, test-plan risk #22 and #19 revision.

**Out of scope:** worker expenses (EX-971), username login, manager-set passwords, server-side
template guard for etapy, narrowing the investment filter, mobile table cards, view-as.

## Architecture / Approach

The `Where` is the only access boundary on both planes (Payload list, SQL sum). One builder composes
the URL filters on top and the scope inside `and`, and the page and the new download action both call
it. The link mint is a side effect inside the existing transaction that inserts etap members.

## Phases at a Glance

| Phase              | What it delivers                                        | Key risk                                               |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------------ |
| 1. Transfer scope  | `and` in SQL, scope builder, wider list for the manager | Sum tile and list disagree                             |
| 2. Employee access | Gates, read-only page, scoped Faktury/Drukuj            | A missed control or a client channel that widens scope |
| 3. Auto link       | Mint in chokepoint, backfill, rotation-only menu        | Mint aborting the etap transaction                     |
| 4. Kosztorys list  | Section with `/z/` links, works at 390px                | Wrong status set                                       |
| 5. Docs            | AGENTS.md, lessons.md                                   | —                                                      |

**Prerequisites:** local docker DB with the dump; the Nikolajewicz login for manual checks.
**Estimated effort:** ~2 sessions.

## Open Risks & Assumptions

- `forgot-password` returns 500 outside production (mail gate), so a worker setting his own password
  can be verified only on production.
- `view-as` lands in parallel. It must resolve the effective user inside `getCurrentUserJwt` for the
  „own id" gate to hold.

## Success Criteria (Summary)

- Nikolajewicz logs in, sees his kasy, zaliczki, wydatki, sprzęt and 3 active kosztorysy with working
  links, on a phone, and nothing else.
- A manager adding a worker to an etap never has to generate a link.
