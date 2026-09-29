# Review-gate ledger — filtry-problemy (whole branch vs `staging`) · 2026-08-17

Trimmed 2026-09-29 to the two findings that still carry a reason git and the code don't hold. Fixed,
dropped and dismissed findings were cut; their fixes live in the branch's commits.

## Findings

- [ ] skipped · code-review · `src/lib/kosztorys/row-conditions/queries.ts` (`countMatching`, surfaced to the
      editor as `conditionCounts`; the ledger originally named `row-conditions.ts`) · the counts run one full pass per condition on every
      keystroke — at 1000+ pozycje that is thousands of predicate calls per edit. Re-raised and
      re-skipped at the `kosztorys-filters-visible-and-extended` gate (2026-08-18), where the registry
      grew six more entries. **Still unfiled** (Linear was at its free-issue cap at the time; still no
      issue as of 2026-09-29). Direction: one pass over the pozycje with the registry loop inside,
      accumulating `id → count`, which reshapes `countMatching` and its spec. Measure before/after on
      the perf dataset (`INV=7 … perf-seed-kosztorys.ts`) — this is the path EX-496 was reverted over.
- [x] skipped · simplify · `row-conditions/registry.ts` · a factory generating the price conditions
      per plane would turn the literal ids into template strings; the ids are the one thing in this
      feature grepped from several places (and persisted, unversioned, in localStorage). Keep them
      literal.
