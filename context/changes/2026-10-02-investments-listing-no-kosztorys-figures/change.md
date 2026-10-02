---
change_id: investments-listing-no-kosztorys-figures
title: Investments listing shows real v2 figures without a kosztorys
status: implemented
created: 2026-10-02
updated: 2026-10-02
archived_at: null
branch: investments-listing-no-kosztorys-figures
worktree: null
---

## Goal

Remove the „brak danych" gate on the investments listing's v2 columns. Owner ruling 2026-10-02: an
investment with no kosztorys (no work executed — e.g. „Kijowska 17 dwa mieszkania", settled on
materials only) is legitimate and must show its real figures, not „brak danych".

## Decisions (owner, 2026-10-02)

- Bilans netto/brutto v2, Robocizna v2, Marża v2: real figures without a kosztorys.
- Pozostało do wypłaty: still withheld without a kosztorys, rendered „brak kosztorysu" instead of „brak danych".
- Kosztorys with no executed etapy keeps −wypłaty (zaliczka), as on the panel.
- Bilans netto/brutto v2 on the tryb's other plane: „rozliczenie brutto / netto / mieszane" instead of
  „nie dotyczy" — say why, not that it doesn't apply.

Detail and data: `research.md`.
