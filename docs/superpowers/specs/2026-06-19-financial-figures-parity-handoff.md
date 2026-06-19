# Handoff: parzystość figur finansowych — listing vs strona szczegółów inwestycji

Data: 2026-06-19
Branch: `feat/settled-correction-parity`
Status: **bilans NAPRAWIONY (red→green na realnych danych); refaktor marży + usunięcie `extractFigures` POTWIERDZONE, jeszcze niezrobione.** Aktualny stan i potwierdzony plan: sekcje 13–16 (czytaj je pierwsze — są nowsze niż sekcje 1–12).

> Ten plik powstał po długiej sesji, w której agent (ja) wielokrotnie ogłaszał „zweryfikowane / na pewno działa", a weryfikacja dotyczyła złej warstwy. **Nie ufaj deklaracjom — ufaj wykonywalnym dowodom (test, który robi się czerwony, gdy psujesz dane).** Patrz sekcje 9 i 16.

---

## 1. Sedno problemu (jedno zdanie)

Te same figury finansowe (bilans, marża, materiały, wydatki inwestycyjne, wypłaty, settled) są **składane w wielu niezależnych miejscach w kodzie**; równość między listingiem a stroną szczegółów nie jest niczym wymuszona — to przypadek, który psuje się przy każdej zmianie, a nasze dotychczasowe testy tego **nie wykrywają**, bo testują funkcję, której żadna strona nie używa.

---

## 2. KONKRETNE, ZWERYFIKOWANE repro (zacznij tutaj)

Rozbieżność jest **żywa teraz** na realnych (starych) danych w lokalnej bazie. Nie trzeba nic dodawać.

| inwestycja                   | bilans na LISTINGU `/inwestycje` | bilans na SZCZEGÓŁACH `/inwestycje/<id>` | różnica |
| ---------------------------- | -------------------------------- | ---------------------------------------- | ------- |
| #59 Grójecka 99 Iwona Smorąg | **0,10 zł**                      | **−799,90 zł**                           | 800,00  |
| #22 Równoległa 8/61          | 0,00                             | −244,42                                  | 244,42  |
| #63 Grenady                  | 0,00                             | −450,07                                  | 450,07  |
| #38 telmak                   | 60 093,57                        | 59 536,27                                | 557,30  |
| #81 Barwna 8 Biblioteka      | 0,00                             | −91,02                                   | 91,02   |

**Przyczyna:** każda **korekta (CORRECTION), nie-settled, BEZ kategorii wydatku** na inwestycji.
Formularz **już** na to nie pozwala (walidacja `needsExpenseCategory` wymaga kategorii dla korekty z inwestycją), więc to są **stare dane** sprzed walidacji — i właśnie dlatego były bezcenne: pokazały, że test nie sprawdza tego, co trzeba.

**Zapytanie znajdujące zatrute wiersze** (read-only, lokalna baza):

```sql
SELECT investment_id, type::text, COUNT(*), SUM(amount)
FROM transactions
WHERE investment_id IS NOT NULL AND cancelled IS NOT TRUE
  AND type IN ('INVESTMENT_EXPENSE','CORRECTION') AND settled IS NOT TRUE
  AND expense_category_id IS NULL
GROUP BY investment_id, type;
```

**Kroki potwierdzenia tezy „testy zielone + ekran się nie zgadza":**

1. `/inwestycje` → „Grójecka 99 Iwona Smorąg" → bilans ≈ **0,10 zł**.
2. `/inwestycje/59` → „Bilans inwestora" (wszystkie kafelki zaznaczone) → ≈ **−799,90 zł**.
3. `pnpm test` i `pnpm test:parity` → **wszystko zielone**.

---

## 3. Dlaczego nasze testy NIE łapią tego (false confidence)

Te figury liczą się w trzech warstwach:

```
wiersze w DB → [1] query/agregacja → [2] złożenie w 6 figur → render na ekranie
```

- **`extractFigures`** (`src/lib/investment-figures.ts:15`) to warstwa [2], ale **NIE używa jej ŻADNA strona** — tylko testy i skrypt audytu.
- Oba testy parzystości (`src/__tests__/investment-financials-parity.test.ts`, `src/__tests__/investment-parity-db.test.ts`) porównują `extractFigures` ↔ `extractFigures`. Dane są realne, ale **kod liczący nie jest tym, który renderuje strony**. Po obu stronach `bilans = calculateBalance(financials)` → obie zawierają korektę → równe → zielono. Realnego bilansu strony szczegółów (suma kafelków) test nie dotyka.

To jest dokładnie ta pułapka: test wygląda, jakby porównywał listing ze szczegółami, a porównuje proxy z samym sobą.

---

## 4. Najgłębszy seam: DWIE różne funkcje `calculateBalance`

- `src/lib/calculate-balance.ts:6` — **statyczna formuła** na `financials`: `wpłaty − (totalMaterialCosts + robocizna) + rabat`. Komentarz w pliku: „Material costs **already include corrections**". Używa jej **LISTING** (`investments.ts`) i `extractFigures`. → korekty wliczone, też bez kategorii.
- `src/lib/export/header-fields.ts:7` — **suma WIDOCZNYCH kafelków**: `Σ field.amount` po polach z `visibility[label] !== false`. Używa jej **STRONA SZCZEGÓŁÓW** (toggle „Bilans inwestora") i wydruk/eksport. → korekta bez kategorii nie ma kafelka → poza sumą.

Bilans na szczegółach jest **interaktywny z założenia** (`ToggleStatButtons` — user odznacza kafelek kosztu i bilans się przelicza). Listing ma jedną statyczną liczbę. **Tego nie da się zunifikować bez usunięcia toggle'a.**

Analogicznie marża na szczegółach (`financial-stats.tsx:97-98`): `totalSettled` jest **re-derywowany z `settledFields`** (obiekty wyświetlane), a nie z `financials.totalSettled` — kolejna niezależna ścieżka.

---

## 5. Pełna mapa ścieżek składania figur (plik:linia)

| figura / strona                                               | gdzie składana                                                                                           | plik:linia                                                                              |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| LISTING bilans + marża                                        | ręcznie: `calculateBalance(financials)` + `calculateMargin(...)`                                         | `src/lib/queries/investments.ts:52-59`                                                  |
| LISTING — wejście do strony                                   | `fetchAllInvestments()`                                                                                  | `src/lib/queries/investments.ts:71`, strona `src/app/(frontend)/inwestycje/page.tsx:14` |
| SZCZEGÓŁY — pola                                              | `buildFinancialFields` = kafelki per-kategoria + Robocizna + Wpłaty + Rabat                              | `src/lib/map-category-costs.ts:22`                                                      |
| SZCZEGÓŁY bilans                                              | suma widocznych kafelków                                                                                 | `src/lib/export/header-fields.ts:7`                                                     |
| SZCZEGÓŁY marża                                               | `calculateMargin`, `totalSettled` z `settledFields`                                                      | `src/components/investments/financial-stats.tsx:97-98`                                  |
| SZCZEGÓŁY — wejście                                           | `deriveFinancials` → `buildFinancialFields` → `<FinancialStats>`                                         | `src/app/(frontend)/inwestycje/[id]/page.tsx:53,59,91`                                  |
| RAPORTY                                                       | jak szczegóły (`deriveFinancials` + `buildFinancialFields`)                                              | `src/app/(frontend)/raporty/page.tsx`                                                   |
| „kanoniczny" wrapper 6 figur (NIEUŻYWANY przez strony)        | `extractFigures`                                                                                         | `src/lib/investment-figures.ts:15`                                                      |
| formuła bilansu (statyczna)                                   | `calculateBalance(financials)`                                                                           | `src/lib/calculate-balance.ts:6`                                                        |
| formuła marży (5 arg. pozycyjnych!)                           | `calculateMargin(labor, payouts, rabat, loss, settled)`                                                  | `src/lib/calculate-margin.ts`                                                           |
| warstwa [1] — klasyfikator danych (NAPRAWIONA, single source) | `deriveFinancials`, `deriveCategoryBreakdowns`, `sumAllInvestmentFinancials`, `sumCategoryByTypeSettled` | `src/lib/db/sum-transfers.ts`                                                           |

Uwaga: `calculateMargin` ma 5 argumentów typu `number` po kolei — łatwo przestawić (`rabat`/`loss`) bez błędu typu. Każde miejsce składania wpisuje je ręcznie.

---

## 6. Co JUŻ zrobione i zacommitowane (na branchu)

Moje commity (od najnowszego):

- `c49f79c` docs(skill): poprawka kadencji backupu na godzinową
- `c847460` test(investments): DB-backed sweep parzystości — **ALE porównuje `extractFigures`↔`extractFigures` (proxy), patrz sekcja 3 — do przepisania**
- `9577a72` fix(investments): **single source of truth dla rozbicia kategorii (warstwa [1])** — settled CORRECTION liczony symetrycznie; `deriveCategoryBreakdowns`; usunięty martwy kod
- `40eceb5` refactor(transfers): jeden predykat `canBeSettled`

To, co realnie naprawione: **warstwa [1] (klasyfikacja/bucketing danych)** — settled CORRECTION trafia teraz symetrycznie do `totalSettled` i `settledCategoryCosts`. Tego się trzymaj, to jest dobre.

**Czego NIE naprawiono:** warstwy [2] (złożenie na stronach) — listing i szczegóły nadal liczą bilans dwiema różnymi metodami (sekcja 4).

**OBCE commity na branchu** (inny agent, NIE moje — wyjaśnić przed merge): `8a37e08`, `3245d0f`, `09a508e`, `0f7955f` (mail link, kolor typu settled, dark styles).

---

## 7. Konsekwencje „użyć `extractFigures` w obu miejscach" (rozważane, NIEzrobione)

- **Blokada na bilansie:** bilans szczegółów to interaktywna suma widocznych kafelków. `extractFigures` daje jedną statyczną liczbę → konsolidacja albo usuwa toggle, albo się nie stosuje. **Bilansu nie da się zunifikować jedną funkcją.**
- `extractFigures` zwraca 6 skalarów; strony potrzebują dużo więcej (pola per-kategoria, etykiety, tooltipy, formatowanie, obiekty toggle). Czyli max można podpiąć figury formułowe (marża, materiały, wypłaty, wydatki, settled), reszta zostaje.
- To refaktor żywego, interaktywnego UI → ryzyko regresji na dokładnie tych stronach, które ciągle źle weryfikowaliśmy.

---

## 8. Czego NAPRAWDĘ chcemy zagwarantować (właściwy invariant)

Nie „obie strony wołają jedną funkcję", tylko **właściwość per inwestycja**:

- bilans szczegółów **przy wszystkich kafelkach widocznych** == bilans listingu,
- marża szczegółów == marża listingu.

Ponieważ bilans liczony jest dwiema różnymi metodami **z założenia** (interaktywna suma vs statyczna formuła), gwarancją dla bilansu **musi być test właściwości**, nie współdzielony kod.

---

## 9. Dyscyplina (czego zabrakło — uczciwie, do trzymania w świeżej sesji)

1. **Żadnych deklaracji „działa" bez dowodu mutacyjnego.** Zanim ogłosisz, że test chroni inwariant: **celowo zepsuj** jedną stronę (np. zmień znak/składnik w `investments.ts` marży) → pokaż, że test robi się **CZERWONY** → cofnij. Test, który nie potrafi się zaczerwienić, jest bezwartościowy.
2. **Test ma uruchamiać realny kod renderujący liczbę**, nie proxy. Tu: realne `fetchAllInvestments` (listing) vs realne złożenie szczegółów (`buildFinancialFields` → `header-fields.calculateBalance` z pełną widocznością + `financial-stats`/`calculateMargin`).
3. **Stare/realne dane są testem prawdy.** To one wyłapały lukę. Każdy nowy guard sprawdź na pełnym lokalnym DB (`pnpm test:parity`), nie tylko na syntetyku.
4. Każda przyszła zmiana dotykająca figury: przejść przez wspólne złożenie tam, gdzie się da, i rozszerzyć test właściwości; **dla bilansu zawsze test właściwości.**

---

## 10. Rekomendowany plan dla świeżej sesji

1. **Napisz test właściwości na REALNYCH ścieżkach** (DB-backed, gated jak obecny `test:parity`): dla każdej inwestycji policz bilans i marżę **tak, jak liczy je strona** — listing przez `fetchAllInvestments`, szczegóły przez `buildFinancialFields` + `header-fields.calculateBalance` (pełna widoczność) + `financial-stats`/`calculateMargin`. Porównaj zaokrąglone.
2. **Uruchom go — MUSI być czerwony** na #22/#38/#59/#63/#81 (to potwierdza, że test działa). Dopiero wtedy szukaj naprawy.
3. **Napraw warstwę [2]** tak, by bilans szczegółów (wszystko widoczne) == bilans listingu. Decyzja do podjęcia: czy listing ma przestać wliczać nieskategoryzowane korekty (zrównać z sumą kafelków), czy szczegóły mają dodać kafelek „korekty bez kategorii" (zrównać z formułą). To jest **decyzja biznesowa** (czy nieskategoryzowana korekta obniża bilans inwestora), nie tylko techniczna.
4. **Dowód mutacyjny** (sekcja 9.1) zanim ogłosisz sukces.
5. e2e (Playwright) **niepotrzebne** — ryzyko siedzi w server-side TS, nie w JSX; harnessa i tak nie ma.

---

## 11. Stan repo / jak uruchomić

- Branch `feat/settled-correction-parity`, working tree czysty (poza ewentualnym tym plikiem).
- `pnpm test` → pełny suite (658 pass, 1 skip — DB test skipuje bez env).
- `pnpm test:parity` → `node --env-file=.env … vitest run …/investment-parity-db.test.ts` — ładuje `.env`, uderza w lokalny Docker Postgres. **Obecny test to proxy (sekcja 3) — do przepisania wg sekcji 10.**
- Pre-push hook (`.husky/pre-push:5`) woła `pnpm test:parity`; przy env+DB pada twardo, gdy DB nieosiągalne (świadomie, żeby nie było cichego skipa).
- Lokalna baza = kopia prod z dumpa (00:19), patrz osobne ustalenia o driftcie/ID-collision. Read-only do prod tylko przez `pnpm db:dump`.

---

## 12. Otwarte decyzje

1. **Biznesowa:** czy nieskategoryzowana korekta ma obniżać bilans inwestora? (decyduje, którą stronę „naprawiamy do której"). — **ROZSTRZYGNIĘTE, patrz sekcja 13.**
2. Czy konsolidować figury formułowe (marża/materiały/…) na `extractFigures` (sekcja 7) — osobno od bilansu. — **ROZSTRZYGNIĘTE inaczej: NIE przez `extractFigures` (usuwamy go), tylko przez `calculateMargin(financials)`. Patrz sekcja 15.**
3. Obce commity na branchu (sekcja 6) — przed merge.
4. Czy rozszerzyć parzystość na inne powierzchnie (raporty, wydruk/eksport, dashboard), które też wołają te funkcje składające. — patrz mapa w sekcji 14.

---

## 13. STAN BIEŻĄCY — bilans naprawiony (red→green na realnych danych)

**Decyzja biznesowa (potwierdzona przez właściciela):** nieskategoryzowana korekta **MA** wpływać na bilans inwestora → **listing jest poprawny**, naprawiamy stronę szczegółów.

**Co zrobione (niezacommitowane):**

- Napisany **prawdziwy** test parytetu na realnych ścieżkach składania: `src/__tests__/investment-render-parity-db.test.ts`. Liczy bilans i marżę tak, jak składają je strony (listing: `calculateBalance`/`calculateMargin`; detal: `buildFinancialFields` → `header-fields.calculateBalance` z pełną widocznością + `calculateMargin` z `settledFields`), per inwestycja, na realnym DB.
- Ten test **był czerwony** na 7 inwestycjach (#22, #26, #31, #38, #59, #63, #81) — różnica bilansu = suma nieskategoryzowanych korekt. To jest „naprawdę czerwony", zweryfikowany.
- **Fix:** `src/lib/map-category-costs.ts` → `buildFinancialFields` dodaje kafelek **„Korekta (bez kategorii)"** o wartości `totalMaterialCosts − Σ kategorii`, więc bilans szczegółów wlicza nieskategoryzowane korekty = bilans listingu.
- Po fixie: test **zielony** na realnych danych; pełny suite 657 pass + 1 skip; typecheck czysty.
- **Usunięte** dwa bezsensowne „proxy" testy (`investment-financials-parity.test.ts`, `investment-parity-db.test.ts`) — porównywały `extractFigures ↔ extractFigures` (funkcję, której żadna strona nie używa).
- `package.json` → `test:parity` przepięty na `investment-render-parity-db.test.ts`.

**Uczciwa ocena obecnego testu:** woła **realne funkcje liścia** (`calculateBalance`, `calculateMargin`, `buildFinancialFields`, `header-fields.calculateBalance`), ale **kopiuje składanie** zamiast wołać kod stron (listing przez `fetchAllInvestments` jest za authem; detal liczy bilans w komponencie React `ToggleStatButtons`). Wierny dziś; nie złapie zmiany **jak** strona składa figury. Refaktor z sekcji 15 to domyka.

---

## 14. Mapa WSZYSTKICH powierzchni pokazujących bilans/marżę (zweryfikowana grepem)

| powierzchnia                                                            | bilans skąd                                             | marża skąd                                                 | objęte testem?                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Listing `/inwestycje` (`investments.ts` → `lib/tables/investments.tsx`) | `calculateBalance(financials)` (formuła statyczna)      | `calculateMargin(5 arg)`                                   | TAK (parytet vs detal)                                               |
| Szczegóły `/inwestycje/[id]` (`financial-stats` → `ToggleStatButtons`)  | **suma widocznych kafelków** (interaktywny toggle)      | `calculateMargin(5 arg)`, `totalSettled` z `settledFields` | TAK                                                                  |
| Raporty `/raporty` (ten sam `financial-stats`)                          | suma widocznych kafelków                                | jak detal                                                  | częściowo — inny zakres (filtr, nie per-inwestycja)                  |
| Wydruk/eksport (`print-button` → `lib/export/header-fields`)            | `header-fields.calculateBalance` (suma widocznych)      | —                                                          | NIE (osobny seam; ta sama logika co toggle, ale druga implementacja) |
| Dashboard (`user-register-stats`, `register-balance-chart`)             | **salda KAS** (`sumAllRegisterBalances`) — INNE pojęcie | —                                                          | n/d — inna rodzina figur, nie bilans inwestycji                      |

Wnioski:

- `extractFigures` (`lib/investment-figures.ts`) — wołany **tylko** przez 2 testy + skrypt audytu. **Żadna strona/komponent.** Osierocony. NIE jest częścią kontraktu „bilans z kafelków" na stronie indywidualnej (ten liczą `buildFinancialFields` + `ToggleStatButtons`).
- Niepokryty seam: **wydruk vs ekran** — `header-fields.calculateBalance` (print) vs `ToggleStatButtons` (ekran) to **dwie implementacje** sumy widocznych. Logicznie to samo, ale nietestowane razem.
- Dashboard pokazuje salda kas, nie bilans/marżę inwestycji — osobna rodzina, nie ten parytet.

---

## 15. POTWIERDZONY plan refaktoru (marża + usunięcie `extractFigures`)

Cel: skasować 5 argumentów pozycyjnych przy marży i mglistą, nieużywaną przez strony funkcję `extractFigures`.

1. **`calculateMargin` bierze `financials`** — symetrycznie do `calculateBalance(financials)`:
   ```ts
   export const calculateMargin = (f: InvestmentFinancialsT) =>
     f.totalLaborCosts - f.totalPayouts - f.totalRabat - f.totalLoss - f.totalSettled
   ```
   Koniec z `calculateMargin(labor, payouts, rabat, loss, settled)` (5 arg. tego samego typu → łatwe do przestawienia).
2. **Listing** (`investments.ts`): `calculateBalance(financials)` + `calculateMargin(financials)`.
3. **Detal/Raporty**: marża liczona na serwerze `calculateMargin(financials)` i przekazana do `FinancialStats` jako liczba; komponent przestaje wołać `calculateMargin`. **Bilans z kafelków (toggle) ZOSTAJE nietknięty** — to legalny, osobny kontrakt.
4. **Usunąć `extractFigures`** + `src/__tests__/investment-figures.test.ts`; w `audit-investment-parity.ts` i `settled-differential.test.ts` zastąpić `extractFigures(fin)` bezpośrednimi `calculateBalance(fin)`/`calculateMargin(fin)`.
5. **Poprawić testy** wołające starą sygnaturę `calculateMargin(5 arg)`.
6. **Strażnik:** czerwony→zielony test `investment-render-parity-db.test.ts` ma zostać zielony; po refaktorze rozważyć, by liczył marżę przez `calculateMargin(financials)` (czyli realny kod stron).

Wzorzec (dla nauki): to **nie Factory** (fabryka tworzy obiekty). To **derived selector / adapter** nad surową formułą — jak `reselect`/computed property. Zasada: single source of truth / DRY.

**Niuans, który NIE znika:** bilans na detalu pozostaje interaktywny (suma kafelków). `calculateBalance(financials)` to wartość „przy wszystkich kafelkach widocznych"; równość tych dwóch pilnuje test parytetu.

---

## 16. LEKCJA (to całe back-and-forth — czego nie powtarzać)

1. **Ta sama figura składana niezależnie w wielu miejscach nie może być równa „przez przypadek".** Równość musi być wymuszonym inwariantem (wspólny kod tam, gdzie się da; test właściwości tam, gdzie kod musi się różnić — jak interaktywny bilans).
2. **Test parytetu jest bezwartościowy, jeśli wykonuje kod, którego żadna strona nie używa.** Testowaliśmy `extractFigures ↔ extractFigures` → zielono, gdy ekrany różniły się o setki zł na 7 inwestycjach. Test MUSI wołać realne funkcje, które renderuje powierzchnia, na realnych danych.
3. **Różnica legalna ≠ błąd.** Bilans listingu (formuła) vs bilans detalu (suma widocznych kafelków) różnią się **z założenia** (toggle). Błędem był brak testu, że zgadzają się w stanie domyślnym.
4. **Dowód czerwienią, nie rozumowaniem.** Nigdy nie ogłaszać „zweryfikowane / nie da się zepsuć" z samego rozumowania. Tylko z wykonywalnego red→green na realnej ścieżce (nasz test był czerwony na 7 inwestycjach, zielony po fixie).
5. **Stare/realne dane to wyrocznia.** Nieskategoryzowane korekty — niemożliwe do utworzenia dziś przez formularz — ujawniły lukę. Każdy guard sprawdzać na pełnym lokalnym DB, nie tylko na syntetyku.
6. **Niedbałe liczby (np. „4–6 miejsc") to też brak weryfikacji.** Precyzyjnie: marża = 1 wzór, 3 miejsca wywołania (w tym osierocony `extractFigures`); bilans = 2 legalne algorytmy. Liczyć grepem, nie z pamięci.
