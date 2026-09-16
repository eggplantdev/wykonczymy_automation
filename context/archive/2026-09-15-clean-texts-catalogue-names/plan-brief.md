# „Popraw literówki" przejmuje nazwy z katalogu prac — Plan Brief

> Pełny plan wdrożenia został zdystylowany przy archiwizacji — leży w historii gita
> (`git show c6f355da:context/changes/2026-09-15-clean-texts-catalogue-names/plan.md`).
> Trwała lekcja o `match_key` trafiła do `context/foundation/lessons.md`.
> Diagnoza i notatki: `change.md` obok.

## What & Why

938 ręcznie przygotowanych poprawek nazw prac trafiło w 2026-09-14 wyłącznie do katalogu prac
i nigdy nie stało się kodem — rozpiski i szablony zostały ze starymi nazwami. Stąd 30 prac
zgłaszanych jako „spoza katalogu" na `/szablony/4`, gdzie podpowiedź różni się od nazwy kosmetycznie.
Ta zmiana przywraca tabelę jako dane produktowe i wpina ją w dwa miejsca naraz: w dopasowanie (żeby
system przestał je zgłaszać) i w przycisk „Popraw literówki" (żeby klient zobaczył poprawiony tekst).

## Starting Point

Reguły przycisku (`TYPO_FIXES`, ~50 podmianek fragmentów) poprawiają **0 z 30** opisów na szablonie 4
— defekty to brakujące ogonki i przeniesienia wierszy z KNR, czyli rzeczy, do których reguła
fragmentowa nie sięga. Tabela z poprawkami została skasowana przez `4de2666e` przy okazji epilogu
innej zmiany i żyje tylko w historii gita. Kod ma już gotowy wzorzec na dokładnie ten problem:
`item-key.ts` podaje `TYPO_FIXES` w pełni do przycisku, a ich przefiltrowaną pochodną do klucza
tożsamości.

## Desired End State

Okno „Porównaj z katalogiem prac" na `/szablony/4` zgłasza **6** prac zamiast 30 — i to bez klikania
czegokolwiek, bo 24 dopasowują się samą tożsamością. Kto kliknie „Popraw literówki", dostaje te
nazwy poprawione również w widocznym tekście oferty. Porównanie z arkuszem Google działa po tym
dokładnie tak, jak przed.

## Key Decisions Made

| Decyzja                              | Wybór                                 | Dlaczego                                                                                                                                    | Źródło     |
| ------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Zakres tożsamości                    | Wchodzi w tę zmianę, jako osobna faza | Bez niej przycisk przepisuje litery, których `itemKey` nie absorbuje — czyli rozjazd z arkuszem Google                                      | Właściciel |
| Kolejność faz                        | Tożsamość **przed** przyciskiem       | Fold nie zapisuje do bazy, więc jest bezpieczny osobno; przycisk bez folda nie jest                                                         | Plan       |
| Klucz tabeli                         | Sam opis, bez j.m.                    | Po zdjęciu „[stary arkusz]" tabela jest jednoznaczna po opisie — 16 dwuznaczności brało się ze znacznika, nie z jednostki                   | Pomiar     |
| Strażnik „nazwa istnieje w katalogu" | Odrzucony                             | Fold jest funkcją czystą i nigdy nie zajrzy do bazy; strażnik po jednej stronie rozjechałby oba mechanizmy. Na danych i tak nie zmienia nic | Właściciel |
| J.m. z tabeli                        | Nie ruszamy                           | `szt` → `m2` to nie literówka, tylko inna podstawa wyceny                                                                                   | Właściciel |
| Przebieg hurtowy                     | Nie ma                                | Zapis idzie przez snapshot i lock inwestycji, więc jest odwracalny                                                                          | Właściciel |
| Dom tabeli                           | Moduł TS obok `clean-description.ts`  | Zero I/O w server action, typecheck pilnuje kształtu; `src/scripts/data/` i tak już nie istnieje                                            | Plan       |

## Scope

**W zakresie:** moduł z 915 poprawkami nazw; pochodna (253 reguły) w `foldDescription`; krok
całonazwowy w `cleanDescription`; spec kształtu tabeli; spec kolizji `match_key` przeciw `db-test`;
specy zbieżności klucza i pierwszy spec `clean-description`.

**Poza zakresem:** zapis do `work_catalogue_items`; zmiana j.m.; skrypt hurtowy po rozpiskach;
przywrócenie skasowanego skryptu; akcja „przyjmij nazwę z katalogu" dla 5 doprecyzowanych wariantów
(wymaga decyzji człowieka — „Klejenie paneli winylowych" ma remis 0.862 : 0.862 między _jodełka_
a _mijanka_).

## Architecture / Approach

Jedna tabela, dwa odbiory — ten sam podział, który plik stosuje dziś dla reguł literowych:

```
catalogue-name-fixes.ts   915 par: fold(stara nazwa) → poprawiona nazwa
        ├─► cleanDescription ─► przycisk „Popraw literówki"     (widoczny tekst)
        └─► foldDescription (filtr klucz≠wartość → 253)
                   ├─► itemKey       (porównanie z arkuszem Google)
                   └─► catalogueKey  (okno „Porównaj z katalogiem")
```

Nowy mechanizm nie powstaje. Różnica wobec `TYPO_FIXES` leży po stronie danych: tamte to podmianki
fragmentów, te to podstawienia całej nazwy — jedno `Map.get` zamiast przebiegu po regułach.

## Phases at a Glance

| Faza                 | Co dostarcza                                                                     | Główne ryzyko                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1. Tabela jako moduł | 915 par z historii gita jako moduł TS + test kształtu                            | Utrata znacznika „[stary arkusz]" przy generowaniu (niesie go 750 z 938 celów)                                      |
| 2. Tożsamość         | `itemKey` i `catalogueKey` zbiegają się; okno pokazuje 6 zamiast 30 bez klikania | Kolizja `UNIQUE` na `match_key` przy nowych zapisach — zmierzone 0 na 843 wierszach, pilnuje spec przeciw `db-test` |
| 3. Przycisk          | Poprawiony tekst w ofercie klienta                                               | Podstawienie całonazwowe zjadające przypadek obsługiwany dotąd przez `unshout` / `sentenceCase`                     |

**Warunki wstępne:** lokalna baza na 5433 (kopia produkcji) i `db-test` na 5435 do specu kolizji;
dostęp do historii gita pod `4de2666e^`.
**Szacowany rozmiar:** jedna sesja, 3 fazy — objętość leży w danych, nie w logice.

## Open Risks & Assumptions

- Brak łańcuchów i brak kolizji to własności **dzisiejszych danych**, nie konstrukcji — dlatego oba
  są testami, nie komentarzami. Dołożenie wpisu do tabeli może je złamać.
- Klucze tabeli zostały wyliczone `foldDescription`-em z commita `61ae1aa5`. Gdyby `TYPO_FIXES`
  zmieniły się od tamtej pory, część kluczy przestałaby trafiać — asercja „klucze stabilne pod
  `fold`" z fazy 1 łapie ten dryf.
- Przycisk siedzi wciąż tylko na `staging` (`86b40010`); na produkcji go nie ma. Faza 2 działa bez
  niego, faza 3 zadziała dopiero po wypuszczeniu menu na produkcję.

## Success Criteria (Summary)

- `/szablony/4` → „Porównaj z katalogiem prac" pokazuje 6 prac spoza katalogu zamiast 30, bez
  klikania czegokolwiek
- Po kliknięciu „Popraw literówki" 24 prace mają poprawiony opis; drugie kliknięcie raportuje 0 zmian
- Porównanie z arkuszem Google nie zaczyna zgłaszać istniejących prac jako nowych
