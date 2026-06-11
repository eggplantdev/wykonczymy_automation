# Plan: wydatki „rozliczone" (R+M) — flaga `settled`

> **Cel (PL):** umożliwić oznaczenie wydatku inwestycyjnego jako „rozliczony" (materiał R+M
> wliczony w cenę robocizny). Taki wydatek: schodzi z kasy jak zwykle, **nie** obciąża klienta
> (nie wchodzi do bilansu inwestora ani do sumy do zapłaty w kosztorysie), ale **obniża marżę**.
>
> **Rabat to OSOBNA funkcja — poza zakresem tego planu.** Patrz `docs/investment-financials-and-discount.md`.

## Kontekst — dlaczego (przeczytaj najpierw)

Pełna analiza modelu finansowego: `docs/investment-financials-and-discount.md`.

Skrót: aplikacja trzyma **dwie księgi** na tabeli `transactions`:

- **Bilans inwestora** = `wpłaty − materiały − robocizna` (`src/lib/calculate-balance.ts`)
- **Marża** (tylko admin) = `robocizna − wypłaty` (`src/lib/calculate-margin.ts`)

Dziś materiały (`INVESTMENT_EXPENSE`) **nie ruszają marży** — bo model zakłada, że klient za nie
płaci (pass-through). Przy robotach R+M materiał jest kosztem firmy, więc MUSI zejść z marży, a
NIE może obciążać klienta. Żaden obecny typ tego nie robi → dodajemy flagę.

## Decyzje zablokowane (ustalone z klientem)

1. **Implementacja: flaga `settled` na `INVESTMENT_EXPENSE`**, nie nowy typ transakcji.
2. Efekt flagi:

   | miejsce                        | zwykły `INVESTMENT_EXPENSE` | `settled = true`     |
   | ------------------------------ | --------------------------- | -------------------- |
   | kasa źródłowa                  | −kwota                      | −kwota (bez zmian)   |
   | lista transferów               | widoczny                    | widoczny (bez zmian) |
   | bilans inwestora (appka)       | +koszt                      | **pomija**           |
   | marża (appka)                  | bez wpływu                  | **−kwota**           |
   | kosztorys, kolumna E (`kwota`) | kwota                       | **PUSTE**            |
   | kosztorys, nowa kolumna        | —                           | kwota                |

3. **Kosztorys: kolumna E dla rozliczonych zostaje PUSTA.** To kluczowe — istniejące, ręcznie
   wklejone formuły klientów (`SUM(E:E)`, `SUMIF(C:C; typ; E:E)`) wtedy **same z siebie** pomijają
   rozliczone. Zero edycji formuł, zero przesuwania kolumn C/E.
4. **Nowa kolumna kwoty rozliczonej idzie ZA blokiem podsumowania** (RAZEM siedzi flush w kol. H,
   `sheets.ts:377`). Pozycja liczona dynamicznie (`SUMMARY_START_COL + 1 + liczba_typów`).
5. **Odłożone „na przyszłość":** kolizja nowej kolumny z rosnącym blokiem RAZEM (gdy dojdzie nowy
   typ wydatku) oraz migracja istniejących zakładek. Na razie: nowa kolumna pojawia się w
   kosztorysach od momentu re-setupu/utworzenia; stare bez niej działają poprawnie (bo E i tak je
   pomija).

## Model matematyczny (dowód spójności)

Mini-przykład: wpłata D=1000, materiał pass-through M=200, materiał rozliczony S=100, robocizna
L=500, wypłaty P=0. Firma trzyma w kasie `1000−200−100 = 700`.

- **Bilans** = `D − (materiały − S) − L` = `1000 − 200 − 500` = **+300** (kredyt klienta)
- **Marża** = `L − P − S` = `500 − 0 − 100` = **+400**
- Kontrola: `300 + 400 = 700` = gotówka w kasie. ✅ Nic nie ginie, nic się nie dubluje.

„Rozliczony rusza TYLKO marżę": wobec świata bez tego wydatku — bilans bez zmian (300), marża
−100, kasa −100.

## Dane bazowe do regresji (inwestycja 31 = „11 Listopada 40")

Stan przed zmianą (z `DB_POSTGRES_URL`, lokalna baza):

- robocizna `LABOR_COST` = 235 911,00
- materiały (`INVESTMENT_EXPENSE` + `CORRECTION`) = 132 416,37 (z czego korekty −3 247,24)
- wpłaty = 160 999,34 · wypłaty `PAYOUT` = 95 824,00
- **Bilans = −207 328,03 · Marża = 140 087,00**

Po oznaczeniu wydatku X jako `settled`: marża spada o X, bilans rośnie o X (mniej ujemny), kasa
bez zmian względem stanu „wydatek istniał". Użyj tego do weryfikacji po Fazie 1.

---

## FAZA 1 — strona aplikacji (marża + bilans)

### 1.1 Pole `settled` w kolekcji

`src/collections/transfers.ts` — dodaj checkbox (wzór jak `cancelled`, `:205-214`):

```ts
{
  name: 'settled',
  type: 'checkbox',
  defaultValue: false,
  label: { en: 'Settled (R+M, not billed to client)', pl: 'Rozliczone (R+M, nie obciąża klienta)' },
  admin: {
    condition: (data) => data?.type === 'INVESTMENT_EXPENSE',
    description: {
      en: 'Material absorbed by the company: leaves the register, reduces margin, NOT billed to the client.',
      pl: 'Materiał na koszt firmy: schodzi z kasy, obniża marżę, klient NIE płaci za niego dodatkowo.',
    },
  },
}
```

- Bez `access.update:() => false` — flaga ma być edytowalna po fakcie (klient: „dla testów").
- Opcjonalny guard w `src/hooks/transfers/validate.ts`: ustaw `settled=false`, gdy
  `type !== 'INVESTMENT_EXPENSE'` (defensywnie).

### 1.2 Migracja

**Hand-write migrację** — `migrate:create` generuje phantom drift (patrz
`memory/project_migrate_create_stale_snapshots.md`). Dodaj kolumnę:

```sql
ALTER TABLE "transactions" ADD COLUMN "settled" boolean DEFAULT false;
```

W `down`: `ALTER TABLE "transactions" DROP COLUMN "settled";`. Wzoruj się na ostatniej migracji w
`src/migrations/`. Po dodaniu pola uruchom `pnpm generate:types` (plik `payload-types.ts` jest w
`.gitignore` — nie commituj go).

### 1.3 Agregacja SQL — wydziel `settled` jako osobny koszyk

`src/lib/db/sum-transfers.ts`. Settled musi być **wyłączone** z kosztów materiałowych/kategorii i
**wystawione** jako osobna suma `totalSettled`.

**a) `InvestmentFinancialsT`** (typ, ~`:135-142`) — dodaj `totalSettled: number`.

**b) `sumFilteredByType`** (`:287-311`, ścieżka strony inwestycji) — zbucketuj settled jako pseudo-typ:

```sql
SELECT
  CASE WHEN type = 'INVESTMENT_EXPENSE' AND settled IS TRUE
       THEN 'INVESTMENT_EXPENSE_SETTLED' ELSE type END AS type,
  COALESCE(SUM(amount), 0) AS total
FROM transactions
WHERE cancelled IS NOT TRUE
  ${conditions}
GROUP BY 1
ORDER BY total DESC
```

**c) `deriveFinancials`** (`:260-276`):

- `totalMaterialCosts` = `INVESTMENT_EXPENSE` (już bez settled) + `CORRECTION` (bez zmian w kodzie — bucket sam je odjął)
- dodaj `totalSettled: totalByType(byType, 'INVESTMENT_EXPENSE_SETTLED')`

**d) `sumCategoryBreakdown`** (`:210-236`) — dodaj `AND settled IS NOT TRUE`, żeby rozliczone nie
wchodziły do kafelków kategorii (czyli do bilansu w UI).

**e) `sumAllInvestmentFinancials`** (`:148-204`, lista inwestycji) — to samo, oddzielnie:

- `total_costs` CASE: dopisz `AND settled IS NOT TRUE`
- dodaj `total_settled` = `SUM(CASE WHEN type='INVESTMENT_EXPENSE' AND settled IS TRUE THEN amount ELSE 0 END)`
- zapytanie kategorii (`:167-176`): dopisz `AND settled IS NOT TRUE`
- zmapuj `totalSettled` w budowie `map` (`:193-200`)

### 1.4 Marża

`src/lib/calculate-margin.ts` — dołóż parametr:

```ts
export const calculateMargin = (laborCosts: number, totalPayouts: number, totalSettled = 0) =>
  laborCosts - totalPayouts - totalSettled
```

Zaktualizuj komentarz (settled = pochłonięty koszt materiału obniżający zysk z robocizny).

### 1.5 Bilans

`src/lib/calculate-balance.ts` — **bez zmian w logice**, ale potwierdź: `totalMaterialCosts` już
nie zawiera settled (krok 1.3), więc `wpłaty − materiały − robocizna` automatycznie pomija
rozliczone. Dodaj komentarz wyjaśniający, że settled jest celowo poza kosztami.

### 1.6 UI — wiersz „Materiały rozliczone"

`src/components/investments/financial-stats.tsx`:

- nowy prop `totalSettled?: number`
- `margin = calculateMargin(totalLaborCosts, totalPayouts, totalSettled)`
- pokaż w bloku **admin-only** (obok „Wypłaty"/„Marża", `:74-83`) jako `StatButton`
  „Materiały rozliczone (R+M)" na pomarańczowo (`border-chart-orange`).
- **NIE** dodawaj do `fields` / `rows` — inaczej wejdzie do sumy bilansu (toggle).
- `src/lib/map-category-costs.ts` — bez zmian (settled nie ma być w `buildFinancialFields`).

Przekaż `totalSettled` ze strony: `src/app/(frontend)/inwestycje/[id]/page.tsx` (tam gdzie
`deriveFinancials` → `FinancialStats`). Sprawdź też inne miejsca renderujące `FinancialStats`
(np. lista inwestycji), żeby prop był podpięty.

### 1.7 Formularz aplikacji

Znajdź formularz wydatku inwestycyjnego w `src/components/forms/` (TanStack Form, `useAppForm`).
Dodaj checkbox „Rozliczone" widoczny dla `type === 'INVESTMENT_EXPENSE'`. Zaktualizuj schemat Zod
i server action w `src/lib/actions/` (przekazanie `settled` do `payload.create/update`).

### 1.8 Weryfikacja Fazy 1

- `pnpm typecheck`, `pnpm lint`
- testy: zaktualizuj/dodaj do `src/__tests__/` (np. `shape-rows.test.ts`) — case z settled:
  marża spada o kwotę, bilans rośnie o kwotę.
- ręcznie: oznacz jeden wydatek na inw. 31 jako settled, porównaj marżę/bilans z liczbami wyżej.
- **Nie uruchamiaj pełnego suite ani nie pushuj bez pytania** (patrz pre-push hook + reguły).

---

## FAZA 2 — kosztorys (Google Sheets)

> Zależność: `settled` z Fazy 1 (pole już w bazie).
> Pliki: `src/lib/google/sheets.ts`, `src/lib/actions/sheets-sync.ts`.

Reguły (ustalone):

- **Rozliczony → kolumna E (`kwota`) PUSTA.** Zwykły → E jak dziś.
- **Kwota rozliczona → nowa kolumna ZA blokiem RAZEM**, pozycja liczona dynamicznie.
- Nowy `RAZEM rozliczone = SUM(nowa_kolumna)`.

### 2.1 Routing kwoty (E puste dla settled)

- `AppRowT` (`sheets-sync.ts:14-22`) — dodaj `settled: boolean`.
- mapper `expenseRow` (`sheets-sync.ts:81-98`) i `loadAppMaterialRows` (`:103-127`) — przenieś
  `settled` z transakcji.
- `valuesByField` (`sheets.ts:216-226`) — gdy `settled`: `amount` (kol. E) = `''`, kwota ląduje w
  polu kolumny rozliczonej; gdy nie: jak dziś.

### 2.2 Nowa kolumna + podsumowanie

- `buildMaterialySummary` (`sheets.ts:83-94`) — po blokach per-typ dodaj `RAZEM rozliczone` z
  `=SUM(<kolumna_rozliczona>)`. Uwaga: kolumna rozliczona jest ZA podsumowaniem → policz jej literę
  z `SUMMARY_START_COL + 1 + expenseTypes.length`.
- `setupMaterialyTab` (`sheets.ts:403+`) — nagłówek + format waluty nowej kolumny; zakres
  formatowania warunkowego (kolory wg typu, `:586-606`) rozszerz, jeśli kolory mają objąć też
  rozliczone.

### 2.3 Pułapka: matcher `kwota`

`FIELD_MATCHERS.amount = h.includes('kwota')` (`sheets.ts:47`) złapie też nagłówek „kwota
rozliczona". Daj nowej kolumnie nagłówek bez słowa „kwota" (np. „rozliczone R+M") **albo** zaostrz
matcher amount do `h === 'kwota'`. Inaczej sync pomyli kolumny przy odczycie nagłówków
(`resolveHeaders`).

### 2.4 Migracja istniejących zakładek — ODŁOŻONE

`setupMaterialyTab` jest idempotentne (re-runnable). Decyzja o jednorazowym przeleceniu istniejących
kosztorysów = „na przyszłość". Stare zakładki bez nowej kolumny działają poprawnie (E pomija
rozliczone w formułach klienta).

### 2.5 Weryfikacja Fazy 2

- preview/apply sync na inwestycji testowej z 1 wydatkiem settled: E puste, kwota w nowej kolumnie,
  `RAZEM` (E) nie zawiera rozliczonego, `RAZEM rozliczone` = ta kwota.
- sprawdź, że ponowny sync (reconcile) nie duplikuje/nie czyści nowej kolumny.

---

## Po wszystkim

- `simplify` na zmienionym kodzie przed commitem (`memory/feedback_simplify_after_big_changes.md`).
- Commit po jawnym poleceniu, staging po ścieżce (nie `git add -A`). Bez push bez pytania.
- Zaktualizuj `docs/investment-financials-and-discount.md`, jeśli model się doprecyzuje.

## Pozostałe pytania (do klienta, nie blokują Fazy 1)

- Czy sumy per-typ (Materiały budowlane/wykończeniowe) mają mieć też wariant „rozliczone"?
- Czy `settled` kiedykolwiek dotyczy `CORRECTION`, czy tylko `INVESTMENT_EXPENSE` (na teraz: tylko EXPENSE).
- **Rabat** — osobny feature: nowy odjemnik marży + obniżka salda. Nie tutaj.
