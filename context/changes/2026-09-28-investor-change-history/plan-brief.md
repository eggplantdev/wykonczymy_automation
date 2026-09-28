# Investor change history — Plan Brief

> Full plan: `context/changes/2026-09-28-investor-change-history/plan.md`
> Design: `context/changes/2026-09-28-investor-change-history/design.md`

## What & Why

The investor can check for themselves what changed in their kosztorys, and when: scope, prices and
progress. Today their link shows only the live state, so nothing they saw yesterday is recoverable from
their side. They open a changed day, and it is compared with the **current** version.

## Starting Point

`kosztorys_snapshots` already stores whole-tree versions in two ways. 10-min `auto` rows are written
only while the editor is open. `manual` rows mix the owner's „Zapisz jako…" with system points such as
„Przed wczytaniem…". Retention thins `auto` rows and deletes everything at 365 days. The investor view
(`/k/[token]`, „Podgląd dla inwestora") is live-only. There is no completion date, and the global rabat
is not captured.

## Desired End State

The investor view has a „Historia zmian" button with a list of changed days, each with a one-line
summary, and named milestones. Opening an entry (`?wersja=`) shows that version in the grid: added
pozycje are listed, removed ones are struck through, and changed values show old → new. A rabat line
shows old → new, or „rabat nieznany" for older versions. The money panel is hidden. The owner sees the
same screen.

## Key Decisions Made

| Decision                 | Choice                                                                                                 | Why                                                                                     | Source            |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ----------------- |
| Granularity              | One end-of-day version per day, plus „Zapisz jako…" as named milestones                                | 10-min states are noise; owner-curated only would let the owner pick what is verifiable | Design #2         |
| Compare against          | The current version, no "od" picker                                                                    | An investor checking in monthly opens their last visit                                  | Design #5         |
| End-of-day capture       | New nightly cron at 23:15 UTC, stamped at the end of the previous Warsaw day                           | Editor-driven capture misses the last edits before closing                              | Design #10 / Plan |
| Storage                  | New kinds `daily` and `named`; no hash column, deep-equal vs the last `daily`                          | The `auto` bands stay untouched; the compare is cheap at ~65 investments                | Plan              |
| Retention                | `daily`/`named` kept while Planowana or Aktywna, then 1 year after `completed_at`; reopening clears it | Owner                                                                                   | Design #12        |
| Past rows                | Old rules for old rows: past `manual` rows are not reclassified, and past `auto` rows thin as today    | Owner's choice over reclassifying                                                       | Plan (owner)      |
| Completion-date backfill | `updated_at` for already-completed investments                                                         | The best available proxy                                                                | Plan (owner)      |
| Rabat                    | Captured in the payload for display; restore still ignores it; old rows show „rabat nieznany"          | A past total must not use today's rabat                                                 | Design #8/#9      |
| Matching                 | Pozycje by id, then sekcja + opis + j.m.; etapy by id, then ordinal                                    | A restore mints new ids                                                                 | Design #14        |
| Pozycje added since      | Listed above the grid                                                                                  | They have no past row to sit in                                                         | Plan (owner)      |
| UI entry                 | Button → list dialog → `?wersja=` on the same page                                                     | The URL is the state; one grid code path                                                | Plan (owner)      |

## Scope

**In scope:** a completion-date column and hook; the `named`/`daily` kinds; the rabat in the payload;
the nightly cron; status-aware retention; a pure diff and history library; token-scoped reads; the
history dialog and version view on both investor pages; docs and test-plan updates.

**Out of scope:** history of the money block; comparing two past days; a preview in the owner's drawer;
changes to the 10-min capture, the `auto` bands or restore; reclassifying past rows; hiding a day.

## Architecture / Approach

The cron uses `buildKosztorysTree` → `serializeTree` → deep-equal against the last `daily` row → INSERT
`daily`. On read, the token resolver gives the investment id. A bounded per-day meta query picks the
entries, and summaries are cached per immutable pair. `?wersja=` loads one scoped payload and runs
`snapshotToTree` and `diffVersions` against the live tree, then `KosztorysEditorBody preview history=…`.
All derivation is pure in `src/lib/kosztorys/history/`.

## Phases at a Glance

| Phase                          | What it delivers                                | Key risk                                                         |
| ------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------- |
| 1. Data foundation             | `completed_at`, new kinds, rabat in the payload | Restore accidentally starting to read the rabat                  |
| 2. Nightly capture + retention | `daily` rows, status-aware gc                   | Deleting active history, or wrong-day attribution                |
| 3. Pure history library        | Diff, snapshot→tree, day selection, summary     | A remap reads as "everything replaced"; unknown rabat shown as 0 |
| 4. Read path                   | Token- and id-scoped history reads              | Leaking another investment's version                             |
| 5. UI                          | Dialog, banner, old → new cells, strike-through | The owner's editor render changing                               |
| 6. Docs + test-plan            | Reversals recorded, 4 new risks, E2E owed       | —                                                                |

**Prerequisites:** the migration applied to prod before the push (human, `pnpm db:migrate:prod`).
**Estimated effort:** ~3–4 sessions across 6 phases.

## Open Risks & Assumptions

- The per-day summary compares with the previous listed day (design #4). This is an assumption, not
  confirmed by the owner.
- Edits between Warsaw midnight and the cron run (15 min in winter, 75 in summer) land on the previous
  day. Accepted.
- Pre-ship history is sparse: weekly beyond 120 days, and nothing from days when the editor wasn't
  open.
- Past user-named versions („opcja 1…") will not appear as milestones.

## Success Criteria (Summary)

- An investor opens their link, opens a past day, and sees exactly what changed since then, including a
  changed Przedmiar old → new.
- A restore does not make the history read as "everything replaced".
- Active investments never lose history, and completed ones are cleaned up a year after completion.
