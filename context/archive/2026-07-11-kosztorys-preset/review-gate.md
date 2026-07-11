# Review-gate ledger — kosztorys-preset (S-09) · 2026-07-11

Scope: full slice diff `7475865..HEAD` (6 commits, 24 files). Verification pass (Step 0.5) already
run this session via `verify-manual-checks` — all six S-09 manual-check boxes ticked in
`context/foundation/manual-checks.md` (save-as new/overwrite/dup-reject; seed empty-CTA/create-picker/non-empty-reject).
Post-implementation refinements added and verified live this session: UI rename preset→szablon; two
save-as buttons merged into one `SaveAsButton` (Wersja/Szablon toggle).

## Findings
<!-- ONE checkbox per finding. Format: [box] [severity, bug-checks only] · disposition · `source` · `file:line` · what — reason -->

- [x] 🟡 WARNING · fixed · code-review + impl-review (F1) · `src/lib/actions/investments.ts:48` · Seed failure after investment create returned `{success:false}`, skipping `['investments']` revalidation → invisible investment + duplicate on retry. **Fixed:** seed is now best-effort in try/catch, returns `success:true` (revalidation runs), logs non-'ok'/throw. Mirrors the non-fatal `stampAllTabs` pattern in `linkSheetAction`. **Regression test (test-driven-debugging, integration):** `src/__tests__/lib/actions/create-investment-preset.test.ts` — bad `presetId` → real `createInvestmentAction` returns `success:true` AND the investment row persists with an empty tree. Asserts persisted state, not the return value. Passes @5435.
- [x] E2E · deferred+filed · slice-review-gate (browser-level obligation) · S-09 UI flows (`SaveAsButton`, create-form szablon picker, empty-editor "Wypełnij z szablonu" CTA) · Browser-level slice owes a Playwright E2E. **Deferred, not authored now:** all 6 manual-check boxes verified live this session + F1 (highest correctness risk) now has an integration guard, so full Playwright specs are disproportionate for v1. **Filed: EX-442** (`e2e-backlog`) covering save-as dialog, seed-from-picker, seed-from-CTA + non-empty reject.
- [x] 🔵 OBSERVATION · fixed · code-review + impl-review (F3b) · `src/lib/actions/investments.ts:53` · `'not-empty'` seed result silently swallowed as success. **Fixed:** folded into the F1 change — any non-'ok' result is now logged (still non-fatal; impossible today for a fresh investment, but no longer silent).
- [x] 🔵 OBSERVATION · fixed · code-review + impl-review (F2) · `src/lib/kosztorys/seed-from-preset.ts:14` · Empty-guard comment overstated race-freedom (READ COMMITTED zero-row SELECT takes no lock; no `UNIQUE(investment_id)`). **Fixed:** comment softened to the real guarantee; the race was already plan-accepted for v1.
- [x] 🔵 OBSERVATION · dismissed · code-review (#6) · `src/components/kosztorys/kosztorys-editor-v2.tsx:48` · Remount latch could stick if `router.refresh()` returned a still-empty tree. **Dismissed:** empirically verified working in the manual pass (grid remounted → 1000 pozycji, CTA gone); `seedFromPresetAction` awaits the write + revalidates the 4 tree tags before `onSeeded()→router.refresh()`, so the refreshed tree is populated. Low-prob timing only.
- [x] 🔵 OBSERVATION · dismissed · impl-review (F4) · `src/lib/db/presets.ts:23` · `insertPreset` uses `ON CONFLICT DO NOTHING`→null instead of the plan's "throw PG error". **Dismissed:** deliberate race-free improvement, identical user-facing behavior — resolves the plan's own UNIQUE-violation-surfacing open-risk.
- [x] 🔵 OBSERVATION · skipped · impl-review (F3c) · `src/components/forms/investment-form/investment-schema.ts` · `presetId` is `z.string()`; a non-numeric value → `NaN` (falsy) silently skips seeding. **Skipped:** the picker only ever supplies `String(preset.id)`; numeric schema validation is optional polish, no live path.
- [x] deferred+filed · code-review (#4) / impl-review · `src/lib/kosztorys/apply-preset.ts:20` · Bulk-insert + id-remap body is a near-verbatim fork of `restore-kosztorys.ts` (RETURNING-order + FK-ordering invariants now in two places). Deliberate v1 decision (D9); extract shared `insertKosztorysTree` helper. **Filed: EX-438.**
- [x] deferred+filed · code-review (#5) · `src/lib/db/presets.ts:55` · `getPreset` ignores stored `schema_version`; a payload written under a future non-additive schema would apply blindly. Matches the existing restore/snapshot gap. **Filed: EX-439** (covers both restore + preset read).
- [x] fixed · comment-noise + simplify · `src/lib/kosztorys/apply-preset.ts:25` · inline transaction-handle comment duplicated the header — **dropped**.
- [x] fixed · comment-noise + simplify · `src/lib/kosztorys/serialize-preset.ts:23` · "drop all recorded progress" restated `progress: []` — **rewritten** to the structure-preserved distinction.
- [x] fixed · comment-noise + simplify · `src/components/forms/investment-form/investment-form.tsx:24` · middle clause restated the render block — **trimmed** to the Create-only/omitted-on-edit why.
- [x] dismissed · tailwind-v4-audit · (all 7 UI files) · No findings — clean idiomatic v4, no arbitrary values / removed utilities / next-image `sizes` issues.
- [x] deferred+filed · simplify (reuse) · `src/lib/kosztorys/seed-from-preset.ts:24` · Payload begin/commit/rollback boilerplate now a 3rd copy (vs `kosztorys-snapshots.ts`, `transfers.ts`). Extract `withPayloadTransaction`. **Filed: EX-440.**
- [x] deferred+filed · simplify (altitude #1) · `src/components/kosztorys/kosztorys-editor-v2.tsx:44` · `becamePopulated` remount heuristic papers over `revision`=`investment.updatedAt` being derived at the wrong level (seed doesn't touch the row). Deeper fix: tree-derived revision token. Behavior-sensitive; empirically works today. **Filed: EX-441.**
- [x] deferred+filed · simplify (efficiency) · `src/lib/kosztorys/apply-preset.ts:47` · single-statement bulk insert caps ~3,855 items (Postgres 65535-param ceiling), no chunking; inherited by restore too. **Noted on EX-438** (chunking belongs in the shared helper).
- [x] dismissed · simplify (altitude #3) · `src/components/kosztorys/save-as-button.tsx` · could split into `SaveAsDialog` shell + per-target field components. **Dismissed:** both simplification + altitude agents call the merge a net simplification; the split is worthwhile only if a flow grows — v1-appropriate as-is.
- [x] dismissed · simplify (altitude #2 minor) · `src/lib/kosztorys/apply-preset.ts:74` · `progress` insert block is speculative generality (only caller feeds `progress: []`). **Dismissed:** harmless, keeps apply structurally equal to restore's insert half (aids the EX-438 extraction).

## Simplify pass

Ran /simplify (4 cleanup agents: reuse / simplification / efficiency / altitude) — 3 applied (comment
trims), 3 deferred+filed (EX-440 tx-helper, EX-441 revision-signal, EX-438-note param-ceiling), 2
dismissed (save-as split, progress-block generality). apply/restore dedup = EX-438 (pre-filed). Each
folded into `## Findings` above (tagged simplify). No separate report file — this ledger is the single
source of truth.

## Tests & suite

- **F1 regression test authored** (integration, test-driven-debugging): `create-investment-preset.test.ts` — 1 passed @5435 (`DB_POSTGRES_URL_TEST`, `set -a; . ./.env`). Auto-discovered by `pnpm test:integration` via its `skipIf(!ENV_READY)` marker.
- **E2E obligation:** deferred + filed as **EX-442** (`e2e-backlog`). Not authored now — see Findings.
- **typecheck** (`tsc --noEmit`): ✅ clean.
- **lint** (`next lint`): ⚠️ 15 errors — ALL pre-existing in `scripts/inspect-sheet.mjs` (`process`/`console` no-undef in a node script), **zero in the S-09 diff** (confirmed: neither `inspect-sheet.mjs` nor `queries/investments.ts` is in `7475865..HEAD`). Not this slice's regression; fixing it is out of scope.
- **test** (`vitest run`, unit): ✅ 800 passed, 29 DB-gated skipped.
- **test (DB-gated integration)** @5435: ✅ slice-relevant specs — `create-investment-preset` (F1 regression), `serialize-apply-preset` (4), `kosztorys-restore`, `kosztorys-snapshots` → **9 passed**.
- **test:e2e**: deferred by user (S-09 browser E2E → EX-442).
- **build** (`next build`, Turbopack): ❌ blocked by a **worktree-infra limitation**, not code — `Symlink node_modules is invalid, it points out of the filesystem root` (the worktree's `node_modules` symlinks to the main repo; Turbopack won't follow a symlink out of the worktree root). Error references no source file; typecheck (the real TS-correctness gate) is green. Build must be re-verified in a non-worktree checkout (or after a real `node_modules` install in the worktree) before the code ships.
