# Review-gate ledger — receipt-scan-line-items (EX-443) · 2026-07-11

Fan-out: impl-review, code-review, tailwind-v4-audit, feature-first-structure, module-cohesion-audit, structure-scatter-audit, comment-noise-audit (7, all read-only). tailwind + scatter = no findings.

## Findings

<!-- ONE checkbox per finding. Format: [box] [severity, bug-checks only] · disposition · `source` · `file:line` · what — reason -->

### Correctness / safety

- [x] 🟡 WARNING · fixed(code) + e2e filed · `impl-review`+`code-review` · `line-items-field.tsx:214` / `use-receipt-fill.ts:67-100` · Removing a row mid-fill writes the extraction to the wrong row — `RemoveButton` wasn't disabled during `isFilling`, so an in-flight worker's captured index goes stale after the array shifts. **Fixed:** `disabled={… || isFilling}`.
      test: test-driven-debugging · e2e — filed as **EX-447** (e2e-backlog): batch-fill in flight → remove earlier row → assert removal blocked / result on correct row.
- [ ] 🔵 OBSERVATION · proposed · `code-review` · `openrouter.ts:37-58` · No timeout/`abortSignal` on the vision call — one hung request never settles, so `mapWithConcurrency`'s `Promise.all` wedges and `isFilling` stays true (spinner never clears). Held for your call: add `AbortSignal.timeout(N)` so a stuck receipt fails into `failedIndices` instead of freezing the batch — needs a timeout value decision.
      test: test-driven-debugging · unit — mock `generateObject` to hang; assert the call rejects/aborts and the row lands in `failedIndices`.
- [x] 🔵 OBSERVATION · dismissed · `impl-review`(F6)+`code-review` · `extract-receipt.ts:20` · No ownership scoping on `media.findByID` — benign: behind `protectedAction`/`requireAuth(MANAGEMENT_ROLES)`, read-only over already-uploaded blobs, consistent with the upload route. Revisit only if media becomes tenant-sensitive.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `expense-form.tsx:174-183` · Submit mid-fill can re-upload a not-yet-stored file — result is a valid mediaId, only a redundant upload. Harmless.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `openrouter.ts:35` · Public blob URLs of receipts are fetched by OpenRouter/OpenAI — intended architecture (design note in change.md), not a defect.
- [x] 🔵 OBSERVATION · skipped · `code-review` · `use-receipt-fill.ts:38-42` / `extract-receipt.ts:24` · Per-row PDF fails as generic "nie odczytano" with no "scanner is image-only" hint — caught safely; UX polish not worth the churn this slice. Revisit if users hit it.

### Plan drift (doc-only)

- [x] 🟡 WARNING · dismissed · `impl-review`(F2,F4,F5) · `package.json:62` / `line-items-field.tsx:271` / `openrouter.ts:26` · Code diverges from plan.md in three benign ways: `ai` is v7 (plan said v6, API used works on v7); batch picker `accept="image/*"` (plan said +pdf — PDFs aren't scannable, per-row input still takes pdf); `extractReceipt` has an extra `mediaType` arg the AI SDK `file` part requires. All functionally correct — plan.md archives with the slice, not reconciling.

### Structure / cohesion (judgment — reviewers disagree)

- [x] 🟡 · fixed(simplify) · `impl-review`(F3) · `upload-file-client.ts:27-38` · Orphaned `uploadFilesClient` (zero call sites after the Phase-4 submit rewrite) — dead code, delete gated on tsc.
- [ ] proposed · `feature-first` · `form-fields/resolve-expense-category-id.ts` · A pure `.ts` domain helper living in a folder of `*-field.tsx` components → move to `expense-form/` (next to `map-line-item.ts`). Held: cohesion/scatter audits call it acceptable colocation; your call.
- [ ] proposed · `feature-first` · `upload-file-client.ts` (`resolveInvoiceMediaIds`) · Single-consumer invoice-domain logic in a generic utils file → move to `expense-form/`. Held: cohesion audit judged the file cohesive (all upload-topic); disagreement → your call.
- [ ] proposed · `module-cohesion` · `use-invoice-files.ts:6,15` · Pure map helpers (`reindexAfterRemoval`, `setFilesAt`) mixed with the hook → optional split to `lib/utils/reindex-map.ts`. Low severity, optional.
- [x] dismissed · `feature-first` · `forms/hooks/use-receipt-fill.ts` · "Should be under `expense-form/` per AGENTS.md" — matches the existing `use-invoice-files.ts` precedent (also single-consumer, in `forms/hooks/`); consistent with repo convention, not this slice's problem to fix.

### Comment noise

- [x] fixed(simplify) · `comment-noise` · `receipt-extraction-schema.ts:3` · Narration head ("output contract… drives typing") over an exported zod schema — trim, keep the load-bearing nullability why.
- [x] fixed(simplify) · `comment-noise` · `use-receipt-fill.ts:26` · Leading clause narrates the loop verbatim — trim, keep the cross-file "mirrors reindexAfterRemoval" tail.
- [ ] proposed · `comment-noise` · `line-items-field.tsx:48,50,54` · Three prop-doc comments lean toward restating the prop name + signature; only the cross-refs carry weight. Held: your call on trim-vs-keep.

### From /simplify (applied)

- [x] fixed · `simplify` · `upload-file-client.ts:27` · deleted orphaned `uploadFilesClient` (tsc-gated). [dup of the F3 structure finding above]
- [x] fixed · `simplify` · `receipt-extraction-schema.ts:3` · trimmed narration head. [dup of comment-noise finding above]
- [x] fixed · `simplify` · `use-receipt-fill.ts:26` · trimmed loop-narration clause. [dup of comment-noise finding above]

### From /simplify (proposed — your call, all open)

- [ ] proposed · `simplify` · `use-receipt-fill.ts:56` vs `line-items-field.tsx:286` · Fill-eligibility predicate written twice with a subtle `files.has` vs `getFileName` divergence → extract one shared predicate. **Correctness-adjacent** (the two could drift).
- [ ] proposed · `simplify` · `upload-file-client.ts` (`resolveInvoiceMediaIds`) · Unbounded `Promise.all` on uploads vs the fill path's `mapWithConcurrency(4)` → route through the cap.
- [ ] proposed · `simplify` · `use-receipt-fill.ts:28` · `reindexSet` duplicates `reindexAfterRemoval` → delegate the Set through the Map helper. (Overlaps the module-cohesion split proposal.)
- [ ] proposed · `simplify` · `use-receipt-fill.ts:44` · `isFilling` derivable as `progress !== null` — held because it now feeds the correctness guard.
- [ ] proposed · `simplify` · `use-receipt-fill.ts:13` · `FormT = any` escape hatch → use `form-shell.tsx`'s structural type.
- [ ] proposed · `simplify` · `expense-form.tsx` (4 `fileInputKey` bump sites) + `file-input.tsx:29` · Global remount-key sledgehammer → control filename from `getFileName(index)` to drop the key. (Root-cause-adjacent — see refactor below.)
- [ ] proposed · `simplify` · `line-items-field.tsx:156,287` · Inline row-type literal repeated → export one shared row type.

### Root-cause refactor (deferred — filed as tech debt)

- [x] deferred + filed · `simplify` · `use-invoice-files.ts` / `use-receipt-fill.ts` / `expense-form.tsx` · **Index-as-row-identity** is the shared root cause of the F1 fill race, the P3.2 stale-filename display, and the whole reindex/remount apparatus (`reindexAfterRemoval`, `reindexSet`, `fileInputKey` bumps, `onRowRemoved`). Deep fix = stable per-row uuids. Larger refactor, out of scope — filed as tech debt **EX-448**.

## Simplify pass

Ran /simplify (receipt-scan worktree) — **3 applied, 7 proposed, 2 dismissed**; tsc green. Each finding folded into ## Findings (tagged `simplify`). The 3 applied = the gate's fix-now items. Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.WbIXRM75Zw.md`

## Tests & suite

Fast legs only (user's call — e2e would reset the 5435 db-test container the manual pass was using):

- **typecheck** — ✅ green (`tsc --noEmit`, also re-confirmed post-/simplify).
- **unit (vitest)** — ✅ green: 822 passed, 24 skipped. Slice specs all pass (receipt-extraction-schema, resolve-expense-category-id, use-invoice-files, map-with-concurrency, invoice-media-resolve).
- **lint** — ❌ red (15 errors) but **pre-existing, not slice-introduced**: all 15 are `no-undef` (`process`/`console`) in `scripts/inspect-sheet.mjs`, a POC script on `main` (commit 9266d4b "add poc artifacts"), untouched by this slice. **0 lint errors in any slice file.** Not a slice regression; tracked below.
- **e2e / build** — not run (fast-legs scope). e2e obligations filed as EX-447.

### Suite finding

- [ ] pre-existing · `suite` · `scripts/inspect-sheet.mjs` · Repo lint is red (15 `no-undef` errors — eslint lacks Node env for this `.mjs` POC script). Predates this slice; blocks a clean `pnpm lint` repo-wide but not this slice's correctness. **Not sweeping it into the receipt-scan diff** (unrelated). Decide: quick eslint-env fix now, or file as its own tech-debt issue.
