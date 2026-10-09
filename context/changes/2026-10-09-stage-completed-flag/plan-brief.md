# Etap „zakończony" Flag — Plan Brief

> Full plan: `context/changes/2026-10-09-stage-completed-flag/plan.md` · Linear: EX-1034

## What & Why

A manager (and up) can mark an etap zakończony. A worker whose etapy on an investment are all
finished stops seeing that investment and can no longer report work on it. Every view of the
kosztorys shows a finished etap in its own colour.

## Starting Point

An etap has a number, a name, a Rozliczenie and a worker split, but no status. A worker's
investment lists (his page, the FV picker, the scan pickers) show every aktywna investment where he
holds any etap. A worker report names no etap; the manager picks the etap at acceptance.

## Desired End State

The etap menu has a „Etap zakończony" checkbox.
- **All of his etapy on X finished:** X leaves all his lists. His saved link shows "your etapy here
  are finished", and both his sends and the kierownik's scans for him are refused.
- **Unchanged:** acceptance, quantities and „Podgląd pracownika". An FV draft he has already sent
  stays editable.

Finished etapy are green with a ✓ in the editor, the investor view and the worker view. PDFs are
unchanged.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| List rule | Per worker: listed while he holds ≥1 open etap | Etapy are assigned per worker; one worker's finished etap must not hide the site from another |
| Report rule | Refused only when he has no open etap | Reports carry no etap, so a per-etap block at send time is impossible |
| Accept | No restriction | Matches "no lock"; covers reports sent before closing without a timestamp |
| Lock | None | Manager can still correct quantities and reopen |
| Worker's own view | Finished etap kept, tinted | His settlement stays visible |
| PDFs | Unchanged | User choice: screen only |
| Pending FV draft | Its own investment stays valid on edit | A sent invoice isn't stranded by a status change |
| Who toggles | MANAGER and up | Comes free from `investmentAction` |
| Colour | Green tint via the existing column-tint overlay; overrides a user column colour | Reuses one mechanism; status beats a cosmetic preference |

## Scope

**In scope:**
- Data and toggle: the column and migration, the toggle, the restore/import/snapshot carry.
- Worker gates: the two list queries, a report gate on the page, send, scan and editor scan menu, and
  the draft-edit exception.
- Display: the screen tint plus the header ✓, the stripe CSS fix, and the domain-notes update.

**Out of scope:** a lock, any accept restriction or `completed_at`, PDFs, per-item hiding, and a new
investment status.

## Architecture / Approach

- **Data:** a `completed` boolean on `kosztorys_stages` flows through the single tree query into
  `KosztorysStageT`.
- **Toggle:** it reuses the „Rozliczenie" save path, `updateStageAction` and `patchStageField`.
- **Worker gates:**
  - The lists filter the joined etap in SQL.
  - One pure "has open etap" predicate sits beside `resolveWorkerScope` and gates every report entry.
  - The view scope itself is untouched, so finished etapy still render.
- **Colour:** a column wrapper after `withColumnColor` tints the etap's three columns in the shared
  on-screen builder.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Flag + toggle | Column, type, read/restore/import carry, menu checkbox | A raw write path silently drops the flag (drift spec guards it) |
| 2. Worker gates | Lists, link notice, send/scan refusal, draft exception | A report entry point missed; every entry reads one predicate |
| 3. Colour + docs | Green tint and ✓ in all on-screen views | Preview stripe CSS erasing the tint |

**Prerequisites:** local DB migrated. Prod is migrated by a human before the push (the change is
additive).
**Estimated effort:** ~1–2 sessions.

## Open Risks & Assumptions

- Required `KosztorysStageT.completed` breaks about 43 test files at compile time. Fix them through
  the fixture helpers, not at each call site.
- While one etap is still open, a worker can report quantities on items of his finished etap. The
  manager sorts that out at acceptance (accepted trade-off).

## Success Criteria (Summary)

- A manager closes a worker's last etap → the investment vanishes from his phone, and his link
  refuses reports.
- Reopening it brings everything back. Nothing about quantities, acceptance or settlement changes.
- Everyone sees which etapy are finished at a glance.
