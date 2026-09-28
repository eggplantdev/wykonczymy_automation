---
created: 2026-07-20
updated: 2026-08-15
verified_at: 938e0564
method: m4l5-1 (DDD domain distillation)
---

# Destylacja domeny — Wykończymy

Regeneracja od zera (bramka 3 changeu `kosztorys-terminology`). Poprzednia wersja opisywała kod
sprzed rozbicia `settlement.ts` na pięć plików (EX-650), sprzed usunięcia `zaliczki.ts` (EX-536)
i sprzed EX-675, który odwrócił jej tezę o stracie. Każde twierdzenie poniżej ma kotwicę
`plik:linia` sprawdzoną przy `938e0564`.

---

## KROK 0 — Kontekst

Dashboard zarządzania firmą wykończeniową: kasy, transfery, inwestycje, pracownicy, i — od v2 —
**kosztorys** jako osobna płaszczyzna pieniądza. UI polskie, kod angielski.

Dwie płaszczyzny liczą tę samą inwestycję **niezależnie**:

- **transakcje** — to, co zaksięgowano na transferach (`src/collections/transfers.ts`),
- **kosztorys** — to, co wynika z rozpiski pozycji i etapów.

Ich zderzenie jest świadome i nazwane: `buildKosztorysReconciliation`
(`src/lib/kosztorys/reconciliation.ts:114`) porównuje dokładnie dwie figury — robociznę i rabat.

---

## KROK 1 — Ubiquitous language (stan faktyczny kodu)

| Termin (arkusz / biznes) | Kod                                       | Kotwica                                     |
| ------------------------ | ----------------------------------------- | ------------------------------------------- |
| Kosztorys                | `sheet` / slug `kosztoryses`              | `src/collections/sheets.ts`                 |
| Pozycja kosztorysu       | `kosztorys-items`                         | `src/collections/kosztorys-items.ts:13`     |
| Sekcja / dział           | `kosztorys-sections`                      | `src/collections/kosztorys-sections.ts:8`   |
| Etap                     | `kosztorys-stages`                        | `src/collections/kosztorys-stages.ts:9`     |
| Postęp etapu             | `stage-progress.qtyDone`                  | `src/collections/stage-progress.ts:31`      |
| Przedmiar                | `plannedQty`                              | `src/collections/kosztorys-items.ts:39`     |
| Pomiar z natury          | Σ `qtyDone` po etapach — **nie kolumna**  | `settlement-rows.ts:19` (`rowTotalQtyDone`) |
| Cena j.m. (klient)       | `clientPrice`                             | `src/collections/kosztorys-items.ts:43`     |
| Rabat pozycji            | `discountType` / `discountValue`          | `src/collections/kosztorys-items.ts:41-42`  |
| Płaszczyzna narzędziowa  | `plane` na etapie (`w_tools`/`no_tools`)  | `src/collections/kosztorys-stages.ts:36`    |
| Wartość wykonana (T)     | `rowValueForView`                         | `settlement-rows.ts:42`                     |
| Pozostało                | `rowRemainingForView`                     | `settlement-rows.ts:67`                     |
| Suma prac (pre-rabat)    | `laborCostsNetFromKosztorys`              | `settlement-client-totals.ts:66`            |
| Rabat kliencki (łącznie) | `discountNetFromKosztorys`                | `settlement-client-totals.ts:67`            |
| Robocizna (post-rabat)   | `laborCostsNet`                           | `summary-reading.ts:14`                     |
| Tryb rozliczenia         | `SettlementModeT` (`NET`/`GROSS`/`MIXED`) | `settlement-mode.ts:15`                     |
| Marża                    | `calculateMargin`                         | `src/lib/db/calculate-margin.ts:16`         |
| Bilans                   | `calculateBalance`                        | `src/lib/db/calculate-balance.ts:11`        |
| Rabat na materiałach     | `materialsNetDiscount`                    | `src/lib/db/investment-financials.ts:19`    |
| Strata                   | `totalLoss`                               | `src/types/investment-financials.ts`        |
| Saldo kasy               | `registerBalance`                         | `src/lib/queries/register-balance.ts:10`    |
| Rozliczenie podwykonawcy | `subcontractorDueByPlane`                 | `src/lib/kosztorys/subcontractor-due.ts:39` |

**Trzy terminy Category A** (polski zostaje, bo nie ma czystego angielskiego odpowiednika):
`kosztorys`, `przedmiar`, `pomiar`. Wszystko inne jest angielskie — pełne rulingi w
`context/domain/02-glossary.md`.

### Pojęcia, których poprzednia mapa nie znała

- **`materialsNetDiscount`** — rabat udzielony na materiałach. Zachowuje się jak rabat robocizny:
  **podnosi bilans i obniża marżę** (`calculate-balance.ts`, `calculate-margin.ts`). Wchodzi do
  `InvestmentFinancialsT` (`src/types/investment-financials.ts:26`) i liczony jest w
  `src/lib/db/investment-financials.ts:92,109`.
- **`SettlementModeT`** — jak inwestycja jest rozliczana z klientem (netto / brutto / mieszane).
  Decyzja o **transakcji handlowej**, trzymana na inwestycji, nie preferencja czytelnika:
  `settlement-mode.ts:5-9`. Rzutuje na oś pieniądza siatki (`settlementModeToGridAxis:59`)
  i wyłącza stawkę netto materiałów przy brutto (`effectiveMaterialsNetRate:65`).
- **`subcontractorDueByPlane`** — należność podwykonawcy liczona **per etap, przy cenie własnej
  płaszczyzny tego etapu**. Zastępuje wcześniejsze przeliczanie 100% wykonanej pracy przy jednej
  cenie, które na inwestycji mieszanej podwajało pieniądze (`subcontractor-due.ts:21-27`).
- **`SummaryReadingT`** — typ-przełącznik płaszczyzny; nie figura (`summary-reading.ts:14`).

### Terminy usunięte z mapy

- **Zaliczka** — `src/lib/kosztorys/zaliczki.ts` nie istnieje (EX-536). Tag cache
  `kosztorysStage` opisywany przez poprzednią destylację razem z nim jest martwy.
- **`wplatyNet` / `materialyNet`** — zero trafień w drzewie; hybrydy już wycięte.
- **`measured_qty`** — dropnięte przez EX-489; został `sheetMeasuredQty`
  (`kosztorys-items.ts:40`, `readOnly`) jako pole importu z arkusza, nie źródło pomiaru.

---

## KROK 2 — Poddomeny

| Poddomena                         | Klasa       | Dlaczego                                                                  |
| --------------------------------- | ----------- | ------------------------------------------------------------------------- |
| Kosztorys (rozpiska + etapy)      | **Core**    | Tu żyje przewaga: własny model wyceny, etapów i płaszczyzn narzędziowych. |
| Rozliczenie klienta (settlement)  | **Core**    | Pięć plików `settlement-*` — reguły, których arkusz nie umie wyrazić.     |
| Rekoncyliacja kosztorys↔transfery | **Core**    | Instrument weryfikacyjny właściciela; nie ma go w żadnym gotowcu.         |
| Rozliczenie podwykonawców         | **Core**    | Per-etap, per-płaszczyzna, per-osoba (EX-613).                            |
| Transfery i kasy                  | **Support** | Zwykła księga gotówki; wartość w integracji, nie w modelu.                |
| Sync z Google Sheets              | **Support** | ACL do cudzego systemu; kandydat na osobny slice łuku l5.                 |
| Inwestycje / leady / pracownicy   | **Support** | CRUD nad Payloadem.                                                       |
| Auth, cache, env                  | **Generic** | Payload JWT, `unstable_cache`, walidowany env.                            |

---

## KROK 3 — Agregaty i niezmienniki

### A. Pozycja kosztorysu (`kosztorys-items` + jej `stage-progress`)

Kandydat na prawdziwy agregat — **dziś nim nie jest**: `stage-progress` to osobna kolekcja
zapisywana niezależnie od pozycji.

Niezmienniki dziś **liczone** (nie egzekwowane zapisem):

1. **Pomiar = Σ etapów.** Nie ma kolumny „pomiar"; `rowTotalQtyDone` (`settlement-rows.ts:19`)
   sumuje etapy widoczne w danym widoku. Parametr `view` jest **wymagany**, nie domyślny —
   domyślka po cichu przywróciłaby odczyt ślepy na płaszczyznę (`settlement-rows.ts:15-17`).
2. **„Pozostało" kotwiczy do przedmiaru**, nie do etapów: `rowRemainingForView`
   (`settlement-rows.ts:67`) = wartość przedmiaru − wartość wykonana. Suma w stopce i „Razem"
   pomija wiersze ponad przedmiar (`isRemainingOverrun`, EX-885) — wiersz zostaje ujemny i czerwony.
3. **Przekroczenie przedmiaru** jest liczone przy pomiarze klienckim, nigdy przy aktywnym widoku —
   przedmiar nie ma płaszczyzny (`settlement-rows.ts:116` + docblock).

### B. Inwestycja — bilans i marża

```
bilans = przychody − (materiały + robocizna) + rabat + materialsNetDiscount + strata
marża  = robocizna − wypłaty − rabat − strata − rozliczone − materialsNetDiscount
```

`src/lib/kosztorys/calculate-balance.ts`, `calculate-margin.ts`.

Od EX-649 obok tej marży stoi druga — nie zamiast niej. Powyższa zostaje żywa na v1, `/raporty`
i w kolumnie „Marża":

```
prognoza          = przedmiar × cena − przedmiar × stawka ekipy   (scenariusz: z narzędziami / bez)
marża rzeczywista = robocizna − rabat − należne podwykonawcom − rozliczone − strata
```

`src/lib/kosztorys/margin-forecast.ts`, `margin-v2.ts`. Prognoza nie zna rabatu, straty ani
materiału wliczonego w robociznę; marża rzeczywista wycenia ekipę z kosztorysu, nie z wypłat, i
zwraca `null` (a nie zero), gdy któryś etap ma wykonaną pracę bez rozliczenia.

**Poprzednia destylacja twierdziła, że strata nigdy nie dotyka bilansu — to już nieprawda.**
EX-675 wprowadził stratę do obu formuł: obniża marżę i **podnosi** bilans (klient przestaje być
winien to, co firma wzięła na siebie), po wartości nominalnej, nigdy nie poszerzając bazy VAT
(AGENTS.md, „Transfer Business Logic").

### C. Rozliczenie klienta — arytmetyka pre/post-rabat

`clientTotalsFromSubtotals` (`settlement-client-totals.ts:54`) produkuje cztery figury:

```
doneNet         = Σ netto wykonane
itemRabatNet    = Σ rabatów pozycji
globalRabatNet  = rabat globalny
sumaPracNet     = doneNet + itemRabatNet          (:66)
rabatClientNet  = globalRabatNet + itemRabatNet   (:67)
```

Stąd `laborCostsNet + rabatClientNet = sumaPracNet` — ale **tylko na widoku klienckim**. Na
`w_tools`/`no_tools` równość nie zachodzi, dlatego faza 5 changeu `kosztorys-terminology` rozdziela
nazwę figury od nazwy operacji sumowania zamiast wieszać jedną nazwę nad obiema.

`executedWorkNetPreRabat` (`settlement-client-totals.ts:83`) nie ma **żadnego wywołania
produkcyjnego** — został jako parity-oracle dla testów (docblock `:79-81`).

### D. Rozliczenie podwykonawcy

Niezmiennik: **per etap relacja jest OR** — jedna ekipa wykonała, przy jednej cenie
(`subcontractor-due.ts:21-27`). Etap bez płaszczyzny nie kredytuje nikogo i podnosi
`hasUnconfirmedPlane` — kwoty renderują się krótsze, a ostrzeżenie stoi obok nich.
Σ `byWorker` === `combined` z konstrukcji; reszta bez przypisania jest własnym wpisem (`null`),
nigdy rozsmarowanym po przypisanych (`subcontractor-due.ts:16-19`).

### E. Szew rekoncyliacji

`buildKosztorysReconciliation` (`reconciliation.ts:114`) porównuje netto do netto:
`sumaPracNet` ↔ `laborCostsNetFromTransactions` oraz `rabatClientNet` ↔ `investmentRabat`.

**Wyciszenie jest per INWESTYCJA, nie per figura** (`reconciliation.ts:132`): odkąd EX-555 wyłączył
księgowanie `LABOR_COST`/`RABAT`, każda nowa inwestycja krzyczałaby bez końca — alarm, który dzwoni
na wszystkim, nie weryfikuje niczego. Reguła per-figura wyciszyłaby „robocizna zaksięgowana, rabat
nie", czyli dokładnie tę lukę, którą `showRabat` wypycha na ekran.

**Brak fallbacku jest niezmiennikiem, nie brakiem.** `readingFromKosztorys`
(`summary-reading.ts:33`) nigdy nie sięga do transferów: pusty kosztorys to odpowiedź „zero", nie
pytanie przekazane dalej. Legacy robocizna zostaje czytelna na v1 — to jest lista rzeczy do
wprowadzenia, nie defekt.

---

## KROK 4 — Rozjazdy MODEL vs KOD

| #   | Rozjazd                                                                                 | Status przy `938e0564`                                         |
| --- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Nazwa „Pomiar z natury" sugeruje pomiar w terenie; to formuła `=SUM(D:M)`               | **Żywy.** Rozstrzyga slice „niezmienniki", nie ten.            |
| 2   | Polskie identyfikatory dla figur generycznych (`saldo`, `sumaPrac`, `wydatki`)          | **Zamknięty.** EX-548 przemianował je; guard trzyma 21 rdzeni. |
| 3   | `wplatyNet` / `materialyNet` — hybrydy polsko-angielskie                                | **Zamknięty.** Zero trafień.                                   |
| 4   | Zaliczki jako osobny moduł                                                              | **Zamknięty.** `zaliczki.ts` usunięty (EX-536).                |
| 5   | „Strata nigdy nie dotyka bilansu"                                                       | **Odwrócony.** EX-675 — dotyka obu figur.                      |
| 6   | `settlement.ts` jako jeden god-module                                                   | **Zamknięty.** Pięć plików `settlement-*` (EX-650).            |
| 7   | `googleSheetId` `required: true, unique: true` — kosztorys nie może istnieć bez arkusza | **Żywy.** `src/collections/sheets.ts:44-50`.                   |
| 8   | Postęp etapu zapisywany poza agregatem pozycji                                          | **Żywy.** Cel slice'a „agregat".                               |
| 9   | `materialsNetDiscount` nieobecny w mapie domeny                                         | **Zamknięty tą regeneracją.**                                  |

---

## KROK 5 — Ranking refaktorów

1. **Agregat Kosztorys Item.** `stage-progress` zapisywany niezależnie od pozycji, więc niezmiennik
   „pomiar = Σ etapów" jest liczony przy odczycie, a nie chroniony przy zapisie. → slice „agregat".
2. **`googleSheetId` wymagany i unikalny** (`sheets.ts:44-50`) — model mówi „kosztorys istnieje sam
   z siebie", schemat mówi „tylko jako cień arkusza". → slice „ACL".
3. **Terminologia** — ten slice (EX-548).

### Świadome NIE-cele (nie proponować jako defekty)

- **Ujemne saldo rejestru dozwolone** — decyzja klienta (git `76dd757`, EX-410 canceled).
- **Nie ma podłogi „≥1 pozycja"** — decyzja właściciela (2026-08-31, EX-751 canceled): kosztorys
  wolno opróżnić do zera. Podłoga stała wcześniej wyłącznie w UI i broniła stanu osiągalnego dwiema
  innymi drogami („Wyczyść kosztorys", „Usuń sekcję") oraz w pełni obsłużonego (`EmptyState`
  z menu „Dodaj" i importem z arkusza). Zdjęta razem z `REMOVE_BLOCK_LAST_ITEM` i całym
  `ItemRemovalPlanT`; nie proponować jej z powrotem jako niezmiennika agregatu.
- ~~**Kosztorys v2 rozłączony od marży**~~ — nieaktualne od EX-555 (robocizna i rabat na liście czytane z kosztorysu) i EX-649 (marża rzeczywista i prognoza w panelu oraz na liście).
- **Polskie stringi UI i transkrybowane nagłówki arkusza** — poprawne z polityki.
- **`'RABAT'` w enumie i `'planowana'` w statusie inwestycji** — wartości zamrożone migracjami.

---

## Bottom line

Rdzeń domeny przesunął się od „kosztorys jako import arkusza" do „kosztorys jako druga płaszczyzna
pieniądza, świadomie porównywana z transakcjami". Trzy rzeczy, które ta regeneracja zmienia
w obrazie z lipca: strata **dotyka** bilansu, `settlement.ts` już nie istnieje jako jeden plik,
a `materialsNetDiscount` jest pełnoprawnym modyfikatorem obu figur inwestycji. Dług językowy
(EX-548) jest spłacony, a guard `local/no-domain-drift` pilnuje 21 rdzeni na `'error'` — kolejny
dług jest już architektoniczny: niezmienniki, agregat, ACL.
