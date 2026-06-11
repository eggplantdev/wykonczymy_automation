# Full-scan report — wykonczymy

## ✅ To-do checklist (easy → hard)

> Gate **every** dead-code deletion on `pnpm typecheck` — `grep` alone is not enough. It already false-flagged `column-meta.ts` (a TS module augmentation) as orphaned; deleting it broke the build.

**Done**

- [x] Remove stray debug log — `src/app/global-error.tsx` (commit `1686ae0`)
- [x] Delete `ui/confirm-close-dialog.tsx` (obsolete — replaced by Zustand form persistence) + `ui/print-button.tsx` (superseded by `transfers/print-button.tsx`) — typecheck green
- [x] Remove recharts cluster — `reports/report-charts.tsx` + `ui/chart.tsx` + `recharts` dep + stale `ReportChart` TODO in `raporty/page.tsx` — typecheck green
- [x] Remove `src/seed.ts` (orphaned dev seeder; npm `seed:*` scripts use `src/scripts/seed-*.ts`)

**Easy — dead code** (delete one → `typecheck` → keep only if green)

- [x] Delete remaining confirmed-orphaned files (14) — UI: `card-box`, `rainbow-button`, `input-group`, `section-header`, `skeleton`, `tag`, `ImageMedia`; icons: `calendar-add/approved/processing-icon`, `dot-icon`; plus `downloadFile.ts`, `types/users.ts`, `form-components/index.ts` — each re-verified by exact export name + import path + `declare module` guard; typecheck green
- [ ] ⚠️ KEEP `src/lib/tables/column-meta.ts` — NOT dead; it augments `ColumnMeta` (`canHide`/`label`/`align`)
- [x] Remove 4 unused non-CSS deps: `next-themes`, `swiper`, `usehooks-ts`, `isomorphic-dompurify` (commit `644fee8`) — hand-edited `package.json` + `pnpm install`; arm64 lightningcss verified intact
- [x] Remove 8 dead exports (used nowhere) — `perf()`, `REGISTER_TYPE_LABELS_PLURAL`, `CreateInternalTransferFormT`, `IconSize`, `CacheTagT`, `SectionIdT`, `TransferColumnIdT`, `PaginationLabelsT` (commit `b933b99`). `CreateTransferFormT` kept — used in 5 files (audit was stale).
- [x] Un-export internally-used-only symbols (drop `export`, keep the symbol): `COST_TYPES`, `INVESTMENT_TYPES`, `SHEET_STATUSES`, `ComboboxItemT`, `ExportContextT`, `TransferQueryT`, and `isNoResultsSentinel` (commit `e0a55d5`) — each verified referenced only within its own module; typecheck green. The `sum-transfers.ts` block cleared once the parallel rabat session landed.
- [ ] Rename `isValidUrl.ts` → `is-valid-url.ts` (kebab-case)

**Decisions made**

- [x] **Shadcn enter/exit animations** — chose **A (restore)**: added `@import 'tw-animate-css';` to `globals.css`, dropped the dead v3 `tailwindcss-animate` plugin (commit `b2e7173`). The Radix `data-[state]` overlay animations now emit; verified `.animate-in` + `@keyframes enter` through the `@tailwindcss/postcss` pipeline.
- [x] Remove config deps (verified not loaded): `@tailwindcss/forms`, `@tailwindcss/typography`, `autoprefixer` (v4 auto-prefixes); `eslint-config-next`/`eslint-config-prettier` (eslint.config.mjs imports `@next/eslint-plugin-next` directly) (commit `644fee8`)

**Hard — refactors** (judgment-heavy, separate sessions)

- [ ] Extract a shared form-shell from the 5 transfer forms (biggest win)
- [ ] Fix divergent `worker`/`investment` schemas (`number` vs `string`) — latent bug
- [ ] Dedup `collections/transfers.ts` predicates vs `lib/constants/transfers.ts`
- [ ] Split god-files: `lib/db/sum-transfers.ts` (409 LOC), `lib/google/sheets.ts` (734 LOC)
- [ ] Untangle the `lib/` root junk-drawer (domain-finance → `lib/db`)

---

# Full-scan report — wykonczymy

**Mode:** apply safe fixes + report · **Worktree:** `.worktrees/simplify-fullscan` (branch `simplify-fullscan-wt`, off `staging`)
**Lenses:** quality/simplify · structure & cohesion · dead-code & deps · Tailwind v4
**Tally:** 1 applied · ~40 proposed · 12 dismissed

> **Verification:** `pnpm typecheck` was run on `staging` after the applied fix — **green**. (`lint` / `test` not run.) Note: this audit was produced read-only; `grep`-based "orphaned" calls must still be re-confirmed with `typecheck` before deletion.

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
