---
change_id: worker-payout-remaining
title: „Pozostało do wypłaty" per worker, and a payout dialog prefilled per investment
status: implementing
created: 2026-09-29
updated: 2026-09-29
archived_at: null
branch: worker-payout-remaining
worktree: ../wykonczymy-worktrees/worker-payout-remaining
---

## Notes

„Pozostało do wypłaty" per worker on the employee list (per investment×worker pair), plus a „Rozlicz wypłaty" dialog opened from the employee list and the investment list that prefills one wypłata per pair; remove the useless all-time „Wypłaty" column from the employee list first.

### Decisions (shaping with the owner, 2026-09-29)

Figures quoted are from the local DB (a prod dump), 2026-09-29.

- **Grain is the investment × worker pair.** One aggregate feeds the employee-list column (Σ over his
  pairs), both dialog entry points, and cross-checks the investment list's existing „Pozostało do
  wypłaty" (`subcontractorRemaining`). Pair = executed work on his etapy at his stawka (same formula
  as `subcontractorDueByPlane.byWorker`) − his PAYOUTs booked on that investment.
- **Why a separate dialog, not the wydatek form:** the wydatek form holds typ / inwestycja /
  pracownik / kasa once in its header and every line item inherits them. The employee entry point
  varies inwestycja per row, the investment entry point varies pracownik per row — neither fits.
  The dialog creates N PAYOUTs, each with its own inwestycja + pracownik; shared data / kasa (no
  metoda płatności — a PAYOUT never stores one). Needs a new server action (`createBulkTransferAction` shares one header).
- **Remove the employee list's „Wypłaty" column** (all-time Σ PAYOUT since 2026-04-11, mixes salary,
  loans, gifts, fuel). Keep the „Wypłaty" figure on `/pracownicy/[id]` — it follows the page's
  transfer filters. Footprint: `components/tables/users.tsx` column + `UserRowT.balance`,
  `fetchWorkerBalances` / `sumAllWorkerBalances` + unit spec, and the golden master's `"workers"`
  snapshot (`financial-golden-master.json`) — else `test:parity` fails.
- **PAYOUTs without an investment** (26 locally: monthly salary, premia, loan, gift, fuel) are out of
  the figure entirely. A monthly salary is not contradictory with this feature — it is a shortcut to
  pay for work on an investment, not a replacement; no „na etacie" flag.
- **Investment without a kosztorys → the pair is absent** (171 pairs / 2.77 M zł of legacy PAYOUTs).
  Otherwise every long-standing worker reads a huge Nadpłata. Mirrors the listing's „brak danych".
- **Kosztorys exists, worker has no etap there, but has PAYOUTs** (21 pairs) → shown as Nadpłata
  with a hint to assign his etap (almost always an unassigned etap, see next).
- **Unassigned etapy** (35 of 46 locally): never reach the employee list. In the dialog opened from
  the investment list, a greyed, non-payable „Nieprzypisane etapy — X zł" row makes the rows sum to
  the column. The column keeps including unassigned work.
- **Etap with executed qty but no rozliczenie (plane)** → only that worker's pair is withheld
  („ustaw rozliczenie etapu", not payable); other workers on the investment still compute. Employee
  column = Σ of computable pairs + marker „N inwestycji bez rozliczenia etapu".
- **No netting across investments.** Employee column = Σ of positive pairs; overpaid pairs are a
  marker („nadpłata na N inwestycjach"), never subtracted.
- **Dialog rows:** Inwestycja/Pracownik | Wykonane | Wypłacone | Pozostało | Kwota wypłaty (input,
  prefilled with Pozostało, editable) | Po wypłacie (live: „zostanie X" / „rozliczone" / „nadpłata X").
  Already-overpaid rows start unticked with no amount. Footer: Razem (what leaves the kasa).
- **Paying ahead is allowed but must be explicit:** red „nadpłata X" on the row + a sentence above
  submit when any row exceeds („Wypłacasz X zł ponad wykonaną pracę (…) — to będzie zaliczka"). No
  block, no extra confirm. Proposed, not yet confirmed: prefill that PAYOUT's opis with „w tym
  zaliczka X zł".

### Decisions after research (owner, 2026-09-29)

- **Wypłaty with no worker on an investment go into the greyed unassigned row** — „Nieprzypisane —
  etapy X, wypłaty bez pracownika Y → X − Y", the same grouping the Podwykonawcy panel already
  uses. Rows then sum to the investment list's „Pozostało do wypłaty"; the listing is unchanged.
  Legacy-only (8 locally, 2026-03-20…04-10) — a PAYOUT can no longer be saved without a worker.
- **Visible to MANAGER too** — employee-list column and dialog, same as the investment list's
  „Pozostało do wypłaty".
- **The word stays „zaliczka"** for paying ahead, despite the investor-wpłata meaning in the
  glossary — the dialog's context (a wypłata to a worker) disambiguates.
- **Dialog columns use the short labels:** Wykonane / Wypłacone / Pozostało.
- **Figures moved between opening and submitting → refuse.** The server recomputes each pair at
  submit; if any differs from what the dialog showed, nothing is booked and the dialog reloads.
- **The uncovered cases get constructed data:** an etap with executed work and no rozliczenie that
  IS assigned to a worker, and an investment with 2+ workers on etapy — built in the DB specs, and in
  a local seed for manual checks.
