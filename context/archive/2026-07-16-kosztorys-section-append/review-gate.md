# Review-gate ledger — kosztorys-section-append · 2026-07-16

## Findings

<!-- ONE checkbox per finding. Format: [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — reason
     Correctness findings carry a `test:` sub-line. Most-severe first. -->

Fan-out clean: 0 CRITICAL, 0 WARNING across both bug-finding checks. SQL parameterized, id-remap
verified, transaction owned+rolled-back, cache tags correct. tailwind / feature-first / cohesion /
scatter all reported zero. All findings below are OBSERVATION-tier or structural nits.

- [x] 🔵 fixed · impl-review+code-review · `src/lib/actions/kosztorys-presets.ts:106,126` · `investmentId` consumed unvalidated → folded into `appendSectionsSchema` (`z.number().int().positive()`), validated with `selections`
      test: no automated test — mechanical Zod guard; the invalid-id path already fails at the FK inside the (rolled-back) tx, and no sibling action tests its bare `investmentId`
- [x] 🔵 fixed · impl-review+code-review · `src/components/kosztorys/add-sections-from-preset-dialog.tsx:45,53,120` · empty-state „Brak szablonów" flashed during fetch, a failed load read as a genuinely-empty library, and the list went stale on reopen → tri-state `PresetSectionMetaT[] | null` (null=loading), error toast on failed load, reset-to-null on close
      test: no automated test — UI loading/error-state polish; behavior is a toast + a render branch, cheaper to eyeball (covered by manual check 4.x)
- [x] 🔵 fixed · code-review · `src/lib/actions/kosztorys-presets.ts:139,141` · action assumed `payload.sections`/`items` exist while the reader defensively `?? []` → mirrored the guard so a malformed preset yields the intended „Nie znaleziono sekcji" not a generic throw
      test: no automated test — defensive guard on a shape `SnapshotPayloadT` already requires; not a reachable bug with current data
- [x] fixed · comment-noise · `src/components/kosztorys/add-sections-from-preset-dialog.tsx:36` · header comment's first sentence restated the `DialogHeader title` → trimmed, kept the multi-select/fetch-on-open design-why
- [x] 🔵 dismissed · impl-review · `src/lib/kosztorys/append-preset-sections.ts:78-84` · returned slice echoes `undefined` coeffs where DB persisted `null` — benign: `treeToRows` treats both identically, zero observable divergence; not worth 6 lines of churn
- [x] 🔵 dismissed · code-review · `src/lib/kosztorys/append-preset-sections.ts:35` · `MAX(display_order)+1` collision under concurrent append — documented + accepted in the file header; only makes relative section order ambiguous, nothing corrupts; matches seed-from-preset's accepted race
- [x] 🔵 skipped · impl-review+code-review · `src/lib/actions/kosztorys-presets.ts:119` · no per-investment authorization on `investmentId` — pre-existing project-wide posture (every sibling action takes a bare `investmentId`, gated only by `MANAGEMENT_ROLES`); not this slice's debt, a codebase-wide RBAC decision

### /simplify findings (folded in)

- [x] deferred · simplify · `src/lib/kosztorys/append-preset-sections.ts:40-72` · section/item bulk-`INSERT` tuples triplicated verbatim across apply-preset / restore-kosztorys / append (reuse + altitude agreed) — extract shared `insertSections`/`insertItems` primitives; behavior-sensitive, touches 2 critical paths outside the diff → filed **EX-504**
      test: recorded in EX-504 — integration (5435 DB), assert persisted rows for one caller of each primitive
- [x] skipped · simplify · `src/lib/queries/presets.ts:17-38` · two near-identical `unstable_cache` wrappers — factory indirection not worth it for 2 callers
- [x] skipped · simplify · `src/lib/db/presets.ts:87-116` · `listPresetSections` reads full jsonb for slim metas — cache-amortized + preset-library-bounded + documented; accepted tradeoff
- [x] skipped · simplify · `src/lib/actions/kosztorys-presets.ts:132-137` · sequential per-preset reads — K tiny, Map-cached once-per-preset already; batching a negligible win

### E2E obligation (browser-level slice)

- [x] deferred · e2e · picker → append → grid-patch flow + empty-kosztorys path — no Playwright coverage; integration layer already covered by 5 real-DB specs → filed **EX-505** (`e2e-backlog`)

## Simplify pass

Ran /simplify (4 agents) — 0 applied, 1 deferred (filed EX-504), 3 skipped; each folded into ## Findings (tagged simplify).
Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.NTjXG6tqSH.md`

## Tests & suite

Fast legs (user chose "fast legs only"):

- typecheck (`tsc --noEmit`) — ✅ clean
- lint (`eslint`) — ✅ 0 errors (87 pre-existing warnings, none in the slice)
- unit (`pnpm test`) — ✅ 952 passed, 36 skipped
- integration (`pnpm test:integration`, 5435 DB) — ⏭ not run (container not up); the slice's 5 append specs are `skipIf(!ENV_READY)`. Signature change (investmentId now validated) is type-safe and the specs pass a valid positive id, so no expected breakage.
- e2e (`test:e2e`) — ⏭ deferred (filed EX-505)
- build — ⏭ not run (fast legs)

No new specs authored: fix-now items were all recorded `no automated test` (mechanical Zod guard / defensive `?? []` / UI state → manual check). /simplify's deferred dedup (EX-504) carries its test disposition into the issue.
