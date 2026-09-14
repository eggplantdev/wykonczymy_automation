# Review-gate ledger — 2026-09-14-transfer-print-return · 2026-09-14

Diff under review: `staging...HEAD` (8ef79935, 952bf1f4, 9f746373, 126a6a74, 47a2c2ac).
Fan-out: `/10x-impl-review`, `/code-review`, `feature-first-structure` + `module-cohesion-audit` +
`structure-scatter-audit` (combined agent), `comment-noise-audit` (flag-only).
`tailwind-v4-audit` dropped — the diff adds no Tailwind beyond utilities already in use.
No Step 0.5 verification pass: this project has no `verify-manual-checks` skill installed.
No E2E obligation: the owner cancelled all E2E for this change („żadnego e2e").

## Findings

- [x] 🔴 CRITICAL · dismissed · `code-review` · `src/lib/actions/fetch-transfers-for-invoices.ts:21` · The action hard-ANDs `cancelled != true` + `type != CANCELLATION`, so the printout drops cancelled rows the screen is showing. **Not a bug — the owner's recorded decision** (`change.md`: „Anulowane i rekordy `CANCELLATION` — nieobecne na wydruku. Jak w oryginale", and manual check #5 says it explicitly). The reviewer read the code without the decision and inverted it; the fix was applied and then **reverted** on the owner's ruling (2026-09-14). The exclusion is unconditional again for both consumers, and the comment now states whose call it is so the next reviewer doesn't re-file it.
      Consequence accepted: in audit mode (`cancelledTransactionAudit=1`) the screen's `where` selects only cancellation rows, so the exclusion empties the set and the button answers „Brak transakcji do wydruku". That toast is the behaviour, not a failure.
      test: no automated test — the invariant is a product decision over an eight-line `where` composition; the manual print check is what asserts it.
- [x] 🟡 WARNING · skipped · `code-review` · `src/lib/transfers/sort-transfer-rows.ts:28` · The comparator uses `localeCompare(…,'pl')` while the screen uses TanStack's non-locale `alphanumeric`, so diacritics and embedded digits can order differently on paper. Deliberately kept: Polish collation is the correct order for a Polish financial printout, and aligning down to the screen's byte-ish sort would make both worse. The overstated „has to match what the reader is looking at" comment was trimmed to what the code actually guarantees.
      test: no automated test — the divergence is intended, so a spec would pin the wrong invariant.
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `src/lib/transfers/build-transfers-print-html.ts:21` · `white-space: pre-line` on every `td` rather than only the opis cell. Benign — every other `printValue` is single-line and `pre-line` collapses space runs like `normal`; the wider rule is the simpler shape.
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · repo root `.next-qa-gate/` said to break whole-tree `pnpm lint`. The directory does not exist in the tree; it was a transient build artifact of the reviewing agent's own run. Re-verified at suite time.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `src/components/transfers/transfer-table-config.ts:23` · Unpaginated-fetch blast radius. All three hosts are entity-anchored and `/raporty` was deliberately left out; the caveat comment already carries the warning for a fourth host.
- [x] 🔵 OBSERVATION · skipped · `impl-review` · `src/components/transfers/print-transfers-button.tsx:59` · `document.write` trips `@typescript-eslint/no-deprecated` (the diff's only warning). It is the only API that takes a whole document string including the doctype; the DOM-built alternative is more code for an advisory deprecation. Warning accepted deliberately.
- [x] 🔵 OBSERVATION · skipped · `code-review` · `transfer-data-table.tsx:73` · The printout's title is a hardcoded „Transakcje" — the paper doesn't say which kasa/inwestycja/pracownik or which filters produced it. Real, but it needs a product decision on what belongs in the header; not a review-gate call.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · Audit mode (`cancelledTransactionAudit=1`) splices cancellation originals in _outside_ `where` (`src/lib/queries/transfers.ts:96`). Moot once the exclusion stayed unconditional: neither the cancellation rows nor their originals reach the paper at all, which is the intended output.
- [x] 🔵 OBSERVATION · dropped · `code-review` · `print-transfers-button.tsx:45` · Print sorts the whole filtered set while the screen sorts only the current page, so paper is a superset. That is the feature's intent (unpaginated by design); only the overstating comment needed fixing, which it got.
- [x] · skipped · `structure-scatter` · `src/components/ui/column-toggle-menu.tsx:19` · `ColumnToggleItemT` is exported from a component file and imported by three kosztorys modules that never render that component. Pre-existing; the type is still legitimately the menu's contract (those modules build items _for_ a picker of this shape), and moving it churns files this slice never touched.
- [x] · dropped · `structure-scatter` · `column-toggle-menu.tsx:36` vs `kosztorys-view-menu.tsx:174` · The show/hide-all label+icon pair now exists twice. A helper returning `{label, Icon}` would be the same size as the expression it replaces — no win; revisit if a third picker appears.
- [x] · skipped · `feature-first` · `src/lib/actions/fetch-transfers-for-invoices.ts` · A read invoked on demand by a client component belongs in `src/lib/queries`, not `src/lib/actions` (AGENTS.md). Pre-existing misplacement; the move is also a rename (the file no longer serves only invoices) across two consumers — worth doing, but as its own change, not folded into a print restore.
- [x] · dismissed · `cohesion` · `src/components/ui/column-toggle-menu.tsx` flagged for exporting a non-component symbol — `ColumnToggleItemT` is the component's own contract type, which the project's own rule counts as one kind.
- [x] · dismissed · `comment-noise` · Five flagged comments (`transfers.tsx:27`, `column-meta.ts:14`, `sort-transfer-rows.ts:14`, `transfer-row.ts:3`, `column-toggle-menu.tsx:15`) reviewed and kept — each carries a constraint, a negative-space contract, or a cross-boundary why that the code cannot say.

_Przycięte przy archiwizacji (2026-09-14): usunięto findingi `fixed` wraz z ich linijkami
`test:` — trwałym zapisem naprawionego findingu jest commit, a to, czego git nie utrzyma, to
negatywna przestrzeń: co uznano za nieszkodliwe, co odrzucono i dlaczego. Tally sprzed cięcia:
**12 fixed, 10 dismissed, 5 skipped, 2 dropped · 0 open**._

## Simplify pass

`/simplify` is a built-in slash command and cannot be self-invoked from inside this gate, so the
equivalent mutating pass was run by hand against the triage, plus the `primitive-reuse-scan` skill
(agent, read-only, folded in below). 12 fixed, 0 proposed/held back, 10 dismissed, 5 skipped/dropped —
every one of them a checkbox in `## Findings` above.

Reuse-scan additions, both fixed in this pass:

- [x] · dismissed · `reuse-scan` · No live equivalent of the deleted `src/lib/export/print-iframe.ts` exists; the only other print flow (`invoice-preview-dialog.tsx:63`) is DOM-built with a load-counting barrier and overlaps in about four lines. A shared `openPrintWindow` would not pay for itself.
- [x] · dismissed · `reuse-scan` · `sort-transfer-rows.ts` vs `src/lib/kosztorys/row-view.ts:44` — single-key vs multi-key, and kosztorys deliberately sinks nulls under both directions. Unifying would change kosztorys ordering. Not a dedup.
- [x] · dismissed · `reuse-scan` · The new code correctly consumes every existing primitive it needs: `formatPLN`, `TRANSFER_TYPE_LABELS`, `SETTLED_TYPE`, `billsNetAmount`, `escapeHtml`, `toastMessage`, and the one `transferRow()` fixture.

## Tests & suite

Authored in this gate: `src/__tests__/lib/transfers/transfer-text.test.ts` (6, direct — no component
graph, so no live SMTP socket), `src/__tests__/components/tables/transfers-sortable-columns.test.ts`
(16, the alias guard), plus the vacuous-assertion fix in `transfers-print-value.test.ts`.

- `pnpm typecheck` — ✅ clean
- `pnpm lint` — ✅ 0 errors, 83 warnings (unchanged baseline; one of them is the deliberately accepted `document.write` deprecation). The `.next-qa-gate/` breakage a reviewer reported does not reproduce — the directory is not in the tree.
- `pnpm test` — ✅ 3343 passed / 268 skipped (was 3319 before this gate)
- `pnpm build` — ✅ clean
- `pnpm test:e2e` — not run: the owner cancelled all E2E for this change („żadnego e2e"). No E2E is owed and none is filed.
