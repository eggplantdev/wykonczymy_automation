---
change_id: catalogue-usage-report
title: Raport użycia prac z katalogu, liczony na klik
status: new
created: 2026-09-28
updated: 2026-09-28
archived_at: null
branch: null
worktree: null
---

## Notes

Zaparkowane w Linearze: **EX-873**.

Raport użycia prac z katalogu, liczony na klik na stronie katalogu prac. Źródło: tylko kosztorysy w aplikacji (bez starych arkuszy). „Użyta" = pozycja ma Przedmiar > 0 **lub** ilość w etapach > 0 (decyzja właściciela 2026-09-28). Pomiar z natury z arkusza się NIE liczy. Sama obecność w rozpisce też nie — kosztorys zawiera cały cennik z zerami. Lokalnie: 642 użyte pozycje z 5929. Dopasowanie po kluczu katalogu (opis + j.m., ta sama funkcja co „Porównaj z katalogiem"), bez dopasowania rozmytego; osobna podpowiedź „występuje z inną j.m." (22 opisy lokalnie). Kolumny: liczba kosztorysów (inwestycji, nie pozycji), ostatnie użycie; sortowanie rosnąco, żeby zera były na górze. Wykluczone inwestycje o statusie „szablon". Szablony (presety) poza zakresem v1. Pomiar 2026-09-28 na lokalnej kopii prod: 18 kosztorysów, 135/561 prac katalogu z ≥1 realnym użyciem, 68% użytych pozycji pasuje dokładnie.

### Analiza 2026-09-29 (lokalna kopia prod) — wstrzymane do czasu, aż przybędzie inwestycji

Ponowny pomiar: 24 kosztorysy, 1040 użytych pozycji z 7557, 164/561 prac katalogu z ≥1 użyciem, 69,2% dokładnych dopasowań. Klucze zapisane w katalogu zgadzają się z liczonymi dziś (0 rozjazdów), więc można dopasowywać po zapisanym kluczu; samo dopasowanie musi iść w Node (poprawki literówek są w kodzie), ale wystarczy wczytać tylko użyte pozycje (~1k wierszy).

Do rozstrzygnięcia przed `/10x-plan`:

1. **Zero ≠ praca nieużywana.** 27% użytych pozycji (284) nie pasuje do niczego, bo kosztorysy niosą starą, ogólną nazwę, a katalog ma już warianty: „Fugowanie ścian i podłóg" (13×) vs „…płytka format standard" / „…mały format"; „Montaż umywalki" (11×) vs „…wiszącej" / „…nablatowej"; „Montaż zaworów" (11×). Propozycja: druga lista „używane, a brak w katalogu" (sortowana po liczbie kosztorysów), z podpowiedziami „może chodzi o…" z istniejącego mechanizmu — tylko jako wskazówka, nie do liczenia.
2. **„wyłączników" vs „włączników"** — „Montaż gniazdek i wyłączników" (9×) nie trafia w katalogowe „…włączników". Oba słowa są poprawne, więc to decyzja właściciela, nie automatyczna poprawka (zmiana listy poprawek zmienia też tożsamość prac w imporcie z arkusza).
3. **„Ostatnie użycie" nie ma wiarygodnej daty na pozycji** — data utworzenia pozycji jest wspólna dla całego kosztorysu (tworzone hurtowo z szablonu/importu; 8 zaimportowanych zakończonych inwestycji ma 2026-08-27), a data edycji skacze przy akcjach zbiorczych. Brać datę z inwestycji — wybrać którą.
4. Podpowiedź „inna j.m." — dziś 12 opisów (w tym literówka w j.m. „klp" vs „kpl").
5. Śmieciowe inwestycje o statusie aktywna („testowe inwestycje", „asDasdaSD", „kosztorys wzór. nic nie dodajemy") — łącznie 9 użytych pozycji, pomijalne.
