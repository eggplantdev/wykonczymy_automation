---
change_id: podsumowanie-podwykonawcow
title: 'Podsumowanie podwykonawców — osobny blok podsumowania dla widoków Z/Bez narzędzi'
status: implementing
created: 2026-07-21
updated: 2026-07-21
archived_at: null
branch: konradantonik/ex-554-podsumowanie-dodac-figure-kwota-do-zaplaty-podwykonawcy
worktree: null
---

## Notes

Dziś jeden blok „Podsumowanie" (`KosztorysSummary`) renderuje się identycznie we wszystkich trzech
widokach edytora V2 (Klient / Z narzędziami / Bez narzędzi) — tylko robocizna jest pod spodem
przeliczana per widok. Materiały / Wpłaty / Rabat / Do zapłaty to pojęcia **klienckie** i nie mają
sensu na planie podwykonawcy.

Slice rozdziela to: **widok Klient zostaje bez zmian**; widoki **Z narzędziami / Bez narzędzi**
dostają osobny blok **„Podsumowanie podwykonawców"**, który liczy stronę kosztową — ile ekipie się
należy z kosztorysu vs ile już wypłacono. Realizuje EX-554 („kwota do zapłaty podwykonawcy"),
domyka EX-551 (model robocizna = cena klienta, wypłaty = cena podwykonawcy).

## Model (potwierdzony — EX-551 Done, EX-554)

Każda praca w kosztorysie ma dwie ceny:

- **cena klienta** → robocizna (co płaci inwestor).
- **cena podwykonawcy** = cena klienta × współczynnik (domyślnie 0,65 „z narzędziami", 0,55 „bez";
  override na sekcji / pozycji) → co właściciel płaci ekipie.

Strona kosztowa podsumowania (owner, 2026-07-21):

- **Suma wykonanej pracy** (należne) = Σ cena podwykonawcy z **prac wykonanych** (odhaczone etapy /
  pomiar z natury), w cenie podwykonawcy **aktywnego widoku**. Rośnie z postępem robót.
- **Zaliczki (wypłaty)** = zrealizowane wypłaty (PAYOUT) przypisane do tej inwestycji, grupowane
  per pracownik.
- **Pozostało do wypłaty** = Suma wykonanej pracy − Σ zaliczek.

## Projekt bloku (widoki Z / Bez narzędzi)

```
Podsumowanie podwykonawców
──────────────────────────────────────────────────────────────
Suma wykonanej pracy                              45 000 zł   ← należne, cena podwykonawcy tego widoku, prace wykonane
──────────────────────────────────────────────────────────────
Zaliczki (wypłaty)
  Jan Kowalski        →                          −20 000 zł   ← link: wypłaty tego pracownika na tej inwestycji
  Piotr Nowak         →                          −12 000 zł
  Adam Wiśniewski     →                           −3 000 zł
  Zaliczki (wypłaty) razem                       −35 000 zł
──────────────────────────────────────────────────────────────
Pozostało do wypłaty                              10 000 zł   ← Suma wykonanej pracy − Zaliczki razem
```

Terminologia arkusza (owner): „Suma wykonanej pracy", „Zaliczki (wypłaty)", „Pozostało do wypłaty".

## Decyzje zablokowane

1. **Zakres = poziom inwestycji, bez atrybucji prac do ekip.** Suma wykonanej pracy i Σ zaliczek to
   obie wielkości cało-inwestycyjne, więc „Pozostało do wypłaty" jest arytmetycznie poprawne jako
   **łączna** kwota dla całej budowy. Świadomie **nie** mówi „komu ile jeszcze" — bo dane tego nie
   niosą (patrz „Ograniczenie z modelu danych"). Owner to akceptuje.
2. **Materiały / Marża znikają** z bloku podwykonawcy (materiały to osobny rejestr, nie płacimy ich
   ekipie; marża zostaje sprawą karty inwestycji).
3. **Zaliczki grupowane per pracownik** (nie surowa lista — jedna budowa ma i 118 wypłat / 10
   pracowników). Suma per pracownik zwija się do ≤~10 wierszy i pokazuje „komu ile wypłacono".
4. **Bez osi netto/brutto — jedna kolumna „Kwota".** (Owner, 2026-07-21, EX-558 Done: podwykonawcy
   płaceni bez VAT.) Wszystkie kwoty bloku to jedna liczba; przełącznik netto/brutto nie renderuje
   się w widokach Z/Bez narzędzi (zostaje tylko w widoku Klient). „Suma wykonanej pracy" **nie
   grosuje** — to samo, co zaliczki (kwoty gotówkowe).
5. **Do sumy wchodzą tylko wypłaty z przypisaną TĄ inwestycją.** Wypłaty bez inwestycji (właściciel
   płaci też poza inwestycjami) świadomie nie liczą się tutaj. ~5% historycznych wypłat nie ma
   inwestycji — będą niewidzialne dla tego bloku; to jest zamierzone.
6. **Link per pracownik** celuje w wypłaty (PAYOUT) tego pracownika na tej inwestycji — filtr
   `inwestycja + pracownik + typ=wypłata`, wzorem linków „Wpłaty"/materiały u klienta.
7. **Blok owner-only z natury** — widoki Z/Bez narzędzi są niedostępne w podglądzie klienta
   (`clientView` przypina widok do `client`), więc linki zawsze aktywne, bez wersji plain-text.

## Decyzja VAT — ROZSTRZYGNIĘTA (owner, 2026-07-21, EX-558 Done)

**Podwykonawcy płaceni bez VAT → blok NIE ma osi netto/brutto, jedna kolumna „Kwota".** Netto = brutto,
więc przełącznik byłby szumem. Przełącznik netto/brutto zostaje wyłącznie w widoku Klient. „Suma
wykonanej pracy" nie grosuje się — jest jedną kwotą, tak jak zaliczki. Upraszcza slice (znika cała oś
`moneyAxis` z tego bloku).

## Ograniczenie z modelu danych (dlaczego „per ekipa" nie teraz)

Zweryfikowane w schemacie i realnych danych (dev DB, 2026-07-21):

- **Zero atrybucji prac do pracownika/ekipy** w kosztorysie — ani pozycja, ani sekcja, ani etap, ani
  postęp nie ma pola „kto to robił". Plan pracy i plan pieniędzy to dwa rozłączne światy.
- **Brak encji „ekipa"** — pracownik to zwykły user; wypłata → jeden pracownik. Wypłata wisi na
  inwestycji, nigdy skrzyżowana „ten pracownik na tej inwestycji" w żadnym zapytaniu/UI dziś.
- **Wielu pracowników na jednej budowie to reguła** — jedna inwestycja: 10 pracowników / 118 wypłat.
- 509 wypłat: 482 (95%) z inwestycją, 452 (89%) z pracownikiem.

Konsekwencja: „Pozostało do wypłaty **per ekipa**" wymagałoby przypisania prac kosztorysu do ekip
(nowy schemat + UI przypisywania + ewentualna encja „ekipa"). To **osobny, większy slice na
przyszłość** — świadomie poza zakresem tego.

## Szkic implementacji (do doprecyzowania w /10x-plan)

- Rozdzielić `KosztorysSummary` na widok Klient (dzisiejszy) vs nowy `PodsumowaniePodwykonawcow`
  (albo jeden komponent z gałęzią per plan — decyzja w planie). Wołane z `KosztorysTotalsPanel`
  (`src/components/kosztorys/kosztorys-totals-panel.tsx`), wybór po `priceView`.
- „Suma wykonanej pracy" = już liczone: Σ subtotals prac **wykonanych** w cenie aktywnego widoku
  (`sectionSubtotalsForView(rows, stages, view)` w `src/lib/kosztorys/settlement.ts`,
  `use-kosztorys-editor.ts`). Uwaga: musi być baza **wykonana** (pomiar), nie przedmiar.
- Nowa figura serwerowa: wypłaty (PAYOUT) tej inwestycji **grupowane per pracownik** — nowe zapytanie
  w `src/lib/db` (dziś jest tylko total per inwestycja i lifetime-saldo per pracownik, nigdy
  skrzyżowane inwestycja×pracownik — patrz `src/lib/db/sum-transfers.ts`).
- Link pracownika → strona inwestycji z filtrem `type=PAYOUT&worker=<id>` (potwierdzić, że strona
  inwestycji wspiera filtr po pracowniku; jeśli nie — dołożyć).
- Bez netto/brutto: nowy blok nie przyjmuje `moneyAxis`; jedna kolumna kwot (EX-558 Done).

## Źródła

- **EX-554** — Podsumowanie: dodać figurę „kwota do zapłaty podwykonawcy".
- **EX-551** (Done) — DECYZJA: robocizna = cena klienta, wypłaty = cena podwykonawcy (współczynnik).
- **EX-535** — S-12 robocizna-from-kosztorys (nadrzędny arc P5).
- Arkusz testowy `1qN68vcevWgq0fXckdh4cuyBJ4iGZNlivVuHDvLuzWy4`, zakładki „zakres pracy z/bez
  narzędzi" (`R = P×0,65` / `0,55`) — cennik podwykonawcy.
- Tło domenowe: `context/reference/kosztorys-editor-domain-notes.md` („Robocizna ↔ rozliczenia").
