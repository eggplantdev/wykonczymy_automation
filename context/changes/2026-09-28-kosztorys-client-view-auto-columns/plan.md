# Investor View Auto-Columns Implementation Plan

## Overview

Retire the „Oferta / Rozliczenie" mode of the investor view. Each investment keeps **one** client
column set; the settlement columns („Pomiar z natury", each etap's ilość and wartość, „Razem
netto", „% wykonania", and their brutto twins) appear on Podgląd, `/k/:token` and the offer PDF only
when the kosztorys holds entries for them. „Udostępnij" drops its settings step: the click mints the
link if missing and copies it. Owner rulings are in `change.md`; the codebase map is `research.md`.

## Current State Analysis

- Storage: `kosztorys_client_view` (per investment) and `kosztorys_client_view_defaults` (firm-wide
  global) hold `mode` + `variants` json (`OFFER` / `SETTLEMENT`, each `{hiddenColumns,
hideEmptyRows}`). EX-722 (`20260824_0_…`) already dropped the flat `hidden_columns` /
  `hide_empty_rows` pair.
- Pure core `src/lib/kosztorys/client-view-settings.ts` defines `ClientViewSettingsT` (flat — what
  every renderer consumes), `ClientViewModeT`, `ClientViewConfigT`, two code defaults, a fail-closed
  sanitizer per variant, and `clientViewSettingsForMode`.
- Every renderer already takes the flat `ClientViewSettingsT`: the preview entrances via
  `getClientViewSettings`, the grid via `previewHiddenColumns`, the print via
  `buildOfferPrintHtml({ settings })`. Only the dialogs, the investor-actions state, the offer-print
  action (pins `config.variants.OFFER`) and the save actions see the mode.
- Nothing hides an empty column anywhere today. `row['stage_<id>']` is never null (`treeToRows` fills
  `?? 0`), so "has data" = some row with `!== 0` in that etap.
- The „Robocizna" summary tab (`summary-stages-tab.tsx`, view value `'stages'`) lists every etap,
  empty ones at 0 zł, plus the progress counter and the „Udział sekcji" pie; its empty state is
  „Brak etapów." when `stages.length === 0`.
- The share dialog is two steps (settings → link). The working tree carries an interim edit of it and
  of `e2e/drivers/share-link.ts` („Wygeneruj i skopiuj link" on the settings step) — both are
  superseded by Phase 3 / Phase 4.

## Desired End State

- One „Ustawienia podglądu inwestora" set per investment (and one firm-wide default), no mode toggle,
  no „Uwaga — zmiana widoczna dla inwestora!" confirm on save. The dialog says that settlement
  columns without entries — and empty etapy — stay hidden from the investor.
- On the investor's surfaces (Podgląd, `/k/:token`, „Wygeneruj ofertę w PDF"): an etap with no entry
  has neither its ilość nor its wartość column; with no entry in any etap, „Pomiar z natury",
  „Razem netto", „% wykonania" (and „Razem brutto") are absent. „Pozostało" is hidden by default and,
  if the owner ticks it, always shown.
- The investor's „Robocizna" tab lists only etapy with entries; with none it shows „Brak etapów.".
- „Udostępnij" copies the link on the click (minting one if none exists; never rotating an existing
  one) and opens the link panel (copy / „Wygeneruj nowy" / revoke) with a „Ustawienia podglądu…"
  shortcut.
- The worker document is untouched: its empty etapy stay visible.
- Stored settings migrated by the owner's rule; `mode` / `variants` columns remain in the DB, unread,
  until a tracked follow-up drops them.

Verify: the phase specs below, the rewritten `e2e/client-share.spec.ts`, and the manual checks.

### Key Discoveries:

- Per-etap columns are keyed by full id (`stage_<id>`, `stageValueNet_<id>`, `stageValueGross_<id>`),
  but `selectV2Columns` filters on `toggleKey(c.id)`, which collapses them to the group key
  (`src/components/kosztorys/editor/grid/column-selection.ts:131`). The emptiness test must read the
  **full** id — disclosure matches the full id (`lessons.md` „Namespacing a column id…").
- The print's per-etap columns carry the full id as `key` (`offer-print/columns.ts` `offerColumnsByKey`),
  so the same id set filters both surfaces.
- `previewVisible: preview && !worker` (`use-kosztorys-editor.ts`) is the investor-audience flag;
  `assertDisclosurePair` keeps it false for the worker document. Gate the new rule on it, never on
  `view === 'client'`.
- The old `hidden_columns` column carried `DEFAULT '[]'` — „hide nothing" (`20260824_0_…:31`).
- `saveClientViewDefaultsAction` read-modify-writes one variant; with one set it becomes a plain write.
- `use-client-view-mode-confirm.ts` and `CLIENT_VIEW_MODE_IMPACT` exist only for the mode; the shared
  `INVESTOR_IMPACT_TITLE` / `useInvestorImpactConfirm` stay (settlement-mode confirm uses them).
- `e2e/client-share.spec.ts` uses `selectVariant` in three tests and imports `CLIENT_VIEW_MODE_IMPACT`;
  the seed (`src/scripts/seed-client-share.ts`) has one etap („Etap 1") with one progress row.

## What We're NOT Doing

- Writing the DROP migration for `mode` / `variants` and their enums — parked in a Linear issue,
  authored only after this deploy is live (`lessons.md` „A migration that both ADDs and DROPs…",
  rule 2).
- Touching the worker view, its settings, dialog or print.
- Changing which columns the investor MAY see (`PREVIEW_VISIBLE_COLUMNS` / `CLIENT_DOCUMENT_COLUMNS`).
- Changing the Podsumowanie / Materiały tabs, or the owner's own „Robocizna" tab.
- Addressing how `investor-change-history` (planned) renders past days — under this rule a past day's
  etap columns follow that day's entries, which falls out of computing emptiness from the rendered
  rows.
- Revisiting manager share permissions (commit `cdd32061`); they stay.

## Implementation Approach

Collapse the mode at the storage and settings layer first (one phase, because the collection types
and the core module change together). Then add one pure function that derives the empty settlement
columns from rows + stages, and subtract its result on the grid and the print — it only ever
subtracts inside the ceiling, so the fail-closed invariant holds. Then rewrite the share dialog, then
the E2E and docs.

## Critical Implementation Details

- **The re-added hidden set must fail closed.** Re-add `hidden_columns` as nullable jsonb with **no
  default**; NULL (never chosen) must resolve to the code default through the sanitizer, never to
  `[]`. A `DEFAULT '[]'` would hand every unsaved investment — and the firm global — the whole
  allowlist, rabat included. `hide_empty_rows` may keep `NOT NULL DEFAULT true`.
- **Backfill rule (owner, 2026-09-28)**, both tables: take the **active** variant (`variants->mode`).
  If it is absent → leave `hidden_columns` NULL (code default — which hides „Pozostało"). If
  `mode = 'SETTLEMENT'` → copy its `hiddenColumns` as-is. If `mode = 'OFFER'` → copy its
  `hiddenColumns` minus `stageQtySum`, `stages`, `stageValueNet`, `net`, `donePercent`; brutto
  (`gross`, `stageValueGross`) and `remaining` stay as stored. `hide_empty_rows` from the active
  variant, default true. In SQL, `jsonb_agg` over zero elements yields NULL — `COALESCE(…, '[]')`
  where the variant exists, or an OFFER variant that hid only settlement keys silently becomes
  „never chosen".
- **Deploy order:** the migration is additive and orderless — migrate prod before pushing. The old
  code keeps reading `mode` / `variants`, the new code reads the flat pair; a save made on the old
  deploy between the migration and the new deploy is not re-copied (accepted: minutes, a handful of
  users).
- **Clipboard in Safari:** start the copy synchronously inside the click with a Promise-valued
  `ClipboardItem` (`navigator.clipboard.write([new ClipboardItem({ 'text/plain': promiseOfBlob })])`)
  that resolves once the token read / mint lands; fall back to the existing failure toast. The panel's
  own „Kopiuj" stays as the manual path.

## Phase 1: One column set (storage + settings)

### Overview

The investment and the firm default each store one flat set; the mode, both variants and the mode
confirm leave the code.

### Changes Required:

#### 1. Additive migration

**File**: `src/migrations/20260928_2_client_view_single_set.ts` (+ `index.ts` entry)

**Intent**: Re-add the flat pair on both tables and backfill it from `mode` / `variants` by the rule
in Critical Implementation Details. Do not drop anything.

**Contract**: `hidden_columns jsonb NULL` (no default), `hide_empty_rows boolean NOT NULL DEFAULT
true` on `kosztorys_client_view` and `kosztorys_client_view_defaults`; `ADD COLUMN IF NOT EXISTS`;
`down` drops the two columns. Hand-written after the latest file's structure (AGENTS.md
„Migrations").

#### 2. Collection + global

**File**: `src/collections/kosztorys-client-view.ts`, `src/globals/kosztorys-client-view-defaults.ts`

**Intent**: Declare `hiddenColumns` (json, no default) and `hideEmptyRows` (checkbox, default true);
stop declaring `mode` / `variants` (the DB defaults fill `mode` on insert until the DROP). Update the
header comments to the single-set story; `defaultColumns` loses `mode`.

**Contract**: Payload field names `hiddenColumns` / `hideEmptyRows`; regenerate `payload-types.ts`.

#### 3. Pure core

**File**: `src/lib/kosztorys/client-view-settings.ts`

**Intent**: Remove `ClientViewModeT`, `ClientViewConfigT`, the two variant defaults,
`clientViewSettingsForMode`, `sameClientViewConfig`. One code default = today's settlement visible set
without `remaining`: `description, plannedQty, unit, price, plannedNet, stageQtySum, net, stages,
stageValueNet, donePercent`. One sanitizer that fails closed exactly as today (non-object or
non-array `hiddenColumns` → the default hidden set; unknown keys dropped).

**Contract**: `ClientViewSettingsT` unchanged; `sanitizeClientViewSettings(source: unknown):
ClientViewSettingsT`; `sameClientViewSettings` exported only if a caller still needs it.

#### 4. Resolver, endpoint, actions

**Files**: `src/lib/queries/kosztorys-client-view.ts`, `src/lib/queries/client-view-settings-endpoint.ts`,
`src/lib/actions/kosztorys-client-view.ts`

**Intent**: `getClientViewSettings` resolves row → global → code default and returns the flat set
(fold `getClientViewConfig` into it); `readClientViewSettings` returns `ClientViewSettingsT`.
`saveClientViewSettingsAction(investmentId, settings)` sanitizes and upserts the flat pair.
`saveClientViewDefaultsAction(settings)` writes the flat pair to the global — no read-modify-write,
no mode argument. Rewrite the comments that explain variants.

**Contract**: a row whose `hiddenColumns` is NULL resolves to the code default, not to the global —
the row still wins as a whole, as today.

#### 5. Settings UI

**Files**: `src/components/kosztorys/editor/dialogs/client-view-settings-form.tsx`,
`kosztorys-client-view-dialog.tsx`, `src/components/kosztorys/editor/actions/investor-actions.tsx`;
delete `use-client-view-mode-confirm.ts`; remove `CLIENT_VIEW_MODE_IMPACT` from
`src/lib/kosztorys/investor-impact.ts`.

**Intent**: The form edits one `ClientViewSettingsT` via `ViewSettingsFields`; the ToggleGroup and its
copy go. Add a `Description` under the fields: settlement columns (Pomiar z natury, etapy, wartości
etapów, Razem netto/brutto, % wykonania) appear for the investor only once there are entries, and
empty etapy stay hidden. The dialog saves without a confirm; toast „…domyślne" loses „dla tego
wariantu". `InvestorActionsT.clientView` becomes `ClientViewSettingsT | null`.

**Contract**: the share dialog stops importing the form in Phase 3; in this phase it compiles against
the flat type (its settings step is removed next phase — a minimal type fix is enough here).

#### 6. Specs

**Files**: `src/__tests__/lib/kosztorys/client-view-settings.test.ts`,
`src/__tests__/lib/queries/kosztorys-client-view.test.ts`,
`src/__tests__/lib/actions/kosztorys-client-view-defaults.test.ts` (DB)

**Intent**: Re-pin the single default (no `remaining`), fail-closed sanitizing, row → global → code
fallback incl. a NULL `hiddenColumns` row, and the flat defaults write.

### Success Criteria:

#### Automated Verification:

- Migration applies to the local docker DB and backfills: `pnpm payload migrate`, then a SELECT over
  both tables shows the flat pair per the rule (an OFFER row without settlement keys, a SETTLEMENT
  row verbatim, a row without its active variant NULL)
- Types regenerate: `pnpm generate:types`
- Settings specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/client-view-settings.test.ts src/__tests__/lib/queries/kosztorys-client-view.test.ts`
- Defaults DB spec passes: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-client-view-defaults.test.ts`

#### Manual Verification:

- „Ustawienia podglądu…" shows one column list, no Oferta/Rozliczenie toggle, and the note about
  columns without entries; „Zapisz" saves with no confirm.
- An investment that was in Rozliczenie keeps its columns on the link after the migration; one that
  was in Oferta keeps its hidden columns.

**Implementation Note**: When this phase's automated verification passes, commit and continue — do
**not** pause for per-phase manual confirmation. Manual verification is collected once, at the end
of the change, into the manual-checks registry.

---

## Phase 2: Settlement columns only when there are entries

### Overview

One pure function decides which settlement columns are empty; the investor grid, the offer print and
the investor's „Robocizna" tab apply it.

### Changes Required:

#### 1. Pure emptiness module

**File**: `src/lib/kosztorys/settlement-columns.ts` (new)

**Intent**: Derive, from rows + stages, which etapy have entries and which settlement column ids are
therefore empty. Full ids, so both surfaces match without collapsing.

**Contract**:

- `stagesWithEntries(rows, stages): KosztorysStageT[]` — an etap has entries when some row's
  `stage_<id>` is `!== 0` (repo idiom `qty_done <> 0`).
- `emptySettlementColumnIds(rows, stages): ReadonlySet<string>` — for each etap without entries:
  `stage_<id>`, `stageValueNet_<id>`, `stageValueGross_<id>`; when no etap has entries also
  `stageQtySum`, `net`, `gross`, `donePercent`. Never `remaining`.
- Computed over the full `rows`, not the client-filtered ones, so columns don't jump on „Pokaż
  wszystkie pozycje".

#### 2. Investor grid

**Files**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`,
`src/components/kosztorys/editor/grid/column-selection.ts`

**Intent**: Under the investor audience only (`preview && !worker`), fold
`emptySettlementColumnIds(rows, stages)` into the preview subtraction. The preview branch of `keep`
must test the full column id as well as its toggle key, so a per-etap id can be subtracted alone.

**Contract**: `closed.has(toggleKey(id)) && !hidden.has(toggleKey(id)) && !hidden.has(id)` (or an
equivalent that passes the full id into `keep`); nothing is ever added past the ceiling.
`reconcileSort` already copes with a sorted column vanishing.

#### 3. Offer print

**Files**: `src/components/kosztorys/editor/actions/offer-print-action.tsx`,
`src/lib/kosztorys/offer-print/build-offer-print-html.ts`

**Intent**: The action passes the single stored set (no `variants.OFFER` pin; rewrite the comment that
justified it). `buildOfferPrintHtml` drops columns whose `key` is in `emptySettlementColumnIds(rows,
stages)` before counting them for the portrait/landscape switch.

**Contract**: `OfferPrintArgsT.settings: ClientViewSettingsT` unchanged; `offeredRows(rows, stages,
settings)` unchanged.

#### 4. Investor „Robocizna" tab

**Files**: `src/components/kosztorys/summary/tabs/summary-stages-tab.tsx`,
`src/components/kosztorys/summary/summary-panel-content.tsx`

**Intent**: In the investor preview, list only `stagesWithEntries(rows, stages)`; with none, the
existing „Brak etapów." empty state renders (counter and pie go with it, as they do today). The
owner's tab is unchanged.

**Contract**: gate on the panel's `preview`; verify the worker document does not mount
`SummaryPanelContent` (it renders `WorkerSummary`) — if it does, gate on the investor audience instead.

#### 5. Specs

**Files**: `src/__tests__/lib/kosztorys/settlement-columns.test.ts` (new),
`src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts`,
`src/__tests__/lib/kosztorys/offer-print/build-offer-print-html.test.ts`,
`src/__tests__/components/kosztorys/editor/actions/offer-print-action.test.tsx`,
`src/__tests__/components/kosztorys/summary/tabs/summary-stages-tab.test.tsx` (new)

**Intent**:

- pure: an etap with only saved zeros is empty; a negative entry counts; one etap with entries keeps
  `stageQtySum`/`net`/`gross`/`donePercent`; no etap at all → all four empty; `remaining` never.
- grid: under preview an empty etap's two columns are absent while a filled etap's are present; the
  worker surface keeps empty etapy (regression guard for the audience gate).
- print: the same two cases on the printed header; the action no longer reads an OFFER variant.
- tab: preview lists only the filled etap; none filled → „Brak etapów.".

### Success Criteria:

#### Automated Verification:

- Emptiness spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/settlement-columns.test.ts`
- Grid spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts`
- Print specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/offer-print/build-offer-print-html.test.ts src/__tests__/components/kosztorys/editor/actions/offer-print-action.test.tsx`
- Tab spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/summary/tabs/summary-stages-tab.test.tsx`

#### Manual Verification:

- Podgląd of a kosztorys with no entries shows only the offer columns; after entering a quantity in
  one etap, that etap (ilość + wartość), „Pomiar z natury", „Razem netto" and „% wykonania" appear,
  other etapy stay hidden.
- „Wygeneruj ofertę w PDF" prints the same columns as Podgląd.
- The worker's podgląd still shows empty etapy.
- Investor „Robocizna" tab lists only etapy with entries; with none it reads „Brak etapów.".

**Implementation Note**: commit and continue when automated verification passes.

---

## Phase 3: Share without the settings step

### Overview

„Udostępnij" copies the link on the click and opens straight on the link panel.

### Changes Required:

#### 1. Share click + dialog

**Files**: `src/components/kosztorys/editor/actions/investor-actions.tsx`,
`src/components/kosztorys/editor/dialogs/kosztorys-share-dialog.tsx`, `src/lib/utils/copy-to-clipboard.ts`

**Intent**: `requestShare` opens the dialog, reads the token, mints one only when none exists (never
rotates), and copies the URL — the clipboard write started synchronously in the menu's `onSelect`
with a Promise-valued `ClipboardItem`, success/failure toast as today. It no longer reads the client
settings. The dialog body is `ShareLinkPanel` only (the settings step, `step` state, draft and mode
confirm go), plus a „Ustawienia podglądu…" button that closes the share dialog and calls
`requestSettings`. Header description: the link-step copy.

**Contract**: a `copyToClipboardAsync(text: Promise<string>, successMessage)` (name at the
implementer's discretion) beside `copyToClipboard`, falling back to `writeText` after the promise
where `ClipboardItem` is unavailable. `ShareLinkPanel` unchanged — its no-token branch still serves
the post-revoke case.

#### 2. Specs

**File**: `src/__tests__/components/kosztorys/editor/actions/investor-actions.test.tsx` (new, DOM) or
the nearest existing share-dialog spec

**Intent**: with no token the click mints once and copies the new URL; with a token it copies the
existing URL and does not mint; the settings read is not called. Actions are `vi.mock`ed (stubbed
server actions throw).

### Success Criteria:

#### Automated Verification:

- Share spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/actions/investor-actions.test.tsx`

#### Manual Verification:

- „Udostępnij" on an investment without a link: toast „Link skopiowany do schowka.", the link is in
  the clipboard, the window shows it.
- With an existing link: the same link is copied, not a new one.
- Works in Safari (copy not refused).
- „Ustawienia podglądu…" in the share window opens the settings dialog.

**Implementation Note**: commit and continue when automated verification passes.

---

## Phase 4: E2E and docs

### Overview

Bring the browser spec and the living docs in line with one column set.

### Changes Required:

#### 1. E2E

**Files**: `e2e/client-share.spec.ts`, `e2e/drivers/share-link.ts`, `src/scripts/seed-client-share.ts`

**Intent**: Delete the variant-flip test and `selectVariant`; the other two tests lose their variant
step (and the `CLIENT_VIEW_MODE_IMPACT` import). `mintShareToken` follows the new click (copy happens
on the click; rotate with „Wygeneruj nowy" when a link already existed). Seed a second etap with no
progress; new test: the link shows „Etap 1" and „Pomiar z natury", not the empty etap; after a
quantity is entered in the second etap (through the owner's editor), a reload of the same link shows
it. Authored, not run by the agent.

#### 2. Docs + tracking

**Files**: `context/reference/kosztorys-editor-domain-notes.md` („Co widzi klient"),
`context/foundation/manual-checks.md` (retire the variant section at `:458` and the „zawsze wariant
OFERTA" print notes), Linear

**Intent**: Rewrite „Co widzi klient" to one set + the entries rule + the fail-closed NULL. In Linear
(project „Wykonczymy"): file the DROP migration of `mode` / `variants` + both enums (to run after this
deploy is live); close EX-721 as obsolete.

### Success Criteria:

#### Automated Verification:

- E2E spec type-checks as part of the whole-tree gate (not run by the agent)

#### Manual Verification:

- The user runs `pnpm test:e2e e2e/client-share.spec.ts` and it passes.

**Implementation Note**: final phase — aggregate the Manual Verification bullets into
`context/foundation/manual-checks.md`.

---

## Testing Strategy

### Unit Tests:

- Emptiness rule (zeros, negatives, no etapy, one filled etap, `remaining` never conditional).
- Sanitizer: single default, fail-closed on NULL/garbage, unknown keys dropped.

### Integration Tests:

- Defaults DB spec (flat write); resolver fallback with a NULL-hidden row.
- Grid + print column sets for the investor audience; worker audience untouched.

### Manual Testing Steps:

1. Fresh investment, no entries → Podgląd + PDF show offer columns only.
2. Enter a quantity in one etap → that etap, „Pomiar z natury", „Razem netto", „% wykonania" appear.
3. Tick „Pozostało" → visible even with no entries.
4. „Udostępnij" twice → the same link both times, copied each time.

## Performance Considerations

`emptySettlementColumnIds` is one pass over rows × stages (1000+ rows × a handful of etapy) per
render of the investor grid — only under preview, where rows never change. No memo needed beyond what
the React Compiler gives.

## Migration Notes

- Additive migration → `pnpm db:migrate:prod` (human) **before** the push.
- DROP of `mode` / `variants` / `enum_kosztorys_client_view_mode` /
  `enum_kosztorys_client_view_defaults_mode` → separate migration, authored after this deploy is live,
  tracked in Linear.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full suite passes: `pnpm test`
- Integration suite passes: `pnpm test:integration`
- Build succeeds: `pnpm build`

## References

- Research: `context/changes/2026-09-28-kosztorys-client-view-auto-columns/research.md`
- Owner rulings: `context/changes/2026-09-28-kosztorys-client-view-auto-columns/change.md`
- Prior: `context/archive/2026-08-15-client-preview-settings/`,
  `context/archive/2026-08-19-kosztorys-client-view-offer-settlement-variants/`,
  `context/archive/2026-09-23-wydruk-oferty/`
- Lessons: `lessons.md` „A stored preference records the DEVIATION…", „A disclosure setting
  subtracts from a code ceiling…", „A migration that both ADDs and DROPs…", „Namespacing a column
  id…"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: One column set (storage + settings)

#### Automated

- [x] 1.1 Migration applies to local docker DB and backfills per the rule — 47e02e81
- [x] 1.2 Types regenerate — 47e02e81
- [x] 1.3 Settings specs pass — 47e02e81
- [x] 1.4 Defaults DB spec passes — 47e02e81

### Phase 2: Settlement columns only when there are entries

#### Automated

- [x] 2.1 Emptiness spec passes — e882bef8
- [x] 2.2 Grid spec passes — e882bef8
- [x] 2.3 Print specs pass — e882bef8
- [x] 2.4 Tab spec passes — e882bef8

### Phase 3: Share without the settings step

#### Automated

- [x] 3.1 Share spec passes — 25f3894e

### Phase 4: E2E and docs

#### Automated

- [ ] 4.1 E2E spec type-checks under the whole-tree gate
