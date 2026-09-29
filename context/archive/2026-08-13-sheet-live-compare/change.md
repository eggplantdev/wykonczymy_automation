---
change_id: sheet-live-compare
title: Live comparison with the sheet instead of an import report
status: archived
created: 2026-08-13
updated: 2026-08-14
archived_at: 2026-08-14T15:24:52Z
branch: pomiar-bez-etapu
worktree: null
---

## Notes

Closes out EX-686 (it deletes the action that change added), so its commits sit on the
`pomiar-bez-etapu` branch — one branch for both.

The „Porównaj z arkuszem" (compare with sheet) action: reads the sheet live, computes both sides,
flags suspicious formulas (Pomiar copied from Przedmiar, Przedmiar computed from a stage) and refreshes
the stored reference numbers without a full import.

Origin (dogfooding investment 31, 2026-08-13): the sheet showed „wartość netto 508 196 zł", the app
491 519,25 zł. The 16 677,70 zł gap sat in 26 items where the sheet's Pomiar z natury is the formula
`=N` — a copied Przedmiar, not a measurement. The import deliberately doesn't take those, so the
discrepancy column is structurally blind on them and zero discrepancies proves nothing. Full formula
anomaly scan: `context/reference/kosztorys-sheet/formula-anomalies.md`.

Rejected: storing the import report in the DB plus a button to open it. A pre-import snapshot goes
stale along with the sheet anyway, so reading on demand is better.

Role split:

- the discrepancy column in the grid — a per-item worklist, runs off the stored number, works without
  the sheet;
- „Porównaj z arkuszem" — the wider two-sided calculation plus formula health, needs a live connection;
- the stored reference number stops being an import-day snapshot and becomes a refreshable cache.

Knowingly accepted risk: without sheet access (revoked share, deleted tab, no network) the view doesn't
work at all.

## Owner ruling (2026-08-13): the „Etapy są prawdą" action goes

The row-menu action deleted the stored reference number to silence a discrepancy. Removed because it
treated the symptom by deleting data instead of showing the mismatch, worked per row against a
problem that is collective (26 items at once), and was the only reason refreshing would have to
arbitrate anything.

## Owner rulings (2026-08-14, after clicking through investment 31) — phase 6

- **Refreshing is not a choice.** The stored number is a copy of the sheet's Pomiar; since the dialog
  reads the sheet live anyway, "keep the old copy" is an answer nobody would pick. The button went;
  refresh happens on open and the dialog reports what changed.
- **The mass class gets a count, point classes get rows.** „Pomiar przepisany z Przedmiaru" (241 of
  336) is collective and closes by fixing the sheet or filling stages. „Przedmiar liczony z etapu" (7)
  and error values are fixed one cell at a time — those are listed.
- **The row number is a link** straight to the cell in the sheet.

Why the list had been useless: one shared 25-sample bucket for all three classes, filled in row
order — the mass class exhausted it before the first point-class row appeared, so the dialog just
listed the top of the sheet with no label of what was wrong.

## Phase 7 — recorded retroactively at the review gate (2026-08-14)

- **„Rozjazd" → „Pozostało do rozliczenia"** (`0bdea8c9`): same subtraction, but the number is a
  balance line, not a defect — the only way to zero it is to enter stage quantities, i.e. declare the
  work done.

  > **Superseded (2026-08-18):** the column is now „Rozjazd między arkuszem Google a apką" and shows
  > only with the „z pomiarem do rozpisania na etapy" filter, not on every imported kosztorys
  > (`src/lib/kosztorys/column-config.ts`, domain notes § „Kolumna nazywa się").

- **Comparison dialog rewrite** (`0345d520`) — full, untrimmed per-item diff lists. A deliberate
  reversal of phase 3's cap: the list's sum **is** the table figure, so trimming it would lie about the
  sum. The cap stays on formula samples, where the count sits beside them anyway.
- **Subcontractor rates in both dialogs** (`405cdc7a`, `488a3bc9`). The plan assumed the comparison
  never calls the price list; now it does. The property behind that survives: a missing price list
  doesn't break the comparison (`readRateTabs` returns an empty list instead of throwing; `ok: false`
  still comes only from `resolveRobocizna`), pinned by a spec.

## Deferred

E2E for both actions: **EX-687** (`e2e-backlog`) — needs a stubbed Sheets client first, otherwise a
browser spec has nothing to assert. EX-686 has the same gap, noted on the same issue.
