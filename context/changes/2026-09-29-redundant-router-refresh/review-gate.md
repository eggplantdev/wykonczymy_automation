# Review-gate ledger — 2026-09-29-redundant-router-refresh (EX-908) · 2026-09-29

Scope: `66bbd9b2...HEAD` on `redundant-router-refresh` (41 files, +108 / −169, no untracked files).
Checks: `/10x-impl-review`, `/code-review`, `comment-noise-audit` (flag-only). Dropped: `tailwind-v4-audit`
(no class changes), the three file-organization audits (no new files; one exported type added to an
existing module). The verification pass runs after this review, per the user's order.

## Findings

- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/editor/hooks/use-restore-remount.ts:40` · round 2: stale tree still stuck in the common case — any ordinary write in tab 1 renders the route after tab 2's delete, so the token already carries the change while the mount-seeded rows don't; `handleStaleTree` armed from that token and never remounted (the toast repeated on every edit). Same for the catalogue picker's `'reseed'` placement after a successful insert. The no-argument arm now defaults to the token the body was seeded from (`seededFrom`, reset on each remount), so it remounts at once when the tree already moved; the render-phase ref write is gone with it
      test: test-driven-debugging · unit — owed, NOT authored: the user said to skip tests in this gate („olej testy"). The spec is one case in `use-restore-remount.test.tsx`: rerender `rev-1 → rev-2`, `triggerRestore()` with no argument, expect `remountKey === 1`
- [x] 🟡 WARNING · skipped · impl-review · manual checks · the tree-replacing paths (reload from szablon, clear, version restore, the offline catch) have no evidence after the latch fix, and the large-kosztorys etap edit was never measured — all of them are boxes in the staging list, `context/foundation/manual-checks.md` § EX-908; re-verified there, not locally
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `use-restore-remount.ts:33` · a ref written during render could hold a token from an interrupted transition — removed with the seeded-token fix above
- [x] 🔵 OBSERVATION · dropped · impl-review + code-review · `kosztorys-editor-v2.tsx:55` · a structural write (add/remove row) committing between the click and the replacing action's render fires the latch on the wrong tree — needs a row add inside one ~100 ms round trip of „Popraw literówki" (the modal dialogs block the grid); the robust fix (actions return the new revision) reshapes four action results
- [x] 🔵 OBSERVATION · dropped · code-review · `kosztorys-editor-v2.tsx:30` · the token `revision:sections:items` collides when another tab deletes one row and adds one (item add/remove don't bump `investments.updated_at`) — pre-existing, needs two tabs editing the same kosztorys in opposite directions before the stale edit
- [x] 🔵 OBSERVATION · dismissed · impl-review · `use-restore-remount.ts:34` · a latch that never fires stays armed until the next unrelated token change — pre-existing; the catch path's refetch and a restore both move `revision`, so it needs a restore with equal counts AND no revision bump
- [x] 🔵 OBSERVATION · dismissed · impl-review · `kosztorys-editor-v2.tsx:42` · reseed runs before `router.refresh()`, where the plan's contract lists refresh second — the refresh is async, no render lands between; arming first is the part that matters
- [x] 🔵 OBSERVATION · dismissed · impl-review · `context/foundation/test-plan.md` · whole table re-padded by prettier — formatter output
- [x] fixed · impl-review · `work-catalogue-data-table.test.tsx:9`, `fleet-data-table.test.tsx:12`, `kosztorys-editor-body-history.test.tsx:14`, `add-items-from-catalogue-dialog.test.tsx:34` · dead `refresh` keys in the `next/navigation` mocks — dropped; the only `router.refresh()` left in `src` is in `kosztorys-editor-v2.tsx`, which none of them renders. Whether the last two mocks are dead as a whole was not checked (needs the specs run)
- [x] fixed · comment-noise-audit · `e2e/support/wait.ts:34,73-77`, `e2e/invoice-ingest.spec.ts:169`, `use-kosztorys-editor.ts:1151` · comments still naming `router.refresh()` / "refresh" as a write's render — reworded to "render" / "refetch"
- [x] fixed · comment-noise-audit · `use-restore-remount.test.tsx:36` · comment restated the test title — deleted
- [x] fixed · comment-noise-audit · `kosztorys-editor-v2.tsx:52` · narration sentence cut, the race rationale kept
- [x] dropped · comment-noise-audit · `use-kosztorys-editor-context.tsx:20`, `kosztorys-versions-drawer.tsx:18` · proposed deletes — each says when the callback fires (after a swap / only on success), which the name alone doesn't
- [x] dismissed · feature-first-structure + module-cohesion-audit + structure-scatter-audit · 0 findings — no new file or home; `OnTreeReplacedT` colocates with its context, as the editor's contract types do; the two large modules predate the branch (EX-521/EX-515)
- [x] dismissed · tailwind-v4-audit · 0 findings — no class changes
- [x] dismissed · simplify · round-2 edits — reuse / simplification / efficiency / altitude reviewed inline (one ~30-line hook diff, no agent fan-out): `seededFrom` is not derivable (token at the last remount), nothing else new

- [x] 🟡 WARNING · fixed · verify · `src/components/kosztorys/editor/hooks/use-restore-remount.ts:34` · CONFIRMED in the browser pass: „Popraw literówki" left the typo on screen in 3/24 runs, because the action's render committed before `.then` armed the latch, which then waited for a change that had already happened. The latch now arms from the token the action started from (`reseed(treeToken)`), so it also fires on a change that already landed. After the fix: 14/14 live
      test: test-driven-debugging · unit — `use-restore-remount.test.tsx` „remounts when the fresh tree landed before it was armed", red → green
- [x] 🟡 WARNING · fixed · verify · `src/components/kosztorys/editor/kosztorys-editor-v2.tsx:66` · stale tree (delete a row in tab 2, edit it in tab 1): tab 1 never remounted. The same latch fix, with `handleStaleTree` arming from the token on screen: 4/4 remount without the row (383/384/391). Most likely the same ordering race; not proven pre-existing, because no build of the base was measured
      test: test-driven-debugging · unit — covered by the same latch spec; browser-level guard in the EX-924 backlog
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/changes/2026-09-29-redundant-router-refresh/plan.md` · EX-924 missing from Progress — recorded under Phase 4 with 4.1/4.2
- [x] 🟡 WARNING · fixed · impl-review · `src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.test.tsx:15` · orphan comment about the router mock — deleted; plus the unused `vi` in `trash-contents.test.tsx:2` and a double blank line in `catalogue-compare-dialog.test.tsx` (prettier)
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/kosztorys/types.ts:139`, `src/components/ui/decimal-field.tsx:48` · comments still named `router.refresh` — now "every render" / "a render brings a new one"
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `e2e/kosztorys-grid-writes.spec.ts:106,129,61` · the title "refreshes once, not once per cell" contradicted the `≤ typed.length` ceiling, and the comment conflated `EXPIRE_NEXT` with `after()` — retitled to "at most once per cell", rationale rewritten (floor = ceiling), comment reflowed
- [x] 🔵 OBSERVATION · dismissed · code-review · `e2e/kosztorys-grid-writes.spec.ts:135` · zero margin on the ceiling `≤ typed.length` — intentional: one GET per stage autosave is the floor, and anything above it is exactly the stacked refresh this assertion guards against
- [x] 🔵 OBSERVATION · filed EX-934 · code-review · `src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx:44`, `actions/clean-item-texts-action.tsx:27`, `actions/sheet-compare-action.tsx` · a thrown action has no try/catch or refetch there (the drawer leaves `restoringId` stuck) — pre-existing: EX-908 did not touch these throw paths, and they did not refresh before it either. Another session is currently wrapping the drawer in `settleAction` in the main tree, so a fix here would collide with it
      test: no automated test · — pre-existing, not regressed by this change
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx:19` · `onRestored` stays typed `() => void` rather than `OnTreeReplacedT` — the drawer never passes `refetch`, so the narrow type is the true one
- [x] fixed · code-review · `src/components/kosztorys/editor/kosztorys-editor-v2.tsx:44` · inline `{ refetch?: boolean }` duplicated `OnTreeReplacedT` — the handler is now typed `OnTreeReplacedT`
- [x] fixed · code-review · `context/foundation/test-plan.md:85` · risk #16 said "no RSC GET", which is false for a deferred autosave — added the carve-out (empty POST + exactly one GET)
- [x] fixed · code-review · `kosztorys-versions-drawer.tsx:18`, `e2e/transfer-create.spec.ts:7,19`, `e2e/drivers/kosztorys-grid.ts:159` · stale comments naming `router.refresh` as the render — reworded to the action's render / the route refetch
- [x] fixed · comment-noise-audit · `src/components/kosztorys/editor/hooks/use-restore-remount.ts:10` · the comment said to arm the latch once the action resolved, but `handleStaleTree` arms it before — now "arm it before the fresh tree commits"
- [x] fixed · comment-noise-audit · `kosztorys-editor-v2.tsx:42`, `use-kosztorys-editor-context.tsx:20` · the caller list was incomplete (it missed clean-item-texts and sheet-compare) — removed, along with the `refetch` rationale repeated from the type
- [x] fixed · comment-noise-audit · `src/components/kosztorys/editor/use-kosztorys-editor.ts:745`, `hooks/use-kosztorys-settings.ts:93,283` · convoluted phrasing, and "refresh" where the code means "render" — simplified
- [x] dismissed · code-review + simplify · `clear-kosztorys-dialog.tsx:24`, `reload-from-preset-dialog.tsx:82`, `sheet-import-dialog.tsx:83` · dedup of the try/catch/`refetch` into a shared helper — its parameters (action, two messages, close, callback) would equal the code
- [x] fixed · simplify · `src/components/kosztorys/editor/kosztorys-editor-v2.tsx:59` · `handleStaleTree` repeated the reseed triple (`triggerRestore`/`reset`/`skipNext`) — it now calls `handleTreeReplaced()` + `refreshDataAction()`
- [x] skipped · simplify · `kosztorys-editor-v2.tsx` · (altitude) put `handleStaleTree` into the context and have the catch branches call it instead of `refetch` — the user's ruling in the plan: "flaga tylko z catch"; `refreshDataAction` is also a heavier server action that can throw just as easily after a transport rejection
- [x] fixed · simplify · `src/__tests__/components/forms/inspection-form/inspection-form.test.tsx:15`, `leads/promote-lead-dialog.test.tsx:9`, `leads/lead-assets-dialog.test.tsx:9`, `investments/investment-assets-control.test.tsx:7` · dead `next/navigation` mocks (the first two were left as `usePathname`-only, the last two were dead before this change) — deleted; the specs are green
- [x] fixed · simplify · `e2e/kosztorys-grid-writes.spec.ts:129` · "an autosave carries no render" is true only for the stage write (raw SQL); field writes render inside the POST (EX-850) — narrowed to "a stage-quantity autosave"
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
