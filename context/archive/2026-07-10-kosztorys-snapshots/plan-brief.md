# Kosztorys Snapshots (S-06) — Plan Brief

> Full plan: `context/changes/kosztorys-snapshots/plan.md`
> Change identity + owner decisions: `context/changes/kosztorys-snapshots/change.md`

## What & Why

The **durable recovery net** for the in-app kosztorys. A Manager+ user can save a **named** version
("Zapisz jako…") and later **restore** the whole kosztorys — sections, items, stages, progress, and
the investment's coeffs/VAT — to that point. The system also snapshots automatically (throttled,
and unconditionally before any destructive op). This catches the failure in-session undo (S-07)
can't: a bad edit or a cascade delete **noticed a day later**, after reload. Architecture is
**independent snapshots, not an event log** — one row = the serialized tree as `jsonb`; restore =
transactional wipe-and-reinsert.

## Starting Point

The editor tree is 4 Payload collections scoped by `investment_id` (`kosztorys-sections/items/stages`

- `stage-progress`), with editor settings (coeffs, VAT) on `investments`. All mutations go through
  `src/lib/actions/kosztorys.ts` (Payload local API, `MANAGEMENT_ROLES` gate). Cascade deletes are
  DB-level FK cascades. No snapshot mechanism, no scheduled-job infra, and no client edit-queue exist
  yet.

## Desired End State

A "Wersje" toolbar button opens a history drawer — named `manual` versions prominent, `auto`
snapshots as ambient timestamped history. Restore (single confirm) atomically reverts the whole
kosztorys and the editor re-renders it. Auto snapshots accrue every ~10 active minutes and before
every destructive op; a daily cron keeps the table bounded. Transfers/balances/marża are never
touched.

## Key Decisions Made

| Decision              | Choice                                                                                     | Why                                                                                                    | Source                |
| --------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------- |
| Architecture          | Independent snapshots, not event log                                                       | Single-editor app; no OT/collab need                                                                   | Roadmap               |
| Kosztorys root        | `investment_id` (1 investment = 1 kosztorys)                                               | No aggregate-root refactor; `kosztoryses` table irrelevant, removed separately                         | Plan                  |
| New-PK safety         | Wipe-and-reinsert is FK-safe                                                               | Research: nothing external references tree ids (only Payload lock rows, cascade harmlessly)            | Research              |
| Payload scope         | Tree + investment settings, restore rewrites both                                          | Faithful point-in-time — prices recompute identically                                                  | Plan                  |
| Versioning            | Version tag + tolerant restore                                                             | Old snapshots survive additive migrations                                                              | Plan                  |
| Kinds                 | **Two**: `manual` + `auto` (no `safety`)                                                   | Pre-destruction protection = a forced `auto` snapshot; don't keep two near-identical rows              | Plan                  |
| Manual save           | "Zapisz jako…" with **required name**                                                      | A name is how the user targets it in the restore list                                                  | Plan                  |
| Auto trigger          | Plain client 10-min interval (fires even when idle) + forced-before-destruction, no dedupe | Dead-simple now; idle-suppression deferred to S-07's edit-queue; forced snapshot must be unconditional | Plan                  |
| Auto retention        | Newest 50 (inline) + GC drops >7 days                                                      | Bounded active + durable "noticed later" window                                                        | Plan                  |
| Manual retention      | Aged out after ~1 year                                                                     | Nothing lingers forever                                                                                | Plan                  |
| Cleanup               | Daily Vercel Cron GC (age caps, incl. dormant)                                             | Inline pruning never revisits idle kosztorysy                                                          | Plan                  |
| Restore reversibility | Forced pre-restore `auto` snapshot                                                         | A wrong restore is itself restorable                                                                   | Plan                  |
| Restore atomicity     | One transaction (`transfers.ts` pattern)                                                   | Only multi-write that must be atomic                                                                   | Plan                  |
| Client refresh        | Remount editor on restore                                                                  | `useState`-seeded grid rows won't re-init via `router.refresh()`                                       | Research (lessons.md) |

## Scope

**In scope:** `kosztorys_snapshots` table; serialize/restore core; throttled + forced + named
capture; restore action; "Wersje" drawer UI; daily GC cron.

**Out of scope:** event sourcing / field-level audit; diffing / partial restore; relocating
coeffs/VAT or re-rooting the tree; removing `kosztoryses`; the idle-suppression activity check on
the interval (deferred to S-07's edit-queue); general non-snapshot cleanup; S-07 undo.

## Architecture / Approach

Raw-only `kosztorys_snapshots` table (`notification_reads` precedent) with a `jsonb` payload.
Serialize reuses `getKosztorysTree`. Restore wipes the tree (FK cascades) and re-inserts remapping
child FKs to fresh parent ids, inside one Payload transaction, then rewrites investment settings and
revalidates the four kosztorys cache tags + investments. Capture triggers piggyback on the existing
mutating actions (server-side throttle) plus a forced snapshot before cascade deletes/restore.

## Phases at a Glance

| Phase                                     | What it delivers                                               | Key risk                                                         |
| ----------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1. Schema + serialize/restore core        | Table + pure serialize + transactional restore, no triggers    | Restore is the one dangerous write — must be atomic + FK-correct |
| 2. Capture triggers + inline pruning      | Throttled `auto`, named `manual`, forced pre-delete, count cap | Throttle correctness; not slowing the autosave hot path          |
| 3. Restore action + pre-restore + listing | Gated `restoreSnapshotAction`, `listSnapshotsAction`           | Cache revalidation completeness                                  |
| 4. "Wersje" drawer UI                     | Toolbar drawer, "Zapisz jako…", confirm + remount              | Grid re-seed after restore (remount, not refresh)                |
| 5. Daily GC cron                          | Vercel Cron age-based cleanup                                  | First cron in repo; `CRON_SECRET` + plan tier                    |

**Prerequisites:** S-01 (editor tree exists — done). `CRON_SECRET` env for Phase 5.
**Estimated effort:** ~4–5 sessions across 5 phases; Phase 1 (restore core) is the heaviest.

## Open Risks & Assumptions

- Restore is coarse (whole-tree) — restoring an old snapshot discards all work since; acceptable by design (no partial restore).
- 10-min throttle / 7-day auto retention are starting points — tune if the table grows.
- Phase 5 cron needs a human to set `CRON_SECRET` in Vercel and to migrate the table to prod before the code ships.
- Tolerant restore covers additive schema drift; a future non-additive change needs the restore mapper updated for that version.

## Success Criteria (Summary)

- "Zapisz jako…" a version → edit → restore returns the tree **and** computed prices to the saved state.
- Deleting a section/stage leaves a forced pre-delete snapshot that restores the subtree; a wrong restore is itself restorable.
- Restore never alters transfers/balances/marża; the table stays bounded via inline caps + the GC cron.
