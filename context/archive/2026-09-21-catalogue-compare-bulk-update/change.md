---
change_id: catalogue-compare-bulk-update
title: Hurtowa aktualizacja rozpiski z katalogu prac w oknie porównania
status: archived
created: 2026-09-21
updated: 2026-09-22
archived_at: 2026-09-22T04:53:56Z
branch: catalogue-compare-bulk-update
worktree: null
---

## Notes

„Porównaj z katalogiem prac" zyskuje drugi kierunek zapisu — dziś pisze wyłącznie do katalogu
(„Edytuj w katalogu", „Dodaj do katalogu"), a owner potrzebuje też wziąć liczby z katalogu do
rozpiski. Trzy kawałki, ustalone z ownerem 2026-09-21:

1. **Fix pół-grosza (bug, robimy pierwszy).** „Malowanie sufitu w kolor — Stawka bez narzędzi"
   pokazuje 14,88 zł przeciw 14,88 zł z różnicą −0,01 zł. Rozpiska trzyma 14,875, katalog 14,88 —
   różnica to dokładnie pół grosza, czyli dokładnie próg wyciszania, ale szum zmiennoprzecinkowy
   (14,88 nie ma dokładnej reprezentacji binarnej) przepycha ją ~4e-16 ponad próg. Naprawa:
   porównywać kwoty zaokrąglone do groszy, żeby raport porównywał dokładnie to, co wyświetla.

2. **Hurtowa aktualizacja cen.** Checkbox przy każdej pojedynczej liczbie, checkbox całej pracy jako
   skrót, „zaznacz wszystkie" na górze listy; trzy liczby jednej pracy dostają wspólny nagłówek i
   wcięcie (dziś opis pracy powtarza się w trzech wierszach i nie widać, że to jedna praca).
   Przed zapisem automatyczna wersja — hurtowy zapis nie wchodzi na stos cofania (wzór:
   rabat procentowy, „Popraw literówki").

3. **Akceptacja podpowiedzi „może chodzi o".** Dwie pułapki wykryte w danych:
   - dopasowanie idzie po parze (opis, j.m.), a „Docięcie i montaż progu" jest w rozpisce **bez
     j.m.**, gdy w katalogu ma `szt` — sama zmiana opisu nie dopasuje, trzeba wziąć opis **i** j.m.;
   - podpowiedź to jeden strzał, a katalog miewa kilku bliskich kandydatów po różnych cenach:
     „Klejenie paneli winylowych" → _jodełka_ 95 zł / _układ prosty_ 60 zł / _mijanka_ 60 zł.
     Dlatego akceptacja to **wybór spośród kandydatów**, nie checkbox „tak", i świadomie **nie**
     ciągnie cen — praca po zmianie nazwy ląduje w „Inne liczby niż w katalogu", gdzie ceny bierze
     się osobnym, widocznym krokiem.

### Rozstrzygnięcie o „auto" (owner, 2026-09-21)

Katalog może nie podawać stawki — 125 z 568 wpisów tak ma; wtedy stawka liczy się jako cena z
katalogu × współczynnik inwestycji. Dziś tabela renderuje w kolumnie „Katalog" **wyliczoną
złotówkę**, czyli liczbę, której w katalogu nie ma i która zmieni się przy zmianie współczynnika.

Rozważane było wyciszenie takich wierszy (katalog „nie ma zdania"). **Owner to odrzucił**:
katalogowe „auto" jest decyzją („ta praca ma liczyć się ze współczynnika"), dokładnie tak jak przy
dodawaniu pracy z katalogu do rozpiski, gdzie auto wchodzi jako auto — więc aktualizacja musi umieć
wziąć auto. Ustalone:

- kolumna pokazuje **słowo „auto"**, nigdy wyliczonej kwoty — po żadnej ze stron nie stanie liczba,
  której nikt nie wpisał;
- rozjazdem jest też **różnica sposobu**, nie tylko kwoty (zamrożona kwota przeciw „auto" w obie
  strony); auto przeciw auto dalej wyciszone;
- aktualizacja takiego wiersza **kasuje nadpisanie** i praca liczy stawkę ze współczynnika;
- kolumna „Różnica" zostaje **kwotowa, ale wyszarzona/oznaczona** — przy zaznaczaniu 40 prac naraz
  owner musi widzieć, ile pieniędzy się rusza, wiedząc że kwota jest wynikiem współczynnika
  (wariant „13,60 zł → auto" z pustą różnicą odrzucony z tego powodu).

Skala zmierzona prawdziwą funkcją porównania na lokalnej bazie (14 kosztorysów, 4464 pozycje) —
metodyka w skasowanym przy archiwizacji `research.md` (`git show 2673dcba^:context/changes/2026-09-21-catalogue-compare-bulk-update/research.md`). Inwestycja 151: 63 prace / 138 różnic, z czego 6 „rozpiska
zamrożona ↔ katalog auto" i 9 „rozpiska auto ↔ katalog kwota".

## Domknięcie (archiwizacja 2026-09-22)

`plan.md`, `plan-brief.md` i `research.md` skasowane przy archiwizacji — ich treść albo weszła do
kodu, albo miała już swój dom (`roundToCents` i „casty przy `NULL` w paczce" w docblokach,
pułapka migawki przez cache'owaną warstwę w `lessons.md`, `patchRows` + `prevById` tamże). Sięgnij po
nie przez `git show 2673dcba^:context/changes/2026-09-21-catalogue-compare-bulk-update/<plik>`.
Nowa lekcja o progu równym połowie jednostki wyświetlania wyniesiona do `context/foundation/lessons.md`.

**Nie było bramki review** (`/slice-review-gate` nigdy nie przebiegła dla tej zmiany) i **14 checków
manualnych zostaje nieodhaczonych** w `context/foundation/manual-checks.md` — sekcja
„catalogue-compare-bulk-update" żyje dalej jako otwarta praca, mimo archiwizacji folderu.

Trzy rozstrzygnięcia właściciela, które nadpisały rekomendację i nie widać ich w kodzie:

- **Trzy kawałki w jednej zmianie**, wbrew rekomendacji rozbicia — właściciel chciał zobaczyć
  i przetestować całość naraz.
- **Checkbox przy każdej pojedynczej liczbie, nie tylko przy pracy**, wbrew rekomendacji „tylko per
  praca".
- **Bez okna potwierdzenia** — przy pracy partiami potwierdzenie staje się odruchem, który niczego nie
  chroni; zamiast niego licznik na przycisku i automatyczna wersja przed zapisem.

Świadomie poza zakresem, do zakomunikowania właścicielowi: zmiana opisu przy przyjęciu kandydata
**rozłącza pozycję od jej bliźniaka w arkuszu** przy następnym „Porównaj z arkuszem".

Progres (fazy → commity): 1 `b8dd0158` · 2 `18092f87` · 3 `3d028a8b` · 4 `fe0763d4` · 5 `87f26bba`
· epilog `2673dcba`.
