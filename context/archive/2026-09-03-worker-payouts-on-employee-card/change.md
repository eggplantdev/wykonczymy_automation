---
change_id: worker-payouts-on-employee-card
title: Rozliczenie pracownika na karcie pracownika (należne z etapów vs wypłaty)
status: new
created: 2026-09-03
updated: 2026-09-03
archived_at: null
branch: null
worktree: null
---

## Notes

Pokazanie rozliczenia pracownika (należne z etapów kosztorysu vs wypłaty) na karcie pracownika.

Stan zastany (rozpoznanie 2026-09-03, do potwierdzenia w researchu):

- Przypisanie jest do **etapu**, nie do pojedynczej pracy — `kosztorys-stages.worker`
  (`src/collections/kosztorys-stages.ts`), nullable; `null` to legalny stan (etap nieprzypisany),
  a nie brak danych. UI: dropdown w nagłówku etapu (`editor/grid/stage-header.tsx`), przy zmianie
  przypisania na etapie z wykonaną wartością > 0 leci confirm dialog. Zapis: patch etapu w
  `src/lib/actions/kosztorys.ts` (`workerId` → pole `worker`).
- Należne liczy `subcontractorDueByPlane` (`src/lib/kosztorys/subcontractor-due.ts`): per etap
  `Σ ilość × cena podwykonawcy` wg rozliczenia etapu (z narzędziami / bez narzędzi), pre-rabat;
  etap bez rozliczenia nie zasila nikogo i podnosi `hasUnconfirmedPlane`. Mapa `byWorker` tnie tę
  kwotę po ludziach, z resztą w koszyku `null`.
- „Ile wypłacić" składa `computeSubcontractorSummary`
  (`src/lib/kosztorys/subcontractor-summary.ts`): należne − Σ PAYOUT tej inwestycji dla pracownika,
  ze stanami `settled` / `overpaid` / `no_stages` / `no_executed_work` / `unattributed`.
  Render: `summary/blocks/subcontractor-worker-totals.tsx`.

Luka, którą zamyka ta zmiana:

- Cały przekrój per-pracownik liczy się **po stronie klienta z drzewa jednej inwestycji**
  (`use-kosztorys-editor.ts`, `investment-summary-panel.tsx`). Karta pracownika potrzebuje cięcia
  odwrotnego — jeden człowiek × wszystkie inwestycje — a takiego zapytania nie ma. Ładowanie drzew
  wszystkich inwestycji odpada (powód istnienia `src/lib/db/kosztorys-subcontractor-due.ts`).
- Kierunek do zweryfikowania: dorzucić `worker_id` do `GROUP BY` w istniejącym CTE `lines`
  (nie nowa funkcja z własną formułą — formuła istnieje już w dwóch egzemplarzach, spiętych
  spec-em parity `src/__tests__/lib/db/kosztorys-subcontractor-due.test.ts`).
- Strona wypłat też wymaga przegrupowania: karta pracownika
  (`src/app/(frontend)/pracownicy/[id]/page.tsx`) ma dziś jedną sumę `PAYOUT` z
  `fetchFilteredByType`, bez podziału na inwestycje.

Do rozstrzygnięcia: czy karta pokazuje tylko sumaryczne „pozostało do wypłaty", czy pełny rozkład
po inwestycjach z linkami.
