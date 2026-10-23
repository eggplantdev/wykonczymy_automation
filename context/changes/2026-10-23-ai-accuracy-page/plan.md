# Trafność AI w kosztorysach — in-app page Implementation Plan

## Overview

Replace the claude.ai artifact „Trafność AI w kosztorysach” with a management-only page
`/inwestycje/trafnosc-ai`, computed live from the DB, so it is current after every review without a
manual refresh. The scoring logic moves into `src/lib` unchanged and becomes the single source for both
the page and the existing CSV export (`accuracy-report-prod.ts` → `<ai-cases>/accuracy/*.csv`), which
stays: the CSVs are analysis and training data.

## Current State Analysis

- `scripts/ai-kosztorys/accuracy.ts` — pure `scoreCases` (5 tables), `shortPozycja`, `toCsv`; typed on
  the prod-client `ItemT`, keyed by `caseNumber`/`slug` from `case.json`.
- `scripts/ai-kosztorys/accuracy-report-prod.ts` — reads `cases/*/case.json` in ai-cases, skips
  `accuracyExcluded`, keeps investments with `aiStage ∈ {review_done, knowledge_extracted}` and any
  `aiPlannedQty`, fetches items over prod REST, writes the CSVs.
- `src/__tests__/scripts/ai-kosztorys/accuracy.test.ts` — written, never run.
- The toolbar on `/inwestycje` (`src/components/investments/investment-data-table.tsx:139-146`) links
  out to the artifact via `AI_ACCURACY_DASHBOARD_URL` (`src/lib/constants/investment-ai-stage.ts:69`).
- The artifact's content and math are in the local copy
  `/private/tmp/claude-501/-Users-konradantonik-workspace-yolo-wykonczymy/5d1c7710-5933-41fd-813d-b5c50678b241/scratchpad/store/new.html`
  (rightPct = round(100 − 100·wrong/owner), clamped ≥ 0 per case; 5-case rolling average).

## Desired End State

A manager opens „Inwestycje” → „Trafność AI” and lands on `/inwestycje/trafnosc-ai`: the same sections
as the artifact, cases named by investment name (linked to `/inwestycje/[id]`), ordered by investment
id, numbers matching what the CSV export produces from the same data. A new review (AI load or owner
edits to Przedmiar / Powód zmiany) shows up on the next page load. An EMPLOYEE gets the usual auth
redirect.

### Key Discoveries:

- `kosztorys_items.investment_id` exists directly; columns `planned_qty`, `client_price`,
  `ai_planned_qty`, `change_reason`, `description`. `investments.ai_stage` enum, `trashed_at`, `name`.
- Template for the raw read: `src/lib/db/kosztorys-client-totals.ts` (one `db.execute(sql…)` + mapper);
  for the cached query: `src/lib/queries/balances.ts:61-91` (`cached(fn, [key], { tags })`).
- Every writer of the scored figures expires `CACHE_TAGS.kosztorysItems` (hooks, editor actions,
  import/restore, the AI load's touch-kosztorys) or `CACHE_TAGS.investments` (`setInvestmentAiStageAction`,
  name edits) — tags `[kosztorysItems, investments]` cover them all.
- Local DB has 26 scorable investments (~9k items); scoring the whole set is cheap, but the result is
  what gets cached, not the raw rows.
- Selection-only cases (Mińska 7 salon fryzjerski = investment 200, Jacek Gołoś angorska = 202) have no
  automatic rule — 6 and 17 AI rows vs 56–127 in normal cases.
- `scripts/ai-kosztorys/*` already import from `@/…` (e.g. `create-case-local.ts:11-14`).
- Internal link button pattern: `src/components/kosztorys/open-kosztorys-v2-button.tsx:17-21`.
- `isActiveLink` prefix-matches, so the new route highlights „Inwestycje” with no nav change.

## What We're NOT Doing

- No change to the artifact (stays as the 22 paź archive) and no deletion of anything in ai-cases —
  `case.json`, `accuracy/*.csv` and the export script all stay.
- No new nav entry, no DB column / migration, no per-role link variants.
- No change to the scoring rules.
- No phone layout work (not in the phone scope).

## Implementation Approach

Lift the pure scoring into `src/lib/kosztorys/ai-accuracy.ts`, keyed by `investmentId` with a display
label, and add the artifact's derived figures (tiles, per-case Wynik, rolling average) next to it. The
CSV script keeps its output format by mapping `investmentId` → `case`/`slug` from `case.json`. The
exclusion of selection-only cases becomes a constant in `src/lib/constants/investment-ai-stage.ts`, read
by both the page query and the script; the script asserts that `case.json` `accuracyExcluded` and the
constant agree, so the reason stays recorded in ai-cases and the two can't drift.

## Critical Implementation Details

- **Selection rule must be identical on both paths:** `ai_stage IN ('review_done','knowledge_extracted')`,
  `trashed_at IS NULL`, at least one `ai_planned_qty IS NOT NULL`, id not in the exclusion constant.
  The script's REST path and the page's SQL path must yield the same investment set on the same data.
- **CSV columns stay byte-compatible** (`case`, `slug`, then the existing figure columns) so earlier
  CSVs in ai-cases remain comparable.

## Phase 1: Shared scoring in src/lib

### Overview

Move scoring into the app, add the page's derived figures, re-point the CSV script and its spec.

### Changes Required:

#### 1. Scoring module

**File**: `src/lib/kosztorys/ai-accuracy.ts` (new)

**Intent**: Home of `scoreCases` + `shortPozycja`, logic unchanged, plus a `summarizeAccuracy` that
derives the artifact's figures from the scored tables.

**Contract**: own item type `AiAccuracyItemT = { aiPlannedQty: number | null; plannedQty: number;
clientPrice: number; changeReason: string | null; description: string | null }`; input
`{ investmentId: number; label: string; items: readonly AiAccuracyItemT[] }[]`; table rows keyed by
`investmentId` + `label` instead of `case`/`slug`. `summarizeAccuracy` returns per-case
`{ investmentId, label, ownerZl, wrongZl, noReasonZl, rightPercent (clamped ≥ 0), rollingPercent (last
≤ 5 cases) }` and the tiles (all / last 5 / latest, and „na każde 100 zł … myli się o”), matching the
artifact's formulas.

#### 2. Exclusion constant

**File**: `src/lib/constants/investment-ai-stage.ts`

**Intent**: `AI_ACCURACY_EXCLUDED_INVESTMENT_IDS` (200, 202) and `AI_ACCURACY_REVIEWED_STAGES`; remove
`AI_ACCURACY_DASHBOARD_URL` once Phase 2 drops its last consumer (do it in Phase 2).

#### 3. CSV script

**Files**: `scripts/ai-kosztorys/accuracy.ts`, `scripts/ai-kosztorys/accuracy-report-prod.ts`

**Intent**: `accuracy.ts` keeps only `toCsv` and the mapping of scored rows back to `case`/`slug`
columns; the report script imports scoring and both constants from `@/lib/…`, throws when a `case.json`
`accuracyExcluded` disagrees with the constant, writes the same five CSVs.

#### 4. Specs

**Files**: `src/__tests__/lib/kosztorys/ai-accuracy.test.ts` (moved from
`src/__tests__/scripts/ai-kosztorys/accuracy.test.ts`), the old spec keeps only `toCsv` + column mapping.

**Intent**: existing scoring cases re-keyed; new cases for `summarizeAccuracy`: clamp at 0 %, rolling
window shorter than 5 at the start, tiles over all / last 5 / latest.

### Success Criteria:

#### Automated Verification:

- Scoring + summary spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/ai-accuracy.test.ts`
- CSV spec passes: `pnpm exec vitest run src/__tests__/scripts/ai-kosztorys/accuracy.test.ts`

#### Manual Verification:

- `TOKEN_FILE=… node --import tsx scripts/ai-kosztorys/accuracy-report-prod.ts` writes the five CSVs to
  `wykonczymy-ai-cases/accuracy/` and `git diff` there shows no change against the 22 paź commit (same
  data → same numbers).

---

## Phase 2: Live page

### Overview

Raw read, cached query, the route, and the toolbar link.

### Changes Required:

#### 1. Raw read

**File**: `src/lib/db/ai-accuracy-items.ts` (new)

**Intent**: one statement returning every item of every scorable investment with the investment's id
and name, ordered by investment id; the selection rule from Critical Implementation Details (exclusion
passed in as a parameter, not hard-coded in SQL).

#### 2. Cached query

**File**: `src/lib/queries/ai-accuracy.ts` (new)

**Intent**: `fetchAiAccuracy()` via `cached()` tagged `[CACHE_TAGS.kosztorysItems,
CACHE_TAGS.investments]`; groups rows per investment, runs `scoreCases` + `summarizeAccuracy`, caches
only the result. `perfStart` log like `balances.ts`.

#### 3. Route

**Files**: `src/app/(frontend)/inwestycje/trafnosc-ai/page.tsx`, `…/loading.tsx`,
`src/lib/constants/sections.ts` (`PAGE_TITLES` entry „Trafność AI w kosztorysach”)

**Intent**: `requireAuth(MANAGEMENT_ROLES)`, `PageWrapper`; `loading.tsx` renders `TitledPageLoading`
with the `PAGE_TITLES` title.

#### 4. Page components

**Directory**: `src/components/investments/ai-accuracy/` (new)

**Intent**: the artifact's sections — Krótko (tiles), Jak liczymy, Wynik w czasie (bars per case +
rolling-average line, `ui/chart.tsx`, client component), Skąd biorą się błędy (Powody 1–4 with the
repeats and missed/extra/quantity tables), Co z tym zrobić, Dlaczego wynik nie jest dokładny (incl. the
pominięte inwestycje by name), Wszystkie przypadki (investment name linked to `/inwestycje/[id]`).
Built only from `ui/` primitives (`Panel`, `SummaryTable`, `Badge`, `SectionHeader`, `Description`,
`EmptyState`); `formatPLN`, `formatPercent`. Static prose copied from the artifact; every number comes
from the query. Empty state when no investment is scorable.

#### 5. Toolbar link

**Files**: `src/components/investments/investment-data-table.tsx`,
`src/lib/constants/investment-ai-stage.ts`, `src/components/ui/external-link.tsx` +
`src/app/(frontend)/design/sections/buttons-section.tsx`

**Intent**: „Trafność AI” becomes an internal `<Button asChild size="sm" variant="outline"><Link>` to
`/inwestycje/trafnosc-ai`; drop `AI_ACCURACY_DASHBOARD_URL`. If the `size` / `buttonVariant` props on
`ExternalLink` (added for this link) have no other consumer, remove them and their `/design` example.

### Success Criteria:

#### Automated Verification:

- Phase 1 specs still pass (same commands as Phase 1)

#### Manual Verification:

- `/inwestycje` → „Trafność AI”: opens `/inwestycje/trafnosc-ai` in the same tab, „Inwestycje” stays
  highlighted in the nav, loading shows the page title.
- „Wszystkie przypadki”: one row per reviewed investment except Mińska 7 salon fryzjerski and Jacek
  Gołoś angorska, names link to the investment; the figures match `accuracy/cases.csv` row for row.
- Change a „Przedmiar” or „Powód zmiany” on a reviewed investment's kosztorys, reload the page: that
  investment's „Błędy AI” / „Błąd bez Powodu zmiany” move.
- Logged in as a worker (EMPLOYEE): `/inwestycje/trafnosc-ai` is not reachable.

---

## Phase 3: Workflow docs

### Overview

Point the AI workflow at the page; keep the CSV step.

### Changes Required:

#### 1. ai-cases README

**File**: `../wykonczymy-ai-cases/README.md` (commit there)

**Intent**: step 9 „Refresh the dashboard” → the page `https://wykonczymy.vercel.app/inwestycje/trafnosc-ai`
updates itself; the step keeps „run `accuracy-report-prod.ts` and commit `accuracy/*.csv`” for
analysis/training data. Excluding a selection-only case = `accuracyExcluded` in `case.json` **and** the
id in `AI_ACCURACY_EXCLUDED_INVESTMENT_IDS` (the script enforces both). Replace the artifact link.

#### 2. Superseded change

**Files**: `context/changes/2026-10-23-ai-accuracy-dashboard/change.md`,
`context/foundation/manual-checks.md`

**Intent**: mark the dashboard change as superseded by `ai-accuracy-page`; its open manual checks
about the external „Trafność AI ↗” link are closed as superseded, pointing at this change's section.

### Success Criteria:

#### Automated Verification:

- No dangling reference: `grep -rn "AI_ACCURACY_DASHBOARD_URL\|BmWzerRwVFVkL5eEGGYmae" src scripts` is empty

#### Manual Verification:

- ai-cases README step 9 links the app page and still lists the CSV export.

---

## Testing Strategy

### Unit Tests:

- Scoring rules (unchanged): AI null → 0, understatement Powód, missed/extra/quantity split, blank-Powód
  sum, repeats ≥ 3 cases, repeat groups.
- Summary: clamp at 0 %, rolling window < 5 at the start, tiles.

### Manual Testing Steps:

1. Page figures vs `accuracy/cases.csv` on the same data.
2. Edit → reload freshness.
3. EMPLOYEE blocked.

## Performance Considerations

~9k rows read once per cache miss; only the scored result (~30 rows + 12 repeats) is cached. Any
kosztorys write anywhere expires it — acceptable at this scale.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

## References

- Predecessor: `context/changes/2026-10-23-ai-accuracy-dashboard/`
- Artifact archive: https://claude.ai/artifact/BmWzerRwVFVkL5eEGGYmae
- Raw read template: `src/lib/db/kosztorys-client-totals.ts:13`
- Cached query template: `src/lib/queries/balances.ts:61-91`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared scoring in src/lib

#### Automated

- [x] 1.1 Scoring + summary spec passes — 3bb299fd7
- [x] 1.2 CSV spec passes — 3bb299fd7

### Phase 2: Live page

#### Automated

- [x] 2.1 Phase 1 specs still pass

### Phase 3: Workflow docs

#### Automated

- [ ] 3.1 No dangling reference
