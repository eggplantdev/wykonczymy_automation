# Review-gate ledger — staging, 2026-10-19 commits · 2026-10-19

**Scope:** `af55477e7..2ed243257` on local `staging` — every commit of 2026-10-19 (41 commits, 147 files):
comment-noise sweep (`6b4120318`), unused theme tokens (`28186af47`), faktura reclaim after delete
(`380b54550`), unknown-URL nav crash (`4b1bcd1a0`, EX-1097), and the `app-audit-refactor` merge —
plan phases 1–2 plus the payout-card / Badge / DotBadge / BadgeButton / Button-variant work.
Phases 3–8 (`app-audit-refactor-wt`) are not in this gate. Previous gate ended at `97c725dff`
(test-suite-speed); `7240f26ad`–`af55477e7` were that gate's own fixes and its archive.
Extended to `562db26c9` on the owner's request: `a353e3506` (column toggle and duplicate finder only
in the table view, cards read every column) and `562db26c9` (its manual checks).

**Step 0.5 (browser verification):** skipped — not requested; the slice's boxes in `manual-checks.md`
stay informational.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `src/lib/actions/cash-registers.ts:48` · `updateCashRegisterAction` had no per-kasa check and left `owner` free — a MANAGER could edit / take over another manager's kasa by calling the action directly; `createCashRegisterAction` let him open a kasa owned by another manager. Owner approved: `findManageableRegister` before the update + `canHandRegisterTo` on create and update (the owner must be one he may manage: himself or an EMPLOYEE); the form's owner field stays. Ruling in `accounts-and-access.md`
      test: test-driven-debugging · integration — `src/__tests__/lib/actions/cash-registers.db.test.ts` asserts the stored name/owner; not yet run (awaiting go)
- [x] 🟡 WARNING · fixed · impl-review · `src/app/(frontend)/warianty-badge/page.tsx:1` · showcase page open to every role (EMPLOYEE included) — now a server page behind `requireManagementPage()`; body moved to `app/(frontend)/warianty-badge/badge-variants.tsx`
      test: no automated test — demo data only, the guard is the shared `requireManagementPage`
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/auth/roles.ts:85` · ruling "any management role cancels a rejected wypłata, regardless of kasa scope" isn't in `context/reference/accounts-and-access.md` — added a `## Wypłaty` section
- [x] 🔵 OBSERVATION · dropped · impl-review · `eslint.config.mjs:129` · `ui/` guard misses relative escapes, `@/hooks/*`, domain `lib/utils` — nothing breaches it; p5 on `-wt` moves the Payload hooks out of `src/hooks`; tightening `lib/utils` is p3's job
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/constants/transfers.ts:1` · duplicate of the module-cohesion `dot-badge.tsx` finding
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/reference/kosztorys-sync.md:115` · "Key files" doesn't name `lib/google/transfer-sheet-sync.ts` (spec move tracked under structure-scatter)
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/payouts/rejected-payouts.tsx:43` · only the ID header goes through the translator, the rest is literal Polish — management-only table, make it all literal
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/foundation/manual-checks.md:1322` · phase-2 check points at the deleted `/wyplaty` — now `/pracownicy` → „Rozlicz wypłaty”

- [x] dismissed · code-review · `src/lib/queries/worker-transfers.ts:30` · worker page forces `showCancelled` for every type, not only payouts — deliberate (118f4f333: "the worker page list always shows cancelled transfers (struck through, no toggle)"); same semantics as the toggle elsewhere
- [x] dropped · code-review · `src/components/payouts/rejected-payouts.tsx:86` · Kasa cell links a MANAGER to a MAIN kasa he can't open — the app-wide pattern (`tables/transfers.tsx:157`, `:173` link the same way); a dead link to a page that refuses, no data exposed
- [x] dismissed · code-review · `src/lib/auth/roles.ts:61` · `ownerRole` undefined for a trashed owner — false positive: `trashedAt` is a plain field with no read filter and the lookup runs `overrideAccess`, so a trashed owner populates; a hard-deleted owner is absent from the table's lookup too
- [x] dismissed · code-review · `src/app/(frontend)/[...catchAll]/page.tsx:10` · unknown URL renders `<NotFound />` with HTTP 200 — deliberate EX-1097 workaround (`notFound()` left the client router stuck), recorded in the file; auth-gated app, no crawler or monitor reads the status
- [x] fixed · code-review · `src/lib/actions/toggle-active.ts:87` · re-implements `findManageableRegister` from `cash-register-trash.ts` (two copies of the register permission rule) — move it out of the `'use server'` file into `lib/cash-registers/register-scope.ts`, call it from both
- [x] dropped · code-review · `src/lib/actions/toggle-active.ts:88` · `depth: 1` populates every relation to read `owner.role` — one `findByID` per click
- [x] skipped · code-review · `src/components/cash-registers/cash-registers-table.tsx:76` · hand-written `useMemo` — pre-dates the range (only its deps changed); phase 7 on `-wt` strips it, an edit here only adds a merge conflict
- [x] skipped · code-review · `src/components/ui/slice-pie.tsx:19` · `formatShare` prop threaded by both callers — the p1 `ui/` guard seam, matching the existing `formatValue` prop; moving `formatPercent` out of `lib/kosztorys` ripples through 9 kosztorys files that p8 on `-wt` is rewriting
- [x] fixed · code-review · `src/components/transfers/cards/transfer-card.tsx:31` · `hasColumn` rescans `row.getAllCells()` on each of ~9 calls per card — build the column-id Set once
- [x] dismissed · code-review · `src/components/worker-reports/section-pill.tsx:4` · duplicate of the tailwind-v4 finding below

- [x] fixed · tailwind-v4 · `src/components/worker-reports/section-pill.tsx:4` · `text-[color-mix(…var(--section-rail…))]` arbitrary + hard-coded `/18` — register `--color-section-rail` / `-ink` in `@theme inline`
- [x] fixed · tailwind-v4 · `src/app/(frontend)/warianty-badge/page.tsx:177` · static `style={{'--section-rail'}}` — reuse `SECTION_COLORS[…].rail` class
- [x] fixed · module-cohesion · `src/components/ui/dot-badge.tsx` · colour-token list lives in a ui component; `lib/constants/transfers.ts` imports `DotBadgeColorT` from `components/ui` (lib → ui upward import) — token map + type now in `src/styles/color-tokens.ts`
- [x] fixed · module-cohesion · `src/lib/table/column-order.ts` · `ColumnToggleItemT` (UI props shape) parked in a ranking module to break a cycle — move to `ui/column-order-dialog.tsx`
- [x] skipped · module-cohesion · `src/lib/auth/roles.ts` · role list + account/register/transfer policies in one file (16→19 exports) — a split into `lib/auth/policies/*` is a cross-cutting refactor; doing it on staging while `-wt` reworks `lib/*` (p3–p6) guarantees merge conflicts
- [x] fixed · module-cohesion · `src/app/(frontend)/warianty-badge/page.tsx` · hand-listed `TONES` already lacks `red` — derive from `badge.tsx`
- [x] fixed · structure-scatter · `src/__tests__/lib/actions/sheets-sync.test.ts:495` · ~290 lines testing the moved `lib/google/transfer-sheet-sync` stayed behind — move to `src/__tests__/lib/google/transfer-sheet-sync.test.ts`
- [x] fixed · structure-scatter · `AGENTS.md:169` · says the `ui/` import rule is "not lint-enforced"; `eslint.config.mjs` now enforces it
- [x] dropped · feature-first · `src/components/transfers/cards/card-list-classes.ts` · `payouts/` imports a class constant from `transfers/cards/` — payouts are transfer cards; a `ui/card-list` primitive for two consumers isn't worth the churn
- [x] dismissed · feature-first · `src/app/(frontend)/warianty-badge/page.tsx` · dev reference page in the prod route tree — deliberate (859d6aa99, design-system reference), read-only, no data
- [x] dismissed · structure-scatter · `src/hooks/` · React hooks and Payload collection hooks share a folder — pre-dates the range; phase 5 on `-wt` moves the Payload hooks to `src/collections/hooks`
- [x] fixed · comment-noise · `src/styles/globals.css:19` · sweep 6b4120318 deleted "colour first: Tailwind takes the first var() of a shadow for its colour slot" — restore
- [x] fixed · comment-noise · `src/styles/globals.css:170` · sweep deleted why `max(var(--text-base), 16px)` holds the 16px floor (iOS zoom) — restore
- [x] fixed · comment-noise · `src/styles/globals.css:219` · sweep deleted why `.dsg-row-header` resets the grid text size (etap rename input) — restore
- [x] fixed · comment-noise · `src/styles/globals.css:363` · sweep deleted the clip-on-text-not-cell and margin-not-padding traps — restore one line each
- [x] fixed · comment-noise · `src/styles/globals.css:524` · sweep deleted why the stripe uses `background-color`, not the `background` shorthand — restore
- [x] fixed · comment-noise · `.github/workflows/blob-backup.yml:87` · sweep deleted the two lftp traps (manifest before `lcd`; `mirror -R <dir>` nesting) — restore
- [x] fixed · comment-noise · `scripts/reset-sequences.sql:1` · sweep deleted the only mapping of Payload's "ValidationError: id" to this script — restore
- [x] dropped · comment-noise · `src/styles/globals.css:176` · placeholder-14px rationale — names a cosmetic regression only
- [x] fixed · comment-noise · `src/styles/globals.css:45` · dangling "They" after the trim, duplicates `lib/utils/cn.ts:4` — fix subject here, drop the cn.ts copy
- [x] fixed · comment-noise · `docker-compose.yml:1` · trim cut the subject; comment now explains `container_name` while on `name:` — rewrite
- [x] fixed · comment-noise · `.github/workflows/blob-backup.yml:1` · secrets-list leftover far from its use — move onto the env line (:68)
- [x] fixed · comment-noise · `.husky/pre-push:59` · "never block a push over LOCAL auth" scrap away from its `else` — move there
- [x] fixed · comment-noise · `.github/workflows/db-backup.yml:5` · DST note on the cron — delete
- [x] fixed · comment-noise · trims: `delete-invoice-media.db.test.ts:12`, `schema.test.ts:141` + `:170` (now wrong: the `after()` is in the caller), `lib/google/sheets.ts:77`, `lib/auth/roles.ts:88`, `lib/google/transfer-sheet-sync.ts:35` + `:67` — trimmed; `lib/queries/worker-transfers.ts:28` dismissed: already a one-line why
- [x] fixed · comment-noise · over 100 cols: `[...catchAll]/page.tsx:3`, `hooks/transfers/delete-invoice-media.ts:5` — re-wrap
- [x] fixed · tailwind-v4 · `src/lib/constants/transfers.ts:227` · `transferColorVar` + `style={{ color }}` in `tables/transfers.tsx:70`, `transfer-card.tsx:71` — tokens now in `@theme`, use a `text-*` class map
- [x] 🟡 WARNING · fixed · suite · `src/__tests__/lib/constants/transfers.test.ts` · `NOT_A_TRANSFER_TYPE_PREDICATE` lacked `transferColor` (c92e9dd4c), so "covers every exported predicate" fails — added with `transferTextClass`
      test: no automated test — the fix is to the spec itself

- [x] fixed · simplify · `src/components/ui/dot-badge.tsx:3` · first fix put the token map in `lib/constants/`, which the `ui/` import guard forbids (lint error) — moved to `src/styles/color-tokens.ts`, beside the `@theme` it mirrors
- [x] fixed · simplify · `src/__tests__/lib/actions/sheets-sync.test.ts:6` · ~95 lines of googleapis mock, headers, tab meta, `withSheet` / `writeData` / `sheetGrids` and the reset copied into the moved spec — extracted to `src/__tests__/helpers/sheets-api.ts`, both specs `vi.mock('googleapis', () => import(…))` it
- [x] fixed · simplify · `src/__tests__/lib/google/transfer-sheet-sync.test.ts:4` · dead in the moved spec: `activeInvestmentExecute` drizzle stub, the auth mock, `valuesAppend/UpdateMock`, `setEnv` wrapper — removed; `findByIDMock` / `valuesUpdateMock` dropped from the action spec too
- [x] fixed · simplify · `src/components/kosztorys/editor/grid/cells/section-header-cell.tsx:54` · `bg-(--section-rail,var(--color-muted-foreground))` beside the new pill tokens — `--color-section-rail` in `@theme inline`, dot is `bg-section-rail` (the pill tokens keep their own expression: an inline token can't reference another inline token)
- [x] fixed · simplify · `src/components/badge-variants/badge-variants.tsx` · a top-level feature dir for one showcase route's client body — moved beside `warianty-badge/page.tsx` (the `zaloguj/login-form.tsx` precedent)
- [x] dropped · simplify · `src/styles/color-tokens.ts` · 27 `section-*` keys also listed in `SECTION_COLORS` — pre-dates the range (`DOT_BADGE_COLORS`); a lookup per entry is as long as the literal it replaces
- [x] dismissed · simplify · `src/lib/cash-registers/register-scope.ts:23` · return `{ refusal }` instead of the action-failure shape — three trash callers return it as is, only toggle unwraps
- [x] dropped · simplify · `src/styles/color-tokens.ts:157` · `COLOR_TOKENS` has one consumer (the showcase) — a one-line derived list beside its map
- [x] dismissed · simplify · `src/lib/actions/toggle-active.ts:88` · toggle now refuses a missing kasa with „Kasa nie istnieje.” — a missing id threw in `payload.update` before. A kasa the role can't view (MAIN for a MANAGER) gets „Brak uprawnień” in every kasa action (`findManageableRegister`), by owner ruling: it exists
- [x] dismissed · simplify · `src/__tests__/lib/actions/sheets-sync.test.ts` · `expect(valuesAppendMock).not.toHaveBeenCalled()` "can never fail" — it guards against a reintroduced `values.append` (`sheets.ts:177` explains why it's banned)

- [x] fixed · reuse-scan · `src/lib/cash-registers/register-scope.ts:13` · hand-rolled relation→id for `ownerId` — existing `resolveId` at `src/lib/utils/resolve-id.ts:6`
- [x] fixed · reuse-scan · `src/lib/google/transfer-sheet-sync.ts:25` · local `relId` (4 calls) — `resolveId`, which the sibling hook `hooks/transfers/sync-sheet.ts` already uses on the same field
- [x] fixed · reuse-scan · `src/components/payouts/rejected-payouts.tsx:43` · transfer link built by hand, same as `documentHref`'s transaction branch — extracted `transferHref(id, investmentId)` in `lib/utils/investment-transfers-href.ts`, both call it
- [x] fixed · reuse-scan · `src/components/payouts/rejected-payouts.tsx:25` · disabled copy of `CancelTransferButton`'s trigger — `CancelTransferButton` takes `disabledReason` (the `EditTransferDialog` pattern)
- [x] fixed · reuse-scan · `src/components/forms/settle-payouts-form/settle-payouts-table.tsx:196` · sign-coloured money span duplicating `BalanceCell` (134b6123d had to fix both) — `<BalanceCell className="font-normal whitespace-nowrap" />`
- [x] dropped · reuse-scan · active-toggle `BadgeButton` ×3, `DotBadge` vs `CardChip`, `CollapsibleSection` pair, inline `/kasa|/pracownicy|/inwestycje` links — a shared form would take the code as params, or no helper exists and inline is the repo norm

- [x] dismissed · code-review · `src/components/transfers/cards/transfer-card.tsx:25` · cards now read `getAllCells()`, so a column hidden in the table shows on a card — intended by `a353e3506`; transfer tables set no `defaultColumnVisibility`, and `excludeColumns` still drops a page's columns from the defs, so nothing the page withholds reaches a card
- [x] dismissed · code-review · `src/components/transfers/transfer-data-table.tsx:115` · hiding `ColumnToggle` in card view also hides its text-size menu — that size styles table cells only; cards don't read it

- [x] fixed · suite · `src/components/tables/transfers.tsx:66` · the gate's own color-class edit used `cn` without importing it — typecheck caught it; import added
- [x] fixed · suite · `src/__tests__/components/forms/hooks/use-investment-from-url.test.ts:21` · lint error `react-hooks/rules-of-hooks` from `f004b9d08` (outside scope, red on staging) — node spec with no renderer, the hook only reads the mocked `usePathname`; line-level disable with that reason
- [x] dismissed · suite · `.next-e2e/types/validator.ts:323` · tsc error on the removed `/wyplaty` page — a stale e2e build artifact, rewritten by the next `next build` into `.next-e2e`

## Simplify pass

Ran /simplify (reuse · simplification · efficiency · altitude) over the gate's own edits — 5 applied, 0 proposed, 5 dropped/dismissed (efficiency: no findings); each folded into ## Findings (tagged simplify). primitive-reuse-scan: 5 fixed, 1 dropped (tagged reuse-scan).

## Tests & suite

Run by the owner's go („testy”), touched specs only — no full suite, no e2e.

- `tsc --noEmit`: green after the `cn` fix, apart from the stale `.next-e2e` artifact.
- `eslint .`: 0 errors after the spec fix (51 pre-existing warnings).
- Unit/DOM — 11 files, 561 tests passed: toggle-active, constants/transfers, sheets-sync,
  transfer-sheet-sync, env schema, delete-invoice-media, column-order, cancel-transfer-button,
  transfer-card-columns, investment-transfers-href, use-investment-from-url.
- Integration (`pnpm test:integration`, 5435) — 4 files, 30 tests passed: cash-registers (new, 5),
  cash-register-trash, toggle-active, delete-invoice-media.
