---
change_id: kosztorys-tryb-mieszany
title: Tryb mieszany — cash settlement view in kosztorys Podsumowanie (slice B)
status: implemented
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

**4 blockers — all resolved in the shipped implementation:**

1. „Mieszane" is a NEW toggle value alongside „Netto + Brutto" (not a repurpose): in cash mode both
   netto and brutto columns stay visible and the gotówka waterfall is appended. (The braindump/shape
   note that said "netto-only, replaces both-columns" was superseded — see plan.md reconciliation.)
2. C (kwota gotówką) — a local panel input, default 0, only in cash mode. Not persisted.
3. D — anchored on „Łącznie" netto (`combinedNet`), with wpłaty subtracted AFTER grossing (never
   grossed), so C = 0 lands on the Brutto-axis „Do zapłaty".
4. No clamp on C — over-typing past the base drives the remainder negative on purpose.
