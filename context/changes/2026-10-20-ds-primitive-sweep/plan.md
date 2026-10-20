# DS Primitive Sweep Implementation Plan

## Overview

Move every hand-rolled UI copy in the census (`census.md`, ~270 sites) onto shared `src/components/ui/`
primitives, consolidate the duplicates inside `ui/` itself, and land a mechanical guard first so no new
copy can appear while the sweep runs or after it. Parent: EX-1099 (EX-1110's swap list is folded in).

## Current State Analysis

- `ui/` holds ~110 primitives and the `/design` page renders them (design-system change). Nothing stops
  a feature from rebuilding one: no lint rule, no AGENTS.md rule. `app-audit-refactor` measured
  duplication with jscpd (token clones), so a component rebuilt with other classes never showed up.
- `ui/` itself carries duplicates: six spinner looks, two dialog title styles, two footers, five heading
  scales, near-duplicate Button variants, three green and three warning spellings, two error/hint
  systems (`FieldError`/`FieldDescription` vs `Description`).
- Several shapes the features need do not exist yet (Button `2xs`/`iconSm`/`touch`/`inline`/`pending`,
  `InlineLoading`, `Panel`, `Sheet`, `TextLink`, `--color-warning`, …), so the copies had nowhere to go.
- The collapsible family is mostly done (`94e30d52e`, `05b6d8911`). Another agent still has
  uncommitted edits on `ui/collapsible.tsx`, `ui/collapsible-section.tsx`, `sidebar.tsx`,
  `collapsible-line-item.tsx`, `sheet-report-parts.tsx`, `worker-report-review.tsx`, `ui/select.tsx`.

## Desired End State

- Outside `src/components/ui/`, the guard rule `local/no-hand-rolled-ui` reports nothing; every
  remaining exception carries an `eslint-disable-next-line local/no-hand-rolled-ui -- <reason>`.
  `eslint-suppressions.json` no longer exists.
- Every census line is either swapped, or marked legit in `census.md` with its reason.
- Inside `ui/`: one spinner (`GradientSpinner`), one dialog title/header/footer, one heading scale
  family, one warning token, one green, one error/hint system, no unreferenced Button variants.
- `/design` shows every new piece.
- Verify: `pnpm lint` green with no suppressions file; the guard's spec is green and was seen red.

### Key Discoveries:

- `eslint.config.mjs:85-94` composes `no-restricted-syntax` per file group, and `:96-137` does the same
  for `no-restricted-imports`. A later flat-config block **replaces** a rule's options, so adding the
  guard as more selectors to those rules would silently drop `NO_RAW_ENV` / `UNSETTLED_ACTION` /
  `NO_RAW_UNSTABLE_CACHE` on the overlapping files. Hence a separate local rule, like
  `eslint-rules/no-domain-drift.mjs` (`eslint.config.mjs:147-152`).
- ESLint is 9.39.2: bulk suppressions (`--suppress-rule`, `eslint-suppressions.json`,
  `--prune-suppressions`) exist, so the baseline is a ratchet without per-file ignores.
- Outside `ui/` (2026-10-20): 24 raw `<button>`, 10 raw `<label>`, 1 `<details>`, 27 `Loader2`/`LoaderCircle`,
  1 raw `@radix-ui` import (`totals-panel-overlay.tsx:3`), 3 `react-toastify` imports (two are the
  legit `ToastContainer` mounts in `(frontend)/layout.tsx` and `(share)/layout.tsx`).
- The `/design` page loops over each component's exported variant maps
  (`app/(frontend)/design/sections/*`), so new Button sizes and Badge tones show up without listing.
  New components need an entry in their section.
- Phone scope (AGENTS.md): navigation must work at 390px, so the `mobile-nav` → `Sheet` swap is a
  phone-checked change.
- A custom font-size `@utility` must be registered in `cn.ts`'s `extendTailwindMerge`
  (`lessons.md` "Small rendering traps"). Colour tokens need nothing.

## What We're NOT Doing

- No Storybook and no agent catalogue doc. `/design` plus the guard is the anchor.
- No redesign: Δ swaps only apply the defaults below. No new looks are invented.
- No touch-target floor app-wide (AGENTS.md: phone scope is narrow).
- Legit exceptions stay, with a disable reason: the worker-report review groups, the grid
  section-header cell, the toolbar `sm:contents` panel, the sidebar rail handle, the `section-color-picker`
  swatch grid, the media overlays, `nav/refresh-data-button.tsx`, the `(legal)` pages, the hidden file
  inputs, the truncation-reveal `title`s, and the public worker page tables.
- No datasheet-grid cell rework beyond the census lines (the `ui/datasheet-grid/` second iteration of
  the design page is its own change).
- No E2E. These are presentational swaps; the risk is visual and is covered by manual checks.

## Implementation Approach

The order is guard → bugs → `ui/` consolidation → new `ui/` pieces → swaps per UI family → close-out.

The guard lands first, with a bulk-suppression baseline of today's violations. A new copy fails lint
from day one, and every swap phase shrinks the baseline with `--prune-suppressions`.

Swap phases go one UI family at a time, mirroring the census sections. Each phase does its `=` and `Δ`
swaps together, because the Δ defaults are settled (table in `plan-brief.md`).

**Re-grep every census line before editing it.** Line numbers drift, and other agents commit to the
same tree.

## Critical Implementation Details

**Guard mechanics.** The rule is `local/no-hand-rolled-ui`, scoped to `src/components/**`, `src/app/**`
and `src/hooks/**`, with `src/components/ui/**` excluded. Run the baseline once:
`pnpm exec eslint . --suppress-rule local/no-hand-rolled-ui`. In phase 1, confirm how 9.39 treats a
suppression that is no longer needed (error vs pass). If it errors, every swap phase must prune or lint
goes red, which is the intended ratchet. If it passes, pruning is still a required step of each phase.

**In-flight collapsible work.** Phase 11 (disclosure) starts only when `git status` shows the other
agent's collapsible files committed. Phases 3–4 must not edit `ui/collapsible.tsx` or `ui/select.tsx`
while those are dirty. If a piece needs them, move that piece to phase 11.

**Translatable defaults.** A new `ui/` piece with a built-in label (`InlineLoading` „Wczytywanie…",
`FormDialogShell` `cancelLabel`) takes it through a translator that defaults to the Polish table
(AGENTS.md: the app speaks the viewer's language). Never hard-code Polish inside `ui/`.

**Memoized surfaces.** `tables/data-table/data-table.tsx` and the kosztorys editor carry hand memos
pinned by `*-memoization.test.ts`. A class swap there must not restructure the memoized value. Run the
matching memoization spec after touching either.

## Phase 1: Guard against new copies

### Overview

A local ESLint rule flags the census signals outside `ui/`. A suppression baseline freezes today's
count, and AGENTS.md states the rule for agents.

### Changes Required:

#### 1. The rule

**File**: `eslint-rules/no-hand-rolled-ui.mjs` (new), `eslint.config.mjs`

**Intent**: Report the mechanical fingerprints of a rebuilt primitive, so a copy fails lint instead of
waiting for an audit.

**Contract**: Each check reports a message naming the `ui/` primitive to use.
- Imports from `@radix-ui/*`, `radix-ui`, `cmdk`, `vaul`.
- `react-toastify` imports other than `ToastContainer`.
- lucide `Loader2` / `LoaderCircle` imports.
- Class-string literals and template parts with a raw status palette:
  `(text|bg|border|ring|fill|stroke)-(red|green|amber|emerald|yellow|orange)-\d{2,3}`.
- `sm:max-w-(sm|md|lg|xl|\dxl)` or `sm:max-w-[` in the className of `DialogContent` /
  `AlertDialogContent` / `FormDialogShell`.
- `<p>`/`<span>` whose className has both `text-destructive` and `text-(xs|sm)`.
- Intrinsic `<details>` and `<label>`.
- `<button>` with a `className`.
- A `title` attribute on an intrinsic element or on `Button`.

Registered beside `no-domain-drift` in the `local` plugin. Files `src/{components,app,hooks}/**`,
ignoring `src/components/ui/**`.

#### 2. Baseline

**File**: `eslint-suppressions.json` (generated)

**Intent**: Freeze today's violations so lint stays green while new ones fail.

**Contract**: Generated by `pnpm exec eslint . --suppress-rule local/no-hand-rolled-ui`. Committed.

#### 3. Spec

**File**: `src/__tests__/eslint-rules/no-hand-rolled-ui.test.ts` (new)

**Intent**: Pin each check with a valid and an invalid case through ESLint's `RuleTester`.

**Contract**: One invalid case per check, plus valid cases:
- the same code under `src/components/ui/`;
- `ToastContainer`;
- `title` on a non-`Button` component.

Break-verify: disable one check in the rule and watch its case go red.

#### 4. Agent rule

**File**: `AGENTS.md` → "Where code lives"

**Intent**: One bullet saying UI primitives come from `src/components/ui/`, enforced by
`local/no-hand-rolled-ui`. A new shape is added to `ui/` (and `/design`), not copied. An exception
carries a disable with a reason.

**Contract**: Edit through the `agent-rule-authoring` skill.

### Success Criteria:

#### Automated Verification:

- Rule spec passes: `pnpm exec vitest run src/__tests__/eslint-rules/no-hand-rolled-ui.test.ts`
- Rule spec seen red with one check disabled, then restored
- `pnpm exec eslint src/components src/app src/hooks` passes with the baseline in place
- A scratch file with a raw `<button className>` fails lint (then deleted)

#### Manual Verification:

- None (no UI change)

---

## Phase 2: Bugs (test-first)

### Overview

The five defects from census §0. Each gets a failing test that asserts observable state, where one is
possible, before the fix.

### Changes Required:

#### 1. Sign colour without rounding

**Files**: `components/users/owned-registers-section.tsx`,
`kosztorys/summary/blocks/subcontractor-headline-summary.tsx`, `subcontractor-worker-totals.tsx`

**Intent**: A −1e-13 residue paints „0,00 zł" red. Switch to `signedMoneyColor`.

**Contract**: The rendered colour class for a residue balance equals the one for 0.
Tests: jsdom render of each component with a residue value, under `src/__tests__/components/**`
mirroring each path.

#### 2. Totals panel toggle

**File**: `kosztorys/summary/kosztorys-totals-panel-toggle.tsx`

**Intent**: The disabled reason never shows (`title` on a `disabled:pointer-events-none` Button), and
the toggle has no `aria-expanded`.

**Contract**: `aria-expanded` reflects open state. The disabled reason goes through `SimpleTooltip` on a
wrapper that receives pointer events. jsdom spec asserts `aria-expanded` flips on click and the reason
text is reachable when disabled.

#### 3. Login double loader

**File**: `app/(auth)/zaloguj/login-form.tsx`

**Intent**: A full-screen `Loader` stacks on `AuthSubmitButton`'s spinner. Keep the button's spinner.

**Contract**: jsdom spec: in pending state exactly one `role="status"` element renders.

#### 4. Materials footer

**File**: `kosztorys/summary/tables/materials-transactions-table.tsx`

**Intent**: The footer finds its column by counting. Use `ColumnTotalRow columnId=…`.

**Contract**: jsdom spec: the total sits in the amount column's footer cell after a column is hidden.

#### 5. Input focus ring

**File**: `ui/input.tsx`

**Intent**: `focus-visible:ring-none` is not a utility, so `Input` has no focus ring. Match
Textarea/SelectTrigger.

**Contract**: No automated test, since jsdom can't tell whether a utility exists. Manual check.

### Success Criteria:

#### Automated Verification:

- Each new spec seen red before its fix, green after:
  `pnpm exec vitest run <the four spec paths>`

#### Manual Verification:

- Tabbing into any text `Input` (e.g. the transfer form amount) shows the same focus ring as a Textarea
- A cash register whose balance sums to 0 shows „0,00 zł" uncoloured in the user's owned-registers section
- Totals panel toggle disabled: hovering shows why

---

## Phase 3: Consolidate inside `ui/`

### Overview

Collapse the duplicates `ui/` already carries, before anything outside starts pointing at them.

### Changes Required:

#### 1. Tokens

**File**: `src/styles/globals.css`

**Intent**: Add one amber `--color-warning` (+ foreground) and retire `text-amber-600` /
`text-chart-orange` as warning spellings. `chart-green` is the one OK green.

**Contract**: `@theme` `--color-warning`, `--color-warning-foreground`, with dark-mode values.

#### 2. Button variants

**File**: `ui/button.tsx` + call sites

**Intent**: Merge the near-duplicates and drop the unreferenced variants.
- `activeFilter` → `greenOutline` (on `chart-green`).
- `destructiveOutline` / `redOutline` / `outlineDestructive` → one.
- Add a `warningOutline`.

**Contract**: The variant map shrinks. Every caller is moved in the same commit. Gate removal on
`tsc`, not grep.

#### 3. One spinner

**Files**: `ui/loader/*`, `ui/auth-submit-button.tsx`, `ui/upload-button.tsx`, `ContentLoading`

**Intent**: `GradientSpinner` everywhere, and a single `role="status"` per loader.

#### 4. One dialog chrome

**Files**: `ui/dialog.tsx`, `ui/alert-dialog.tsx`, `ui/confirm-dialog.tsx`, `ui/form-dialog-shell.tsx`

**Intent**: One title style (`SECTION_TITLE_CLASS`), one header and one footer. Export
`AlertDialogHeader`/`AlertDialogFooter`, and build `ConfirmDialog` on them. Widths use the
`max-w-dialog*` tokens.

#### 5. Headings, badges, fields, cards

**Files**: `ui/empty-state.tsx`, `ui/count-badge.tsx` → `Badge` solid appearance, `ui/search-select.tsx`
(reuse the SelectTrigger class), `ui/decimal-input.tsx` (Input look), `ui/textarea.tsx` (dark
`aria-invalid` ring), `ui/reason-field.tsx`, `ui/file-input.tsx`, `ui/settings-card.tsx` +
`ui/auth-success-card.tsx` → `Panel`, the native `title`s in `toggle-group.tsx` / `env-badge.tsx` /
`datasheet-grid/header-menu.tsx` → tooltip, `stat-button.tsx` inline `style`, `dot-badge` vs
`card-chip` colour maps.

**Intent**:
- Every `ui/` heading reads `SECTION_TITLE_CLASS`.
- Errors and hints use one system. `Description` delegates to `FieldError` / `FieldDescription`
  styling, or the reverse, so there is one class per tone.
- The muted xs label exists once (`decimal-field.tsx:94`, `inline-mode-select.tsx:29`).

### Success Criteria:

#### Automated Verification:

- Existing `ui/` specs pass: `pnpm exec vitest run src/__tests__/components/ui`
- No reference left to a removed Button variant (tsc, run at the whole-tree gate)

#### Manual Verification:

- `/design` → Przyciski: no duplicate-looking variants remain
- `/design` → Ładowanie i stany: one spinner look
- `/design` → Dialogi: every dialog has the same title and footer

---

## Phase 4: New `ui/` pieces

### Overview

Add every missing shape from census §1, each with an entry on `/design`, so swap phases only swap.

### Changes Required:

#### 1. Button

**File**: `ui/button.tsx`

**Intent**: The missing sizes and states.

**Contract**:
- Sizes: `2xs` (h-6 px-2 text-xs), `iconSm` (size-7), `touch` (h-11), `iconTouch` (size-11, svg 7),
  `inline` (h-auto p-0).
- An `active` variant for the nav.
- A `pending` prop: the leading icon becomes `GradientSpinner`, the button is disabled, and it gets
  `aria-busy`.
- `RowActionButton` passes `pending` through.
- Spec: `src/__tests__/components/ui/button.test.tsx` — pending disables the button, sets `aria-busy`
  and renders one status.

#### 2. Text actions and loading

**Files**: `ui/text-link.tsx` (`TextLink`, `TextButton`), `ui/inline-loading.tsx` (`InlineLoading`,
`BlockLoading`)

**Intent**:
- `TextLink` / `TextButton`: a muted xs text action, and the `text-primary` underline link.
- `InlineLoading`: spinner + label, default label translatable.
- `BlockLoading`: a centred box.

#### 3. Dialogs and overlays

**Files**: `ui/sheet.tsx` (new, Radix Dialog side=left), `ui/form-dialog-shell.tsx`, `ui/dialog.tsx`

**Intent**:
- `Sheet` replaces the hand-built mobile nav drawer.
- `FormDialogShell` gains `confirmVariant`, `cancelLabel` and `showCloseButton`.
- `DialogHeader.description` takes a ReactNode, and there is a `DialogBody` slot.

**Contract**: Sheet spec — Esc closes it and focus returns to the trigger
(`src/__tests__/components/ui/sheet.test.tsx`).

#### 4. Layout and text

**Files**: `ui/panel.tsx` (`Panel`, tones muted/alert; `BORDERED_LIST_CLASS`), `ui/section-header.tsx`,
`ui/badge.tsx`, `ui/warning-banner.tsx`, `ui/empty-state.tsx`, `ui/description.tsx`

**Intent**:
- `Panel` (with `SettingsCard` built on it). `CARD_SHELL_CLASS` / `CARD_LIST_CLASS` move into `ui/`
  from `transfers/cards/`.
- `SectionHeader size`, plus `SUBSECTION_TITLE_CLASS` and `EYEBROW_CLASS`.
- `Badge` gets a `section` tone, a pill shape with a trailing action, and a `solid` appearance.
- `WarningBanner bordered={false}`.
- `EmptyState size="inline"`.
- `Description tone="warning"`.

#### 5. Fields

**Files**: `ui/combobox.tsx`, `ui/search-select.tsx`, `ui/label.tsx`, `ui/checkbox-row.tsx`, `ui/field.tsx`,
`ui/toggle-group.tsx`

**Intent**:
- `Combobox variant="field"` + `invalid`.
- `SearchSelect` `size` + a `trigger` slot.
- `Label size="xs" tone="muted"`.
- `CheckboxRow variant="plain"`.
- A `Field` gap option and a muted `FieldLegend`.
- `ToggleGroup variant="muted"`, keeping the segmented look of `ui-scale-switch`.

#### 6. Data

**Files**: `ui/balance-cell.tsx`, `lib/utils` money formatters, `ReportTable`, toast helper in
`lib/utils/toast.ts`

**Intent**:
- `BalanceCell` settled tone (green at 0).
- `formatSignedPLN`.
- `ReportTable` headers as `{content, className}[]`.
- A sticky/updatable progress toast.

**Contract**: Specs:
- extend `balance-cell.test.tsx` with the settled tone;
- `formatSignedPLN` unit spec under `src/__tests__/lib/utils/`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/ui src/__tests__/lib/utils`

#### Manual Verification:

- `/design` shows every new piece in its section, in light and dark

---

## Phase 5: Swaps — buttons and links (census §2)

### Overview

Move every raw `<button>`, every Button+className size rebuild, every hand link and the duplicated
name-link class string onto the phase 3–4 primitives.

### Changes Required:

#### 1. Sites

**Files**: every line in census §2 A–C. The `ui/`-internal items there were done in phase 3.

**Intent**:
- Raw `<button>` → `Button` with the right size/variant. `stage-split-dialog.tsx:138` becomes a radio
  (`role="radio"` group) instead of `role=checkbox`.
- `size="sm"` + `h-7 px-2` → `xs`.
- `variant="link"` + `h-auto p-0` → `size="inline"`.
- Hand links → `OptionalLink` / `TextLink`.
- The 4× name-link class string goes into one constant or component in `nav/`.

**Contract**: After the swaps, `pnpm exec eslint . --prune-suppressions`.

### Success Criteria:

#### Automated Verification:

- Specs mirroring touched files pass: `pnpm exec vitest run <mirrored spec paths>`
- Suppressions for this family pruned; lint green on touched dirs

#### Manual Verification:

- Filter chips, the active-filters bar, the payouts-to-confirm actions (390px), and the
  investments/users table inline links look and act as before

---

## Phase 6: Swaps — dialogs, overlays, tooltips (census §3)

### Changes Required:

#### 1. Sites

**Files**: census §3 outside `ui/`, plus `nav/mobile-nav.tsx` → `Sheet`.

**Intent**:
- The five hand-built dialogs → `FormDialogShell`.
- Primary buttons move from the body into the footer: `expense-draft-dialog`, `scan-report-dialog`,
  `add-sheet-dialog`.
- 28 raw widths → `max-w-dialog*`:
  - `md` (448) → `dialog-sm` (420);
  - `lg` (512) → `dialog` (600);
  - `xl` / `2xl` / `3xl` / `4xl` / `7xl` and the `96vw` pair → the nearest `dialog-md…3xl` token.
- Native `title=` → `SimpleTooltip` / `HintTooltip`. Legit truncation reveals get a disable comment.

### Success Criteria:

#### Automated Verification:

- Mobile-nav spec (if one exists) and the specs mirroring touched dialogs pass
- Suppressions pruned

#### Manual Verification:

- Phone over LAN (390px): open the mobile nav, navigate, close with the backdrop. Esc closes it on
  desktop-narrow.
- Open a sample of re-widthed dialogs (cancel transfer, reject payout, scan report, reload from preset,
  settle payouts). Content fits with no horizontal scroll.
- The tooltip replacements show on hover and on keyboard focus

---

## Phase 7: Swaps — cards, headings, tables (census §4, §5, §10)

### Changes Required:

**Files**: census §4, §5, §10.

**Intent**:
- Card shells → `Panel`; bordered lists → `BORDERED_LIST_CLASS`.
- Headings → `SectionHeader size` / `SUBSECTION_TITLE_CLASS` / `EYEBROW_CLASS`.
- `catalogue-diff-table` → `ReportTable`.
- `lead-answers-dialog` → `InfoList divided`.
- Do not restructure the memoized values in `data-table.tsx`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run` on the data-table memoization spec and the specs mirroring touched files
- Suppressions pruned

#### Manual Verification:

- Kosz, firmowa wiedza, kosztorys versions drawer and the worker report review read with one heading
  scale

---

## Phase 8: Swaps — loading (census §6)

### Changes Required:

**Files**: census §6 A–D.

**Intent**:
- `Loader2` in buttons → `Button pending` (`RowActionButton pending`).
- Spinner + label and text-only „Wczytywanie…" → `InlineLoading`. Drop the stray Info icons.
- Centred boxes → `BlockLoading`.

### Success Criteria:

#### Automated Verification:

- Specs mirroring touched files pass; no `Loader2`/`LoaderCircle` import left outside `ui/` (lint)
- Suppressions pruned

#### Manual Verification:

- Download invoices and print transfers show the gradient spinner in the button while working

---

## Phase 9: Swaps — feedback and status colour (census §7)

### Changes Required:

**Files**: census §7.

**Intent**:
- ≈25 raw error lines → `Description tone="error" withIcon={false}`, or `FieldError` under a field.
- The three „form has errors" notices → one shared notice.
- Hints → `Description` / `FieldDescription`.
- Raw empty-state `<p>` → `EmptyState size="inline"`.
- Raw `AlertTriangle` → `AlertIcon`.
- `text-amber-600` / `text-chart-orange` warnings → the `warning` token.
- Raw green/red status → `chart-green` / `destructive`.
- The green-at-zero rule written 3× → `BalanceCell` settled.
- `use-file-archive` → the toast helper.

### Success Criteria:

#### Automated Verification:

- Specs mirroring touched files pass (the settle-payouts and review-lines specs included)
- Suppressions pruned

#### Manual Verification:

- Kosztorys sheet compare / report dialogs: warnings are amber, matches green, errors red, in light and
  dark
- Settle payouts: a settled row is green at 0

---

## Phase 10: Swaps — form fields (census §8)

### Changes Required:

**Files**: census §8 outside `ui/`.

**Intent**:
- Hand-assembled Select → `SimpleSelect`.
- Raw `<label>` + Checkbox → `CheckboxRow variant="plain"`.
- Raw `<label>`/flex-col wrappers → `Field` + `FieldLabel`.
- The re-implemented `DecimalField withSave` → the real one.
- Muted group headings → `FieldSet` + muted `FieldLegend`.
- `report-bar` / `filter-select` / `lead-assets-dialog` → `SearchFilterInput` / `SearchSelect` /
  `EntityComboboxField`.
- Pasted Input/Trigger class strings → `invalid` / `variant="field"`.
- `<Label>` used as plain text → text.

### Success Criteria:

#### Automated Verification:

- Specs mirroring touched forms pass (expense form, discount fields, settle-payouts form)
- Suppressions pruned

#### Manual Verification:

- Expense draft dialog: labels focus their selects
- Kosztorys settings discount fields save as before
- The worker report bar search works at 390px

---

## Phase 11: Swaps — disclosure and tabs (census §9)

### Overview

Starts only when the other agent's collapsible edits are committed (re-check `git status`).

### Changes Required:

**Files**:
- `history/history-banner.tsx` (`<details>` → `Collapsible`);
- `reorder-dialog.tsx:279` (`CollapsibleChevron variant="side"` + `aria-expanded`);
- the toolbar and totals-toggle chevrons → `CollapsibleChevron`;
- `totals-panel-overlay.tsx` (raw Radix → `ui/collapsible`, needs the no-animate option);
- `ui/env-badge-shell.tsx`;
- segmented controls → `ToggleGroup` (`ui-scale-switch`, `transfer-view-switch`,
  `worker-reports-list` with `aria-pressed`, `telmak-check-dialog`).

**Intent**: The remaining folds and switches use the shared primitives. Fix the stale comment in
`section-color-picker.tsx`.

### Success Criteria:

#### Automated Verification:

- Specs mirroring touched files pass; suppressions pruned

#### Manual Verification:

- Kosztorys editor: the totals panel opens without animation glitch
- The history banner folds
- The UI-scale and transfer-view switches keep the segmented look

---

## Phase 12: Close-out

### Changes Required:

#### 1. Baseline gone

**Files**: `eslint-suppressions.json` (delete), `census.md`

**Intent**: Prune to empty and delete the file. Mark each census line done or legit-with-reason.

#### 2. Docs and tracker

**Files**: AGENTS.md (if phase 1's bullet needs a correction), Linear EX-1110 / EX-1099

**Intent**: Close EX-1110. Comment on EX-1099 with the result.

### Success Criteria:

#### Automated Verification:

- `eslint-suppressions.json` absent and `pnpm lint` green

#### Manual Verification:

- None beyond the earlier phases

---

## Testing Strategy

### Unit Tests:

- The guard rule (`RuleTester`), seen red per check.
- `formatSignedPLN`, `BalanceCell` settled tone, `Button pending`, `Sheet` Esc/focus return.

### Integration Tests:

- None. No DB or server path changes.

### Manual Testing Steps:

Profile: `context/reference/manual-verification.md`, local DB. The phone check is over LAN only.

1. `/design`, light and dark: every section after phases 3–4.
2. 390px over LAN: mobile nav Sheet, payouts-to-confirm, worker report bar.
3. A walk through the Δ screens listed per phase.

## Performance Considerations

None beyond keeping the data-table/editor hand memos intact.

## Migration Notes

None. No schema or persisted keys change.

## Whole-tree Gate

Run once, after phase 12:

- `pnpm typecheck` (or `pnpm exec tsc --noEmit`)
- `pnpm lint`
- `pnpm build`
- The full `pnpm test` runs only on the user's explicit go (project rule).

## References

- Census: `context/changes/2026-10-20-ds-primitive-sweep/census.md`
- Why it was missed + guard design: `change.md`
- Design page decisions: `context/changes/2026-10-20-design-system/change.md`
- Local rule pattern: `eslint-rules/no-domain-drift.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Guard against new copies

#### Automated

- [x] 1.1 Rule spec passes — a4f667efd
- [x] 1.2 Rule spec seen red with one check disabled, then restored — a4f667efd
- [ ] 1.3 Lint passes on components/app/hooks with the baseline
- [x] 1.4 Scratch raw `<button className>` fails lint — a4f667efd

### Phase 2: Bugs (test-first)

#### Automated

- [x] 2.1 Each new spec seen red before its fix, green after — 4eaa16758
  - Adapted: the materials footer is unreachable as a bug (the table renders no toolbar, so no
    column can be hidden) — swapped onto `ColumnTotalRow` as a dedup, guarded by a netto-dataset
    footer spec instead of a hidden-column one.
  - Adapted: the Input ring was removed on purpose (`8ed806695`); only the non-utility
    `focus-visible:ring-none` class is dropped, no ring added. Its manual check is void.
  - Pulled forward from phase 3: `AuthSubmitButton` → `GradientSpinner`, `ContentLoading` gets
    `role="status"`, so the login spec could count indicators.

### Phase 3: Consolidate inside `ui/`

#### Automated

- [x] 3.1 Existing `ui/` specs pass
  - Adapted: phases 3 and 4 landed as one commit (four parallel agents split by `ui/` file set).
  - Deferred to the swap phases: `simple-select` `toolbarSm` (six callers outside ui/),
    `loader/spinner.tsx` deletion (three callers), `env-badge` tooltip (needs `env-badge-shell`).
- [x] 3.2 No reference left to a removed Button variant — tsc clean

### Phase 4: New `ui/` pieces

#### Automated

- [x] 4.1 ui + lib/utils specs pass
  - Adapted: the progress toast lives in `lib/utils/progress-toast.ts` — the dom setup mocks
    `toast.ts` as `{ toastMessage }` alone.

### Phase 5: Swaps — buttons and links

#### Automated

- [ ] 5.1 Specs mirroring touched files pass
- [ ] 5.2 Suppressions pruned; lint green on touched dirs

### Phase 6: Swaps — dialogs, overlays, tooltips

#### Automated

- [ ] 6.1 Specs mirroring touched dialogs pass
- [ ] 6.2 Suppressions pruned

### Phase 7: Swaps — cards, headings, tables

#### Automated

- [ ] 7.1 Data-table memoization spec + mirrored specs pass
- [ ] 7.2 Suppressions pruned

### Phase 8: Swaps — loading

#### Automated

- [ ] 8.1 Mirrored specs pass; no Loader2/LoaderCircle outside ui/
- [ ] 8.2 Suppressions pruned

### Phase 9: Swaps — feedback and status colour

#### Automated

- [ ] 9.1 Mirrored specs pass
- [ ] 9.2 Suppressions pruned

### Phase 10: Swaps — form fields

#### Automated

- [ ] 10.1 Mirrored form specs pass
- [ ] 10.2 Suppressions pruned

### Phase 11: Swaps — disclosure and tabs

#### Automated

- [ ] 11.1 Mirrored specs pass; suppressions pruned

### Phase 12: Close-out

#### Automated

- [ ] 12.1 `eslint-suppressions.json` absent and `pnpm lint` green
