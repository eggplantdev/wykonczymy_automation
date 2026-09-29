# Review-gate ledger — kosztorys-empty-section · 2026-09-29

Scope: commits `5bbc2499` (p1), `1edb9aa0` (p2), `2cee8858` (p3), `0f293091` (p4) on `staging`.
The range `5bbc2499^..HEAD` interleaves 21 other agents' commits, so the reviewed diff is the union of
these four, not the range diff. Step 0.5 (browser verification pass) skipped — manual checks live in
`context/foundation/manual-checks.md`.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit` (0 findings), file organisation
(`feature-first-structure` + `module-cohesion-audit` + `structure-scatter-audit`), `comment-noise-audit`
(flag-only).

## Findings

- [x] 🔵 OBSERVATION · skipped · code-review · `src/components/kosztorys/editor/use-kosztorys-editor.ts` (section swap rollback) · undoing a swap after the neighbouring section was deleted re-derives the current neighbour — predates this slice (impl-review confirms), rare, behaviour-changing to alter
      test: no automated test · — not changed here
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/kosztorys/editor/kosztorys-editor-body.tsx:560` · an itemless section under a search shows „Brak wyników" — correct: the section has no pozycja to match
      test: no automated test · — intended behaviour
- [x] 🔵 OBSERVATION · dismissed · impl-review F3 · `e2e/kosztorys-structure.spec.ts` · most planned E2E edits not made — none of the listed specs depended on the seeded first pozycja or the cascade; plan line refs were stale
      test: no automated test · — nothing broke
- [x] 🔵 OBSERVATION · dismissed · impl-review F4 · `src/__tests__/lib/kosztorys/work-catalogue/section-target.test.ts` · no dedicated „itemless name resolves" case — a `SectionMetaT` carries no pozycje, so the existing „matches an existing sekcja" case already is that assertion; the host passing `subtotals` is caught by the type at `catalogue-picker-host.tsx:40`
      test: no automated test · — covered by the existing case + tsc
- [x] 🔵 OBSERVATION · dismissed · impl-review F6 · `plan.md` wording vs `kosztorys-editor-v2.tsx:30` · plan overstates „reseeds the editor"; the code comment is accurate — the plan is a one-off doc, archived with the change
      test: no automated test · — doc wording
- [x] 🔵 OBSERVATION · dropped · impl-review F5 · `src/components/kosztorys/editor/use-kosztorys-editor.ts:539` · `onAddItem` defined outside `columnOpts` — identical behaviour under the React Compiler, churn for nothing
- [x] dismissed · code-review · `src/components/kosztorys/editor/grid/menus/kosztorys-section-actions-menu.tsx:108` · „Not gated by the sort" — still true for „Dodaj pracę"
- [x] dropped · file-organisation · `src/components/kosztorys/editor/use-kosztorys-editor.ts:193` · move `sections` state into a leaf hook — bound to the row store (EX-702 / EX-496 rationale in place)
- [x] dropped · file-organisation · add-menu orchestration → `handleAddFirstItem` — one caller, no win
- [x] dismissed · file-organisation · `src/lib/kosztorys/row-ops.ts` · `catalogueSlicePlacement` stays in `row-ops` — it is a row op
- [x] dismissed · comment-noise · `src/lib/kosztorys/section-band-rows.ts:15` · `showItemless` comment carries the only „why" for hiding it in client outputs — kept

Not verified by any reviewer (no finding, noted for the manual pass): sheet sync / reconcile / import
with an itemless section, the versions-drawer row diff, `reload-from-preset`.

## Simplify pass

Applied in the main thread against the triaged findings, not a separate `/simplify` run: the fan-out
already covered reuse/efficiency/altitude (file-organisation + code-review) with no reuse candidate
left, so the mutating pass was the 11 comment-noise edits + the `:536` comment. `primitive-reuse-scan`
not run (no new UI primitive in the diff). Every finding is folded into `## Findings` above.

## Tests & suite

- `tsc --noEmit` — green
- `eslint` + `prettier` on the gate's touched files — green (whole-repo `pnpm lint` OOM-killed earlier;
  the change's 34 files lint green)
- Single spec files (unlocked, per AGENTS.md): `use-kosztorys-itemless-sections`, `section-band-rows`,
  `section-target`, `section-header-cell` — 43/43 green; the 3 new regression cases each proven red on
  the pre-fix code
- `pnpm test`, `pnpm test:integration`, `pnpm build` — **deferred by user** („tylko bez testów")
- E2E: the slice's browser flow has an authored spec (`e2e/kosztorys-structure.spec.ts`, bare section →
  „Dodaj pracę" → delete last pozycja → bare band) — authored, not executed

## Archive gate

0 open findings. **Not archived:** the 7 manual checks in `context/foundation/manual-checks.md`
(„kosztorys-empty-section — sekcja bez pozycji") are unticked → slice stays **in review**. No Linear
issue and no roadmap entry for this change.
