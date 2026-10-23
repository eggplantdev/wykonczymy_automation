# AI accuracy dashboard — access and refresh Implementation Plan

## Overview

Management gets a permanent link to the claude.ai dashboard „Trafność AI w kosztorysach” from the
investments listing, and the dashboard is refreshed by a repeatable script after every owner review,
as a step of the AI runbook in `wykonczymy-ai-cases`. The dashboard goes case by case, without
grouping cases into rounds of the flow.

## Current State Analysis

- The dashboard (https://claude.ai/artifact/BmWzerRwVFVkL5eEGGYmae, Dashboard type, „anyone with the
  link”) reads five fixed CSV datasets from its own store: `cases`, `error_types`, `reasons`,
  `repeat_groups`, `repeats`. They came from one-off read-only SQL on 2026-10-22, with a hand-typed
  case → investment → batch map, Polish labels and shortened pozycja names fixed by hand. The SQL is
  saved nowhere in either repo.
- Nothing in the app links to it. `/inwestycje` is management-only (`page.tsx:11-12`).
- The runbook (`wykonczymy-ai-cases/README.md`) has no step that refreshes it; Method step 8
  „Evaluation” (`:206`) says it was never done.

## Desired End State

- `/inwestycje` shows „Trafność AI ↗” in the table toolbar, beside „Dodaj inwestycję”; it opens the
  dashboard in a new tab.
- `TOKEN_FILE=… node --import tsx scripts/ai-kosztorys/accuracy-report-prod.ts` reads prod through
  the app (GET only) and writes the five CSVs into `wykonczymy-ai-cases/accuracy/`, one row per case
  where a case is per-case data.
- The dashboard shows every case the owner has reviewed, one by one, with no batch labels.
- The runbook links the dashboard and, in step 9, says: after „Recenzja zakończona”, run the script,
  commit the CSVs, refresh the dashboard.

### Key Discoveries:

- Toolbar slot: `src/components/tables/data-table/data-table-toolbar.tsx:17-25`, used at
  `src/components/investments/investment-data-table.tsx:129`; design audit A41
  (`design/audyt/groups/a41-list-page-header.tsx:91-121`) points page actions there rather than a
  separate row like `/kosztorysy`'s.
- `src/components/ui/external-link.tsx` — button variant is fixed at `size="touch"`.
- `scripts/ai-kosztorys/prod-client.ts` — REST through the app with a user's token; `itemsOf()`
  returns `aiPlannedQty`, `plannedQty`, `changeReason`, `clientPrice`, `description`.
  `collect-reasons-prod.ts:28-36` is the `aiStage` filter precedent. `prod-client.ts` reads
  `TOKEN_FILE` at import, so pure logic must not import it.
- Case identity: `wykonczymy-ai-cases/cases/<NN>-<slug>/case.json` → `investmentId` (all 31 cases).
- Scorable = owner reviewed: `aiStage` `review_done` or `knowledge_extracted`, with at least one item
  carrying `aiPlannedQty`. On the 10-22 dump: the 24 cases of the old SQL + 11, 12.

## What We're NOT Doing

- No rounds/batches of the flow, no batch registry (decision 2026-10-23).
- No in-app dashboard page — only if the access check (Phase 0) fails.
- No link on the investment page and no push-notification change.
- No per-round history: a case is scored on the AI quantities currently in prod. A later round drops
  the stage to „Przeanalizowana”, so the case leaves the report until the owner reviews it again.
- No scheduled/automatic refresh — the runbook step is the trigger.

## Implementation Approach

Keep the 10-22 metric exactly (it is what the owner has already seen) and change only its shape
(per case, no batches) and its home (a script whose pure scoring is unit-tested). The dashboard
remains on claude.ai, so its update is an agent step in the runbook, not part of the script.

## Critical Implementation Details

- **The metric, per kosztorys item** (from the 10-22 SQL): `ai = aiPlannedQty ?? 0`; `own =
  plannedQty`, but `own = ai` when `changeReason` matches `/zani|niedosza|powykonaw/i` (a deliberate
  understatement is not an AI error); `zł = |ai − own| × clientPrice`. Missed = `ai = 0 && own > 0`,
  extra = `ai > 0 && own = 0`, quantity = both > 0. „Bez Powodu” = wrong and `changeReason` blank.
  Repeats group by `description` lower-cased with whitespace collapsed; a pozycja „repeats” when it
  is wrong in ≥ 3 cases — now over every scored case, not cases 17+.
- **Parity anchor**: for cases whose kosztorys hasn't changed since 2026-10-22, the per-case
  `ai_zl` / `owner_zl` / `too_high_zl` / `too_low_zl` must equal the current `cases.csv` (asset
  `/_blob/40878fb1c23f76b80c69844a8a07ccdb`). A mismatch there is a port bug, not new data.

## Phase 0: Access check (manual, before any code)

### Overview

The link is worth building only if a manager without a claude.ai account can open the dashboard.

### Changes Required:

None.

### Success Criteria:

#### Automated Verification:

- None — a browser check.

#### Manual Verification:

- https://claude.ai/artifact/BmWzerRwVFVkL5eEGGYmae opens in a private window with no claude.ai
  session and shows the charts. If it asks for a login: stop and re-plan with an in-app page
  (research §5).

---

## Phase 1: Scoring script

### Overview

The 10-22 SQL becomes a repeatable, read-only script that writes the five CSVs into the ai-cases
repo.

### Changes Required:

#### 1. Pure scoring

**File**: `scripts/ai-kosztorys/accuracy.ts`

**Intent**: The metric above as pure functions over items of each case, producing the five tables. No
import of `prod-client.ts`.

**Contract**: input `{ caseNumber, slug, investmentId, items }[]` (items as the `ItemT` subset:
`aiPlannedQty`, `plannedQty`, `clientPrice`, `changeReason`, `description`); output five row arrays
whose columns become the CSV headers:
- `cases`: `case, slug, ai_zl, owner_zl, too_high_zl, too_low_zl`
- `reasons`: `case, wrong_zl, no_reason_zl`
- `error_types`: `case, missed_zl, extra_zl, qty_zl`
- `repeat_groups`: `group_order, how_often, wrong_zl, pozycje` (labels „W 3 lub więcej
  przypadkach” / „W 2 przypadkach” / „Tylko w 1 przypadku”)
- `repeats`: `pozycja, wrong_in_cases, reasons_written, wrong_zl` — top 12 by zł, pozycja name cut
  at the first „ - ” / „, ” when longer than 60 characters, then to 70.
Złotówki rounded to whole zł.

#### 2. Unit spec

**File**: `src/__tests__/scripts/ai-kosztorys/accuracy.test.ts`

**Intent**: Pin the rules that are easy to break in a port: the understatement override, the
missed/extra/qty split, null `aiPlannedQty` as 0, blank vs written Powód, the ≥ 3-cases threshold.

**Contract**: hand-built items for two or three fabricated cases; asserts each table's rows.

#### 3. The script

**File**: `scripts/ai-kosztorys/accuracy-report-prod.ts`

**Intent**: Read every `cases/*/case.json`, skip those carrying `accuracyExcluded`, keep investments
at `aiStage` `review_done` | `knowledge_extracted` with any `aiPlannedQty`, score them, write
`<CASES_ROOT>/accuracy/<table>.csv` and print a one-line count per table. GET only.

**Contract**: run as `TOKEN_FILE=… node --import tsx scripts/ai-kosztorys/accuracy-report-prod.ts`;
header comment in the style of `collect-reasons-prod.ts`. A case.json whose investment is missing
from prod fails loudly.

#### 4. Exclusions

**Files**: `wykonczymy-ai-cases/cases/11-*/case.json`, `wykonczymy-ai-cases/cases/12-*/case.json`

**Intent**: Record why these two are left out, in the case itself.

**Contract**: new field `"accuracyExcluded": "Sam wybór prac, bez plików — ilość 0 znaczy „ilość
nieznana”, nie pomyłkę AI."`

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/scripts/ai-kosztorys/accuracy.test.ts` passes
- The script run writes five CSVs into `wykonczymy-ai-cases/accuracy/`
- Parity: per-case figures equal the 10-22 `cases.csv` for every case whose kosztorys is unchanged
  since then (differences listed and explained in the commit message)

#### Manual Verification:

- None.

---

## Phase 2: Dashboard per case

### Overview

The dashboard drops rounds and reads the new CSVs.

### Changes Required:

#### 1. Data

**Target**: the dashboard's store (ArtifactData on https://claude.ai/artifact/BmWzerRwVFVkL5eEGGYmae)

**Intent**: Upload the five CSVs as assets and point each `datasets/<id>` at its new file, with
`updated: { at, by }` and descriptions that no longer mention rounds or „Przypadki 17–27”.

**Contract**: dataset ids unchanged; `fixed` removed (the data now changes after every review).

#### 2. Page

**Target**: `files/index.html` in the same store

**Intent**: Every chart and table that was per round becomes per case; batch labels, the
`roundLabel` helper and „what's new in the flow” go. The text keeps the 10-22 reading rules (an
understatement counts as AI right).

**Contract**: follows the type's marking rules (every figure from a dataset or a `dash.calc`); the
type's `check` read passes.

### Success Criteria:

#### Automated Verification:

- The dashboard's `data/users/me` → `check` read reports no failure

#### Manual Verification:

- The dashboard shows one entry per reviewed case, no round labels, and today's case count.

---

## Phase 3: Link on the investments listing

### Overview

Management reaches the dashboard from `/inwestycje`.

### Changes Required:

#### 1. External link size

**File**: `src/components/ui/external-link.tsx` (+ its entry in
`src/app/(frontend)/design/sections/buttons-section.tsx`)

**Intent**: Let the button variant take the size (and variant) of the toolbar's other buttons, so
the link sits level with „Dodaj inwestycję” instead of the fixed `touch` size.

**Contract**: optional `size` / `buttonVariant` props passed to `Button`; default stays `touch`, so
existing callers don't change. `/design` shows the new size.

#### 2. URL constant

**File**: `src/lib/constants/investment-ai-stage.ts`

**Intent**: One home for the dashboard URL, beside the AI stage constants.

**Contract**: `export const AI_ACCURACY_DASHBOARD_URL = 'https://claude.ai/artifact/BmWzerRwVFVkL5eEGGYmae'`

#### 3. Toolbar action

**File**: `src/components/investments/investment-data-table.tsx:129`

**Intent**: Add „Trafność AI ↗” before `<AddInvestmentDialog/>` in `actions`.

**Contract**: hardcoded Polish label, like the rest of this surface.

### Success Criteria:

#### Automated Verification:

- No phase-scoped spec (a static link); covered by the whole-tree gate.

#### Manual Verification:

- `/inwestycje` as a manager: „Trafność AI ↗” sits in the toolbar beside „Dodaj inwestycję” at
  desktop width and opens the dashboard in a new tab.
- `/design` → buttons: the external link in the new size.

---

## Phase 4: Runbook

### Overview

The refresh becomes part of the AI workflow, and the workflow links the dashboard.

### Changes Required:

#### 1. README

**File**: `wykonczymy-ai-cases/README.md`

**Intent**:
- `## Goal`: one line with the dashboard link.
- Method step 8 „Evaluation” (`:206`): replaced by a pointer to the script and the dashboard.
- Method step 9 (`:209-259`): after `collect-reasons-prod.ts`, before „Wiedza wyekstraktowana”
  (`:256`): run `accuracy-report-prod.ts`, commit `accuracy/*.csv`, refresh the dashboard (upload
  the five files, update the datasets). A case leaves the report while a later round is unreviewed.
- `## Fast path` step for selection-only investments (`:106-112`): such a case gets
  `accuracyExcluded`.

**Contract**: prose only.

### Success Criteria:

#### Automated Verification:

- None — prose.

#### Manual Verification:

- None.

---

## Testing Strategy

### Unit Tests:

- `accuracy.test.ts` — the metric's rules (Phase 1).

### Integration Tests:

- None: the script's prod read is checked by the parity anchor, not a test.

### Manual Testing Steps:

1. Private-window access check (Phase 0).
2. `/inwestycje` link (Phase 3).
3. Dashboard shows per-case data (Phase 2).

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`

## References

- Research: `context/changes/2026-10-23-ai-accuracy-dashboard/research.md`
- 10-22 SQL: session `80a474c6` transcript (extract in research §1)
- Pattern: `scripts/ai-kosztorys/collect-reasons-prod.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 0: Access check (manual, before any code)

#### Automated

- [x] 0.1 None — a browser check — 274969951

### Phase 1: Scoring script

#### Automated

- [ ] 1.1 `accuracy.test.ts` passes
- [x] 1.2 The script run writes five CSVs into `wykonczymy-ai-cases/accuracy/` — 274969951
- [x] 1.3 Parity with the 10-22 `cases.csv` for unchanged cases — 274969951

### Phase 2: Dashboard per case

#### Automated

- [ ] 2.1 The dashboard's `check` read reports no failure

### Phase 3: Link on the investments listing

#### Automated

- [ ] 3.1 No phase-scoped spec; whole-tree gate

### Phase 4: Runbook

#### Automated

- [ ] 4.1 None — prose
