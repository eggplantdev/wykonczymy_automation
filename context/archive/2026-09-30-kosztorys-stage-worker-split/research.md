---
date: 2026-09-30T07:23:50+0200
researcher: Claude
git_commit: 593d838e
branch: staging
repository: wykonczymy
topic: "Several workers per kosztorys etap with a percent/amount split of the etap's executed-work pool (EX-943)"
tags: [research, codebase, kosztorys, stages, workers, subcontractor-due, worker-view, payouts]
status: complete
last_updated: 2026-09-30
last_updated_by: Claude
last_updated_note: 'Owner answered the seven open questions'
---

# Research: several workers per etap + split of the executed-work pool (EX-943)

**Date**: 2026-09-30T07:23:50+0200
**Git Commit**: 593d838e · **Branch**: staging · **Repository**: wykonczymy

## Research Question

What has to change to replace EX-613's "one worker per etap" with several workers per etap whose
executed-work pool is split per the owner rules in `change.md` (mode per etap: percent | amount; all
but one worker carry an entered value, one takes the rest; fixed amounts accrue in full and the rest
may go negative; single-worker etapy migrate with no figure moving)?

## Summary

- **One line attributes money to a person today**: `subcontractorDueByPlane` credits the whole etap
  pool to `st.workerId` (`src/lib/kosztorys/subcontractor-due.ts:84`), and flags a plane-less etap
  against that one worker (`:73`). Everything per-person downstream (Podsumowanie podwykonawców,
  worker view, employee list, investment listing's `subcontractorsOwed`, „Rozlicz wypłaty") reads
  either that map or its **SQL twin** (`src/lib/db/kosztorys-subcontractor-due.ts:26-72` →
  `src/lib/db/worker-payout-pairs.ts:30-62`), which groups by `ks.worker_id`.
- **Margin cannot move.** `calculateMargin` reads only payouts; `marginV2` reads the combined due. As
  long as Σ shares === pool per etap — which the "one worker takes the rest" rule guarantees — the
  combined figure, the listing total and the golden master stay put.
- **Recommended storage**: raw child table `kosztorys_stage_workers` (stage FK cascade, worker FK,
  entered value, remainder flag) + a per-etap mode column on `kosztorys_stages`. Backfill each
  `worker_id` as a one-person "rest" row → nothing moves.
- **Recommended split location**: ONE pure TS function (`splitStagePool`) used by both the editor's
  reference fold and the cross-investment pairs path; the SQL keeps only the **pricing** (pool per
  etap) and stops encoding attribution. The bridge test then pins only the pool, which the existing
  parity spec already covers.
- **Traps found**: (1) the SQL fold inner-joins `stage_progress`, so an amount-mode etap with no
  executed work would silently lose its fixed amounts and negative rest; (2) a negative rest is read
  as „nadpłata" / „zaliczka" by every classifier; (3) the worker view's per-etap lines and the print
  document's totals assume the whole etap is his; (4) stored snapshots carry the legacy `workerId`
  and must stay restorable forever; (5) the sheet import being built in another session right now
  adds a third single-worker writer.

## Detailed Findings

### 1. Money derivations

**Reference fold** — `src/lib/kosztorys/subcontractor-due.ts:57-95`. Per etap: skip if plane-less
(raising `unconfirmedWorkers` for `st.workerId` when the etap holds qty, `:67-75`), else
`planeTotal = Σ qty × viewPrice(row, plane)` → `byStage.set` (`:83`) and
`byWorker.set(st.workerId, … + planeTotal)` (`:84`). Callers: editor `use-kosztorys-editor.ts:403`,
`investment-summary-panel.tsx:62`, `worker-view/summary.ts:44`, parity spec
`investment-render-parity-db.test.ts:225`.

**Readers of the per-person figures**

- `computeSubcontractorSummary` (`subcontractor-summary.ts:84-136`) — rows = union of payouts,
  `byWorker` keys and `assignedWorkerIds`, the latter built from the single `stage.workerId`
  (`:98`). `settlementState` (`:57-69`) calls `remaining < 0` with `due > 0` „overpaid", else
  `no_executed_work` / `no_stages`. **A rest worker overdrawn by fixed amounts has `due < 0`** and
  would be labelled „prepayment" — wrong; needs its own state.
- `computeWorkerSummary` (`worker-view/summary.ts:37-67`) — `executedNet = byWorker.get(workerId)`
  (`:45`, follows the split automatically), but `executedByStage[].net = due.byStage.get(stage.id)`
  (`:56`) is the WHOLE etap → his per-etap lines would no longer sum to his total. `plannedNet`
  (`:52`) is the whole przedmiar × his stawka, not per etap.
- SQL pairs `selectWorkerPayoutPairs` (`db/worker-payout-pairs.ts:19-72`) → `fetchWorkerPayoutPairs`
  (`queries/balances.ts:135`, cache key `worker-payout-pairs-v1` `:145`) → employee list
  (`pracownicy/page.tsx:17` → `workerColumnFigures`, nadpłata marker `:103`), listing
  `subcontractorsOwed` (`queries/investments.ts:35`), settle dialog (`queries/settle-payouts.ts:42`),
  settle action re-read under lock (`actions/settle-payouts.ts:71`, keyed `${investmentId}:${workerId}`
  — fine with many workers). `classifyPair` (`kosztorys/worker-payout-pairs.ts:43-47`) → a negative
  remaining = `overpaid`; `paidAheadOf` labels the payout a „zaliczka".
- Margin: `db/calculate-margin.ts:16` (payouts only), `margin-v2.ts:28` (combined due + flag). Not
  per-person.
- Golden master (`financial-golden-master-db.test.ts:272,302`) reads the per-investment combined
  figure only, but its dataset signature hashes `ks.worker_id` (`:193`) — breaks if the column is
  dropped, and goes blind to split edits unless the new table joins the hash (lesson ~1781).

**SQL twin today** — `lines` CTE (`kosztorys-subcontractor-due.ts:26-62`): one row per (etap, pozycja)
**with progress** — `investment_id, plane, worker_id, qty_done, price`; columns (`:65-72`): due =
`sum(qty_done*price) FILTER (plane IS NOT NULL)`, flag = `bool_or(plane IS NULL AND qty_done <> 0)`.
Pairs group by `(investment_id, worker_id)` and `UNION ALL` the payouts. All `numeric`.

**Rounding** — `roundToCents` is for comparisons and displayed totals only (`subcontractor-summary.ts:114,135`,
`subcontractorRowTotals:153`, `classifyPair:43`, `worker-view/summary.ts:49-50`). The DB parity spec
compares with `toBeCloseTo(x, 2)` (`__tests__/lib/db/worker-payout-pairs.test.ts:184,216`) — the
half-grosz coin flip of lesson ~2076.

### 2. Data / persistence

- **Column + type**: `kosztorys_stages.worker_id` (`src/migrations/20260728_1_add_worker_to_kosztorys_stages.ts`),
  Payload field `collections/kosztorys-stages.ts:44-53`, `KosztorysStageT` `lib/kosztorys/types.ts:100-106`,
  patch type `:110-115`. Tree load `lib/db/kosztorys-tree.ts:80,161`.
- **Writes**: `updateStageAction` (`lib/actions/kosztorys.ts:635-651`, maps `workerId` → `worker`);
  `addStageAction(investmentId, plane, workerId)` (`:595-619`, schema `:625-631`); client
  `handleSetStageWorker` → `patchStageField` (`editor/hooks/use-kosztorys-stage-ops.ts:83-123`) —
  optimistic, debounced, revert on error, **not undoable** (`:29-30,119-120`). The field-equality guard
  `current[field] === value` (`:90`) is reference equality — useless for an array.
  Lock: every write goes through `investmentAction` (`investment-action.ts:34`, `investment-gate.ts:20`).
  Tags: `kosztorysStages` (`kosztorys.ts:618,650`).
- **New etap copies the last etap's worker** (`toolbar/menus/kosztorys-add-menu.tsx:95`, optimistic
  append `use-kosztorys-stage-ops.ts:54`) — commit 593d838e.
- **Restore INSERT**: `insert-kosztorys-tree.ts:8-14` lists `worker_id`; `:24-43,80-94` null out
  deleted workers and count them. With splits, dropping the rest holder needs a new rest holder.
- **Snapshots**: `SNAPSHOT_SCHEMA_VERSION = 1` (`history/snapshot-format.ts:36`); stages stored as strict
  `KosztorysStageT[]` (`:121`, `serialize-tree.ts:15`). Named/daily snapshots are kept forever
  (`:28-29`) → do not bump the version (lesson ~772); make the stored stage type tolerant (legacy
  `workerId?` + new shape) and read a legacy `workerId` as a one-person split in restore **and** in
  `history/snapshot-to-tree.ts:35` (history preview passes stored stages through raw).
- **Presets**: carry no etapy (`serialize-preset.ts:32-36`) → nothing to do.
- **Sheet import**: `parse-labor-tab.ts:229` `workerId: null`; `build-import-plan.ts:71,91,239`,
  `actions/kosztorys-import.ts:283,296`, `sheet-import-dialog.tsx:76,150-157,200` apply ONE default
  wykonawca to every imported etap — **uncommitted work of another session (2026-09-30)**, a third
  single-worker writer. Must land before this change or be rebased onto it.
- **User delete guard**: `collections/users.ts:52-55` counts `kosztorys-stages.worker` via Payload
  (`delete-blocker.ts:56`) — only works on a Payload collection.
- **Cached payloads carrying the stage shape** (key bumps needed, lesson ~1070):
  `worker-kosztorys-data-v1` (`queries/worker-kosztorys.ts:113` — token link, Podgląd, PDF),
  `preview-kosztorys-editor-data-v2` (`preview-kosztorys.ts:97`), `preview-kosztorys-history-v1`
  (`preview-kosztorys-history.ts:50`). `worker-payout-pairs-v1` / `kosztorys-subcontractor-due-v1`
  keep their row shape.

**Storage options**

| Option                                                                                                                                                                                                                   | Verdict                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| (a) child table `kosztorys_stage_workers(stage_id FK CASCADE, worker_id FK, value numeric NULL, takes_rest bool)` + `UNIQUE(stage_id, worker_id)` + partial unique `(stage_id) WHERE takes_rest` (raw SQL — lesson ~876) | **Recommended as a raw table.** Writes already funnel through `investmentAction`; tree read + restore are raw SQL; admin panel unused. Cost: raw user-delete probe (or FK `ON DELETE RESTRICT`), one more level in restore INSERT. A Payload collection instead costs lesson ~1732's nine migration items + a `'stage'` hop in `access/investment-lock.ts:13-20` and buys only the delete probe. |
| (b) Payload `hasMany` + separate values                                                                                                                                                                                  | Reject — value can't live on `_rels`; lesson ~1041 silent `typeof === 'number'` failures.                                                                                                                                                                                                                                                                                                        |
| (c) jsonb on the stage                                                                                                                                                                                                   | Reject — no FK to users; SQL fold needs `jsonb_array_elements` (JIT trap, lesson ~1525).                                                                                                                                                                                                                                                                                                         |

Mode: enum column on `kosztorys_stages` (`percent` | `amount`), same pattern as `plane` (`20260724_2`).
Percent stored as integer basis points or `numeric(5,2)`; amount as `numeric(12,2)`.

**Migration**: hand-written, additive → migrate prod before push. Backfill
`INSERT … SELECT id, worker_id, NULL, true FROM kosztorys_stages WHERE worker_id IS NOT NULL`.
Between migrate and deploy the old code still writes `worker_id` → re-run an idempotent backfill or
accept the gap (5 users). `DROP COLUMN worker_id` is a separate later migration (destructive → after
deploy, lesson ~1558); the golden master hash and restore's legacy read must stop needing it first.

### 3. UI surfaces

- **Picker today**: inside the etap header dropdown (`grid/stage-header.tsx:111-207`), name on a second
  `text-2xs` line (`:141-143`); roster `StageWorkerSection` (`grid/stage-worker-section.tsx:23-83`,
  single-select checkbox rows, „Bez przypisania" pinned, cmdk avoided for arrow-key conflict `:19-22`).
  Confirm `ReassignWorkerConfirmDialog` when executed value > 0 and a worker is set
  (`stage-header.tsx:78-86`, `reassign-worker-confirm-dialog.tsx:27-57`) — one-to-one wording.
  Plane-less etap swaps the roster for `workerNeedsPlane` copy (`stage-header.tsx:188-197`).
- **No room in the header**: column `minWidth: 130` (`kosztorys-v2-columns.tsx:242,252`), a Radix
  dropdown already stacking plane / sort / rename / delete / roster; per-row inputs inside a menu are
  fragile. → **Popover or small dialog opened from the header menu** („Pracownicy etapu…"), header's
  second line shows „Jan Kowalski +1". Not the toolbar „Pracownicy" menu — that one is per worker
  (link / Podgląd / PDF), the split is per etap.
- **Primitives**: `ui/toggle-group.tsx` (% / kwota), `ui/decimal-field.tsx` / `decimal-input.tsx`,
  `ui/popover.tsx`, `form-dialog-shell.tsx`, `ui/combobox.tsx`; per-row amount precedent in
  `forms/settle-payouts-form/settle-payouts-table.tsx:26-46` + `row-value.ts` (another session is
  editing it now).
- **Commit semantics**: a split is valid only as a whole → explicit „Zapisz" in the dialog, not
  per-keystroke autosave like `patchStageField`. Whole-split validation: exactly one rest holder,
  percent Σ entered ≤ 100, and (owner, 2026-09-30, reversing option A) amount Σ entered ≤ the etap's
  current executed-work value — the UI agent's original "Σamount ≤ executed" turned out right. The
  cap holds only at save time; a later drop in the pool is an open question in `change.md`.
- **Problem filter** `stage-no-worker` (`stage-conditions.ts:21-35`) matches `workerId == null` → "no
  worker rows".
- **Summary block**: `SubcontractorWorkerTotals` (`summary/blocks/subcontractor-worker-totals.tsx:57-113`)
  one row per worker, fed by `byWorker` — follows the split with no UI change except the new negative-rest
  qualifier. `SubcontractorPayoutsTable` is payouts only — unaffected.
- **Worker view**: scope `resolveWorkerScope` (`worker-view/scope.ts:19`) and `assignedWorkers`
  (`assigned-workers.ts:21`) → membership; projection `buildWorkerKosztorysData`
  (`queries/worker-kosztorys.ts:82-87`) → whole-etap rows (fine per owner). `WorkerSummary`
  (`summary/blocks/worker-summary.tsx:17-54`) — „Twój udział" belongs on each shared etap's line of
  `executedByStage` and in the print footer (`print/worker.ts:27-37`). **Print totals conflict**:
  section/column totals sum whole-etap values (`use-kosztorys-editor.ts:680-691`, `print/worker.ts:59-64`)
  while the grand total is `summary.executedNet` (`print/worker.ts:84`); `print/worker.test.ts:115`
  pins that they agree.
- **Unaffected**: PAYOUT worker in `expense-form.tsx:341-342`, `hooks/transfers/validate.ts:153-158`,
  `tables/transfers.tsx:162-167`.

## Code References

- `src/lib/kosztorys/subcontractor-due.ts:57-95` — reference fold; `:73`, `:84` the two single-worker lines
- `src/lib/db/kosztorys-subcontractor-due.ts:26-72` — SQL pricing + fold by `worker_id`
- `src/lib/db/worker-payout-pairs.ts:19-72` — cross-investment per-worker pairs
- `src/lib/kosztorys/subcontractor-summary.ts:57-69,98` — settlement states, assigned set
- `src/lib/kosztorys/worker-payout-pairs.ts:43-47` — `classifyPair`
- `src/lib/kosztorys/worker-view/{scope,assigned-workers,summary}.ts` — worker view
- `src/lib/kosztorys/print/worker.ts:27-37,59-64,84` — print footer + totals
- `src/lib/actions/kosztorys.ts:595-651` — add/update stage actions
- `src/components/kosztorys/editor/hooks/use-kosztorys-stage-ops.ts:54,83-123` — optimistic stage writes
- `src/components/kosztorys/editor/grid/{stage-header,stage-worker-section,reassign-worker-confirm-dialog}.tsx`
- `src/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu.tsx:95` — copy last etap's worker
- `src/lib/kosztorys/insert-kosztorys-tree.ts:8-43,80-94` — restore INSERT
- `src/lib/kosztorys/history/{snapshot-format.ts:36,121, snapshot-to-tree.ts:35}` — snapshots
- `src/collections/users.ts:52-55` — user delete guard
- `src/lib/kosztorys/stage-conditions.ts:21-35` — problem filters

## Architecture Insights

- **One split function, pricing stays in SQL.** Keep SQL for what needs scale (pool per etap across
  all investments, ~49 MB at 1000 investments if done in TS), have it return etap-level rows
  (`investment_id, stage_id, plane, pool, unconfirmed`) — driven from `kosztorys_stages LEFT JOIN
lines` so an etap with no progress still yields a row — plus the share rows; fold them in TS with
  the same `splitStagePool` the editor uses. The split rule then exists once (lesson ~1362 in spirit),
  and the bridge test only pins the pool (lesson ~40). The settle action can run it inside its
  transaction after `lockInvestmentGates`.
- **Proposed pure module** `src/lib/kosztorys/stage-worker-split.ts`:
  `splitStagePool(pool, split | undefined): Map<number | null, number>` — no split → `{null: pool}`;
  `subcontractorDueByPlane` also emits `byStageWorker: Map<stageId, Map<workerId, number>>` for the
  worker view's per-etap lines, and loops `unconfirmedWorkers.add` over every member.
- **Rounding rule that keeps both planes identical**: round only the entered percent shares to the
  grosz (half-up, after stripping float residue so TS matches Postgres `round(numeric,2)`); the rest
  is the unrounded `pool − Σ entered`. Σ shares === pool exactly; a one-person split is bit-identical
  to today. Parity specs compare `roundToCents(a) === roundToCents(b)`, not `toBeCloseTo`.
- **Fixture churn**: ~46 spec files build `KosztorysStageT` with `workerId`. Adding `workers` beside
  (or deriving) rather than renaming in place limits the churn; decide in the plan.
- **Glossary**: no entry for worker / share / split. `remainderNet` / `remainderGross` (glossary
  `:156,227`) already mean a cash remainder → the split's rest needs a distinct identifier (e.g.
  `takesRest` flag, `share` for a computed amount). Add the terms to `context/domain/02-glossary.md`.

## Historical Context (from prior changes)

- `context/archive/2026-07-27-kosztorys-stage-worker-assignment/change.md:22-23` — EX-613 „one stage,
  one worker; splitting … out of scope" (the rule reversed). Still standing: plane dominates, a
  plane-less etap accepts no worker (`:51-55`), negative remaining always red (`:56-58`), one shared
  derivation for live and saved figures (`:41-45`), MANAGER sees per-worker figures.
- Worker-view design (deleted doc, `git show 732f7567^:context/archive/2026-09-28-kosztorys-worker-view/design.md`;
  living copy `context/reference/kosztorys-editor-domain-notes.md:374-420`) — #2 „tylko kolumny swoich
  etapów", #6 wykonane = `byWorker.get` hold with the share; #11 (two planes block the link) and #12
  (deactivated worker keeps the link) hold unchanged.
- `context/archive/2026-09-29-worker-payout-remaining/change.md:22-23,44-46` — pair = executed work
  on his etapy at his stawka; plane-less etap withholds "that worker's pair" → becomes every member's.
  Fixtures already include "an investment with 2+ workers on etapy" (`:70-71`).
- `context/archive/2026-09-03-worker-payouts-on-employee-card/change.md:18-26` — describes the single
  nullable field.
- Test plan: risk 16 (`test-plan.md:67,86`) — settle books wrong pairs; response = per-pair SQL↔TS
  parity + Σ pairs = listing cell. No dedicated stage↔worker attribution risk (closest: risk 1, two
  surfaces disagree) → extend via `/10x-test-plan`.
- Manual checks: `manual-checks.md:1531-1535` („żaden nie widzi ilości ani kwot drugiego" — directly
  changed by a shared etap), `:2253-2329` (EX-919 pairs, „Nieprzypisane"), `:2626` (new etap copies the
  last worker), `:2637` (import sets one worker on all etapy).

## Living docs that become factually wrong

- `context/reference/kosztorys-editor-domain-notes.md:382,413,972-979,984-988,599`
- `context/foundation/investment-financials-and-discount.md:191,202-206`
- `context/domain/02-glossary.md` — add the new terms

## Related Research

- `context/archive/2026-07-27-kosztorys-stage-worker-assignment/change.md`
- `context/archive/2026-09-29-worker-payout-remaining/change.md`

## Open Questions

**Resolved with the owner 2026-09-30** — answers recorded in `change.md` („Decided with the owner
after research"): 1 → nothing accrues until the etap has executed work (this also removes the
no-progress SQL trap: a pool of 0 splits to nothing); 2 → plane-less credits nobody; 3 → whole
przedmiar value, unscaled; 4 → „nadpłata" as everywhere (fix `settlementState` so `due < 0` is
`overpaid`, not `no_executed_work`); 5 → whole-etap section totals + „Twój udział" separately;
6 → copy the whole split; 7 → dialog requires a new reszta holder, restore falls back to the first
remaining member.

Original questions:

1. **Fixed amounts on an etap with no executed work.** Under rule A the fixed amounts accrue at once:
   an etap with 3 × 1 000 zł fixed and nothing executed shows +1 000 for three workers and −3 000 for
   the rest. Confirm, or accrue fixed amounts only once the etap has any executed work.
2. **Etap bez rozliczenia (no plane).** Today it credits nobody and shows the warning. Proposed: the
   same for a split etap — fixed amounts included — otherwise the rest is unknowable and the totals
   stop adding up.
3. **Worker view „Wartość przedmiaru" when he holds several etapy with different shares.** Przedmiar
   is per pozycja, not per etap, so "przedmiar × his share" has no single answer when he has 50% of
   etap 1 and 100% of etap 2. Options: drop the figure for shared workers; or show it only when every
   etap of his has the same percent share.
4. **The label for an overdrawn rest.** Today negative = „nadpłata" everywhere (summary, employee list,
   „zaliczka" in settle). Proposed new wording, e.g. „kwoty stałe wyprzedzają wykonaną pracę".
5. **Worker PDF totals.** Rows show the whole etap (owner decision), so the section totals no longer
   equal his share. Proposed: section totals stay whole-etap, the footer shows „Wykonane (cały etap)"
   and „Twój udział" as separate lines.
6. **New etap from the menu copies the last etap** — copy the whole split (mode, people, values, rest)?
   Proposed yes.
7. **Removing the rest holder** (from the dialog, or a deleted user dropped at restore): proposed —
   the dialog requires picking a new rest holder; on restore the first remaining member becomes the rest.

Plan-level: the order vs the in-flight sheet-import change (another session), the migrate→deploy gap,
when to drop `worker_id`, and the test-plan risk to add.
