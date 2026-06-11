# Tech-debt & refactor backlog — wykonczymy

Living backlog of non-blocking refactor/cleanup findings, distilled from the 2026-06-11 full-scan audit. Every item is independent and judgment-heavy (none are mechanical auto-fixes) — pick by priority, do each in its own session/PR. Add new findings here instead of spawning fresh audit docs.

> **Gate every dead-code deletion on `pnpm typecheck`**, not `grep` — a TS module augmentation (`src/lib/tables/column-meta.ts`) once grepped as orphaned but broke the build when removed. Keep it.

Priority tags: **HIGH** (drift risk / latent bug / biggest win) · MED · LOW.

## Duplication & reuse

- [ ] **HIGH** — Extract a shared form-shell from the 5 transfer forms (`src/components/forms/{deposit,internal-transfer,expense,investment,worker}-form/*.tsx`). They repeat the store-selector triplet, `useAppForm` listeners + `defaultValues ?? {}`, the `onSubmit → CreateTransferFormT` mapping, and the `FormClearButton`/`<form>`/`FieldGroup`/`FormFooter` shell. Biggest single win.
- [ ] **HIGH** — Dedup transfer predicates: `src/collections/transfers.ts:31-49` (`showSourceRegister`/`showInvestment`/`showTargetRegister`/`needsOtherCategory`/`showExpenseCategory`) re-implement rules already in `src/lib/constants/transfers.ts`. Import + thin `(data?.type)` wrappers. Same business rule defined twice = live drift risk.
- [ ] **HIGH** — `src/lib/actions/toggle-active.ts:10-70` — `toggleUserActive`/`toggleCashRegisterActive`/`toggleInvestmentStatus` are near-identical; collapse to one parameterized helper (investments use `status` not `active`, and omit `overrideAccess`).
- [ ] **HIGH** — `src/lib/actions/transfers.ts:318-356` — `updateTransferInvoiceAction` & `removeTransferInvoiceAction` share findByID + media-id extraction + invoice-update; extract a helper.
- [ ] **HIGH** — `src/lib/export/invoice-zip.ts:23-29` — `sanitizeForFilename` duplicates `sanitize-filename.ts` with **diverging** rules (`/\:*?"<>|` vs non-alphanumeric). Consolidate before they drift further.
- [ ] MED — `src/lib/tables/transfers.tsx:88-152` — `mapTransferRow` branches on `depth:0` vs `depth:1` at runtime; split into two typed functions to kill the `(doc: any)`.

## Structure — scatter & cohesion

- [ ] **HIGH** — Zod schema dual homes + latent bug: `src/lib/schemas/{worker,investment,transfer}.ts` vs colocated `forms/*/*-schema.ts`. Actions import from `lib/schemas`, dialogs/stores from the colocated copy, no rule predicts which. Worse: `worker.ts` (`defaultCashRegister: number`) vs `worker-form/worker-schema.ts` (`: string`) **actually diverge** (same for investment). Pick one home + an explicit string→number transform.
- [ ] **HIGH** — Split god-file `src/lib/db/sum-transfers.ts` (409 LOC, 14 exports): `getDb()` + 6 SQL aggregations + 5 result types + 2 derive helpers → split queries / derive / types.
- [ ] **HIGH** — Split god-file `src/lib/google/sheets.ts` (734 LOC, largest file): row type + formatting helper + summary builder + 5 async Sheets I/O fns → split by concern.
- [ ] MED — Transfer-type union defined twice: `src/lib/constants/transfers.ts:2` vs `src/collections/transfers.ts:7`; derive the Payload options from the const array.
- [ ] MED — `src/lib/` root is a 22-file junk drawer mixing generic formatters with domain finance (`calculate-balance`, `calculate-margin`, `map-category-costs` → belong in `lib/db`) and URL/filter builders.
- [ ] MED — Three competing "utils" conventions: `src/lib/utils/default-cash-register.ts` (lone-file dir) vs flat `*-utils.ts` vs `lib/cn.ts`; pick one.
- [ ] MED — Split `src/lib/schemas/transfer.ts` — 3 schemas + 3 types + 2 validators + magic-number constants in one file.
- [ ] MED — Split `src/lib/actions/utils.ts` — catch-all holding the `protectedAction()` framework + `getErrorMessage` + validators + 2 result types. Give `protectedAction` its own file; types → `src/types/`.
- [ ] MED — `src/lib/queries/transfers.ts` exports a type + 2 where-clause builders (`buildTransferFilters`, `stripCancelledFilters`) that are filter logic, not fetching — move them out.
- [ ] MED (doc-only) — Declare the placement rule: `src/types/` = cross-feature only, feature types colocate (re `src/components/forms/types/form-types.ts` vs `src/types/`).
- [ ] LOW — `src/lib/validation-utils.ts` — Zod refinement helpers live away from the schemas that use them → move under `lib/schemas/`.
- [ ] LOW — `src/lib/tables/*.tsx` (5 files) — React column-definition components (return JSX) sit in non-UI `lib/`; move to `components/`.
- [ ] LOW — `src/lib/constants/transfers.ts` holds ~18 behavioral predicates (`needsSourceRegister`, `isLaborCost`…) = domain logic, not constants; split into a transfer-rules module.

## Type safety — `any` & null convention

- [ ] MED — `src/lib/queries/reference-data.ts:86-129` — five raw-SQL mappers each `(row: any)`; share one typed row-mapper.
- [ ] MED — `src/lib/actions/transfers.ts:166-200` (+ type alias L168/172) — `fetchAndAuthorize` types `payload`/`original` as `any`, erasing the doc type through the whole auth path.
- [ ] MED — `src/lib/db/sum-transfers.ts:11` — `getDb(): Promise<any>` leaks untyped; return `unknown` or a narrow Drizzle type.
- [ ] MED — `src/lib/auth/require-auth.ts:9` — `AuthResultT.user: null` on failure; project convention is `undefined`.
- [ ] MED — `src/lib/validation-utils.ts:7-12` — `getAmountError` returns `string | null`; convention is `undefined`.
- [ ] LOW — `src/components/forms/form-fields/*.tsx` (~10 files) — repeated `form: any` (with eslint-disable); a shared `FormApi`-typed prop alias removes the `any` everywhere (the render callback is already typed via `AppFieldComponentsT`).
- [ ] LOW — `src/components/ui/data-table/{table-header,virtualized-table-body}.tsx:8,17` — `headerGroups: any[]` / `header: any`; TanStack exposes `HeaderGroup<T>`/`Header<T>`.
- [ ] LOW — `src/lib/queries/transfers.ts:94` — `(r: any) => Number(r.id)`; type the row.
- [ ] LOW — `src/lib/db/sum-transfers.ts:184` — `categoryMap.get(invId)!.push(...)` non-null assertion outside tests; guard instead.

## Tailwind / UI / a11y

- [ ] LOW — `src/components/wykonczymy/{hero,about,contact,projects,nav}.tsx` — the same ~5 hardcoded hex (`#1c1917`/`#78716c`/`#e7e0d8`/`#fdfbf7`) + `text-[0.625rem]` (×5) + `tracking-[0.2em]` repeat across the marketing site, none in `@theme`. Add the palette (`--color-ink/stone/sand/cream`, `--text-2xs`, ease + shadow tokens) to `globals.css`, then the swaps are mechanical.
- [ ] LOW (a11y) — `src/components/wykonczymy/nav.tsx:34-48` — mobile hamburger is icon-only, 24×24 (< 44px target) and has no `aria-label`.

## Optional

- [ ] `src/app/global-error.tsx` — currently has no logging (the stray debug log was removed). If you want production error visibility, wire a real reporter (Sentry / structured console) rather than re-adding a debug log.

---

_Migrated from `simplify-fullscan-audit-2026-06-11` (now removed). Completed items — dead-file/export removal, 10 dependency removals, animation wiring, the `is-valid-url.ts` rename — are in git history on `staging`._
