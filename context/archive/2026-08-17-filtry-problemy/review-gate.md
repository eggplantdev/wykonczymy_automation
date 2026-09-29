# Review-gate ledger — filtry-problemy (whole branch vs `staging`) · 2026-08-17

Trimmed 2026-09-29 to the two findings that still carry a reason git and the code don't hold. Fixed,
dropped and dismissed findings were cut; their fixes live in the branch's commits.

## Findings

- [x] fixed EX-768 (`e3708d09`, 2026-09-02) · code-review · `src/lib/kosztorys/row-conditions/queries.ts`
      (`countMatching`, surfaced to the editor as `conditionCounts`) · the counts run one full pass per
      condition on every committed keystroke. The proposed fix — one pass with the registry loop
      inside — was measured and gains nothing: predicate calls stay N × C, and the cost sat in six
      conditions each re-summing the pomiar. Fixed by computing it once per pozycja (`qtyDoneByRow`):
      3.82 → 1.51 ms median at 1000 pozycje. Do not re-file the loop fusion (EX-899 was, and was
      canceled as a duplicate).
- [x] skipped · simplify · `row-conditions/registry.ts` · a factory generating the price conditions
      per plane would turn the literal ids into template strings; the ids are the one thing in this
      feature grepped from several places (and persisted, unversioned, in localStorage). Keep them
      literal.
