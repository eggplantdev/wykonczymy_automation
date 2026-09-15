---
date: 2026-09-15T11:38:22Z
researcher: Claude Opus 5
git_commit: 01079b217c7446fa73d74386dd33615c2ed1da27
branch: staging
repository: wykonczymy
topic: 'EX-770 — bramka zamka zakończonej inwestycji dla kolekcji `kosztoryses` w /admin'
tags: [research, codebase, investment-lock, payload-access, kosztoryses, admin-panel]
status: complete
last_updated: 2026-09-15
last_updated_by: Claude Opus 5
---

# Research: bramka zamka nie obejmuje kolekcji `kosztoryses` w /admin (EX-770)

## Research Question

Czy `kosztoryses` da się objąć zamkiem zakończonej inwestycji bez zabicia niepowiązanego arkusza;
gdzie ma stać bramka (access / hook / akcja); i czy warto przy okazji przepisać cztery kolekcje
kosztorysu z reguł `access` na hooki.

## Summary

Bug jest realny i dokładnie taki, jak opisano: `/admin` jest jedyną drogą, którą można przepiąć albo
wyczyścić `investment` na arkuszu zakończonej inwestycji, i jedyną, którą można go skasować mimo zamka.

**Obie techniczne premisy issue są jednak fałszywe** — sprawdzone w źródle Payloada 3.73.0 **i**
odpalone przeciwko `db-test`:

1. **`not_equals` po nullowalnej relacji NIE odsiewa wierszy bez inwestycji.** Payload kompiluje
   `not_equals` do `(kolumna IS NULL OR kolumna <> wartość)`, a trawersowanie relacji to **LEFT JOIN**.
   Niepowiązany arkusz przechodzi. Gotowa fabryka `unlessInvestmentLocked` jest więc użyteczna
   bez zmian, a proponowany `or` z `exists: false` jest **redundantny**.
2. **Odmowa z `access`-`Where` NIE dociera jako „nie znaleziono", tylko jako 403 Forbidden** — a w
   praktyce użytkownik nawet nie klika Zapisz, bo panel renderuje dokument read-only z wygaszonym
   przyciskiem. Jedyne, czego brakuje, to polskie zdanie zamiast generycznego
   „You are not allowed to perform this action".

Z tego wynika rekomendacja odwrotna do „kierunku" dopisanego w issue: **`kosztoryses` bramkujemy
regułą `access`, nie hookiem**, a przepisanie czterech kolekcji na `beforeChange`/`beforeDelete`
jest w 2/3 niewykonalne i szkodliwe — `access` rzuca **przed** hookiem na `create`/`update`, więc hook
byłby tam martwym kodem; jedyna operacja, na której hook zdąży pokazać komunikat, to `delete`.

## Detailed Findings

### 1. Profil zapisu płaszczyzny `kosztoryses` — hook byłby legalny, ale niepotrzebny

W odróżnieniu od tabel v2 kosztorysu (~12 miejsc surowego SQL-a, przez co `investment-action.ts:20-26`
nazywa warstwę akcji jedynym chokepointem), **`kosztoryses` nie jest pisane surowym SQL-em ani przez
żaden skrypt czy route handler**. Grep `(insert into|update|delete from) kosztoryses` po `src`, `scripts`,
`e2e` → zero trafień poza `src/migrations/`. Tabela jest w surowym SQL-u tylko czytana
(`src/lib/queries/reference-data.ts:74`, `LEFT JOIN kosztoryses k ON k.investment_id = i.id`).

| #   | Writer                            | file:line                                                    | Ścieżka           | Pola                               | Zamek?                                                          |
| --- | --------------------------------- | ------------------------------------------------------------ | ----------------- | ---------------------------------- | --------------------------------------------------------------- |
| 1   | `addUnlinkedSheetAction`          | `src/lib/actions/sheets.ts:30` (write :67)                   | akcja → Local API | `googleSheetId`, `name`            | nie — i nie ma czego bramkować (nigdy nie ustawia `investment`) |
| 2   | `linkSheetToInvestmentAction`     | `sheets.ts:94` (write :133)                                  | akcja             | `investment` NULL→id               | tak (`investmentAction`, cel)                                   |
| 3   | `unlinkSheetFromInvestmentAction` | `sheets.ts:178` (gate :182)                                  | akcja             | `investment`→NULL                  | tak (`lockedSheetError`)                                        |
| 4   | `saveSheetColumnMappingAction`    | `sheets.ts:207`                                              | akcja             | `sheetColumnMapping`               | tak (`investmentAction`)                                        |
| 5   | `clearSheetColumnMappingAction`   | `sheets.ts:238`                                              | akcja             | `sheetColumnMapping`               | tak (`investmentAction`)                                        |
| 6   | `deleteSheetAction`               | `sheets.ts:276` (gate :286)                                  | akcja             | DELETE                             | tak (`lockedSheetError` + `ADMIN_OR_OWNER_ROLES`)               |
| 7   | `linkSheetAction`                 | `src/lib/actions/investments.ts:116` (write :169)            | akcja             | INSERT z `investment`              | tak (`investmentAction`)                                        |
| 8   | **`/admin` + REST/GraphQL**       | `src/collections/sheets.ts:30-35`                            | panel             | **każde pole, w tym `investment`** | **NIE**                                                         |
| 9   | Kaskada `ON DELETE SET NULL`      | `src/migrations/20260528_move_sheet_id_to_kosztoryses.ts:26` | FK                | `investment`→NULL                  | nie — poniżej Payloada                                          |

**Wszystkie siedem akcji przekazuje `overrideAccess: true`** (`sheets.ts:70,137,189,229,257,292`,
`investments.ts:169`). To jest sedno: reguła `access` na tej kolekcji bramkuje **wyłącznie `/admin`** —
czyli dokładnie dziurę — i nie rusza ani jednej ścieżki aplikacji. Hook odwrotnie: odpaliłby się
**zawsze**, więc dołożyłby bramkę do `unlinkSheetFromInvestmentAction` i `deleteSheetAction`, które
zamek już sprawdzają po swojemu i zwracają czytelny `ActionResult` — zmiana zachowania, o którą nikt
nie prosił.

Wiersz 9 (kaskada) jest w praktyce nieosiągalny: nie istnieje `deleteInvestmentAction`, a kasowanie
inwestycji z `/admin` jest tą samą dziurą panelu, plus `preventDeleteWithTransactions`
(`src/collections/investments.ts:49`) odcina każdą inwestycję z transakcjami.

**Zamknięty trop:** `linkSheetToInvestmentAction` bramkuje inwestycję **docelową**, nie źródłową — ale
przepięcie i tak jest niemożliwe, bo `sheets.ts:125-127` odbija każdy już powiązany arkusz
(„Ten kosztorys jest już dodany do inwestycji."). Przepiąć może **tylko panel**.

### 2. Payload: `Where` po nullowalnej relacji — premisa issue obalona

**Dowód ze źródła** (`@payloadcms/drizzle@3.73.0`):

- `queries/parseParams.js:225-227` — `not_equals` NIE kompiluje się do gołego `<>`:
  ```js
  if (queryOperator === 'not_equals' && queryValue !== null) {
      constraints.push(or(isNull(resolvedColumn), ne(resolvedColumn, queryValue)));
      break;
  }
  ```
- `queries/getTableColumnFromPath.js:587-594` — trawersowanie „simple relationships" pcha join **bez**
  pola `type`, a `queries/selectDistinct.js:16-18` domyśla wtedy `leftJoin`:
  ```js
  joins.forEach(({ type, condition, table }) => {
    query = query[type ?? 'leftJoin'](table, condition)
  })
  ```
  Żadna ścieżka w adapterze nie ustawia `innerJoin`.

Wynikowy SQL trzyma wiersz z `investment_id IS NULL`, bo LEFT JOIN daje prawą stronę NULL, a
`status IS NULL` jest TRUE.

**Dowód z uruchomienia** (probe przeciwko `db-test` na 5435, trzy arkusze: `locked` → inwestycja
`completed`, `live` → `active`, `orphan` → bez inwestycji):

```
bare not_equals              -> [live, orphan]
or + exists:false            -> [live, orphan]
equals (contrast)            -> [live]
not_in (contrast)            -> [live]
```

Trzy wnioski:

1. **Gotowe `unlessInvestmentLocked('investment.status')` działa poprawnie na nullowalnej relacji.**
2. `or` z `exists: false` daje **identyczny** wynik — jest redundantny. (`exists` na relacji `hasOne`
   nie tworzy joina, kompiluje się do `investment_id IS NULL` — `sanitizeQueryValue.js:203-210`,
   `operatorMap.js:6,10`.)
3. **`not_in` NIE jest symetryczne z `not_equals`** — `orphan` wypada. Gdyby ktoś kiedyś zamienił
   operator (albo rozszerzył zamek na listę statusów), bramka po cichu zacznie blokować niepowiązane
   arkusze. To jest jedyny realny powód, by intencję zapisać jawnie — komentarzem albo specem, nie
   redundantnym `or`.

### 3. Co panel naprawdę pokazuje (druga obalona premisa)

- `payload/dist/collections/operations/updateByID.js:82-88` — gdy dokument nie przechodzi `Where`
  z `access`, leci **`Forbidden`**, nie `NotFound`:
  ```js
  if (!docWithLocales && !hasWherePolicy) {
    throw new NotFound(req.t)
  }
  if (!docWithLocales && hasWherePolicy) {
    throw new Forbidden(req.t)
  }
  ```
  Ten sam układ w `deleteByID.js:73-78`.
- `Forbidden` to `APIError` ze statusem 403 i **generycznym** komunikatem `error:notAllowedToPerformAction`
  (`payload/dist/errors/Forbidden.js:4-8`). Kanału na własne zdanie reguła `access` nie ma —
  zwraca `boolean | Where`.
- Zanim użytkownik kliknie Zapisz, panel **wygasza formularz**: `docAccess` → `getEntityPermissions`
  (`utilities/getEntityPermissions/getEntityPermissions.js:154-180`) → `entityDocExists` robi `db.count`
  z `combineQueries(where, {id})` → `permission: false` → `hasSavePermission: false` →
  `@payloadcms/ui/dist/views/Edit/index.js:535` `readOnly`, `:411` Zapisz `disabled`.

Czyli realny UX bramki `access` to **dokument otwarty tylko do odczytu, bez przycisku Zapisz**, a 403
jest zapasem dla API/nieaktualnej zakładki. `read` zostaje nietknięty — `access.update` nie wpływa na
listę ani na odczyt (`find.js:46-49,73` konsultuje wyłącznie `access.read`).

### 4. Niepowiązany arkusz — gdzie jest pierwszoklasowy

- **Listing to `/kosztorysy`** (nie `/arkusze`): `src/app/(frontend)/kosztorysy/page.tsx:26-47` rozwidla
  `linked` / `unlinked`; `src/components/tables/sheets.tsx:59-75` daje niepowiązanemu arkuszowi
  **dokładnie jedną** akcję — „Powiąż z inwestycją". Bez otwierania, bez odpięcia, bez kasowania.
- **Zmiana nazwy, `googleSheetId` i kasowanie niepowiązanego arkusza istnieją WYŁĄCZNIE w `/admin`** —
  mówi to wprost komentarz `src/lib/actions/sheets.ts:66-67` („the owner can rename it later from the
  admin panel").
- `src/lib/queries/sheets.ts:23-33` `fetchAllSheets` — **bez `where`**, `overrideAccess: true`; żadne
  zapytanie w repo nie filtruje po `investment IS NULL` jawnie.
- Kontrakt kolekcji (`src/collections/sheets.ts:5-11`) i migracja
  (`20260528_move_sheet_id_to_kosztoryses.ts:26`, `:42-43` — partial unique index
  `WHERE investment_id IS NOT NULL`) stawiają niepowiązany arkusz jako stan docelowy, nie awaryjny.
- **Niepowiązany arkusz nie może nieść rozpiski** — `kosztorys_items/sections/stages` mają
  `investment_id NOT NULL` (`20260708_2_add_kosztorys_sections_items.ts:26`), a edytor jest pod
  `/inwestycje/[id]/kosztorys_v2`. To czysty wiersz metadanych: `name`, `googleSheetId`,
  `sheetColumnMapping`.
- **Dane produkcyjne: 65 arkuszy, 0 niepowiązanych** (odczyt z `dumps/dump-latest.sql` i
  `dumps/dump-2026-09-14_16-35.sql`, bez dotykania bazy). Stan jest architektonicznie pierwszoklasowy,
  ale dziś niezaludniony — błędna bramka nie zepsułaby nic **widocznego**, zepsułaby pierwszy wiersz
  utworzony przyciskiem „Nowy kosztorys".
- **Zero testów** na niepowiązany arkusz — ani unit, ani E2E. Regresja poszłaby na zielono.
- Najgorszy scenariusz błędnej bramki: literówka w `googleSheetId` daje nieusuwalny wiersz, który
  blokuje UNIQUE (`migration :35-36`), a własny guard aplikacji (`investments.ts:150-157`) odmawia
  wtedy rejestracji poprawnego arkusza. Brak drogi wyjścia z aplikacji.

### 5. Przepisanie czterech kolekcji na hooki — w 2/3 niewykonalne

Kolejność operacji w Payloadzie przesądza sprawę:

| operacja | kolejność                                                                     | czy hook zdąży pokazać komunikat?                     |
| -------- | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| `create` | `executeAccess` → … → `beforeChange`                                          | **nie** — `access` rzuca pierwsze, hook to martwy kod |
| `update` | `executeAccess` (`updateByID.js:40`) → lookup → throw `:86` → `beforeChange`  | **nie** — jw.                                         |
| `delete` | `executeAccess` `:35` → **`beforeDelete` `:43`** → lookup `:67` → throw `:73` | **tak** — hook biegnie przed odmową z `access`        |

Czyli „jeden idiom i ten sam komunikat wszędzie" jest nieosiągalny bez **usunięcia** reguł `access`
z `create`/`update`. A to:

- **psuje pięć skryptów seedowych** (`src/scripts/perf-seed-kosztorys.ts:22,27,36,55,71,100`,
  `seed-kosztorys.ts:53,58,68,91,121,141`, `seed-kosztorys-bands.ts`, `seed-kosztorys-reconciliation.ts`,
  `recolor-kosztorys-sections.ts`) — dziś przechodzą na zakończonej inwestycji, po zmianie padają;
- **dokłada +1 zapytanie na dokument** przy bulk-edit w panelu (≤100/stronę) i ≈ +1100 przy perf-seedzie,
  przy zerowym zysku;
- **niczego nie domyka** — wszystkie ścieżki masowe (`kosztorys-import.ts` przez `insert-rows.ts:99,126`,
  `restore-kosztorys.ts:35-36`, `clearKosztorysAction`, `applyPercentDiscountToAllItemsAction`,
  `setStageProgressAction`, `kosztorys-sheet-measured-qty.ts:22`) to surowy SQL, niewidoczny **dla obu**
  kształtów bramki.

Kaskady też nie są argumentem za hookami: `ON DELETE CASCADE`
(`20260708_2_add_kosztorys_sections_items.ts:27`, `20260709_0_add_kosztorys_stages.ts:25-26`) działa
poniżej Payloada — `beforeDelete` na sekcji odpali się **raz**, a jej pozycje i `stage_progress` znikną
bez żadnej bramki. Tak samo jest dziś przy `access`, więc to nie regresja, ale teza „hooki są
dokładniejsze" upada: oba kształty pilnują dokładnie jednego wiersza.

Warsztat szablonów jest bezpieczny w obu wariantach — `src/lib/db/workshop-investment.ts:42` nadaje mu
`TEMPLATE_INVESTMENT_STATUS = 'szablon'`, a każda bramka porównuje wyłącznie z `'completed'`.

## Code References

- `src/collections/sheets.ts:30-35` — kolekcja bez bramki (sedno buga)
- `src/access/investment-lock.ts:22-27` — `unlessInvestmentLocked`, fabryka `Where`
- `src/lib/db/investment-lock.ts:55-62` — `isRelatedInvestmentLocked`: „nic nie jest zablokowane"
- `src/lib/actions/sheets.ts:153-172` — `lockedSheetError`, ręczna bramka i jej uzasadnienie
- `src/lib/actions/sheets.ts:125-127` — odmowa przepięcia już powiązanego arkusza
- `src/__tests__/access/investment-lock.test.ts:32-51` — spec asercjonujący **literał** `Where`
- `node_modules/@payloadcms/drizzle/dist/queries/parseParams.js:225-227` — null-inclusion `not_equals`
- `node_modules/@payloadcms/drizzle/dist/queries/selectDistinct.js:16-18` — domyślny `leftJoin`
- `node_modules/payload/dist/collections/operations/updateByID.js:82-88` — Forbidden vs NotFound
- `node_modules/payload/dist/collections/operations/deleteByID.js:43` — `beforeDelete` przed lookupem

## Architecture Insights

- **Reguła `access` na kolekcji, której wszystkie akcje jadą `overrideAccess: true`, jest bramką
  dokładnie na `/admin`** — nic więcej. To czyni ją narzędziem precyzyjnym, nie prowizorką.
  Odwrotnie niż hook, który widzi wszystko i dlatego bramkuje też to, czego nie chcieliśmy ruszać.
- **Lekcja 1636 („gdzie stoi bramka, decyduje profil zapisu płaszczyzny") działa tu w drugą stronę niż
  przy v2**: tam surowy SQL wypchnął bramkę do akcji, tu brak surowego SQL-a i `overrideAccess` w każdej
  akcji sprawia, że `access` jest jedyną warstwą widzącą **tylko** dziurę.
- **Trzywartościowa logika nie jest tu pułapką, bo Payload ją za nas obchodzi** — ale robi to
  **per operator**. `not_equals` tak, `equals`/`in`/`not_in` nie. Wiedza o tym mieszka w jednej linii
  `parseParams.js` i nie da się jej wyczytać z kodu wywołującego.
- **Spec na literale `Where` nie umie zweryfikować tego zachowania.** `investment-lock.test.ts`
  asercjonuje kształt obiektu, więc przepuściłby każdą pomyłkę operatorową. Wymaganie z issue
  („arkusz bez inwestycji przepuszcza") jest asercją **o bazie**, nie o literale — należy do specu
  DB-gated (`*.db.test.ts`), nie do istniejącego pliku.

## Historical Context (from prior changes)

- `context/archive/2026-08-28-investment-lock-on-completed/change.md` — ustalenia właściciela; zamek
  jest totalny (bez roli omijającej), rekord inwestycji poza zamkiem, faktury poza zamkiem.
- `context/archive/2026-08-28-investment-lock-on-completed/review-gate.md` — oba findingi źródłowe:
  `filed EX-770` (brak bramki na `kosztoryses`) i `skipped` (przepisanie czterech kolekcji na hooki).
- `context/foundation/lessons.md:1636` — „Gdzie stoi bramka, decyduje profil zapisu płaszczyzny";
  punkt (4) tej lekcji — odmowa z hooka musi być `APIError(msg, 403)` — pozostaje aktualny.
- `context/foundation/lessons.md:1407` — „`beforeValidate` on update can see the change" (patrz
  Open Questions).

## Open Questions

1. **Czy lekcja 1407 wymaga korekty?** Jeden z wątków twierdzi, na podstawie źródła
   (`collections/operations/utilities/update.js:115-125`), że kolekcyjny `beforeChange` dostaje `data`
   **nie**zmergowane, więc hook czytający `data.investment` zawiódłby cicho przy autosave edytora
   (jedno pole na raz). Lekcja 1407 mówi co innego — ale mówi o **`beforeValidate`** na `transactions`
   i została ustalona **probem**, nie czytaniem źródła. To mogą być dwa prawdziwe zdania o dwóch różnych
   hookach. **Nie korygować lekcji bez własnego probu.** Praktyczny wniosek niezależny od rozstrzygnięcia:
   bramka w hooku czyta `originalDoc`, nie `data`.
2. **Czy chcemy polskie zdanie w panelu na `delete`?** Technicznie da się (tylko `beforeDelete` biegnie
   przed odmową `access`) i kosztuje ~20 linii wzorowanych na `guard-delete.ts` — ale daje jeden
   komunikat na jednej z trzech operacji, więc kupujemy niespójność zamiast idiomu. Decyzja
   produktowa, nie techniczna.
3. Czy `addUnlinkedSheetAction` ma dostać cokolwiek — dziś jedyny writer bez bramki, ale strukturalnie
   nieszkodliwy (nigdy nie ustawia `investment`). Prawdopodobnie nie.
