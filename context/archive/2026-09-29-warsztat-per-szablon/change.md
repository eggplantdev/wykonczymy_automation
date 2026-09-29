---
change_id: warsztat-per-szablon
title: Szablon jest inwestycją — koniec wspólnego warsztatu i biblioteki jsonb
status: archived
created: 2026-09-29
updated: 2026-09-29
archived_at: 2026-09-29T07:03:21Z
branch: warsztat-per-szablon
worktree: null
---

## Notes

każdy szablon dostaje własną inwestycję-warsztat zakładaną razem z szablonem (zamiast jednego wspólnego warsztatu przełączanego wskaźnikiem). Zastępuje EX-893.

## Decyzje (nie wynikają z kodu)

- **Szablonów jest mało i tak zostanie** (2026-09-29; lokalnie 5). Koszt „jedna inwestycja na szablon" jest pomijalny, więc warsztat powstaje **od razu razem z szablonem**, a nie leniwie przy pierwszym wejściu — szablon bez warsztatu nie istnieje.
- **Dlaczego zmiana:** jeden wspólny warsztat przełączany wskaźnikiem wymusił kolejno: historię wersji z kluczem szablonu (szablony-crud), eksmisję i strażnika wskaźnika w lustrze (szablon-autosave), ciężkie transakcyjne „Otwórz" z ponawianiem i ekranem „Otwórz" dla nieaktualnej karty (szablon-open-speed), a teraz EX-893 — zapis ze starej karty ląduje w szablonie otwartym teraz. Wszystkie cztery mają jedno źródło: numer warsztatu zmienia znaczenie w czasie.
- **~~Do potwierdzenia z właścicielem~~ (zastąpione zmianą kierunku niżej):** ruling ze szablony-crud „inwestycja jest wyłącznie warsztatem — nigdy drugim magazynem szablonów". Trwałe drzewo per szablon formalnie jest drugą kopią; od autozapisu warsztat i tak jest żywą kopią z biblioteką opóźnioną o ≤10 s. Biblioteka (`kosztorys_presets`) zostaje źródłem prawdy dla czytelników (wstawianie szablonu do inwestycji, „Wczytaj szablon…").
- **Zmiana kierunku (2026-09-29): szablon JEST inwestycją ze statusem `szablon`.** Drzewo tej inwestycji jest treścią szablonu; biblioteka `kosztorys_presets` (jsonb) znika razem z lustrem. Ruling szablony-crud „nigdy drugim magazynem" miał podstawę tylko przy jednym warsztacie — jedna inwestycja nie mieści wielu szablonów, więc treść musiała żyć gdzie indziej. Przy inwestycji per szablon drugiego magazynu nie ma wcale: treść żyje w jednym miejscu. Poprzedni wariant (warsztat per szablon + lustro do biblioteki) trzymałby dwie kopie tylko po to, by uszanować regułę bez podstawy.
- **EX-893 nie jest łatany osobno** — poprawka „zapis niesie oczekiwany szablon" pilnowałaby wskaźnika, który ta zmiana usuwa.
- **Rozstrzygnięcia po researchu (2026-09-29):**
  - „Przełącz na inny szablon…" w szablonie wraca jako **„Wczytaj szablon…"** — zastępuje treść bieżącego szablonu cudzą, z punktem ochronnym (ta sama ścieżka co na inwestycji).
  - Migracja zakłada **wszystkie 5 szablonów od nowa**; dotychczasowy warsztat #151 zostaje starym warsztatem do czasu migracji destrukcyjnej, która go kasuje. Szablon-duch widoczny w tym oknie — akceptowane.
  - **59 punktów „Przed wczytaniem" bez przypisanego szablonu** — kasowane w migracji (treść nie odpowiada etykiecie).
  - Unikalność nazw szablonów **bez rozróżniania wielkości liter i spacji na brzegach** (`lower(trim(name))`).
  - Tag cache `presets` zostaje pod tą nazwą — decyzja inżynierska, bez wpływu na zachowanie.
