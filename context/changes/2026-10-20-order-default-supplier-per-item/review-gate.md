# Review-gate ledger — order-default-supplier-per-item · 2026-10-20

Scope: uncommitted working tree on `staging` against `HEAD` (`ae2ab8208`) — 13 modified files plus the
new migration `20261020_0_order_default_supplier_per_item.ts` and this change folder. Step 0.5 (browser
verification) skipped: no browser pass unless asked.

## Findings

- [x] 🟡 WARNING · fixed · impl-review + code-review · `src/components/orders/order-pick-step.tsx:76` · a
      default changed from the gear while the order dialog is open left the old supplier picked and the
      „Dostawca domyślny” button seeded with the old id — supplier now follows the default (`useDraft`),
      button keyed on `kind:defaultSupplierId`
      test: TDD · unit — `order-dialog.test.tsx` „takes a default supplier saved from the gear” (written
      alongside the fix; red not observed separately)
- [x] 🔵 OBSERVATION · skipped · code-review · `src/lib/actions/order-settings.ts:18` · an owner save
      overwrites a default a MANAGER starred while the settings form was open — last-write-wins already
      governs suppliers and prices in the same global; a „send only what changed” fix needs a keep/clear
      tri-state on the server for ~5 management accounts
      test: no automated test — behaviour unchanged by design
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/actions/order-settings.ts:24` · `keptDefault(undefined)`
      matched an id-less (new) supplier row and returned `undefined`, so Payload kept the stale default —
      guarded with `supplierId &&`
      test: no automated test — unreachable from the form (it always sends ids); „clears a default left
      unset” covers the path
- [x] 🔵 OBSERVATION · fixed · impl-review · `plan.md` Progress 2.1 / no manual-checks section — section
      `2026-10-20 — order-default-supplier-per-item` added to `context/foundation/manual-checks.md`; 2.1
      ticks with the suite
- [x] fixed · simplify · `src/components/orders/order-pick-step.tsx:76` · price and supplier prop→state
      sync hand-rolled `useDraft` (`src/hooks/use-draft.ts`) — both now `useDraft`, `handleKindChange`
      keeps its setters (two kinds can share a default)
- [x] skipped · simplify (altitude) · `src/components/orders/order-pick-step.tsx:76` · derive the pick from
      a `{basis, id}` override instead of syncing — a new mechanic beside the repo's `useDraft`, which
      already covers it
- [x] dropped · code-review + simplify · `src/components/forms/order-settings-form/order-settings-form.tsx:95`
      · two near-identical default-supplier selects — labels differ by Polish case („big bag” /
      „kontenera”), the price inputs beside them aren't mapped either; a label map would not be shorter
- [x] dismissed · simplify (reuse) · `order-settings-form.tsx:29` · `chosenSupplier` / „— brak —” option
      as a third copy of the SELECT_NONE mapping — two one-liners with different shapes per call site
- [x] fixed · comment-noise · `order-settings-form.tsx:66` · comment restating `shownSupplier` — deleted
- [x] fixed · comment-noise · `src/migrations/20261020_0_order_default_supplier_per_item.ts:4` · business
      reason + restatement of the `UPDATE` — deleted
- [x] fixed · comment-noise · `src/globals/order-settings.ts:28` · „a save that drops row ids leaves them
      pointing at nothing” — no longer true, the save nulls a missing id — deleted
- [x] dismissed · module-cohesion-audit / structure-scatter-audit / feature-first-structure /
      tailwind-v4-audit · no findings on this diff (scanner hits were on pre-existing files)

## Simplify pass

Ran /simplify (reuse, simplification, efficiency, altitude) — 1 applied, 1 skipped, 1 dropped, 1
dismissed; efficiency and simplification came back clean. Each finding folded into ## Findings (tagged
simplify).

## Tests & suite

- `pnpm typecheck` — clean
- `eslint` on the 14 touched files — clean
- `vitest` order-dialog / order-settings-form / investments specs — 31/31 passed
- `order-settings.db.test.ts` against `db-test` (5435) — 10/10 passed
- Full suite / e2e / build — not run (user approved the touched legs only)
