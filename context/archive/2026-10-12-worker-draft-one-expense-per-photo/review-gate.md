# Review-gate ledger — worker-draft-one-expense-per-photo · 2026-10-12

Scope: uncommitted work on `staging` vs `HEAD` (69fad70d6), 31 files — the other session's
`investment-ai-stage` files in the same tree are excluded. Checks: `/code-review`,
`tailwind-v4-audit`, `feature-first-structure`, `module-cohesion-audit`, `structure-scatter-audit`,
`comment-noise-audit`. `/10x-impl-review` dropped (no `plan.md`). Step 0.5 browser pass skipped —
the browser is driven only on an explicit ask; manual checks stay pending.

## Findings

- [x] 🔵 OBSERVATION · skipped · code-review · `src/components/worker-expenses/draft-prefill.ts:54` ·
      a photo shared by N rows is uploaded N times — one media row per transfer is the delete/reclaim
      model, and per-row upload predates this change; sharing a media row is a model change, not a cleanup
      test: no automated test · — not a defect
- [x] dropped · feature-first-structure · `src/lib/expense-duplicates/duplicate-of.ts:13` ·
      `skippedReceiptSchema` lives beside the duplicate schema — pre-existing placement, not this change
- [x] dismissed · tailwind-v4-audit · — · 0 findings
- [x] skipped · simplify (altitude) · `src/components/worker-expenses/draft-prefill.ts:32`,
      `src/lib/db/worker-expense-drafts.ts:384` · a paragon carries two client-sent keys (`mediaIds` +
      `readRow`) reconciled in prefill, decide and restore; the server could derive `mediaIds` from
      `ai_read -> rows -> readRow` — changes what the server trusts across three paths, a refactor that
      deserves its own review, not a cleanup
- [x] skipped · simplify (efficiency) · `src/components/worker-expenses/draft-prefill.ts:41` · a photo
      with N paragony is uploaded N times on accept — same as code-review #7 (media row per transfer)
- [x] dismissed · eslint · `src/lib/ai/openrouter.ts:83` · `generateObject` deprecated — pre-existing
      at HEAD, not this change

## Simplify pass

Ran /simplify (reuse, simplification, efficiency, altitude) — 5 applied, 0 proposed, 2 skipped;
each folded into ## Findings (tagged simplify). No separate report.

## Tests & suite

- Typecheck: clean. ESLint on the touched files: 0 errors (1 pre-existing deprecation warning).
- DB specs: `read-expense-draft-receipts` + `worker-expense-drafts` (db, actions, worker) 58/58
  (5435; `20261012_1` applied there by hand — `payload migrate` would also have applied another
  session's uncommitted `20261012_0`).
- `__tests__/components/worker-expenses/` + `__tests__/lib/worker-expenses/` 57/57.
- `pnpm test`: 3 failed / 5813 passed — all three red at HEAD from 081e83518 (payouts), fixed
  above; both specs 455/455 after the fix.
- `pnpm test:integration`: 8 failed (trashed fixture worker, fixed above), then 792/792.
- Live eval `pnpm test:receipts-ai`: 15/15 × 3.
