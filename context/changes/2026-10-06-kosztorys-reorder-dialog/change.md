---
change_id: kosztorys-reorder-dialog
title: „Ustaw kolejność” — układanie prac i sekcji w kosztorysie/szablonie
status: implementing
created: 2026-10-06
updated: 2026-10-06
archived_at: null
branch: staging
worktree: null
linear: EX-999
---

## Notes

„Ustaw kolejność” w edytorze kosztorysu/szablonu: lista z zaznaczaniem (klik, Shift-zakres, sekcja),
przeciąganie bloku prac także między sekcjami, przeciąganie sekcji, jeden zapis całego układu z
auto-wersją. Spike już w drzewie (niezacommitowany).

Powód: szablon ma ~400 prac, a dziś pracę przesuwa się tylko ▲▼ o jeden wiersz z menu ⋯, wyłącznie
w obrębie sekcji. Przeniesienia między sekcjami nie było wcale. Pokrewne: EX-857
(`2026-09-23-kosztorys-bulk-actions` — zaznaczanie w siatce, inna powierzchnia).

Dialog szerszy (`sm:max-w-7xl`) — prośba właściciela.

Luki spike'a do domknięcia:

- dialog bierze wiersze siatki z chwili otwarcia, nie czeka na niezapisane edycje komórek, a zapis
  przeładowuje siatkę — świeżo wpisana komórka może przepaść;
- zapis czyści Cofnij/Ponów (jak „Popraw literówki”), powrót = auto-wersja w „Wczytaj”;
- brak koloru sekcji na liście, brak własnego auto-scrollu przy przeciąganiu;
- brak testów (`moveItems` / `moveSection` — czysta logika, node; `writeKosztorysLayout` — DB spec).
