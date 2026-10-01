# Trash for an unused worker (EX-918) — Plan Brief

> Full plan: `context/changes/2026-10-01-kosz-pracownikow/plan.md`
> Research: `context/changes/2026-10-01-kosz-pracownikow/research.md`

## What & Why

A worker added by mistake or never used can't be removed from the app today. This change lets a
manager send them to the trash (`/kosz`) together with every kasa they own, provided all of it is
unused; restore them; delete them for good; or let them purge after 30 days. It also closes the
login gap that a trash would otherwise leave open (and that „Aktywny" off already leaves open), and
gives `/kosz` one policy across every kind.

## Starting Point

„Unused" already exists as the users delete guard, but its kasa probe blocks on any owned kasa,
empty or not. The kasa trash (EX-917) shipped the `/kosz` machinery and a seam for trashing a kasa
inside someone else's transaction. Auth reads only the JWT, so nothing refuses a disabled account;
`/admin` and REST check stored sessions. No self-delete or last-owner guard exists anywhere.

## Desired End State

„Do kosza" on `/pracownicy` for an unused worker. In `/kosz`, a „Pracownicy" section where each row
names the kasy that went with the worker; restore, delete forever and purge act on the pair. A
trashed worker vanishes from every list and picker, keeps their name on cancelled rows, and can't be
booked, assigned, handed equipment or reached by a report link. A trashed or deactivated account
can't log in. Nobody can remove themselves or the last OWNER/ADMIN. Every `/kosz` kind asks for the
typed name and auto-purges after 30 days, except an investment with a used kosztorys.

## Key Decisions Made

| Decision               | Choice                                                                            | Why                                                                     | Source           |
| ---------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------- |
| Auth gap               | Refuse login when trashed or inactive; drop stored sessions; no per-request check | Closes `/admin` and REST now; the app's ≤7-day JWT window is accepted   | Research (owner) |
| Who may trash          | MANAGER: EMPLOYEE only; ADMIN/OWNER: anyone                                       | Owner ruling                                                            | Research (owner) |
| Account guards         | No self, not the last live OWNER / ADMIN — also in `beforeDelete`                 | Owner ruling; `/admin` and REST had no guard either                     | Research (owner) |
| Kasy                   | All owned kasy, any type, go with the worker — one used kasa refuses              | Owner ruling; employees own AUXILIARY kasy too                          | Research (owner) |
| Pair in `/kosz`        | One row; the kasy listed under the worker, absent from „Kasy"                     | Owner ruling                                                            | Research (owner) |
| Typed name             | On delete forever, for every kind                                                 | Owner: one `/kosz` policy                                               | Research (owner) |
| Auto-purge             | 30 days for every kind, except an item still holding real work                    | Owner: one policy, different checks                                     | Research (owner) |
| Pair storage           | Derived — a trashed kasa with a trashed owner; same `trashedAt` instant on both   | No column; the invariant „live kasa ⇒ live owner" is enforced by guards | Plan             |
| Restore / delete order | Restore user then kasy; delete kasy then user; one `req`, no internal catch       | Kasa guard refuses a restore under a trashed owner; 25P02 on a catch    | Plan             |
| Sessions               | Raw delete of `users_sessions` after the user update, same transaction            | The update rewrites the sessions array from the merged doc              | Plan             |
| Home                   | `src/lib/workers/`, mirroring `src/lib/cash-registers/`                           | Same layering as EX-917                                                 | Plan             |
| MANAGER and MAIN       | A MANAGER can't trash a worker who owns a MAIN kasa                               | Consistent with the kasa trash hiding MAIN from a MANAGER               | Plan             |
| Default kasa           | Cleared on trash, not restored                                                    | Kasa precedent                                                          | Plan             |
| Snapshot restore       | A trashed member is dropped, like a deleted one                                   | `liveWorkerIds` already drops and counts                                | Plan             |
| E2E                    | Filed to the `e2e-backlog` at the review gate                                     | Same as EX-952                                                          | Plan             |

## Scope

**In scope:**

- the `users.trashed_at` column and the trashed-account freeze;
- the login refusal and session drop (trash and deactivation);
- self / last-OWNER / last-ADMIN guards;
- ref-data split and name resolvers;
- write gates (transfers, etapy, snapshot restore, equipment, kasa owner and restore, report link);
- trash / restore / delete forever, purge and its cron step;
- „Do kosza" on `/pracownicy` and the „Pracownicy" section in `/kosz`;
- typed name for every `/kosz` kind;
- docs (AGENTS.md Auth, test-plan).

**Out of scope:**

- guarding role changes or „Aktywny" off for the last OWNER;
- a per-request DB auth check;
- kasa handover;
- admin-panel filters;
- flota and sprzęt;
- an E2E spec.

## Architecture / Approach

Mirror EX-917 layer by layer. „Used" is one exported blocker (every users probe except kasy); the
collection's `beforeDelete` adds the kasa probe and the account guards, so a hard delete from any
route meets them. Trash = worker unused AND every owned kasa passes the kasa blocker, all decided
before the first write. Auth is closed at the door (`beforeLogin` + dropped sessions), not per request.

## Phases at a Glance

| Phase                              | What it delivers                                             | Key risk                                                     |
| ---------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| 1. Schema + login + account guards | Column, freeze, login refusal, self/last-owner, session drop | The freeze guard interfering with Payload's own login writes |
| 2. Readers + write gates           | Live/trashed split, names on history, every write refused    | A gate breaking cancellation of an old row naming the worker |
| 3. Trash core + actions + purge    | The pair in one transaction, restore, delete forever, cron   | A refusal returned after a write commits half a pair         |
| 4. UI                              | „Do kosza", the „Pracownicy" section with paired kasy        | Collisions with the in-flight investment-trash edits         |
| 5. One `/kosz` policy + docs       | Typed name for every kind                                    | Starts only after the other session commits                  |

**Prerequisites:** the other session's investment-trash work committed before Phases 2, 4 and 5;
local DB migrated from this tree (`git status src/migrations`, and the `_payload_migrations` name drift).

**Estimated effort:** ~3 sessions across 5 phases.

## Open Risks & Assumptions

- An app session already open stays valid until its JWT expires (≤ 7 days) — accepted by the owner.
- Plan written against the other session's uncommitted files; dependent phases re-read them first.
- A worker made used while trashed (race) is caught by the delete-forever re-count, not by the trash.

## Success Criteria (Summary)

- An unused worker and their empty kasy are trashed, restored and purged as one; a used one is
  refused with a sentence and nothing is trashed.
- A trashed or deactivated account cannot log in anywhere.
- Every `/kosz` kind asks for the name on delete forever.
