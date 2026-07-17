# Review-gate ledger — kosztorys-toolbar-view-menu (dogfooding follow-up) · 2026-07-16

Scope: uncommitted dogfooding iteration on the already-implemented Widok popover.
Removed the min-1 guard → `none` state on money/layer/progress axes; Etapy radio→checkbox
pair; section reorder (Kwoty → Warstwy → Etapy → Kolumny); tooltips stripped to Kolumny-only;
row glyph icons moved right; totals-bar latent bug fix (`none` no longer shows both totals).

Files (mine, by explicit path):

- src/lib/kosztorys/axis-checkboxes.ts, money-axis.ts, layer.ts, progress-display.ts
- src/components/kosztorys/use-money-axis.ts, use-layer.ts, use-progress-display.ts
- src/components/kosztorys/kosztorys-toolbar-options.tsx, kosztorys-view-menu.tsx, kosztorys-totals-bar.tsx
- src/**tests**/kosztorys-axis-checkboxes.test.ts, kosztorys-progress-display.test.ts

## Findings

- [x] 🔵 dismissed · code-review · `kosztorys-progress-counter.tsx:29` · under new `none` money axis the counter still renders netto figures — benign: separate summary surface, not an axis-filtered grid column; unchanged file, out of this slice's scope.
- [x] 🔵 dismissed · code-review · `kosztorys-totals-bar.tsx:31` · under `none` the bar renders empty (no content guard) — acceptable: hiding money columns implies hiding money totals; a thin empty bar is fine.
- [x] 🔵 dismissed · code-review · `kosztorys-view-menu.tsx` · `whitespace-pre-line` on KOLUMNY_HINT is inert (no newlines) — harmless/defensive, kept for symmetry with future multi-line hints.
- [x] 🟡 fixed · impl-review · `manual-checks.md:366-371` · live dogfooding gate still asserted the removed min-1 guard + Etapy-radio + old section order — rewrote all boxes to the shipped four-state model, added „Pokaż wszystkie" + tooltip-scope boxes (8 boxes now).
- [x] 🔵 fixed · impl-review · `change.md:23-29` · epilogue said "min-1-guarded mapper" — rewrote to describe the four-state follow-up.
- [x] 🔵 fixed · impl-review · `manual-checks.md:360` · intro said "tri-state mapper / axis semantics untouched" — updated to the four-state follow-up.
- [x] fixed · comment-noise · `kosztorys-toolbar-options.tsx:46,57,81,89,99` · stale „old Bez filtra" + config-restating comments — deleted; trimmed the progress-pair comment to its load-bearing "governs the stage-value block".
- [x] fixed · comment-noise · `kosztorys-view-menu.tsx:30-32` · comment said "Etapy is single-select (radio) … tri-state axes" — rewrote to the checkbox-pair/four-state reality.
- [x] fixed · comment-noise · `axis-checkboxes.ts:13-15` · trimmed the code-narrating first sentence, kept the "no min-one guard, empty table is legitimate" rationale.
- [x] no automated test · dismissed · verify · `use-hidden-columns.ts` `showAllColumns` · trivial sparse-map spread (id→false); sibling hooks (`toggleColumn`, widths) carry no unit either, and the meaningful risk (default-hidden override) is already exercised by `toggleColumn` — manual gate box covers the wiring.
      test: no automated test · unit — not worth the localStorage/useSyncExternalStore mock for a one-line merge.
- [x] fixed · verify · `money-axis.test.ts`, `layer.test.ts` · newly-reachable `none` state was untested — added a `none`-hides-both-sides case + extended the fail-open loop through `none` in both (mirrors progress-display).
      test: TDD · unit — added with the four-state change; 46 axis tests green.
- [x] fixed · simplify · `kosztorys-view-menu.tsx` · extracted the three near-identical checkbox-pair `.map` blocks into one generic `<AxisSection<T>>` helper — the three call sites now differ only by label/options/value/config/onChange. TSC clean, axis unit tests still green.

## Simplify pass

No `/simplify` slash-command run — the code-review + comment-noise fan-out already covered its reuse/simplification/altitude territory and surfaced nothing structural introduced by this diff. Only pre-existing finding: the view-menu pair-block triplication (logged above as `[ ] proposed`, not introduced here).

## Tests & suite

- unit (4 axis files): 46 passed.
- typecheck: clean (`tsc --noEmit`, 0 errors).
- full suite (lint / e2e / build): not run — dogfooding follow-up commit, user asked for review + commit, not archive.
