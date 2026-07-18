# Review-gate ledger — ex-448-stable-row-ids · 2026-07-18

Base: `main` (ba6674ed) · Head: 461c8e6a · Merges to **staging** (rebase before PR).

Touched (11 files): `expense-form.tsx`, `line-items-field.tsx`, `line-item-invoice-field.tsx`,
`use-invoice-files.ts`, `use-receipt-generation.ts`, `upload-file-client.ts`, `expense-schema.ts`,
`bulk-expense-form.ts`, `form-stores.ts`, `invoice-files-projection.test.ts` (new),
`use-invoice-files.test.ts` (deleted).

## Findings

<!-- one checkbox per finding; most-severe first; correctness findings carry a test sub-line -->

- [x] 🔴 CRITICAL · fixed · `code-review` · `use-invoice-files.ts:20` · scan→generate read `filesRef` before React committed `setFiles`, so a batch receipt scan found zero eligible rows and silently skipped AI generation — **fixed**: `filesRef` is now the write-through source of truth (a `commit()` helper updates the ref synchronously ahead of React), retiring the render-time mirror + its `react-hooks/refs` disable. Verified tsc/eslint clean, 10 tests green.
      test: test-driven-debugging · e2e — hook-level state/ref commit-timing has no repro path without a hook renderer (none in repo; jsdom risks the lightningcss arm64 break). Honest guard is browser-level → **filed to `e2e-backlog` EX-447 §3** (batch-add ≥2 → scan/generate → assert rows populate).
- [x] fixed · `comment-noise` · `use-receipt-generation.ts:81` · trimmed vanished-state tail ("so we no longer auto-assign…") — code visibly never assigns category.
- [x] 🔵 OBSERVATION · dismissed · `impl-review` F1 · `form-stores.ts:16` · store retype not in plan's file list — benign/necessary dedup that enables the recovery re-key; documented deviation.
- [x] 🔵 OBSERVATION · dropped · `code-review` · `use-receipt-generation.ts:79` · marker sets id-keyed but field writeback still index-keyed — safe: mid-generation row removal is disabled and appends don't shift earlier indices. Pre-existing, latent-only.
- [x] 🔵 dropped · `code-review` · `upload-file-client.ts:filesByRowId` · recovery re-key depends on wire order + stored ids — invariant holds today (snapshot persists `value.lineItems` incl. `id`); no runtime guard but no defect.
- [x] dropped · `comment-noise` · `line-items-field.tsx:60/99`, `expense-form.tsx:269`, `line-item-invoice-field.tsx:67`, `use-invoice-files.ts:21` · 6 borderline-narration comments — each carries a sliver of load-bearing why (pointer / nullability / StrictMode / mirror rationale); not worth the churn.
- [x] dismissed · `module-cohesion` + `structure-scatter` · slice-wide · both audits clean — `upload-file-client.ts` cohesive (projections are a matched id↔position pair on the same wire seam), hooks single-concern, new test + fns landed in existing canonical homes.
- [x] fixed · `simplify` · `use-invoice-files.ts:33` · extracted `deleteFile(id)` — collapsed 3× verbatim copy-map-delete-id closures.
- [x] skipped · `simplify`(altitude) · `use-receipt-generation.ts:74` · AI write-back still positional behind the generation-disable guard — behavior-uncertain hardening (resolve index-by-id at write time), review-worthy, out of slice core. Same latent finding code-review dropped.
- [x] dropped · `simplify` · `upload-file-client.ts` generic re-key helper; `use-invoice-files.ts:24` extract `useStateRef` — both defer/less-readable, not worth churn.
- [x] dismissed · `simplify`(altitude) · `expense-form.tsx:122/225` · seam knows both coordinate spaces — right layer.

## Simplify pass

Ran /simplify — 1 applied (`deleteFile` dedup), 0 proposed, 2 dropped + 1 dismissed + 1 skipped; each folded into ## Findings (tagged simplify). Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.MUhHoaIqPO.md`

## Tests & suite

- `tsc --noEmit` → exit 0 (after write-through fix + `deleteFile` dedup).
- `eslint src/components/forms/hooks/use-invoice-files.ts` → 0 (the `react-hooks/refs` disable is gone).
- `vitest run invoice-files-projection + invoice-media-resolve` → 10/10 green.
- Full suite (`typecheck && lint && test && test:e2e && build`) — **not run yet; owed before archive.** Ask user before running (long; e2e needs the 5435 container). Pre-existing red specs known: transfer-create/cancel (EX-473), root `scripts/inspect-sheet.mjs` lint (out of scope).
- Regression guard for the 🔴 → filed **EX-447 §3** (browser-level; no unit repro without a hook renderer).
