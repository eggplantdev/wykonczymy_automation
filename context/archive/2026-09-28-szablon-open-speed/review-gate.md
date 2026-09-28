# Review-gate ledger — szablon-open-speed · 2026-09-28

Scope: branch `szablon-open-speed` vs base `19310ba6` (branch point off `staging`), 29 files, no untracked.
Checks: 10x-impl-review, code-review, tailwind-v4-audit, feature-first-structure, module-cohesion-audit,
structure-scatter-audit (diff-scoped), comment-noise-audit (flag-only). Step 0.5 (browser verification
pass) skipped — no Playwright without an explicit go; the manual checks in `manual-checks.md` stay pending.

## Findings

- [x] 🟡 WARNING · dismissed · code-review · `src/components/presets/template-workshop.tsx:71` · Back/Forward onto a szablon page restores the cached `?open=1` render, the host remounts and runs the open again — a history traversal acts like a row click (evicts whatever the warsztat holds now) — dismissed by the owner 2026-09-28: with the szablon still held the open writes nothing, and otherwise the eviction mirrors the outgoing edits first, so a traversal equals clicking the row
      test: no automated test · — behaviour kept as designed
- [x] 🟡 WARNING · filed EX-893 · code-review · `src/lib/actions/investment-action.ts:84` · warsztat writes never carry the szablon the editor was opened for, so a stale warsztat editor's inserts land in whatever szablon is loaded now and the mirror copies them into that szablon's library — pre-existing; the two open-path findings below widen its reach — a gate change on every warsztat write, its own change
      test: TDD · integration — open A, someone opens C, an append-section write expecting A is refused and C's library row stays unchanged (recorded in EX-893)
- [x] 🟡 WARNING · filed EX-893 · code-review · `src/components/presets/template-workshop.tsx:52` · two opens from one tab can commit out of order (open A in flight, Back, open B on another instance) — the page renders B while the warsztat holds A; damage only through the finding above, so it is filed with it
      test: test-driven-debugging · integration — two out-of-order opens; pointer and last rendered szablon agree (travels with the issue above)
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/presets/template-workshop.tsx:53` · a rejected action (transport error) goes to the error boundary, not the prompt — identical in the deleted `useOpenPreset`, not introduced here
      test: no automated test · — transport-level, unchanged behaviour
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/kosztorys/open-preset-in-workshop.ts:51` · `held.id` never compared with the resolved warsztat id — only reachable in a first-ever provisioning race, and the warsztat already exists in every restored DB
      test: no automated test · — unreachable once provisioned
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/kosztorys/mirror-workshop-preset.ts:85` · an outgoing szablon with an unreadable schema version blocks every open — only after a schema rollback; fails loud and rolls back cleanly
      test: no automated test · — rollback-only edge
- [x] dismissed · structure-scatter · `src/components/presets/preset-open-href.ts` · first route-href builder under `components/` — feature-first judged it the presets feature's own route contract; the audits split and the move buys nothing
- [x] skipped · structure-scatter · `src/lib/kosztorys/` · 100-file flat directory, proposed `presets/` subdir for 9 files — predates this slice; a 9-file move is its own refactor, not this change's
- [x] dismissed · primitive-reuse-scan · `src/components/presets/template-workshop.tsx` · the one new UI surface composes existing primitives (`PageWrapper`, `PageLoading`, `OpenWorkshopPrompt`) — nothing hand-rolled
- [x] dismissed · comment-noise #12–15 · `template-workshop.tsx:29`, `preset-open-href.ts:1`, EX-597 call sites, `kosztorys-presets.test.ts:623` · each carries a why at its own site — kept
- [x] dismissed · module-cohesion · `kosztorys-presets.ts`, `tags.ts`, `mirror-workshop-preset.ts`, `preset-open-href.ts`, `template-workshop.tsx`, `data-table.tsx` · scanner export-count flags — one concern each
- [x] dismissed · module-cohesion · `src/components/presets/template-workshop.tsx:19` · „`ServerWorkshopT` export has no consumer" — the DOM spec imports it
- [x] dismissed · tailwind-v4-audit · — · no className added or changed

## Simplify pass

Ran inline (reuse / dedup / efficiency over the slice diff plus the review fixes) instead of the /simplify
skill — the 7-agent fan-out had already covered reuse, cohesion and scatter. 1 applied, 0 proposed;
folded into ## Findings (tagged `simplify`). primitive-reuse-scan: no findings.

## Tests & suite

- Unit + DOM, affected: `presets/`, `kosztorys/editor/dialogs/`, `cache/revalidate`, `actions/investment-action` — 13 files / 81 tests green
- DB integration, affected (5435): `kosztorys-presets`, `kosztorys/mirror-workshop-preset`, `replace-tree-concurrent`, `replace-tree-lost-write`, `kosztorys-restore` — 5 files / 30 tests green
- `tsc --noEmit`: clean apart from the 6 history-spec errors already on `staging`
- eslint on changed files: clean (1 pre-existing `incompatible-library` warning in `data-table.tsx`)
- Full suite: deferred by user (2026-09-28)
