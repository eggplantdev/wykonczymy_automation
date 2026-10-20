# In-app Design System Page Implementation Plan

## Overview

One management-only page, `/design-system`, that renders every token and every primitive in
`src/components/ui/` side by side, looped over each component's own variants. It gives the owner one place
to spot visual drift and gives agents something concrete to reuse. It absorbs `/warianty-badge`.

## Current State Analysis

- `/warianty-badge` (`src/app/(frontend)/warianty-badge/`) is the only showcase. It has a server `page.tsx`
  gated by `requireManagementPage()` and a client body. A local `Row({title, source})` helper renders real
  badges looped over `BADGE_OUTLINE_TONES`, `COLOR_TOKENS` and the domain status constants.
- `ui/` holds about 80 top-level modules plus the `loader/`, `pagination/`, `row-actions/`, `icons/` and
  `datasheet-grid/` subfolders. Only `Button` and `Field` use `cva`. Most other variant maps are private:
  `SimpleSelect`'s `VARIANT`, `Description`'s `SIZE`/`TONE`, and `ConfirmDialog`'s `variant` union.
- The tokens are in `@theme` in `src/styles/globals.css:36-142`, with dark remaps at `:144-162`.
  `COLOR_TOKEN_CLASSES` (`src/styles/color-tokens.ts`) is a literal class lookup for the palette. It does
  not cover the shadcn semantic set.
- Dark mode is class-based: `@custom-variant dark (&:where(.dark, .dark *))` at `globals.css:6`, and
  `ThemeToggle` sits in the sidebar.

## Desired End State

A management account opens `/design-system` and sees, on one long page with a sticky table of contents:
colours (both themes), typography, radius and shadow, badges, buttons, form fields, overlays, dialogs,
feedback and loading, layout blocks, navigation, and data display. Every primitive in `ui/` appears,
except an explicit exclusion list. Adding or removing a variant on a primitive with a typed variant prop
fails `tsc` until the page is updated. An EMPLOYEE is redirected. `/warianty-badge` returns 404.

### Key Discoveries:

- `src/app/(frontend)/warianty-badge/badge-variants.tsx:33-44` — the `Row` helper to promote into a shared
  `ShowcaseRow`.
- `src/lib/auth/require-management-page.ts:12-16` — the gate.
- `src/components/ui/button.tsx:106` exports `buttonVariants`. Its variant and size keys come from
  `VariantProps<typeof buttonVariants>` without touching the file.
- `src/components/ui/collapsible-section.tsx:35` exports `OPEN_STATES`. `checkbox.tsx:15` exports
  `CheckboxVariantT`. `badge.tsx:16-18` exports `BadgeToneT` and `BADGE_OUTLINE_TONES`.
- `context/reference/roles-inventory.md:321` is the only live doc row that names `/warianty-badge`.
  References under `context/changes/2026-10-19-desktop-regression-audit/` are historical. Leave them.

## What We're NOT Doing

- `ui/datasheet-grid/` cells. They come in iteration 2.
- `env-badge` / `env-badge-shell`, which already render on every non-prod page.
- Editing any primitive so the page can show it. No exports added, no props added, no restyling.
- Imitation frames or showcase-only copies of a primitive's chrome.
- Consolidating duplicates: deleting dead Button variants, merging spinners, adding success/warning
  tokens, picking a sans font. The page exists to expose these. Fixing them is the next change.
- The agent catalogue (`ui/CATALOG.md`), the ESLint guard against hand-rolled primitives, and the
  repo-wide census of hand-rolled UI outside `ui/`.
- Nav entry, `PAGE_TITLES` entry, own `loading.tsx` (the precedent had none, so the page inherits
  `(frontend)/loading.tsx`), i18n (internal page, Polish only), and phone layout.
- Tests (see Testing Strategy).

## Implementation Approach

The route folder holds a thin server `page.tsx`, a client body, a shared row and a table of contents, and
one file per section under `sections/`. The section list is one `as const` array of `{ id, label }`. The
TOC and the section headings both read from it, so anchors never drift. Each section renders real imports
looped over the component's own variant source.

**Drift-proofing without touching primitives.** Where a primitive has a typed variant, size or tone prop,
the section declares its showcase list as an exhaustiveness record derived from the component's own
props. The record has one key per variant, so `tsc` fails when a variant is added or removed:

```ts
type ButtonVariantT = NonNullable<VariantProps<typeof buttonVariants>['variant']>
const BUTTON_VARIANTS = Object.keys({
  default: true, defaultOutline: true, /* … every key … */
} satisfies Record<ButtonVariantT, true>) as ButtonVariantT[]
```

`ComponentProps<typeof SimpleSelect>['variant']` reaches a private union the same way. An exported
array, such as `OPEN_STATES` or `Object.keys(BADGE_OUTLINE_TONES)`, is used directly.

**Overlays.** Dialogs open from a trigger button. Tooltip, Popover and DropdownMenu (`modal={false}`)
render held open through their controlled `open` prop. Select locks scroll while open, and a held-open
overlay that misbehaves when the page scrolls falls back to a trigger. That's an implementation-time call
per overlay, not a design question.

## Critical Implementation Details

- **Held-open overlays portal to `body`.** They are positioned fixed against their trigger, so several
  held open at once can stack over each other and over the sticky TOC. Give each its own vertical slot,
  and fall back to a trigger rather than adding showcase-only z-index or positioning.
- **Dark mode.** Most of the page is checked through the existing `ThemeToggle`. The colours section also
  renders each swatch grid a second time inside a `<div className="dark">` wrapper. The `.dark` remap and
  the `dark` variant both match descendants, so both themes show side by side without toggling. This does
  not work for portalled content, which is why only the colours section uses it.
- **Tailwind scanning.** The semantic-colour, font-size and radius swatches need literal class arrays,
  such as `['bg-background', 'bg-card', …]`. Classes built from template strings are not generated.

## Phase 1: Skeleton, foundations and badges

### Overview

The route, gate, layout, TOC and shared row are created. The foundations sections and the badges section
are filled in. `/warianty-badge` is removed in the same phase, so there is never a second showcase.

### Changes Required:

#### 1. Route and shell

**File**: `src/app/(frontend)/design-system/page.tsx`, `design-system.tsx`, `showcase-sections.ts`,
`showcase-row.tsx`, `showcase-toc.tsx`

**Intent**: The server page calls `requireManagementPage()` and renders the client body. The body lays out
a sticky TOC beside the stacked sections.

**Contract**:
- `SHOWCASE_SECTIONS` is an `as const` array of `{ id, label }` with Polish labels. Its ids are colors,
  typography, radius-shadow, badges, buttons, fields, overlays, dialogs, feedback, layout, navigation and
  data-display.
- `ShowcaseRow({ title, source, children })` is promoted from `Row`. `source` is the repo path shown under
  the title.
- A section wrapper renders `<section id>` plus its heading from `SHOWCASE_SECTIONS`.
- The route stays out of `NAV_LINKS` and `PAGE_TITLES`.

#### 2. Foundations sections

**File**: `src/app/(frontend)/design-system/sections/colors-section.tsx`, `typography-section.tsx`,
`radius-shadow-section.tsx`

**Intent**: Every `@theme` token renders as a labelled sample.

**Contract**:
- **Colours.**
  - The shadcn semantic set is shown as foreground-on-background pairs from a literal class array.
  - The palette comes from `COLOR_TOKENS` / `COLOR_TOKEN_CLASSES[token].dot`.
  - The chart hues, the section soft/base/deep shades, the transfer, neon and `report-accent` colours
    each get a labelled group.
  - The whole section is rendered once in light and once inside a `.dark` wrapper.
- **Typography.**
  - Font families: `font-mono`, and the system stack the body uses today, labelled as such.
  - Font sizes from `text-3xs` to `text-3xl` in a literal array.
  - Weights.
  - One Polish sample line with diacritics (`Zażółć gęślą jaźń 1 234,56 zł`).
- **Radius and shadow.** The radius scale off `--radius`, plus `shadow-panel` and the stock shadows used
  in `ui/`.

#### 3. Badges section and removal of `/warianty-badge`

**File**: `src/app/(frontend)/design-system/sections/badges-section.tsx`; delete
`src/app/(frontend)/warianty-badge/`; `context/reference/roles-inventory.md:321`

**Intent**: Move the badge showcase content unchanged into the section, using `ShowcaseRow`. Then delete
the old route and repoint the inventory row to `/design-system`.

**Contract**:
- The section keeps both groups from the old page: "Badge family" and "outside Badge".
- `useTranslation('transfers')` stays where the feature badges need a translator.
- Add `count-badge`, `badge-select` and `dot-badge` if they are not already covered.

### Success Criteria:

#### Automated Verification:

- No live reference to the old route remains:
  `grep -rn "warianty-badge" src context/reference context/foundation AGENTS.md` returns nothing.

#### Manual Verification:

- A management account opens `/design-system`. TOC links jump to each section, and the TOC stays visible
  while scrolling.
- An EMPLOYEE account opening `/design-system` is redirected.
- The colours section shows the light and dark swatch grids side by side, with no swatch blank in either.
- `/warianty-badge` returns 404.

**Implementation Note**: When this phase's automated verification passes, commit and continue. Do not
pause for per-phase manual confirmation.

---

## Phase 2: Components

### Overview

The remaining sections cover every primitive in `ui/` outside the exclusion list, each looped over its
own variants. Typed variants use the exhaustiveness record.

### Changes Required:

#### 1. Buttons

**File**: `src/app/(frontend)/design-system/sections/buttons-section.tsx`

**Intent**: Show the full matrix so that unused and duplicate variants are visible next to the rest.

**Contract**:
- A variant × size grid, both from `VariantProps<typeof buttonVariants>` exhaustiveness records.
- One row each for `align`, `disabled`, and icon-plus-label.
- Button-shaped `ui/` modules each get a row: `remove-button`, `upload-button`,
  `save-as-default-button`, `submit-pill`, `toolbar-toggle`, `stat-button`, `toggle-stat-buttons`,
  `history-back-button`, `external-link`, `auth-submit-button` and `row-actions/*`.

#### 2. Form fields

**File**: `sections/fields-section.tsx`

**Intent**: Every input primitive in its normal, disabled and error (`aria-invalid`) states.

**Contract**:
- Components covered:
  - `Input`, `Textarea`, `DecimalInput`, `DecimalField`, `Label`, `Field` (orientation values).
  - `Checkbox` (`CheckboxVariantT` × checked, unchecked and indeterminate), `CheckboxRow`.
  - `Select` (`SelectTrigger` sizes), `SimpleSelect` (variants through `ComponentProps`).
  - `SearchSelect`, `Combobox`, `InlineModeSelect`, `LanguageSelect`.
  - `FileInput`, `ReasonField`, `Calendar`, `ToggleGroup`.
- Local `useState` drives the controlled ones. No TanStack Form needed.

#### 3. Overlays and dialogs

**File**: `sections/overlays-section.tsx`, `sections/dialogs-section.tsx`

**Intent**: The real overlay components, held open or opened from a trigger.

**Contract**:
- **Held open, falling back to a trigger:** `Tooltip`, `InfoTooltip`, `Popover`, `DropdownMenu`
  (including `menu-item-body` and `dropdown-check-groups`), and `column-toggle-menu`.
- **Opened from a trigger:** `Dialog` with `FormDialogShell` and `DialogActions`, `ConfirmDialog`
  (`alert` and `neutral`), `AlertDialog`, `column-order-dialog`, and `command`.

#### 4. Feedback and loading

**File**: `sections/feedback-section.tsx`

**Intent**: Put all four spinner looks side by side, along with the empty and warning states.

**Contract**:
- Loading: `GradientSpinner`, `Spinner` (its variants), `PageLoading`, `ContentLoading`,
  `TitledPageLoading`, `DetailPageLoading`.
- `Loader` with `portal={false}` inside a bounded box. `FixedClientLoader` from a trigger.
- States: `EmptyState`, `WarningBanner`, `Description` (sizes × tones through `ComponentProps`),
  `AlertIcon`, `LabelHintIcon`.

#### 5. Layout, navigation, data display

**File**: `sections/layout-section.tsx`, `sections/navigation-section.tsx`,
`sections/data-display-section.tsx`

**Intent**: Show the blocks whose heading scales and radii disagree, next to each other.

**Contract**:
- **Layout blocks:**
  - `PageWrapper`, `SectionHeader`, `SettingsCard`.
  - `CollapsibleSection` (sizes × `OPEN_STATES`).
  - `Separator`, `ControlGrid`, `SummaryGrid`, `InfoList`, `EdgeHandlePill`.
  - `AuthPageLayout` and `AuthSuccessCard` in a bounded box.
- **Navigation:**
  - `pagination/*`, rendered as `ClientPagination` with local state.
  - `AuthLink`, `ContactLink`, `OptionalLink`, `BrandLogo`, `LanguageLabel`.
- **Data display:** `BalanceCell`, `SignedMoneyDisplay`, `DecisionProgressBadge`, `Chart`, `SlicePie`
  and `PieLegend`, with sample data.
- **Icons:** the `icons/` registry (`Icon` sizes from `icon-variants.ts`).

### Success Criteria:

#### Automated Verification:

- Every `ui/` module outside the exclusion list is imported by the page. The command below prints
  nothing:
  ```bash
  for f in $(cd src/components/ui && find . -name '*.tsx' -not -path './datasheet-grid/*' | sed 's|^\./||; s|\.tsx$||'); do
    case "$f" in env-badge|env-badge-shell) continue;; esac
    grep -rqF "components/ui/$f'" 'src/app/(frontend)/design-system' || echo "missing: $f"
  done
  ```
  Non-component helpers such as `combobox-commit.ts`, `get-windowed-pages.ts` and `row-action-labels.ts`
  are `.ts` files and are skipped by the `*.tsx` filter.

#### Manual Verification:

- Every section renders in light and dark (via `ThemeToggle`) with no console errors.
- Each held-open overlay stays anchored to its trigger while the page scrolls, or was switched to a
  trigger.
- Each dialog opens from its trigger and closes on Escape and on its own close control.
- Button grid: the eight never-used variants and the `destructiveOutline` / `outlineDestructive` pair are
  visible in the grid.

**Implementation Note**: When this phase's automated verification passes, commit and continue. Do not
pause for per-phase manual confirmation.

---

## Testing Strategy

### Unit Tests:

- None. The change is a showcase spike. The page renders real primitives, so a broken primitive breaks the
  page visibly. The exhaustiveness records make `tsc` the drift guard.

### Integration Tests:

- None.

### Manual Testing Steps:

1. Log in locally as a management account, open `/design-system`, and walk the TOC top to bottom.
2. Toggle dark mode and walk it again.
3. Log in as an EMPLOYEE and open `/design-system`. Expect a redirect.
4. Open `/warianty-badge`. Expect a 404.

## Performance Considerations

None that matter. The page is a management-only dev page. `Chart` and `Calendar` are the heaviest
imports and load only on this route.

## Migration Notes

None. No schema or data changes.

## Whole-tree Gate

Run **once**, after the final phase.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

## References

- Research: `context/changes/2026-10-20-design-system/research.md`
- Precedent: `src/app/(frontend)/warianty-badge/badge-variants.tsx:33-44`
- Gate: `src/lib/auth/require-management-page.ts:12-16`
- Tokens: `src/styles/globals.css:36-162`, `src/styles/color-tokens.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Skeleton, foundations and badges

#### Automated

- [x] 1.1 No live reference to `/warianty-badge` remains — f66e2fc6e

### Phase 2: Components

#### Automated

- [x] 2.1 Every non-excluded `ui/` module is imported by the page — 105ac298b
