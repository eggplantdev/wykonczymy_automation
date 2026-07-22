---
change_id: kosztorys-tryb-mieszany
title: Tryb mieszany — cash settlement view in kosztorys Podsumowanie (slice B)
status: implementing
created: 2026-07-22
updated: 2026-07-22
archived_at: null
branch: konradantonik/ex-536-zaliczka-v2
worktree: null
---

## Notes

Slice B of the kosztorys zaliczka v2 arc — continues on branch `konradantonik/ex-536-zaliczka-v2`
after slice A (materiały netto/brutto) shipped. Builds on the `grossPair` / `materialsGross`
foundation from slice A (`context/changes/kosztorys-zaliczka-v2/`).

Mixed-mode ("tryb mieszany") cash settlement view driven by a per-investment cash-amount input,
netto-only. Source shaping notes: `context/changes/kosztorys-zaliczka-v2/braindump.md` §64–82
(## Slice B — tryb mieszany).

**Scope lock (owner, verbatim):** do NOT touch `investment-financials.ts`, `calculate-balance.ts`,
`calculate-margin.ts`, or the transactions model. Bilans won't reconcile — accepted, not a bug.
Mixed view is netto-only.

**4 blockers to resolve with the owner before planning:**

1. Does „Mieszana" toggle become the gotówka view (dropping today's both-columns meaning), or is
   gotówka a separate control?
2. Skąd C (kwota gotówką) — lokalny input w panelu, domyślnie 0, tylko w trybie mieszanym?
3. Co to D („całość do zapłaty netto") — Do zapłaty netto czy „Łącznie" netto, i gdzie w tym wpłaty?
4. Potwierdzić: limit C ≤ D − Mciznę?

Entry: `/10x-shape` (unresolved domain decisions must be shaped before planning).
</content>
</invoke>
