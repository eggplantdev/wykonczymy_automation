---
change_id: kosztorys-bridge
title: Read-only bridge to the financial plane + remaining kosztorys parity rows
status: implemented
created: 2026-07-18
updated: 2026-07-18
archived_at: null
branch: kosztorys-bridge
worktree: null
---

## Notes

Read-only bridge between kosztorys v2 and the investment financial plane (materiały /
zaliczki / transfers — **live join, no write-back, no sync**; the FR-015 firewall stays for
writes) plus the 6 plannable parity rows from `context/changes/kosztorys-parity-gaps/`
(braindump.md consolidated gap table + missing-features.md).

Decisions locked in shaping (2026-07-18, owner):

- **Read-only for this arc.** Write-back (auto-`LABOR_COST` from the rozpiska sum, rabat
  unification) is a separate future change, decided after the read side is dogfooded.
- **No sync machinery.** Same Postgres — query at render + existing cache-tag revalidation.
  v1 mechanisms (Synchronizuj / mirror tabs / iframe) are obsolete, never rebuilt.
- **Access control unchanged.** New surfaces inherit ADMIN/OWNER/MANAGER gating. Client
  delivery of the oferta is a later stage — most probably a file; possibly a script that
  exports/populates a Google arkusz (app → sheet, one-shot).
- **First increment:** Podsumowanie Robocizna / Materiały / Łącznie split with Materiały
  summed live from the investment's transactions. „Aktualnie do zapłaty R + M" comes after
  the zaliczka model is decided.
- Timeline: aggressive — starts today.

Zaliczka model — **decided 2026-07-19 (owner)** by reading the balance calc, not by picking
an option. `calculate-balance.ts`: `Bilans inwestora = totalIncome − (materiały + robocizna) +
rabat`, where `totalIncome` = every deposit type attached to the investment (`INVESTOR_DEPOSIT`

- `COMPANY_FUNDING` + `OTHER_DEPOSIT`). So "wpłaty inwestora" = the money added to the investor
  balance = `totalIncome`. Podsumowanie therefore shows **„Wpłaty"** = `totalIncome` (matches the
  investment page by construction) and **„Do zapłaty"** = (robocizna po rabacie + materiały) −
  Wpłaty = `−Bilans`, both rendered unconditionally. The **etap tag** (`kosztorysStage` on a
  deposit) stays a separate, sparser signal — the per-etap „Zaliczki" row on the „Suma transzy"
  table only — and remains taggable on any investment-attached deposit type (the deposit form
  already gates it on `showsInvestment && stages.length > 0`, which covers all three deposit
  types). Dropped the old etap-tagged-Σ source for the podsumowanie total (`fetchZaliczkiByStage`
  returned {} for nearly every investment → „Wpłaty" silently absent).

Open questions carried in: udział % base (Przedmiar vs executed) · per-etap price base
(client vs subcontractor) · Brutto column placement · „pozostało/bilans" formula still under
owner discussion — don't harden dependents.

Scope (parity rows, gap-table #): Podsumowanie split (#3) · suma transzy per etap (#6) ·
suma prac wykonanych readout (#8) · kolumna komentarz (#13) · zaliczki (etap-tagged deposit
transfers, read-only in kosztorys) · footer „do zapłaty R + M". **Descoped 2026-07-18
(owner):** oferta view (#1) + PDF eksport (#2) → import/export slice; pie „% udziału" (#4)
→ EX-529 nice-to-have. Preserved: marża/register figures byte-identical (bridge never
writes); grid behaviour + perf at 1000+ rows.
