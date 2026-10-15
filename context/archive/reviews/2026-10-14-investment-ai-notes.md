# Review-gate ledger — investment-ai-notes (1a03c8bd8 + 429ef8395) · 2026-10-14

Scope: `1a03c8bd8^..429ef8395` on `main` (24 files, +101/−41). No 10x change folder, no plan.md →
`/10x-impl-review` dropped out. Diff ~100 lines of product code, so the review ran inline in the
main thread instead of a subagent fan-out (proportional effort).

_Trimmed at archive (2026-10-15): 3 of 10 findings were `fixed` and are removed — their record is the commit. What remains is what the gate chose not to act on. Pre-trim tally: 3 fixed, 4 dismissed, 3 dropped, 0 open._

## Findings

- [x] 🔵 OBSERVATION · dismissed · code-review · `src/collections/investments.ts:94` · „read-only” is UI-only: any MANAGER+ can PATCH `aiNotes` over REST — intended, the script writes through exactly that path with a user token; the Payload panel is unused
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/actions/investments.ts:174` · `updateInvestmentAction` / „Edytuj notatkę” could wipe `aiNotes` — verified: `payload.update` is partial and the form schema has no `aiNotes`, so it survives every edit
- [x] 🔵 OBSERVATION · dismissed · code-review · `fill-case-prod.ts:257` · the REST PATCH bypasses `DRY=1` — verified: `if (DRY) return` (line 162) exits before it; `api` throws on non-2xx
- [x] dropped · test-coverage · `src/components/investments/investment-ai-notes.tsx` · no DOM spec for „empty → no section” — the three manual checks cover it; a spec would assert one `if`
- [x] dropped · simplify · `investment-ai-notes.tsx` · repeats `CollapsibleSection` props from `InvestmentNotes` (size / withSeparator / className) — four literals, extracting them costs more than it saves
- [x] dropped · simplify · `change.md` step 7 · file is still called `investment-notes-appendix.txt` — renaming it across every `cases/*` dir is churn for a throwaway experiment
- [x] dismissed · comment-noise · `investments.ts:91`, `adopt-case-prod.ts:79`, `fill-case-prod.ts:256` · all three state a why (who writes it, why a rerun overwrites, why the whole of Notatki) — keep

## Simplify pass

Inline pass on the ~100-line diff — 1 applied, 0 proposed, 3 dropped/dismissed; each folded into ## Findings (tagged simplify).

## Tests & suite

Not run — tests/typecheck need an explicit go (hook). Pre-push runs typecheck + unit + integration.
