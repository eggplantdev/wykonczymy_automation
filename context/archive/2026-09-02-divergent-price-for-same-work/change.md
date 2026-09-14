---
change_id: divergent-price-for-same-work
title: „Problemy" pokazuje pozycje, gdzie ta sama praca ma różną cenę j.m.
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02T14:14:10Z
branch: staging
worktree: null
---

## Notes

EX-761. Zakres to **wyłącznie widoczność** — diagnostyka ma się świecić w „Problemy", a właściciel
sam decyduje, czy dana różnica cen jest błędem. Rozstrzygnięcia właściciela zapisane w komentarzu
do EX-761 (2026-09-02):

- `tone: 'worklist'`, nie `'defect'` — inna łazienka może być świadomie droższa.
- Licznik liczy **pozycje**, nie grupy — zgodnie z resztą rejestru i z tym, co widać po kliknięciu.
- Rabat poza zakresem; diagnostyka sądzi „Cena j.m.".

Kształt: grupowanie po `catalogueKey(opis, j.m.)` liczone piętro wyżej i wpuszczone do
`RowConditionCtxT` jako fakt spoza wiersza — dokładnie jak `hasSettledMaterial`.
