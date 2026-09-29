# Review-gate ledger — 2026-09-29-redundant-router-refresh (EX-908) · 2026-09-29

Scope: `66bbd9b2...HEAD` on `redundant-router-refresh` (41 files, +108 / −169, no untracked files).
Checks: `/10x-impl-review`, `/code-review`, `comment-noise-audit` (flag-only). Dropped: `tailwind-v4-audit`
(no class changes), the three file-organization audits (no new files; one exported type added to an
existing module). The verification pass runs after this review, per the user's order.

## Findings

- [x] 🟡 WARNING · skipped · impl-review · manual checks · the tree-replacing paths (reload from szablon, clear, version restore, the offline catch) have no evidence after the latch fix, and the large-kosztorys etap edit was never measured — all of them are boxes in the staging list, `context/foundation/manual-checks.md` § EX-908; re-verified there, not locally
- [x] 🔵 OBSERVATION · dropped · impl-review + code-review · `kosztorys-editor-v2.tsx:55` · a structural write (add/remove row) committing between the click and the replacing action's render fires the latch on the wrong tree — needs a row add inside one ~100 ms round trip of „Popraw literówki" (the modal dialogs block the grid); the robust fix (actions return the new revision) reshapes four action results
- [x] 🔵 OBSERVATION · dropped · code-review · `kosztorys-editor-v2.tsx:30` · the token `revision:sections:items` collides when another tab deletes one row and adds one (item add/remove don't bump `investments.updated_at`) — pre-existing, needs two tabs editing the same kosztorys in opposite directions before the stale edit
- [x] 🔵 OBSERVATION · dismissed · impl-review · `use-restore-remount.ts:34` · a latch that never fires stays armed until the next unrelated token change — pre-existing; the catch path's refetch and a restore both move `revision`, so it needs a restore with equal counts AND no revision bump
- [x] 🔵 OBSERVATION · dismissed · impl-review · `kosztorys-editor-v2.tsx:42` · reseed runs before `router.refresh()`, where the plan's contract lists refresh second — the refresh is async, no render lands between; arming first is the part that matters
- [x] 🔵 OBSERVATION · dismissed · impl-review · `context/foundation/test-plan.md` · whole table re-padded by prettier — formatter output
- [x] dropped · comment-noise-audit · `use-kosztorys-editor-context.tsx:20`, `kosztorys-versions-drawer.tsx:18` · proposed deletes — each says when the callback fires (after a swap / only on success), which the name alone doesn't
- [x] dismissed · feature-first-structure + module-cohesion-audit + structure-scatter-audit · 0 findings — no new file or home; `OnTreeReplacedT` colocates with its context, as the editor's contract types do; the two large modules predate the branch (EX-521/EX-515)
- [x] dismissed · tailwind-v4-audit · 0 findings — no class changes
- [x] dismissed · simplify · round-2 edits — reuse / simplification / efficiency / altitude reviewed inline (one ~30-line hook diff, no agent fan-out): `seededFrom` is not derivable (token at the last remount), nothing else new

- [x] 🔵 OBSERVATION · dismissed · code-review · `e2e/kosztorys-grid-writes.spec.ts:135` · zero margin on the ceiling `≤ typed.length` — intentional: one GET per stage autosave is the floor, and anything above it is exactly the stacked refresh this assertion guards against
- [x] 🔵 OBSERVATION · filed EX-934 · code-review · `src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx:44`, `actions/clean-item-texts-action.tsx:27`, `actions/sheet-compare-action.tsx` · a thrown action has no try/catch or refetch there (the drawer leaves `restoringId` stuck) — pre-existing: EX-908 did not touch these throw paths, and they did not refresh before it either. Another session is currently wrapping the drawer in `settleAction` in the main tree, so a fix here would collide with it
      test: no automated test · — pre-existing, not regressed by this change
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx:19` · `onRestored` stays typed `() => void` rather than `OnTreeReplacedT` — the drawer never passes `refetch`, so the narrow type is the true one
- [x] dismissed · code-review + simplify · `clear-kosztorys-dialog.tsx:24`, `reload-from-preset-dialog.tsx:82`, `sheet-import-dialog.tsx:83` · dedup of the try/catch/`refetch` into a shared helper — its parameters (action, two messages, close, callback) would equal the code
- [x] skipped · simplify · `kosztorys-editor-v2.tsx` · (altitude) put `handleStaleTree` into the context and have the catch branches call it instead of `refetch` — the user's ruling in the plan: "flaga tylko z catch"; `refreshDataAction` is also a heavier server action that can throw just as easily after a transport rejection
- [x] filed EX-935 · simplify · `src/components/kosztorys/editor/use-kosztorys-editor.ts:748` · undo/redo sends N writes = N renders; a batch reversal action would give 1 — a refactor outside EX-908 (it already improved from N+1)
- [x] dropped · simplify · `e2e/kosztorys-grid-writes.spec.ts:62` · `countRouteRefreshes` vs "refetch" in the comments — a cosmetic rename, not worth the churn
- [x] dismissed · simplify · `src/components/forms/form-fields/save-default-register-button.tsx` · `savedId` might be derivable from the prop — depends on whether the `['users']` revalidation re-renders the reference data; unconfirmed, and it would change behaviour
- [x] skipped · suite · `src/__tests__/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.test.tsx` · 3/3 red on the base and on staging (the context mock lacks `sections`, which `KosztorysAddMenu` reads) — pre-existing, reported to the user; `kosztorys-workers-menu.test.tsx` "read-only for a manager" is red since `0f664eec` — same
      test: no automated test · — failure outside this change
- [x] skipped · simplify · merge risk · the main tree has another session's `src/lib/utils/settle-action.ts` (untracked) wrapping `linked-sheet-actions`, `delete-forever-dialog`, `trash-investment-button` and the versions drawer — the same files as EX-908; if it wraps the three tree-replacing dialogs, the "threw → refetch" signal disappears. Flag it at the merge into staging

## Round 2 — full fan-out (2026-09-29, `66bbd9b2...5c30cfc3`)

Checks: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (flag-only); then `/simplify` +
`primitive-reuse-scan`. Verification pass not re-run (25 checks passed after round 1).

## Simplify pass

Round 1: ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 6 applied, 0 proposed, 6 dismissed/dropped/skipped. Round 2: inline on the round-2 edits — 0 applied. Each folded into ## Findings (tagged simplify).

## Tests & suite

- `pnpm typecheck` — clean.
- `eslint` + `prettier --check` on the changed files — clean.
- 20 touched/affected specs (`gate2.txt` in the scratchpad) — 20/20 files, 98/98 tests green. The toolbar spec is excluded (pre-existing red, see above).
- Full `pnpm test` / `test:e2e` — not run (the user did not ask).
- After the latch fix: `use-restore-remount.test.tsx` + `use-kosztorys-catalogue-problems.test.tsx` 9/9 green; `pnpm typecheck`, `eslint` and `prettier --check` on the changed files clean.
- Round 2: tests skipped by the user („olej testy") — no spec written or run; `eslint` + `prettier --check` on the changed files clean.
