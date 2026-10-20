---
date: 2026-10-20T10:39:11+02:00
researcher: Claude (Opus 5.5)
git_commit: ae2ab8208a119bd8e37a8bad7e338759b7d14a03
branch: staging
repository: wykonczymy
topic: "Design system — what exists today (tokens, fonts, ui primitives) and where a first in-app page fits"
tags: [research, codebase, design-system, tokens, typography, components-ui, warianty-badge]
status: complete
last_updated: 2026-10-20
last_updated_by: Claude (Opus 5.5)
---

# Research: Design system — current state and where the first page fits

**Date**: 2026-10-20T10:39:11+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: ae2ab8208
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Build an in-app design-system page (code as source of truth): fonts, colour palette and components. Start
small — a first page with the existing tokens and core primitives, iterate on the look — and only then run the
full-repo census of hand-rolled UI and the sweep.

**Scope of this document:** tokens, fonts, the `src/components/ui/` inventory, and page infrastructure. The
census of hand-rolled UI **outside** `ui/` (raw `<button>`, palette-colour usage counts, duplicated class
strings) is deliberately deferred to the sweep phase — not researched here.

## Summary

- **A precedent page already exists:** `/warianty-badge` (`src/app/(frontend)/warianty-badge/`), committed
  as *"the starting reference for the design system"* (`859d6aa99`). Server `page.tsx` gated by
  `requireManagementPage()`, client body rendering live variants in a `Row({title, source})` helper, not in
  nav, Polish labels. The new page should extend or absorb it rather than start a parallel pattern.
- **Fonts:** only Space Mono 400 (`latin` + `latin-ext`) is loaded, as `font-mono` (`src/fonts/index.ts`,
  `globals.css:37`). **`font-sans` is never set** — body text is Tailwind's default system stack, i.e. a
  different typeface per OS. Choosing a sans is the first real typography decision.
- **Colours:** stock shadcn neutral semantic tokens (light + `.dark`), plus a project palette of 9 chart hues
  with derived section soft/base/deep shades, transfer colours, two neon colours and `report-accent`.
  **No `success` / `warning` / `info` semantic tokens** — green/amber states have no named home.
- **Components:** 114 files in `ui/`. Only 3 use `cva` (`button`, `field`, `icons/icon-variants`). `Button`
  has **22 variants, 8 never referenced**, plus a near-duplicate pair. Accidental overlaps: 4 spinner looks,
  2 input looks, 2 dialog footers/titles, 4 independent heading scales in layout blocks, count-badge and
  badge-select bypassing `Badge`/`Select`. `icons/` registry is vestigial (0 external consumers vs 199 files
  importing `lucide-react` directly).
- **Dark mode is live** (`next-themes`, `ThemeToggle` in sidebar and mobile nav) — the page must show both
  themes.
- **No Storybook, no visual-regression tooling, no markup snapshots.** The in-app page is the only catalogue.

## Detailed Findings

### Tokens (`src/styles/globals.css`)

- `@theme` (`:36-142`):
  - Fonts: `--font-mono` only (`:37`).
  - Breakpoints overridden: `sm` 48rem, `md` 64rem, `lg` 80rem, `xl` 90rem, `2xl` 120rem (`:39-43`).
  - Radius: shadcn scale off `--radius: 0.625rem` (`:47-52`).
  - Extra font sizes: `--text-2xs` 0.625rem, `--text-3xs` 0.5625rem (`:54-55`).
  - Dialog widths `--container-dialog-*` (`:59-65`), registered in `cn.ts` so overrides merge.
  - Spacing: `below-top-nav`, `dialog-scroll`; shadow: `panel` (`:68-71`).
  - Semantic colours (shadcn neutral, oklch): background, foreground, card, popover, primary, secondary,
    muted, accent, destructive, border, input, ring (`:73-89`).
  - Chart hues: blue, orange, red, green, pink, turquoise, yellow, teal, purple (`:91-99`).
  - Section shades `--color-section-<hue>-soft|base|deep` via `color-mix` (`:101-127`).
  - Transfer: `transfer-red-dark`, `transfer-red-warm`, `transfer-fuchsia` (`:129-135`).
  - Neon: `neon-fuchsia`, `neon-cyan` (`:137-138`); `report-accent` #1db954 (`:45`).
- `@theme inline` (`:21-34`): `section-rail` / `section-pill` / `section-pill-ink` resolving per element.
- `.dark` (`:144-162`): remaps the semantic set only; palette tokens are theme-independent.
- Custom utilities: `typing-surface` (iOS 16px zoom floor, `:184`), `grid-cell-text`, `grid-band-text`,
  `vertical-text`, and effect utilities `gradient-border*`, `neon-glow-duo*`, `progress-glow`,
  `gradient-spinner` (`:239-315`).
- `src/styles/color-tokens.ts` (157 lines): `COLOR_TOKENS`, `COLOR_TOKEN_CLASSES`, `ColorTokenT` — the
  literal class lookup used by `DotBadge` (added `bfe768539`). Ready-made data for a swatch grid.
- `src/lib/utils/cn.ts:4-16`: `extendTailwindMerge` knows `max-w-dialog*` and font sizes `text-2xs`,
  `text-3xs`, `grid-cell-text`, `grid-band-text`. **Any new font-size token must be added here**
  (`lessons.md:255`).

### Fonts

- `src/fonts/index.ts`: `Space_Mono`, subsets `latin` + `latin-ext`, weight `400` only, variable
  `--font-space-mono`.
- No sans family loaded; no `@font-face` / CSS `@import` of fonts.

### `src/components/ui/` — core primitives for a first page

| Primitive | Variants / sizes | Ext. consumers |
|---|---|---|
| `button` (cva) | 22 variants, sizes xs/sm/default/lg/icon/iconLg, `align` | 118 |
| `badge` (`Badge`, `BadgeButton`) | hand-written tone map `BADGE_OUTLINE_TONES`, soft + outline | 19 |
| `input` / `textarea` / `label` / `checkbox` | checkbox default/ai | 19 / 5 / 8 / 13 |
| `select` / `simple-select` | SelectTrigger xs/sm/default; SimpleSelect default/soft/pill/toolbar/toolbarSm | 16 / 16 |
| `search-select` / `combobox` | — (cmdk / free text) | 6 / 3 |
| `dialog` / `confirm-dialog` / `form-dialog-shell` / `dialog-actions` | confirm alert/neutral | 41 / 33 / 10 / 13 |
| `dropdown-menu` | — | 36 |
| `tooltip` / `info-tooltip` | — | 9 / 6 |
| `description` | sizes sm/xs/2xs, tones muted/error | 35 |
| `collapsible-section` | lg/sm/compact | 17 |
| `page-wrapper` / `section-header` / `settings-card` / `empty-state` / `warning-banner` | — | 18 / 2 / 1 / 5 / 1 |
| `toggle-group` | — | 12 |
| `loader/page-loading`, `gradient-spinner`, `loader/spinner` | — | 26 / 6 / 3 |

**Button usage** (195 `<Button>` outside tests): outline 99, default 34, ghost 24, link 10, ai 7,
destructive 7, colour outlines 6, expressions 8. Sizes: sm 108, default 41, xs 26, icon 11, lg 3, iconLg 1.
**Never referenced:** `defaultOutline`, `destructiveOutline`, `tealOutline`, `green`, `red`, `blue`, `teal`,
`turquoise`. `destructiveOutline` (`button.tsx:23`) and `outlineDestructive` (`:20`) do the same job in two
looks.

### Accidental overlaps inside `ui/` (consolidation candidates the page will expose)

- **Spinners — 4 looks:** `GradientSpinner` (size-4), `loader/spinner` (w-10 black/white ring,
  `spinner.tsx:12`), `ContentLoading` emoji bounce, inline lucide `Loader2`/`LoaderCircle` (15 files).
- **Inputs — 2 looks:** `input.tsx:12` `h-9 rounded-md border-input shadow-sm` vs `decimal-input.tsx:14`
  `h-6 w-20 rounded border-border text-xs`, no focus ring. `Input` has no size variant.
- **Dialogs:** title `leading-none wrap-anywhere` (`dialog.tsx:127`) vs `text-lg font-semibold`
  (`alert-dialog.tsx:60`); `confirm-dialog.tsx:51` builds its own footer instead of `DialogActions`.
- **Heading scales, one per block:** `page-wrapper` h1 `text-2xl` (`:16`), `empty-state` h2 `text-lg`
  (`:14`), `section-header` `SECTION_TITLE_CLASS` `text-lg` (`:5`), `settings-card` `text-sm` (`:15`).
  No shared type scale.
- **Badges:** `count-badge.tsx:9` re-implements a `rounded-full bg-primary h-5` pill instead of a Badge
  tone (Badge is `rounded-md px-1.5 py-0.5`, `badge.tsx:37`); `badge-select.tsx:45` strips trigger chrome by
  hand instead of a SimpleSelect variant.
- **Stat tiles — 2 builds:** `stat-button.tsx:18-25` (disabled outline Button + inline `style` colour) vs
  `toggle-stat-buttons.tsx:89` (`border-2` + borderClassName).
- **Text buttons:** `history-back-button.tsx:14` hand-rolls what is `variant=link size=xs`;
  `external-link.tsx:16` copies Button's default variant by hand.
- **Triggers:** `search-select.tsx:67` copies the SelectTrigger class string (`select.tsx:35`); two chevron
  sources (lucide in `select.tsx:42`, custom `Icon dropdownDown` in `search-select.tsx:73`).
- **Radius drift:** `settings-card` `rounded-md` (`:12`) vs `warning-banner` `rounded border-2` (`:16`).
- **Icons:** `ui/icons/` registry (cva sizes xxs–lg) has 0 external consumers; 199 files import
  `lucide-react` directly (`globals.css:12-16` sets lucide's default 1rem).

### Domain leaks in `ui/` (break AGENTS.md "ui/ is domain-agnostic")

`balance-cell`, `signed-money-display`, `toggle-stat-buttons` (PLN/balance), `decision-progress-badge`,
`label-hint-icon` (5 hard-coded settlement messages, `:4-34`), `env-badge` (imports `serverEnv`). Not first-page
work; note for the sweep.

### Page infrastructure

- **Precedent `/warianty-badge`:** `page.tsx:5` `requireManagementPage()`
  (`src/lib/auth/require-management-page.ts:12-16`); `badge-variants.tsx` (189 lines, client) with
  `Row({title, source})` (`:33-44`), section A = `Badge` family looped over real exports
  (`Object.keys(BADGE_OUTLINE_TONES)`, `COLOR_TOKENS`), section B = feature badges outside `Badge`
  (`:137`). No `loading.tsx`, no `PAGE_TITLES` entry, not in `NAV_LINKS`; `useTranslation('transfers')` only
  because two feature badges need a translator. Listed in `roles-inventory.md:321` and the desktop-regression
  audit plan as a dev showcase.
- **Layout:** `(frontend)/layout.tsx` mounts `ThemeProvider` (next-themes, class attribute, default light,
  no system), toasts, `AppLanguageProvider` → `CurrentUserProvider` inside `AuthenticatedShell`. Session
  required; roles per page.
- **Hidden from nav** = absent from `NAV_LINKS` (`src/lib/constants/sections.ts:47-75`).
- **No environment-gated route exists**; `VERCEL_ENV` is server-only (`src/lib/env/schema.ts:86`). A
  prod-hidden page would be a new pattern — not needed; management-only matches the precedent.
- **i18n:** internal pages stay Polish-only (`accounts-and-access.md:38-41`); shared components inside take a
  translator where their props require it.
- **ESLint:** `ui/**` may import only `ui/`, `lib/utils|i18n|table|env` (`eslint.config.mjs:120-137`);
  `@/styles/*` and `@/hooks` aren't blocked (`dot-badge` imports `@/styles/color-tokens`). No lint rule
  against raw palette colours or arbitrary values.

### Tests that constrain renames

- Class assertions in ~10 specs, almost all on `text-destructive` / `text-muted-foreground` / `text-sm`
  (e.g. `ui/balance-cell.test.tsx:11,17`, `fleet/deadline-cell.test.tsx:49,53`); E2E relies on
  `.text-destructive` (`e2e/deposit-settlement-plane.spec.ts:66`, `e2e/drivers/expenses.ts:79`). Renaming the
  destructive token breaks them.
- 8 specs under `src/__tests__/components/ui/`; no markup snapshots; Playwright `screenshots: false`.

## Code References

- `src/app/(frontend)/warianty-badge/page.tsx:4-6` — gated precedent page
- `src/app/(frontend)/warianty-badge/badge-variants.tsx:33-44` — `Row` showcase helper
- `src/styles/globals.css:36-142` — `@theme` tokens; `:144-162` — `.dark`
- `src/styles/color-tokens.ts` — literal colour-token class lookup
- `src/fonts/index.ts` — Space Mono, the only loaded font
- `src/lib/utils/cn.ts:4-16` — tailwind-merge custom groups
- `src/components/ui/button.tsx:12-49` — 22 variants, 6 sizes
- `src/components/ui/badge.tsx:37` — Badge base shape
- `src/lib/auth/require-management-page.ts:12-16` — management gate
- `src/lib/constants/sections.ts:22-36,47-75` — `PAGE_TITLES`, `NAV_LINKS`

## Architecture Insights

- The token layer is half-semantic: neutrals are named by role (`muted`, `destructive`), status colours are
  not — so any green/amber state is picked from the raw palette or a chart hue at the call site. A role-named
  status set (`success`, `warning`, `info`) is the missing middle layer between the chart palette and
  components.
- `cva` is the variant mechanism only for `Button`/`Field`; other primitives use hand-written maps. Variant
  explosion in `Button` (colour × fill) came from encoding hue instead of intent.
- The page renders real exports looped over their own variant maps (precedent `Row` pattern) — so it can't
  drift from the code: add a variant, it shows up. That's the property that makes it "something to relate to".

## Historical Context (from prior changes)

- `859d6aa99` / `bfe768539` (2026-10-19) — badge showcase page; transfer and section colours moved into
  `@theme`; `COLOR_TOKENS`.
- `a8091ee0e`, `1ec28bd62`, `c92e9dd4c`, `9e55b7f1e`, `233f75ebe`, `28186af47` (2026-10-19) — Badge tones +
  outline appearance, DotBadge palette, BadgeButton, Button filled/`*Outline` colour variants, unused theme
  tokens removed. The badge family is the one area already consolidated.
- `context/foundation/roadmap.md:249-274` (O-02 RWD) — z-index scale as `@theme` tokens; "prefer fixing
  shared primitives over sprinkling breakpoints" (`:272`).
- `context/archive/2026-10-05-column-colors/`, `context/archive/2026-07-26-kosztorys-section-header-rows/` —
  section palette reuse and hue ordering.
- No design-system slice in `roadmap.md` or `prd.md`.

## Related Research

None — first research on this topic.

## Open Questions

1. **Absorb `/warianty-badge`** into the new page (one route, badges as a section) or keep it as a sub-page?
   Absorbing means updating `roles-inventory.md:321` and the desktop-regression audit plan row.
2. **Route name** — Polish like the precedent (e.g. `/design-system` vs a Polish slug)?
3. **Sans typeface** — keep the OS system stack or load one (with `latin-ext`)?
4. **First-page scope** — proposed: colours (semantic + palette, both themes), type scale, radius, Button
   (all variants × sizes), Badge, Input/Textarea/Select/Checkbox, Dialog/ConfirmDialog, spinners. Everything
   else in later iterations.
5. **Unused Button variants** — delete during the first iteration (the page makes the dead ones visible) or
   leave for the sweep?
6. Deferred to the sweep: full census of hand-rolled UI outside `ui/`, raw palette-colour counts, domain
   leaks out of `ui/`, `icons/` removal, and an ESLint guard against raw palette colours.
