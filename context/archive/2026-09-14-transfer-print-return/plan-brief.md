# Drukowanie przefiltrowanej listy transakcji — Plan Brief

> Plan i research skasowane przy archiwizacji — ich rationale poszło do
> `context/foundation/lessons.md`; pełny tekst nadal pod
> `git show <sha>^:context/changes/2026-09-14-transfer-print-return/{plan,research}.md`.
> Decyzje bramki review: `review-gate.md` obok.

## What & Why

Wraca przycisk „Drukuj" w toolbarze tabeli transakcji, skasowany 2026-08-12 przez EX-672 razem
z eksportem CSV. Właściciel zgłosił, że był używany. Wraca **sam wydruk wierszy** — bez nagłówka
z figurami finansowymi, bo to nagłówek był powodem usunięcia: liczył własny „Bilans" jako sumę
widocznych kafelków v1 przez globalny store, czyli był drugim, niezależnym czytnikiem figur.

## Starting Point

Przycisku nie ma, a `git revert` nie wejdzie — siedem modułów, na których wisiał patch, nie istnieje
już pod tymi nazwami, i trzy zachowania zmieniły się po usunięciu (`LOSS` się odwrócił, kolejność
kolumn stała się stanem użytkownika, sygnatura toolbara się zmieniła). Przetrwały natomiast trzy
rzeczy, które zdejmują większość pracy: akcja `fetchFilteredTransfers` (nieostronicowana, już
wyklucza anulowane), slot toolbara, i sprawdzony mechanizm druku z podglądu faktury.

## Desired End State

Na `/inwestycje/[id]`, `/kasa/[id]` i `/pracownicy/[id]` stoi „Drukuj". Klik dociąga cały
przefiltrowany zbiór (wszystkie strony), odtwarza sortowanie z ekranu, bierze kolumny widoczne
w kolejności ustawionej przez użytkownika i otwiera nowe okno z czystą tabelą oraz dialogiem druku.
Anulowane nie wychodzą. Ctrl+P na samych stronach aplikacji zachowuje się jak dziś.

## Key Decisions Made

| Decyzja                         | Wybór                                                | Dlaczego                                                                                                       | Źródło     |
| ------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------- |
| Zakres wydruku                  | Cały przefiltrowany zbiór, wszystkie strony          | Jak w oryginale; stronicowanie to sprawa ekranu                                                                | Właściciel |
| Anulowane i `CANCELLATION`      | Nieobecne                                            | Jak w oryginale — akcja już to robi, bez zmian                                                                 | Właściciel |
| Sortowanie i widoczność kolumn  | Odtwarzane / honorowane                              | Jak w oryginale                                                                                                | Właściciel |
| Kolejność kolumn                | Honorowana                                           | Jedyna rzecz ponad oryginał — `ranks` doszło 2026-08-26                                                        | Właściciel |
| Nagłówek z figurami             | Nie ma go                                            | Rozpuszcza problem drugiego czytnika, płaszczyznę v1/v2 i dług w `test:parity`                                 | Właściciel |
| Gdzie żyje tekst komórki        | `meta.printValue` na istniejących definicjach kolumn | Jedno źródło etykiety, kolejności, widoczności i tekstu — skasowany rejestr zdążył się już rozjechać z ekranem | Plan       |
| „Faktura" / „Notatka" / „Akcje" | Nigdy nie drukowane                                  | To widżety, nie treść; brak `printValue` JEST mechanizmem wykluczenia                                          | Plan       |
| Hosty                           | Trzy, te co mają „Faktury"                           | `/raporty` to stub; dashboard świadomie rezygnuje i ma niezakotwiczony filtr                                   | Plan       |
| E2E                             | Zgłoszone do `e2e-backlog`                           | Przechwycenie popupa to najdroższa część zmiany; dług musi być na tablicy, nie w archiwum                      | Plan       |

## Scope

**W zakresie:** przycisk w toolbarze na trzech stronach, mapa tekstowa kolumn, odtworzenie
sortowania, builder dokumentu HTML z własnym arkuszem druku, własna flaga `print?` w konfiguracji.

**Poza zakresem:** nagłówek z figurami, CSV, PDF, nowe zależności, trzecia noga w `test:parity`,
globalny `@media print`, `/raporty`, dashboard menedżera, zmiany w `fetch-transfers-for-invoices.ts`.

## Architecture / Approach

Kluczowe odkrycie planu: `table.getVisibleLeafColumns()` zwraca kolumny **już przestawione**
zgodnie z `columnOrder` (zweryfikowane w `@tanstack/table-core@8.21.3` — `getAllLeafColumns`
przepuszcza listę przez `_getOrderColumnsFn()`). Toolbar dostaje `table` w kontekście, więc
widoczność, kolejność, etykiety i stan sortowania schodzą z jednego obiektu — bez osobnego
przeciągania `ranks`, jak zakładał research.

Przepływ: `fetchFilteredTransfers(where)` → `sortTransferRows` → kolumny widoczne przefiltrowane do
tych z `meta.printValue` → `buildTransfersPrintHtml` → `window.open('', '_blank')` → `print()`.

## Phases at a Glance

| Faza                          | Co dostarcza                                                               | Główne ryzyko                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1. Tekst kolumny i sortowanie | `meta.printValue` na 16 kolumnach, `columnLabel()`, przywrócony komparator | Rozjazd tekstu z komórką ekranową — dlatego siedzi obok niej w tym samym pliku                 |
| 2. Dokument i przycisk        | Builder HTML + `PrintTransfersButton`                                      | Escapowanie wolnego tekstu w opisie; blokada popupów                                           |
| 3. Wpięcie w strony           | Flaga `print?`, render, trzy strony, issue E2E                             | Pułapka opcjonalnego pola — strona bez flagi nie zapali `tsc`, przycisk po prostu nie istnieje |

**Warunki wstępne:** brak — zero migracji, zero nowych zależności.
**Szacowany rozmiar:** jedna sesja, ~10 plików (4 nowe).

## Open Risks & Assumptions

- **Cicha opcjonalność flagi** — jedyne zabezpieczenie to ręczne sprawdzenie trzech hostów; to ta
  sama klasa pułapki, przez którą EX-672 skasował producentów bez żadnego sygnału z typecheckingu.
- **Zerowe pokrycie browserowe na wejściu** — dokładnie stan, który pozwolił skasować używaną
  funkcję. Świadomie odłożone, ale zgłoszone jako issue, nie jako zdanie w commicie.
- Zakładam, że właściciel mówi o wydruku z tabeli transakcji, nie o „Drukuj" z podglądu faktury,
  który działa do dziś. Research stawia to jako pytanie nr 1; `change.md` rozstrzyga je na wydruk
  listy.

## Success Criteria (Summary)

- Właściciel drukuje przefiltrowaną listę z karty inwestycji, kasy i pracownika, i papier wygląda
  jak ekran — te same kolumny, ta sama kolejność, to samo sortowanie.
- Na wydruku nie ma anulowanych ani kolumn, które na ekranie są przyciskami.
- Ctrl+P na stronach aplikacji nie zmienił się ani o piksel.
