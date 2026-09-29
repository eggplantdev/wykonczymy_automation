# Review-gate ledger — marza-prognoza-rzeczywista (EX-649) · 2026-08-18

Trimmed 2026-09-29 to what is still open. Linear was at its free-issue limit during the gate; all were
re-checked against the code and filed on 2026-09-29 (EX-900…EX-906). Fixed, dropped and resolved findings were cut; the
`summary-margin-tab.tsx` split was done since (`tabs/margin-actual-table.tsx` /
`tabs/margin-forecast-table.tsx`).

## Findings

- [x] filed EX-900 · gate-step-3 · browser-level E2E for the „Marża" tab — the persisted figure/plane
      toggle, the withheld-margin (`null`) state and the listing columns. No `e2e-backlog` issue
      exists for it.
      test: no automated test yet · e2e — the obligation itself
- [x] 🟡 WARNING · filed EX-901 · code-review · `src/components/tables/investments.tsx` · the Robocizna
      v1 / v2 columns sit **outside** the `isAdminOrOwner` gate that Marża v1/v2 sit behind, so a
      MANAGER sees them. Not auto-applied: it changes what a user MAY see — an owner call, still
      unmade.
      test: no automated test · integration — owed with the decision, not before it.
- [x] filed EX-902 · simplify(altitude) · `src/components/kosztorys/summary/allowed-summary-views.ts` ·
      the view gate is a **third** parallel enumeration of `SummaryViewT` — after the union +
      `VALID_VIEWS` (`hooks/use-summary-view.ts`) and the label table in `summary-panel-content.tsx` —
      written as an `if (value === …)` ladder. A new owner-only view leaks silently to the client
      share if someone forgets this file. Direction: one descriptor table `{ value, label, gate? }`
      next to `SummaryViewT`; three files, ~30 lines, no behaviour change.
- [x] filed EX-903 · simplify(efficiency) · `src/lib/queries/balances.ts` ·
      `selectKosztorysSubcontractorDue` is a **second full scan** of the tables
      `selectKosztorysClientTotals` already scans (same joins, same `GROUP BY investment_id`, same
      consumer), so the listing pays two Neon round-trips on every cache miss — i.e. after every
      debounced editor autosave. Direction: one CTE emitting both figure sets behind one
      `unstable_cache` entry; a refactor of a cached hot path the golden master and the parity spec
      both sit on.
- [x] filed EX-904 · structure-scatter · `src/components/kosztorys/summary/` · the directory root is a junk
      drawer — panel shell, controls, options and warnings beside coherent subfolders
      (`blocks/`, `tabs/`, `tables/`, `hooks/`) some of them belong in.
- [x] filed EX-905 · module-cohesion · `src/components/kosztorys/summary/summary-panel-content.tsx` ·
      `show*` flag sprawl — two hosts (editor / investment page) render different subsets of one
      component. Should become two compositions or one explicit variant prop.
- [x] filed EX-906 (owner call) · `margin-actual-table.tsx` · three words for one overpaid state:
      „Nadpłata" here and in `worker-summary.tsx`, „nadpłacone" and „Wypłacono więcej niż wykonano"
      in `subcontractor-worker-totals.tsx`.
- [x] dismissed · simplify(reuse) · `src/__tests__/investment-render-parity-db.test.ts` · the spec
      reads subcontractor due through the uncached `selectKosztorysSubcontractorDue`, on purpose
      (at the gate it held its own copy of the fold). Routing it through the cached fetcher would put `unstable_cache` inside a spec whose job is to read the DB fresh and compare
      two render paths — it could then pass against a stale entry.
