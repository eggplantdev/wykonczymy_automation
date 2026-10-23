---
date: 2026-10-23T09:40:00+02:00
researcher: Claude (Opus 5.5)
git_commit: 995889c84c8fb2a44591332f0b5054ac4de1e39b
branch: staging
repository: wykonczymy (+ wykonczymy-ai-cases)
topic: "Permanent management access to the „Trafność AI w kosztorysach” dashboard, refreshed after every owner review"
tags: [research, ai-kosztorys, dashboard, investments-listing, ai-stage, runbook]
status: complete
last_updated: 2026-10-23
last_updated_by: Claude (Opus 5.5)
---

# Research: AI accuracy dashboard — access from the app, refresh after every review

## Research Question

The dashboard „Trafność AI w kosztorysach” (https://claude.ai/artifact/BmWzerRwVFVkL5eEGGYmae) shows
how the AI kosztorys drafts compare with the owner's final Przedmiar. Managers should reach it at any
time from the investments listing and from the AI workflow, and it should be refreshed after every
investment review. Today its data are five CSVs from a one-off read-only SQL run against prod
(2026-10-22). Open: does the link work without a claude.ai login; alternative — an in-app page
computed live.

## Summary

- **The link is a two-line change in the app.** `/inwestycje` is management-only already; the
  investments toolbar has an `actions` slot, and `ui/external-link.tsx` exists (fixed `touch` size).
  The investment page has a button row in `investment-overview.tsx` beside „Etap AI”.
- **The refresh is the real work.** The SQL lives only in a past session transcript, with a
  hand-typed case → investment → batch map. The case list is derivable (`cases/*/case.json` +
  `ai_stage`), the batches are not — they need a declared file. Uploading to the dashboard is an agent
  step (Artifact data store), not something a node script can do.
- **The current figures carry three known distortions**: batch 1 is probably mislabelled („Nic, AI
  samo” — cases 1–2 were redrafted with the first house rules on 10-09); cases 5 and 8 are scored on
  round-2 AI values the owner hasn't re-reviewed (`ai_planned_qty` is overwritten per round); cases 11
  and 12 are excluded without a written reason.
- **Unverified: anonymous access.** The artifact is set to „anyone with the link”, but the page is a
  client shell (`curl` gets only `<title>Claude Artifact</title>`), so whether a manager without a
  claude.ai account can open it must be checked in a private window. The in-app alternative is
  feasible (recharts is installed) but would move the case/batch registry, which lives in the
  separate ai-cases repo, into the app.

## Detailed Findings

### 1. The dashboard as it is

- Artifact created from the Dashboard type; „shared with anyone with the link (viewers see updates
  immediately)”. Five datasets, all `kind: file`, `fixed: true`, `updated 2026-10-22T17:30Z`:
  `cases`, `error_types`, `reasons`, `repeat_groups`, `repeats`.
- Content is changed only through its data store (ArtifactData): upload a new CSV as an asset, then
  `update` the dataset's `source.url`, `source.name`, `updated`. Done by the agent, not a script.
- The SQL (session `80a474c6`, 2026-10-22 16:17–17:39 UTC) per `kosztorys_items` row:
  `ai = coalesce(ai_planned_qty, 0)`; `own = planned_qty`, except `own = ai` when `change_reason ~*
  '(zani|niedosza|powykonaw)'` (a deliberate understatement counts as AI right — matches the runbook
  rule that such Powody aren't lifted into knowledge, ai-cases `README.md:250-252`); zł = qty diff ×
  `client_price`.
  - `cases`: per case — AI zł, owner zł, too high zł, too low zł, batch label, „what's new in the flow”.
  - `reasons`: per batch — wrong zł, wrong zł without a Powód.
  - `error_types`: per batch — missed (AI 0, owner > 0), extra (AI > 0, owner 0), wrong quantity.
  - `repeats` / `repeat_groups`: batches ≥ 4, grouped by whitespace-normalised lower-case
    description; pozycje wrong in ≥ 3 cases (top 12), and zł by how often the same pozycja is wrong.
  - Post-processing by hand: English batch labels `sed`-ed into Polish; long pozycja names shortened,
    three of them rewritten by hand.

### 2. App: where the link goes

- `src/app/(frontend)/inwestycje/page.tsx:11-19` — `requireAuth(MANAGEMENT_ROLES)`; renders
  `PageWrapper` + `InvestmentDataTable`. `PageWrapper` (`src/components/ui/page-wrapper.tsx:3-23`) has
  no actions slot.
- `src/components/tables/data-table/data-table-toolbar.tsx:17-25` — `actions` slot (right
  `ControlGrid`, beside „Kolumny”). Used at `src/components/investments/investment-data-table.tsx:129`
  with `<AddInvestmentDialog/>`.
- Precedent for an external header link: `src/app/(frontend)/kosztorysy/page.tsx:55-58` — a separate
  `justify-end` row with `<ExternalLink href={ALL_SHEETS_URL}>` (`src/lib/constants/sheets.ts:1`).
  Design audit A41 (`src/app/(frontend)/design/audyt/groups/a41-list-page-header.tsx:91-121`) flags
  that row as drift and proposes toolbar `actions` (or a future `PageWrapper` `actions` slot) instead.
- `src/components/ui/external-link.tsx` — `variant: 'text' | 'button'`, `target="_blank"
  rel="noopener noreferrer"`; the button variant is `Button asChild size="touch"` with no size/variant
  passthrough. A toolbar-sized button needs a prop there (and its `/design` entry,
  `design/sections/buttons-section.tsx:250-251`).
- AI workflow surface on the investment page: `[id]/page.tsx:59` → `InvestmentOverview`
  (`src/components/investments/investment-overview.tsx:43-58` button row: Edytuj, Umowa, Kosztorys,
  Zamów…; `:60-63` info list with the „Etap AI” row from `investment-info-fields.tsx:48-52`; `:86`
  „Uwagi AI”). On the listing: „Analiza AI” column `src/components/tables/investments.tsx:123-141` and
  filter `investment-data-table.tsx:107-114`.
- Stage values `src/lib/constants/investment-ai-stage.ts:2-8`: `ready_for_analysis`, `analyzed`,
  `review_done`, `knowledge_extracted`, `new_information`; `null` = „Uzupełnianie informacji”.
  Written via `setInvestmentAiStageAction` (`src/lib/actions/investments.ts:167-197`, `protectedAction`).
- Roles: `MANAGEMENT_ROLES = ['ADMIN','OWNER','MANAGER']` (`src/lib/auth/roles.ts:16`). EMPLOYEE is
  redirected off both pages — any link placed there is management-only with no extra gate.
- i18n: the investments surface is hardcoded Polish (no `investments` namespace) — a hardcoded label
  matches its neighbours.
- URL constants are domain-scoped files in `src/lib/constants/` (`sheets.ts`); no general links file.

### 3. Data: making the refresh repeatable

- **Case ↔ investment**: `wykonczymy-ai-cases/cases/<NN>-<slug>/case.json` holds `investmentId`
  (also `presetId`, `files`, `draft`, `notesAppendix`; no date/round/status). All 31 cases have it;
  it matches the 24 hand-typed rows of the SQL.
- **Which cases are scorable** = owner has reviewed: `investments.ai_stage IN ('review_done',
  'knowledge_extracted') AND trashed_at IS NULL AND EXISTS (item with ai_planned_qty IS NOT NULL)`.
  On the local dump (2026-10-22) that is the 24 mapped investments + #200, #202 (cases 11, 12). #228
  is `knowledge_extracted` with 0 AI rows → dropped by `EXISTS`. A new round sets the stage back to
  `analyzed` (ai-cases `README.md:969-973`), so the case leaves the report until re-reviewed.
- **Excluded today**: cases 11 (#200) and 12 (#202) — selection-only, no files, most rows at qty 0
  (`README.md:106-112, 275-276`); scoring them would count „Praca wybrana, ilość nieznana” as AI
  misses. Reason is implied, not written. Case 26 (#223, round 2 not reviewed) and 28–31 (#226,
  #227, #229, #230, owner hasn't reviewed) are `analyzed`.
- **Batches have no home.** Flow changes are scattered through the README research log: 10-01 no
  knowledge; 10-08 first katalog Komentarze + Manual; 10-09 „assume and write every assumption”, cases
  1–4 rebuilt; 10-12 batch #198–#206 + first knowledge lift; 10-14 one sekcja per bathroom, later
  rounds; 10-15 reviewer agent (case 22 first); 10-16 szablon → `templates` #1 (cases 24+); 10-20
  reviewer checks duplicates. Knowledge lifts are dated in `knowledge-ledger.json` (131 entries).
- **Batch 1 is probably mislabelled**: cases 1–6 share the same `inputs/wiedza-firmowa.md` committed
  2026-10-09 and their `ai-draft-load.json` were last written 10-09 — the drafts now on prod for cases
  1–2 were likely rebuilt with the first house rules.
- **`ai_planned_qty` is not stable**: a later round overwrites it (`scripts/ai-kosztorys/
  load-draft-sql-prod.ts:138-143`). Cases 5 (#190) and 8 (#198) are scored on round-2 values (local:
  19 and 15 rows still `ai_recheck = true`). Frozen per-round AI quantities exist only in case files
  (`measure/ai-draft-load.json`, `ai-draft-pre-review.json` for 22–31, `ai-draft-round-N.json`) and in
  daily `kosztorys_snapshots` (`snapshot-format.ts:82`, thinned by `snapshot-gc.ts`). No column
  records an item's round.
- **Prod access pattern of the existing scripts** (`scripts/ai-kosztorys/`):
  - REST through the app (`prod-client.ts`: base URL `:10`, `TOKEN_FILE` `:13`, `api()` `:76`,
    `itemsOf()` `:121` returns `aiPlannedQty`, `plannedQty`, `changeReason`, `clientPrice`,
    `description`). Run `TOKEN_FILE=… node --import tsx scripts/ai-kosztorys/<x>.ts`. GET-only =
    read-only by construction. `collect-reasons-prod.ts:28-36` already filters by `aiStage =
    review_done` with an `INVESTMENTS=` override; `CASES_ROOT` (`prod-client.ts:11`) resolves the
    ai-cases repo.
  - Raw psql only in `load-draft-sql-prod.ts:165-170` (`DB_POSTGRES_URL_PROD`, `--env-file=.env`).
- Output (slugs, zł, pozycja names) carries no personal data. Note the README contradicts itself on
  the repo's visibility (`README.md:30` private vs `:958-959` public).

### 4. Where the refresh step belongs in the runbook

- Two reviews exist: the reviewer agent before load (fast path step 6, `README.md:69-84`) and the
  owner's review in the app after load. The metric needs the owner's final Przedmiar → known when he
  sets „Recenzja zakończona” (`review_done`), Method step 9 (`README.md:211`).
- Placement: in step 9, after `collect-reasons-prod.ts` and before setting „Wiedza wyekstraktowana”
  (`README.md:256`). Step 8 „Evaluation (not done yet for any case)” (`README.md:206`) becomes a
  pointer to the script — the dashboard is that evaluation. The README's own metric sketch
  (`README.md:695-699`) and „Improvement loop” (`:795-808`, „a deterministic scoring script”) are the
  same idea.

### 5. In-app alternative

- `recharts ^2.15.4` (`package.json:98`), wrapped in `src/components/ui/chart.tsx`; one real use
  (`SlicePie`). No analytics page exists; no decision against one.
- A management route needs `page.tsx` + `requireAuth(MANAGEMENT_ROLES)`, `loading.tsx` with
  `TitledPageLoading`, a `PAGE_TITLES` key + `NAV_LINKS` entry (`src/lib/constants/sections.ts:22-80`),
  raw SQL in `src/lib/db`, a `cached()` query in `src/lib/queries`.
- Cost beyond the page: case numbers, slugs, batches and exclusions live in the ai-cases repo, not
  the DB — they'd have to move into the app (a table or a constant). Gain: no manual refresh; figures
  live per render.

## Code References

- `src/app/(frontend)/inwestycje/page.tsx:11-19` — listing, management gate
- `src/components/investments/investment-data-table.tsx:129` — toolbar `actions` slot in use
- `src/components/tables/data-table/data-table-toolbar.tsx:17-25` — the slot
- `src/components/ui/external-link.tsx` — external link primitive, fixed `touch` size
- `src/app/(frontend)/kosztorysy/page.tsx:55-58` — existing external header link (audit A41 drift)
- `src/app/(frontend)/design/audyt/groups/a41-list-page-header.tsx:91-121` — audit proposal
- `src/components/investments/investment-overview.tsx:43-63,86` — investment page buttons, Etap AI
- `src/lib/constants/investment-ai-stage.ts:2-58` — stages and labels
- `src/lib/constants/sheets.ts:1` — URL-constant precedent
- `scripts/ai-kosztorys/prod-client.ts:10-13,76,121` — REST prod access
- `scripts/ai-kosztorys/collect-reasons-prod.ts:28-36` — `review_done` filter precedent
- `scripts/ai-kosztorys/load-draft-sql-prod.ts:138-143` — rounds overwrite `ai_planned_qty`
- `src/collections/kosztorys-items.ts:39,43,55-59,87` — `plannedQty`, `clientPrice`, `aiPlannedQty`, `changeReason`
- `wykonczymy-ai-cases/README.md:206,211,250-256,695-699,795-808,969-973` — runbook anchor points

## Architecture Insights

- The dashboard is a read model whose source of truth is split: figures in prod
  (`kosztorys_items`), identity of cases and batches in the ai-cases repo. Whichever host renders it
  (claude.ai or the app) needs both; that split, not the charting, decides the cost.
- „Score against the current `ai_planned_qty`” and „score against the round the owner reviewed” differ
  for every multi-round case; today's numbers mix them silently.

## Historical Context (from prior changes)

- No claude.ai artifact has ever been linked from the app UI; four are linked from docs
  (`context/reference/kosztorys-snapshots.md:6`, `context/reference/roles-inventory.md:6`,
  `context/changes/2026-10-22-v1-phase-out/analysis.md:3-4`,
  `context/changes/2026-10-19-desktop-regression-audit/change.md:18`). Nothing records whether
  managers have claude.ai accounts.
- `context/archive/2026-10-12-investment-ai-stage/change.md` — one Etap AI field; owner sets
  „Recenzja zakończona”.
- `context/archive/2026-10-23-ai-stage-push/change.md` — „notify, don't trigger”; push on entry into
  `ready_for_analysis`, `analyzed`, `review_done`.
- `context/archive/2026-10-06-kosztorys-ai-knowledge-loop/change.md:70` — AI przedmiar 0 (skipped)
  vs empty (never had it) kept distinguishable for analysis.
- ai-cases `cases/01-bemowo-125m2/owner-comparison.md:29-40` — „Suma to zły wskaźnik — oceniać trzeba
  pozycje”: per-pozycja zł error, not totals, is the measure the dashboard uses.
- Roadmap (`context/foundation/roadmap.md`) has no AI-kosztorys or dashboard entry.

## Related Research

- `context/changes/2026-10-22-v1-phase-out/analysis.md` — the other team-facing artifact.

## Decisions (2026-10-23)

- **No batches.** The dashboard goes case by case; no grouping into rounds of the flow, no batch
  registry. The per-batch datasets (`reasons`, `error_types`) become per-case, `cases` loses its
  batch columns, and the batch-1 label problem disappears with them.

## Open Questions

1. **Can a manager without a claude.ai account open the link?** Check in a private window. No →
   the claude.ai path is dead and the in-app page is the only route.
2. **Which AI values to score**: the current `ai_planned_qty`, or the round the owner reviewed
   (frozen case files)? Decides whether cases 5 and 8 move.
3. **Cases 11/12** — keep excluded (write the reason) or score them.
4. **Repeated pozycje** — were limited to batches ≥ 4 (cases 17+); without batches, over every scored
   case or over a case-number floor.
5. **Link on the investment page too, or only the listing?** It's a cross-investment figure; the
   „Etap AI” row is the one place the AI workflow shows up per investment.
