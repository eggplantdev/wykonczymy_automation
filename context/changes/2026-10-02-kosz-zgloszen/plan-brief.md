# Kosz zgłoszeń — Plan Brief

> Full plan: `context/changes/2026-10-02-kosz-zgloszen/plan.md`

## What & Why

Leads pile up on `/zgloszenia`, many of them empty (no files, no useful answers), and nothing can
remove one. EX-970 adds bulk „Do kosza" for ADMIN, OWNER and MANAGER, a „Bez plików" filter to find
the empty ones, and a „Zgłoszenia" section in `/kosz`.

Removing a lead must never cost the investment it became anything: not its data and not its photos.

## Starting Point

Leads have no trash state. The other kinds share one trash infrastructure: `TRASH_KINDS`,
typed-name delete, and a 30-day purge in the cleanup cron. The fleet kind (EX-915) is its smallest
instance.

Files are shared media rows: a promoted investment points at the same files as its lead, and a file
is deleted only once nothing references it.

## Desired End State

Select leads on `/zgloszenia` (header checkbox = the current page), click „Do kosza (N)", and they
disappear from the list, from „N nowych" and from the nav badge. `/kosz` lists them plainly with
Przywróć and Usuń na zawsze.

Usuń na zawsze, and the purge after 30 days, wipe the lead's contents. A file used by an investment
stays.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Forever = row delete? | **No: erase in place** (`erasedAt` tombstone keeps source + externalId) | The daily Facebook reconcile re-fetches the last 100 leads per form and would re-create and re-email a deleted row. |
| Hide mechanism | Hand-rolled `trashedAt` column, not Payload `trash: true` | `trash: true` would hide trashed leads from dedup (resurrection) and from the media reference scan (shared files deleted). |
| Investment independence | Never touch `investments`; reclaim only unreferenced files | Promotion shares media ids, and the existing reference scan already spares anything an investment holds. |
| Roles | ADMIN, OWNER, MANAGER | Owner ruling; matches who can see `/zgloszenia`. |
| Bulk scope | Current page only | Simple and visible; no hidden off-page selection. |
| Empty-lead finder | „Bez plików" filter (`?noFiles=1`) | The owner's target is "empty ones"; every Facebook lead qualifies. |
| `/kosz` layout | Plain section like the others, per-row actions, no bulk | Owner: "I will not be using this heavily". |
| Typed name | name → email → phone → „Zgłoszenie #id" | Many Facebook leads have only a phone; one function feeds both what is shown and what is checked. |
| Redeliveries onto a tombstone | `captureLead` sends nothing; landing attaches nothing | Otherwise a stuck `pending` status emails sales an empty lead, or files hang on an invisible row. |

## Scope

**In scope:** migration (`trashed_at`, `erased_at`), reader filters, bulk trash / restore / erase
actions, cron purge step, redelivery guards, selection + „Bez plików" on `/zgloszenia`, the `/kosz`
section, docs.

**Out of scope:** hard-deleting lead rows; bulk in `/kosz`; per-row trash on `/zgloszenia`;
selection across pages; guarding promote/attach against a stale tab; E2E (deferred to an
`e2e-backlog` issue).

## Architecture / Approach

The flow is `/zgloszenia` selection → `trashLeadsAction(ids)` → `trashedAt`. Readers then filter
`trashed_at IS NULL`.

The `/kosz` lead row offers two paths:
- `restoreLeadAction`;
- `deleteLeadForeverAction`, which calls `eraseTrashedLead`.

`eraseTrashedLead` wipes the contents, sets `erasedAt`, then runs `deleteUnreferencedMedia`. The
cron calls the same `eraseTrashedLead` through `purgeTrashedRows`.

`findStoredLead` stays unfiltered, so a trashed or erased row keeps blocking a re-create.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Columns and hiding | Migration + fields; list, count and badge skip trashed rows | Missing a reader leaks trashed leads |
| 2. Trash, restore, erase, purge | Actions, cron step, redelivery guards + DB specs | Erase order: the reference scan must run after the write |
| 3. `/zgloszenia` UI | Checkbox column, „Do kosza (N)", „Bez plików" | Payload `exists: false` on a hasMany upload may not translate (raw-SQL fallback named) |
| 4. `/kosz` + docs | „Zgłoszenia" section, lessons/test-plan entries | Source label is client-only today and may need lifting |

**Prerequisites:** local docker DB migrated; `db-test` (5435) for the DB specs.
**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- The prod migration (additive) must run before the deploy that reads `trashed_at`. Run by a human.
- Assumes no surface outside `/zgloszenia`, `/kosz` and the badge reads leads. Verified by grep:
  promote, attach and toggle all act on an id the list provided.

## Success Criteria (Summary)

- Empty leads can be found and removed from `/zgloszenia` in one bulk action.
- Deleting a promoted lead forever leaves its investment's gallery complete (pinned by a DB spec).
- A Facebook lead deleted forever never comes back and is never re-emailed.
