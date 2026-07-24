---
id: kosztorys-zaliczka-v2
title: Kosztorys zaliczka v2 — materiały netto/brutto w Podsumowaniu (slice A)
status: implemented
linear: EX-536
branch: konradantonik/ex-536-zaliczka-v2
created: 2026-07-22
updated: 2026-07-22
---

Slice A of the zaliczka v2 arc: make „Materiały" in the kosztorys Podsumowanie respect netto/brutto.
Materiały are recorded as brutto transactions, so netto is derived by subtracting VAT
(`netto = brutto / (1+VAT)`) — the inverse of robocizna. The split flows through the whole waterfall
(pozycja Materiały → Łącznie → Do zapłaty). Financials/bilans deliberately untouched (won't reconcile
for now — accepted). Shaping in `braindump.md`; slice B (tryb mieszany) and the persistence slice follow.
