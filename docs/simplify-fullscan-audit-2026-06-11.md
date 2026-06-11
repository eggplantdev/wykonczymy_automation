# Full-scan report — wykonczymy

**Mode:** apply safe fixes + report · **Worktree:** `.worktrees/simplify-fullscan` (branch `simplify-fullscan-wt`, off `staging`)
**Lenses:** quality/simplify · structure & cohesion · dead-code & deps · Tailwind v4
**Tally:** 1 applied · ~40 proposed · 12 dismissed

> **Verification caveat:** `pnpm install` was declined, so this worktree has no `node_modules`. I could **not** run `lint` / `typecheck` / `test`. The one applied change is a one-line debug-log removal — safe to compile, but the suite was not run.

> **Headline:** across all four lenses, exactly **one** finding was safe to auto-apply. Not because the code is clean — because its debt is _judgment-heavy_, not mechanical. Every dedup target differs per call-site (slug/shape/signature), every structural move breaks imports, and every Tailwind swap needs a `@theme` token added first. The value here is the map, not the auto-fix.

---

## Applied

- `src/app/global-error.tsx:10` — removed stray debug log `console.log('global-error.tsx:10 -', error)` (literal file:line prefix = leftover scaffolding, not telemetry; not part of the `[PERF]` convention). Dropped the now-unused `error` from the destructure; kept it in the props type (Next.js `GlobalError` contract). _Note: this leaves the global error boundary with no logging — see Proposed if you want real telemetry wired in._

---

## Proposed (not applied)

### Duplication & reuse (quality lens)

- `src/components/forms/{deposit,internal-transfer,expense,investment,worker}-form/*.tsx` — all 5 transfer forms repeat the same scaffold (store-selector triplet, identical `useAppForm` listeners + `defaultValues ?? {}`, `onSubmit→CreateTransferFormT` mapping, `FormClearButton`/`<form>`/`FieldGroup`/`FormFooter` shell). Extract a shared form-shell hook/component. **(HIGH — biggest single win)**
- `src/collections/transfers.ts:31-49` — `showSourceRegister`/`showInvestment`/`showTargetRegister`/`needsOtherCategory`/`showExpenseCategory` re-implement predicates already in `src/lib/constants/transfers.ts`. Import + thin `(data?.type)` wrapper. **Live drift risk: same business rule defined twice.** (HIGH)
- `src/lib/actions/toggle-active.ts:10-70` — `toggleUserActive`/`toggleCashRegisterActive`/`toggleInvestmentStatus` near-identical; collapse to one parameterized helper (investments uses `status` not `active`, omits `overrideAccess`). (HIGH)
- `src/lib/actions/transfers.ts:318-356` — `updateTransferInvoiceAction` & `removeTransferInvoiceAction` share findByID + media-id extraction + invoice-update; extract helper. (HIGH)
- `src/lib/export/invoice-zip.ts:23-29` — `sanitizeForFilename` duplicates `sanitize-filename.ts` with **diverging** rules (`/\:*?"<>|` vs non-alphanumeric). Consolidate before they drift further. (HIGH)
- `src/lib/tables/transfers.tsx:88-152` — `mapTransferRow` branches on `depth:0` vs `depth:1` at runtime; two typed functions kill the `(doc: any)`. (MED)

### `any` / convention drift (quality lens)

- `src/lib/queries/reference-data.ts:86-129` — five raw-SQL mappers each `(row: any)`; share one typed row-mapper. (MED)
- `src/lib/actions/transfers.ts:166-200` (+ type alias L168/172) — `fetchAndAuthorize` types `payload`/`original` as `any`, erasing the doc type through the whole auth path. (MED)
- `src/lib/db/sum-transfers.ts:11` — `getDb(): Promise<any>` leaks untyped; return `unknown` or a narrow Drizzle type. (MED)
- `src/lib/auth/require-auth.ts:9` — `AuthResultT.user: null` on failure; convention is `undefined`. (MED)
- `src/lib/validation-utils.ts:7-12` — `getAmountError` returns `string | null`; convention is `undefined`. (MED)
- `src/components/forms/form-fields/*.tsx` (~10 files) — `form: any` (with eslint-disable) repeated; render callback is already typed (`AppFieldComponentsT`), so a shared `FormApi`-typed prop alias removes the `any` everywhere. (LOW)
- `src/components/ui/data-table/{table-header,virtualized-table-body}.tsx:8,17` — `headerGroups: any[]` / `header: any`; TanStack exposes `HeaderGroup<T>`/`Header<T>`. (LOW)
- `src/lib/queries/transfers.ts:94` — `(r: any) => Number(r.id)`; type the row. (LOW)
- `src/lib/db/sum-transfers.ts:184` — `categoryMap.get(invId)!.push(...)` non-null assertion outside tests; guard instead. (LOW)

### Structure — scatter (cross-file)

- **Zod schema dual homes** — `src/lib/schemas/{worker,investment,transfer}.ts` vs colocated `forms/*/​*-schema.ts`; actions import from `lib/schemas`, dialogs/stores from the colocated copy, no rule predicts which. Worse: `worker.ts` (`defaultCashRegister:number`) and `worker-form/worker-schema.ts` (`:string`) **actually diverge** (same for investment) — a latent bug. Pick one home + an explicit string→number transform. **(HIGH)**
- `src/lib/constants/transfers.ts:2` vs `src/collections/transfers.ts:7` — transfer-type union defined twice; derive the Payload options from the const array. (MED)
- `src/lib/` root is a **22-file junk drawer** mixing generic formatters with **domain finance** (`calculate-balance`, `calculate-margin`, `map-category-costs` → belong in `lib/db`) and URL/filter builders. (MED)
- `src/lib/utils/default-cash-register.ts` (lone-file dir) vs flat `*-utils.ts` vs `lib/cn.ts` — three competing "utils" conventions; pick one. (MED)
- `src/lib/validation-utils.ts` — Zod refinement helpers live away from the schemas that use them → move under `lib/schemas/`. (LOW)
- `src/lib/tables/*.tsx` (5 files) — React column-definition components (return JSX) sit in non-UI `lib/`; move to `components/`. (LOW)
- `src/lib/downloadFile.ts` + `src/lib/isValidUrl.ts` — camelCase filenames violate kebab-case convention → `download-file.ts` / `is-valid-url.ts`. _(downloadFile.ts is also orphaned — see dead-code; resolve together.)_ (LOW)
- `src/components/forms/types/form-types.ts` vs `src/types/` — declare the rule: `src/types/` = cross-feature only, feature types colocate. (MED, doc-only)

### Structure — cohesion (god-files)

- `src/lib/db/sum-transfers.ts` (409 LOC, 14 exports) — mixes `getDb()` + 6 SQL aggregations + 5 result types + 2 derive helpers. Split queries / derive / types. (HIGH)
- `src/lib/google/sheets.ts` (734 LOC — largest file) — row type + formatting helper + summary builder + 5 async Sheets I/O fns. Split by concern. (HIGH)
- `src/lib/schemas/transfer.ts` — 3 schemas + 3 types + 2 validators + magic-number constants in one file. (MED)
- `src/lib/actions/utils.ts` — catch-all: `protectedAction()` framework + `getErrorMessage` + validators + 2 result types. Give `protectedAction` its own file; types → `src/types/`. (MED)
- `src/lib/queries/transfers.ts` — exports a type + 2 where-clause builders (`buildTransferFilters`, `stripCancelledFilters`) that are filter logic, not fetching. (MED)
- `src/lib/constants/transfers.ts` — "constants" file holds ~18 behavioral predicates (`needsSourceRegister`, `isLaborCost`…) = domain logic; split into a transfer-rules module. (LOW)

### Dead code & deps

> Verify the Tailwind-v4 migration is fully complete before pulling any v3/PostCSS plugin — bundlers can't see CSS-only usage.

- **Unused deps** (zero `import` in `src`): `next-themes`, `swiper`, `usehooks-ts`, `isomorphic-dompurify`, `recharts` (+ the dead `ui/chart.tsx` + commented-out `report-charts.tsx` cluster — remove together), `tailwindcss-animate`, `tw-animate-css`, `eslint-config-next` (flat config imports the plugin directly), `eslint-config-prettier`, `@tailwindcss/forms`, `@tailwindcss/typography`, `autoprefixer`. (MED/LOW)
- **Orphaned files** (no importer, framework-safe): `src/components/reports/report-charts.tsx` (fully commented out), `src/components/ui/chart.tsx`, `src/seed.ts` (verify not in a Payload `onInit`), `src/components/ImageMedia.tsx`, `src/components/ui/{card-box,rainbow-button,input-group,section-header,skeleton,tag,confirm-close-dialog}.tsx`, `src/components/ui/icons/{calendar-add,calendar-approved,calendar-processing,dot}-icon.tsx`, `src/lib/downloadFile.ts`, `src/lib/tables/column-meta.ts`, `src/types/users.ts`, `src/components/forms/form-components/index.ts` (dead barrel). Confirm `print-button` ambiguity (`ui/print-button.tsx` orphan vs `transfers/print-button.tsx` live). (LOW)
- **Unused exports:** `lib/perf.ts perf()`, `constants/transfers.ts {COST_TYPES,INVESTMENT_TYPES}`, `constants/sheets.ts SHEET_STATUSES`, `sum-transfers.ts isNoResultsSentinel`, `tables/cash-registers.tsx REGISTER_TYPE_LABELS_PLURAL`, plus ~10 exported types with no importer. (LOW)

### Tailwind / UI

> Setup is correct, modern v4 (`4.1.18`, `@import 'tailwindcss'` + full `@theme`). **Zero** `var()`-in-`[...]` smells. App surface is clean; debt is contained to the marketing pages.

- `src/components/wykonczymy/{hero,about,contact,projects,nav}.tsx` — same ~5 hardcoded hex (`#1c1917`/`#78716c`/`#e7e0d8`/`#fdfbf7`) + `text-[0.625rem]` (×5) + `tracking-[0.2em]` repeat across the marketing site, none in `@theme`. Add the palette (`--color-ink/stone/sand/cream`, `--text-2xs`, an ease + shadow token) to `globals.css`, _then_ the swaps become mechanical. (LOW, systemic-but-contained)
- `src/components/wykonczymy/nav.tsx:34-48` — mobile hamburger is icon-only, 24×24 (< 44px target) and no `aria-label`. (LOW a11y)

### Observability (follow-on to the one applied fix)

- `src/app/global-error.tsx` — now has no logging. If you want production error visibility, wire a real reporter (Sentry/console in a structured way) rather than re-adding the debug log.

---

## Dismissed

- `src/lib/actions/investments.ts:3-5` — commented `revalidateTag`/`CACHE_TAGS` imports are an **intentional** breadcrumb for the disabled auto-create block. Keep.
- `src/lib/actions/utils.ts:10-11` — commented `getDb/sumRegisterBalance` import + TODO to re-add when the negative-balance constraint returns. **Intentional.** Keep.
- `src/lib/actions/transfers.ts:46-56, 99-110` — commented `checkIfSufficientBalance` blocks with explicit "re-enable this block" instructions. **Intentional toggle.** Keep.
- `[PERF]` `console.log`s in `sum-transfers.ts`, `lib/actions/*`, `hooks/transfers/*` — deliberate `perfStart` instrumentation per AGENTS.md. Keep.
- shadcn UI barrel unused re-exports across `components/ui/*` — vendored component APIs; removing piecemeal fights the pattern. Keep.
- `components/ui/*` stock-Shadcn arbitrary values (`ring-[3px]`, `rounded-[2px]`, `min-w-[8rem]`, `text-[0.8rem]`) — upstream defaults; tokenizing diverges from Shadcn. Leave.
- All 19 inline `style={{}}` in `ui/*` and `wykonczymy/*` — Framer motion values, recharts series colors, TanStack-Virtual measured heights, OG `ImageResponse` (Satori has no Tailwind), SVG data-URI (`film-grain.tsx`). **Legitimately dynamic.** Leave.
- `tag.tsx` arbitrary radii/gaps — Figma-spec'd per the file header comment. Leave.
- `src/lib/cache/revalidate.ts revalidateCollections` `for...of` — a sub-agent suggested `.map().forEach()`; that's wrong/worse for side-effects. Not a finding.
- `extractInvoiceIds` Set-loop — idiomatic dedup; rewrite isn't clearly better. Leave.
- `src/lib/auth/roles.ts:11-13` `readonly RoleT[]` tuples — AGENTS.md bans `readonly` on props, but these are const tuples cast downstream; removal is non-trivial, not a mechanical safe-fix. Hold (would be a Proposed, not auto-apply).
- `public/fonts/*`, `scripts/inspect-template.mjs`, root `tests.js` — knip flags as unused but fonts load via `next/font` CSS vars; low value, verify-before-touch. Leave.
- `src/components/ui/data-table/data-table.tsx:21`, `transfers/transfer-data-table.tsx:17`, `ui/toggle-stat-buttons.tsx:26` `readonly` on props — violate the no-readonly convention and removal is mechanical, but TanStack typing may push back, so not a blind auto-apply. Hold.
