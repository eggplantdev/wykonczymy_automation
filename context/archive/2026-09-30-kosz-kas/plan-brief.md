# Trash for an unused kasa (EX-917) — Plan Brief

> Full plan: `context/changes/2026-09-30-kosz-kas/plan.md`
> Research: `context/changes/2026-09-30-kosz-kas/research.md`

## What & Why

A kasa created by mistake or never used can't be removed from the app today. This change lets you
send it to the trash (`/kosz`), bring it back, delete it for good, or let it purge itself after 30
days. It is the second kind in the trash after investments, so it also brings in the shared `/kosz`
prep: a per-kind table and one retention constant. It leaves a seam for EX-918, which trashes a
worker together with their empty kasa.

## Starting Point

„Unused" already exists as the kasa delete guard: no live transactions, and cancelled ones don't
count. There is no in-app delete. The kasa list serves both the pickers and the names on transaction
rows. Nothing refuses a booking into a particular kasa, and a kasa's owner can be changed freely.

## Desired End State

A trashed kasa vanishes from `/kasy`, the pickers, the filters and its own page. It keeps its name
(without a link) on its cancelled transactions. It cannot be booked into, edited, or set as a
default. `/kosz` gets a „Kasy" section. A used kasa's owner is locked.

## Key Decisions Made

| Decision               | Choice                                                             | Why                                                                            | Source           |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------------- |
| What counts as use     | Live transactions only                                             | The owner's ruling; the existing delete guard already says so                  | Research (owner) |
| WORKER kasa on its own | Always trashable                                                   | The employee lands on a 404 dashboard, a state 21 employees already have       | Plan             |
| Owner handover         | Locked once the kasa has live transactions (hook + disabled field) | „A kasa cannot be handed over" was not true in the code                        | Plan             |
| Auto-purge             | Yes, after 30 days                                                 | A trashable kasa is empty by definition                                        | Plan             |
| Delete-forever confirm | Plain confirm always                                               | Nothing of value is lost beyond cancelled rows' kasa name                      | Plan             |
| MANAGER and MAIN       | Hidden in `/kosz`, refused in the actions                          | A MANAGER never sees MAIN anywhere else                                        | Plan             |
| Default kasa on trash  | Cleared on trash, not restored                                     | One write instead of four reader filters                                       | Plan             |
| Name map vs pickers    | Ref data split into live + trashed; only the name map reads both   | A new picker cannot forget the filter (risk #15)                               | Plan             |
| Write gate             | Transfers `validate` hook, after the cancellation early returns    | The only complete gate; a stale form or default otherwise books into the trash | Research         |
| Retention constant     | `ENTITY_TRASH_RETENTION_DAYS` in `constants/trash.ts`              | Avoids a name clash with the planned file trash                                | Plan             |

## Scope

**In scope:**

- the `trashed_at` column;
- the server gates (booking, edit, default, owner);
- the ref-data split;
- the three actions;
- the purge and its cron step;
- the `/kosz` kinds table and „Kasy" section;
- „Do kosza" on `/kasy`;
- the owner-lock UI;
- docs.

**Out of scope:**

- EX-918's pair (a seam only);
- kasa handover;
- flota and sprzęt;
- entity tags;
- admin-panel filters;
- an E2E spec;
- the 21 employees who already have no WORKER kasa.

## Architecture / Approach

Mirror the investment trash layer by layer:

- a blocker in `lib/cash-registers/`;
- SQL in `lib/db/cash-register-trash.ts`;
- actions in `lib/actions/cash-register-trash.ts`;
- the purge in `lib/cash-registers/purge-trash.ts`;
- a second cron step.

Two differences from the investment trash:

- The kasa list is split in the ref data rather than filtered in its SQL, because it doubles as a
  name map.
- The trash core takes a `req`, so EX-918 can trash the worker and the kasa in one transaction.

## Phases at a Glance

| Phase                     | What it delivers                                          | Key risk                                                      |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| 1. Schema + server gates  | Column; booking, edit, default and owner refusals         | Gate placement breaking cancellation or invoice attach        |
| 2. Readers                | Live/trashed split; names kept on rows                    | A consumer silently needing the trashed list                  |
| 3. Backend + purge + cron | Trash/restore/delete-forever, 30-day purge, constant move | Default-clear bypasses user hooks; the tag list must cover it |
| 4. UI + docs              | `/kosz` „Kasy", „Do kosza", locked owner field            | Template/investment copy regressing in the kinds refactor     |

**Prerequisites:** the local DB is migrated from this worktree (check `git status src/migrations` in
the main checkout first). Worktree `../wykonczymy-worktrees/kosz-kas`, branch `kosz-kas`.

**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Trashing an active employee's WORKER kasa lands them on a 404 dashboard. This was accepted, and
  EX-918's pair is the intended route.
- Delete-forever blanks the kasa on its cancelled rows. This was accepted by the owner.

## Success Criteria (Summary)

- An unused kasa can be trashed, restored and purged, and a used one is refused with a sentence.
- A trashed kasa cannot receive money by any route, including a stale form.
- Old cancelled rows still say which kasa they were.
