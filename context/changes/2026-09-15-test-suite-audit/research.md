---
date: 2026-09-15T18:36:51+0200
researcher: Claude Opus 5
git_commit: b13781329c6949facc0a22de4eeeaca777898c4c
branch: staging
repository: wykonczymy
topic: 'Audyt całego pakietu testów: rozmiar kodu testowego i ważność każdego testu'
tags: [research, codebase, tests, vitest, test-plan, dead-tests, deduplication]
status: complete
last_updated: 2026-09-15
last_updated_by: Claude Opus 5
---

# Research: audyt całego pakietu testów — rozmiar i ważność

**Date**: 2026-09-15T18:36:51+0200
**Researcher**: Claude Opus 5
**Git Commit**: b13781329c6949facc0a22de4eeeaca777898c4c
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Dwie osie, obie na całym pakiecie testów:

1. **Objętość** — czy da się pociachać ilość kodu testowego (dedup, parametryzacja, helpery, kasowanie).
2. **Ważność** — czy każdy test ma sens: czy nie jest martwy, tautologiczny, testujący implementację zamiast zachowania, albo dublujący warstwę niżej/wyżej.

## ⚠ Wiarygodność tego dokumentu — przeczytaj przed użyciem liczby

Ten audyt powstał z syntezy pięciu równoległych agentów. **Nie wszystko tu zostało przeze mnie
zweryfikowane**, a forma (tabele LOC, procenty) sugeruje jednolitą precyzję, której nie ma. Sekcja §1
przeszła w rozmowie z właścicielem **dwie korekty** — bilans spadł z −1 200 LOC na −214 — i obie
wynikły z tego, że pierwotny wniosek stał na przesłance, której nikt nie sprawdził. Zakładaj, że
pozostałe sekcje mogą zawierać ten sam błąd.

Skąd się bierze ten błąd: agenci mieli zakaz uruchamiania pakietu, więc oceniali testy po **nagłówkach
i strukturze**, a nie po pytaniu „jaki błąd produkcyjny stanie się niewidoczny, gdy to skasuję".
`sheets-golden` deklarował się w nagłówku jako zamek na refaktor, refaktor wylądował — agent uznał, że
zamek wygasł. Niezmiennik pod zamkiem (kasowanie wierszy od dołu do góry w żywym arkuszu klienta) żył
dalej i nikt o niego nie zapytał.

**Poziomy dowodu:**

| tier                  | znaczenie                                                                    |
| --------------------- | ---------------------------------------------------------------------------- |
| **[Z]** zweryfikowane | sam przeczytałem kod/uruchomiłem/sprawdziłem historię gita w tej sesji       |
| **[A]** raport agenta | pochodzi z subagenta, **nie potwierdzone niezależnie** — hipoteza, nie wynik |
| **[S]** szacunek      | liczba wyprowadzona z [A], odziedzicza jego niepewność                       |

**Żadna rekomendacja skasowania z tierem [A] nie powinna zostać wykonana, zanim nie przejdzie testu:
jaki konkretny błąd produkcyjny przestanie być wykrywalny, gdy ten test zniknie — i czy sąsiedni spec
już tego nie łapie.** Ten test obalił §1 w dwóch trzecich.

### Mapa tierów po sekcjach

| §   | temat                           | tier                                                                                                     |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | Google Sheets / `sheets-golden` | **[Z]** — przemielone przypadek po przypadku, z historią gita                                            |
| 2   | `transfer-actions.test.ts`      | **[Z]** liczby (154 `expect`, 39 `toHaveBeenCalledWith`, 1 trafienie DB) · **[A]** rekomendacja rozbicia |
| 3   | `reconciliation.test.ts:63-69`  | **[Z]** — przeczytane w tej sesji                                                                        |
| 4   | 764 LOC boilerplate             | **[A]** — tabela z regexów agenta, nie przemielona ponownie                                              |
| 5   | adopcja helperów                | **[A]**                                                                                                  |
| 6   | korzeń `__tests__/`             | **[A]** · odkrywalność (0 sierot) **[Z]**                                                                |
| 7   | census asercji pustych          | **[A]**                                                                                                  |
| 8   | parametryzacja                  | **[A]**                                                                                                  |
| 9   | asercje przechodzące na wyjściu | **[A]** — **najwyższe ryzyko powtórki błędu §1**, to są zarzuty „ten test nic nie sprawdza"              |
| 10  | pojedyncze tautologie           | **[A]**                                                                                                  |
| 11  | fixture `EMPLOYEE_EXPENSE`      | **[A]**                                                                                                  |
| 12  | `DATASET_FLOOR` — nie ruszać    | **[Z]**                                                                                                  |
| 13  | warstwa DOM                     | **[A]**                                                                                                  |
| 14  | E2E                             | **[A]**                                                                                                  |
| 15  | szacunki odzysku                | **[S]** — wszystkie liczby dziedziczą niepewność [A]                                                     |

Fakty pomiarowe zweryfikowane osobiście **[Z]**: czerwony pakiet (`deposit-payment-method.test.tsx`),
13,24 s / 4 testy, 3 825 testów / 80,1 s, krzywa wzrostu z gita, 298 skipów = bramka `ENV_READY`.

## Summary

Pakiet liczy **348 plików spec / ~38 100 LOC / 3 825 testów**, uruchamianych w 80 s. Urósł ~7× w trzech
miesiącach (348 z 397 dodań plików spec przypada na 2026-07/08/09) i **nigdy nie był audytowany**.

**Stan sanitarny jest dobry, stan ekonomiczny — nie.** Census asercji wykazał praktycznie zero
klasycznego śmiecia (0 `expect(typeof x).toBe('function')`, 0 samo-porównań, 1 blok bez `expect`).
Problem nie polega na tym, że testy są głupie — polega na tym, że **kilka dużych inwestycji broni
niewłaściwej rzeczy**, a **ceremonia bootstrapu jest kopiowana setki razy**.

Cztery wnioski nadrzędne:

1. **Snapshot Sheets — największy plik drzewa testowego — jest w większości ZDROWY.** Z 1 218 LOC
   `sheets-golden.test.ts.snap` do cięcia kwalifikuje się 176: przypadek `applyTabRowsBatch` powtarza
   co do fixture `sheets.test.ts:112`. Dwa przypadki `setupTab` zostają — historia gita pokazuje, że
   jedyna zmiana w trzy miesiące trafiła w ochronę tabu, czyli dokładnie w to, co miały chronić.
   **Argument „umierająca integracja" jest martwy** (§7 planu przepisane 2026-09-15): Sheets nie znika
   i długo nie zniknie, bo dwie wersje aplikacji pojadą równolegle.
2. **Największy spec w repo (`transfer-actions.test.ts`, 1 181 LOC, 77 `it`) nie dotyka bazy ani
   razu** — 39 asercji to `toHaveBeenCalledWith` na w pełni zamockowanym Payloadzie. Łamie wprost
   regułę z AGENTS.md („assert persisted state, not the return value") i zostawia **ryzyko #2
   z mapy ryzyk niepokryte**, jednocześnie wyglądając na najlepiej pokryty obszar w repo.
3. **`reconciliation.test.ts` — spec nazwany od reguły nadrzędnej — łamie tę regułę w linii 64.**
   Oczekiwanie dla strony transakcji jest liczone ze strony kosztorysu, więc pięć asercji „reconciles
   silently" to `x === x`. To dokładnie ten szew, którego rozjazd jest **ryzykiem #1**.
4. **764 LOC to dosłowny boilerplate** w 68 plikach DB-owych, a helpery, które miały go usunąć, już
   istnieją i mają po 2–13 importerów przy 4–11 plikach robiących to samo ręcznie.

Szacowany realny odzysk: **~5 000–6 000 LOC (13–16 % pakietu)** przy **zwiększeniu**, nie zmniejszeniu,
siły sygnału — bo dwie z trzech największych pozycji to usunięcie testów, które nic nie chronią, a nie
skracanie tych, które chronią.

Oprócz tego audyt wywlókł **problem odwrotny**: `lib/db` ma stosunek test:src **3,59×**, a
`components/ui` **0,04×** i `components/kosztorys` **0,12×** — ~6 300 LOC renderowanego UI
(`app/(frontend)`, `components/dialogs`, `filters`, `fleet`, `nav`, `sheets`, `investments`) nie ma
ani jednego `.test.tsx`. Pakiet nie jest „za duży" — jest **źle rozłożony**.

### Dwie rzeczy do decyzji, poza mandatem audytu

- **Pakiet jest obecnie CZERWONY.** `src/__tests__/components/forms/deposit-form/deposit-payment-method.test.tsx`
  jest nieśledzony przez gita (`??`) i przewraca 2 z 4 testów (`expected "TRANSFER", received "CASH"`,
  linia 129). Nigdy nie przeszedł bramki pre-push, bo nigdy nie był zacommitowany. Ten sam plik jest
  **największym pożeraczem czasu w całym pakiecie**: 13,24 s na 4 testy, przy 43,1 s sumy wszystkich
  348 plików — 31 % czasu za 4 asercje.
- **`test-plan.md` §7 rozjeżdża się z rzeczywistością.** Plan wyklucza Sheets („don't invest in the
  dying integration") i cache/rewalidację, a w repo leży ~2 000 LOC specs na Sheets i 83 LOC na cache.
  Albo wykluczenie jest nieaktualne, albo testy są zbędne — to rozstrzygnięcie właściciela, nie audytu.

## Detailed Findings

### 1. Google Sheets — `sheets-golden` to duplikat plus snapshot kolorystyki

> **Skorygowane 2026-09-15 po rozmowie z właścicielem.** Pierwotna wersja tej sekcji opierała się na
> wykluczeniu `test-plan.md` §7 („retired at cutover S-09, don't invest in the dying integration").
> **Ten argument nie obowiązuje**: integracja z Sheets nie znika i długo nie zniknie — przez dłuższy
> czas będą istnieć dwie wersje aplikacji, zintegrowana i standalone. Poniższa ocena jest przeprowadzona
> wyłącznie na merit: co ten test złapie, gdy coś się zepsuje.

`src/__tests__/lib/google/sheets-golden.test.ts` (144 LOC) + `__snapshots__/sheets-golden.test.ts.snap`
(1 218 LOC — największy plik drzewa testowego i jedyny `.snap` w repo). Trzy przypadki, trzy różne werdykty.

**Przypadek 3 — `applyTabRowsBatch` (176 linii snapshotu): duplikat, do skasowania.**

Snapshot trzyma rzeczy realne, wbrew pierwotnej ocenie tego audytu. `deleteRange.startRowIndex` **jest**
figurą biznesową: wartości `3` a potem `1` kodują kasowanie **od dołu do góry**, co emituje
`src/lib/google/sheets.ts:244` przez `.sort((a, b) => b - a)`. Odwrócenie tego sortu sprawia, że drugi
`deleteRange` trafia w niewłaściwy wiersz **w żywym arkuszu klienta** — dokładnie klasa incydentu
z 2026-08. Snapshot pinuje też mapowanie kolumn A–G, `1234.56` jako liczbę (nie string, więc brak
korupcji na przecinku dziesiętnym) i cudzysłowy w `cement "extra"`.

Problem w tym, że **`src/__tests__/lib/google/sheets.test.ts:112` robi to samo, lepiej** — ta sama
fixture (header r1, ids 101/102/103, `sheetId` 777, ten sam tab), to samo wywołanie
`applyTabRowsBatch(…, [row(102), row(200)], [101, 103])`, te same niezmienniki asertowane po imieniu:

```ts
// deletes run bottom-up: 103 (row 4 → startRowIndex 3) before 101 (row 2 → 1)
expect(reqs.map((r) => r.deleteRange.range.startRowIndex)).toEqual([3, 1])
expect(reqs[0].deleteRange.range.endColumnIndex).toBe(7) // summary (col H+) preserved
```

Wersja nazwana mówi przy awarii **co** padło; snapshot pokazuje diff 176 linii.
→ **skasować przypadek 3: −176 LOC snapshotu, −38 LOC specu, zero utraty pokrycia.**

**Przypadki 1 i 2 — `setupTab` (1 039 linii snapshotu): ZOSTAJĄ. Dane obaliły zarzut kruchości.**

Skład ładunku: ~9 `backgroundColor`, 7 `textFormat`, 4 `foregroundColor`, 11 `updateDimensionProperties`
(szerokości kolumn) — czyli jak tab **wygląda**. W środku siedzi garść rzeczy load-bearing:
`addProtectedRange` + `deleteProtectedRange` (blokada kolumn na materiałach — wdrożona funkcja, SA-only
z obejściem dla właściciela), 2 × `numberFormat` (kwota jako liczba, nie tekst), 3 × `booleanRule`/
`condition` (walidacja listy kategorii), `mergeCells` + `gridProperties` (układ nagłówka).

Skąd 1 039 linii: `setupTab` (`src/lib/google/sheets.ts:298-610`) to ~310 linii kodu **produkcyjnego**,
budującego stylizowany tab dla klienta — baner, nagłówek, swatche kategorii, wiersz RAZEM, reguły
warunkowe, szerokości kolumn. To jest produkt, nie szum; ten arkusz ogląda klient. Test wywołuje tę
funkcję i serializuje każdy bajt wyniku, a snapshot pretty-printuje (jeden `backgroundColor` = 5 linii,
jeden `repeatCell` ≈ 20), więc 310 LOC emisji puchnie do 1 039 LOC zapisu, ×3,3. **Nikt tych linii nie
napisał — napisał je `toMatchSnapshot()`.**

Naturalny zarzut brzmi „snapshot formatowania jest kruchy, wywali się przy zmianie tła nagłówka i zespół
nauczy się odruchu `-u`". **W tym repo nie ma na to ani jednego dowodu.** Snapshot ruszono dwa razy
w trzy miesiące:

```
e6bf2d73  test: golden characterization of expenses-tab Google API requests   ← powstanie
b1087d02  fix(sheets): warning-only protection on read-only tabs              ← 14 linii z 1218
```

Jedyna zmiana trafiła **dokładnie w element load-bearing** — ochronę tabu:

```diff
-  "editors": { "users": ["test@example.iam.gserviceaccount.com"] },
-  "warningOnly": false,
+  "warningOnly": true,
```

Diff 14 linii na 1 218, czytelny, bo zmieniło się tylko to, co się zmieniło. Snapshot zrobił swoją
robotę. Koszt utrzymania tego pliku wynosi **zero** — nie jest pisany ręcznie ani czytany, dopóki nie
pęknie, a kod formatowania nie ruszył się od trzech miesięcy. → **nie ruszać.**

**Bilans `sheets-golden`: −176 LOC snapshotu, −38 LOC specu. Nie −1 200, jak twierdziła pierwsza
i druga wersja tej sekcji.**

**`sheets-sync.test.ts:244-897` — 35 `it` za mockiem granicy: werdykt DO PONOWNEJ OCENY.**
Pierwotna rekomendacja („skasować ~650 LOC") też stała na wykluczeniu §7 i wymaga tego samego
przemiału na merit co `sheets-golden`, zanim cokolwiek się z nią zrobi. Utrzymuje się obserwacja
faktograficzna: każdy z tych `it` sprawdza **którą metodę googleapis wywołano**, za pełnym mockiem
granicy, więc z konstrukcji nie złapie złego zakresu ani 403; a cztery przypadki routingu
`settled`/`CANCELLATION` (`:626`, `:794`, `:814`, `:863`) mają czystsze odpowiedniki
w `lib/google/tab-rows.test.ts:162-329`. Czy to czyni je zbędnymi, czy tylko tańszymi do utrzymania
w innej formie — nierozstrzygnięte.

**Zostaje nietknięte**: `sheets-write-credential.test.ts`, `google/auth.test.ts`,
`google/sheet-access.test.ts` — pilnują reguły „write only from production", czyli incydentu z 2026-08,
gdzie osiem arkuszy klientów przyjęło 36 obcych wierszy.

### 2. `transfer-actions.test.ts` — 1 181 LOC broniące mocka

Największy spec w repo. 154 `expect(`, z tego **39 `toHaveBeenCalledWith`**, i tylko **1** trafienie na
`getPayload|ENV_READY|payload.find(|execute(`. Preambuła `:1-105` mockuje Payload w całości, `getDb`
idzie na `mockDbExecute`, a `sumRegisterBalance` jest zadrutowane na `99999`. **Nic nigdy nie jest
odczytywane z powrotem.** Każda asercja zapisu to `expect(mockCreate).toHaveBeenCalledWith(
expect.objectContaining({…}))`.

To jest wprost zakazane przez AGENTS.md („assert the persisted / observable state, not the action's
return value — a success result can hide a failed write") i przez `test-plan.md` §6.4. Efekt:
**ryzyko #2 (ścieżka mutacji nieprzetestowana) jest nadal otwarte**, ale wygląda na zamknięte, bo plik
ma 77 testów.

Układ: preambuła `:1-105`, fixtures `:107-172`, `beforeEach` `:174-188`, potem osiem `describe` —
`createTransferAction :195` (20), `createBulkTransferAction :416` (9), `cancelTransferAction :556` (12),
`updateTransferAction :740` (20), `addTransferInvoicesAction :989` (10), `removeTransferInvoiceAction
:1091` (3), `removeAllTransferInvoicesAction :1124` (2), `deleteOrphanedMediaAction :1150` (3).
Dodatkowo `:272`, `:278` gołe `toHaveBeenCalled()`, `:297` `toBeTruthy()` na wyniku akcji.

→ **rozbić na `lib/actions/transfer/{create,update,cancel,invoices}.test.ts` + przepisać oracle na
`.db.test.ts` z odczytem zwrotnym; ~400 LOC netto mniej, a ryzyko #2 faktycznie zamknięte.**

### 3. `reconciliation.test.ts` — reguła nadrzędna złamana we własnym specu

```ts
// src/__tests__/lib/kosztorys/reconciliation.test.ts:63-69
function syncedTransactions(tree: KosztorysTreeT): TypeSettledTotalT[] {
  const { laborCostsNetFromKosztorys, discountNetFromKosztorys } = clientTotals(tree)
  return [
    { type: 'LABOR_COST', settled: false, total: laborCostsNetFromKosztorys },
    { type: 'RABAT', settled: false, total: discountNetFromKosztorys },
  ]
}
```

Strona transakcji jest **zbudowana ze strony kosztorysu**, po czym reconciler porównuje obie. Każde
„reconciles silently" (`:86`, `:93`, `:109`, `:131`, `:138`) jest tożsamością. Spec mockuje dokładnie ten
szew, którego rozjazd jest całym ryzykiem. Ten sam plik **umie to zrobić dobrze** — `:148`, `:175`,
`:194`, `:234` podają figury strony transakcyjnej na sztywno. → **przepisać oracle na wzór własnych
dobrych przypadków.**

### 4. Boilerplate — 764 LOC dosłownie skopiowane

| blok                                                                                   | plików | LOC |
| -------------------------------------------------------------------------------------- | ------ | --- |
| `const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)` | 68     | 68  |
| bootstrap Payloada (3 linie, `getPayload`/`@payload-config`)                           | 64     | 210 |
| `db = await getDb(payload)`                                                            | 45     | 51  |
| `let payload: Payload` + `let db: Awaited<ReturnType<typeof getDb>>`                   | 44     | 100 |
| lookup usera → `authState.userId`                                                      | 14     | 135 |
| scaffold mocka `requireAuth` (6 linii, bajt w bajt)                                    | 18     | 108 |
| `vi.mock('server-only', () => ({}))`                                                   | 47     | 47  |
| `vi.mock('@/lib/cache/revalidate', …)`                                                 | 25     | 25  |
| `const authState = vi.hoisted(() => ({ userId: 0 }))`                                  | 20     | 20  |

**Dwa twarde ograniczenia na fix:**

- Literał `skipIf(!ENV_READY)` **musi zostać w każdym pliku** — `scripts/test-integration.sh` odkrywa
  specy DB-owe przez `grep -rl 'skipIf(!ENV_READY)'`. Zrefaktorowanie tego stringu = zero odkrytych
  specs, bramka pre-push przechodzi na pusto.
- `vi.mock` jest hoistowany per-moduł, więc helper importowany dla efektu ubocznego jest niemożliwy —
  mock auth musi być fabryką: `vi.mock('@/lib/auth/require-auth', ownerAuthMock)`.

### 5. Helpery istnieją, nikt ich nie użył

- `helpers/kosztorys-db-tree.createKosztorysTree` — 13 importerów, a **11 plików ręcznie klepie
  27 wywołań `payload.create` = 248 LOC**. Jego własny docblock (EX-635) mówi, że wersja inline
  „cost ~60 lines before a spec asserted anything".
- `helpers/transfer-fixtures.createRegisterOwner` — 2 importerów vs 4 ręczne = 90 LOC.
- `helpers/kosztorys-tree.baseItem` — 8 importerów, a **10 plików kopiuje literał `KosztorysItemT`
  (9–15 linii)** = ~90 LOC.
- Brak helpera na literał zerowych financials (11–13 linii, 5 plików, ~60 LOC) → nowy
  `helpers/financials.ts → zeroFinancials()`.
- **W pełni zaadoptowane, 0 ręcznych kopii**: `helpers/investment` (44 importerów),
  `purge-fixture-users`, `money`, `fleet`, `workshop`, `fixtures/transfer-row`.

Wniosek: to nie jest problem braku abstrakcji, tylko braku sięgnięcia po istniejącą.

### 6. Korzeń `src/__tests__/` — 45 specs / 7 888 LOC (18 % pakietu) poza mirrorem

Tylko 5 jest faktycznie przekrojowych (`financial-golden-master-db`, `investment-render-parity-db`,
`reference-data-sql-drift`, plus `transfer-actions` jako powierzchnia akcji). Reszta to zaległość
migracyjna. Osiem par korzeń↔mirror do scalenia (~230 LOC): `transactions-report-filters` ⊂
`build-transfer-filters`; `transfer-loss` + `transfer-rabat` ⊂ tabela prawdy `transfer-constants`;
`leads/fetch-lead` vs `lib/leads/fetch-lead`; `transfer-table` vs `lib/queries/transfer-mapping`;
`kosztorys-chart-slices` vs `lib/kosztorys/chart-slices`; `assert-complete-page` vs
`lib/queries/assert-complete-page.db`; `leads/reconcile-leads` vs `lib/leads/reconcile-sweep`.

`src/__tests__/leads/` (15 plików) wygląda na mirror, ale nim nie jest — miesza `lib/leads`,
`lib/actions` i dwa route handlery, podczas gdy `lib/leads/` istnieje równolegle.

Weryfikacja odkrywalności: **160 chybień mirrora, 0 prawdziwych sierot, 0 dziur w odkrywaniu.** Żaden
spec nie jest niewidoczny dla bramki. (Naiwny grep dawał 154 fałszywe alarmy — kilka specs dzieli jeden
plik źródłowy i różni się nazwą, co AGENTS.md dopuszcza wprost.)

### 7. Census asercji pustych — prawie czysto

Na 2 804 bloków `it`: **0** `expect(typeof x).toBe('function')`, **0** samo-porównań, **3** asercje
snapshotowe (wszystkie w `sheets-golden`), **1** blok bez `expect` (legalny — rzucający
`assertNonTrivial`), **5** samotnych `not.toBeNull()` (wszystkie zasadne, subject zwraca error-albo-null).

Realna zaległość to **11 samotnych `toHaveBeenCalled()`**: `transfer-actions.test.ts:269,:275` ·
`hooks/sync-sheet.test.ts:97,:125` · `lib/kosztorys/optimistic-setting-save.test.ts:91,:99` ·
`components/…/section-name-cell.test.tsx:70` · `components/…/sort-and-row-commands.test.tsx:45` ·
`hooks/transfers/delete-invoice-media.test.ts:47` · `lib/actions/investment-action.test.ts:101` ·
`lib/ai/scan-receipt.test.ts:78`.

### 8. Parametryzacja to NIE jest duża wygrana

Mechaniczny przemiał całego repo znalazł tylko **7 grup** przy progu ≥4 identycznych szkieletów,
warte **52 LOC** łącznie — z czego 46 w jednej grupie (`lib/invoices/invoice-zip.test.ts:157`, 6 wariantów
`buildInvoiceZipMessage`). Parametryzacja nie jest tu dźwignią.

**Ale** pogłębiony przegląd `lib/kosztorys/` znalazł **18 klastrów wewnątrzplikowych wartych ~290 LOC**,
których matcher szkieletów nie widzi — ciała różnią się strukturalnie, a twierdzą to samo. To robota
ręczna, nie sweep.

### 9. Asercje przechodzące na wyjściu, które mają odrzucać

- `reconciliation.test.ts:86/93/109/131/138` — opisane w §3.
- `display-order-plan.test.ts:59-62` — oczekiwana kolejność malejąca jest bajt w bajt tym samym
  literałem co zapisana kolejność w `:48`.
- `build-import-plan.test.ts:274-276` — `Array(report.dropped.length).fill(...)` bierze długość
  z faktycznego wyniku, więc przechodzi na `[]`.
- `build-sheet-comparison.test.ts:128` — `toBeGreaterThan(0)` tam, gdzie 2287,5 jest już zapięte
  w `footer-totals.test.ts:54`.
- `parse-labor-tab.test.ts:286-290` — przejdą dowolne dwa różne stringi koloru.
- `build-sheet-comparison.test.ts:277` — subject vs subject, przeżywa `[]`.

Wymagające **dołożenia**, nie skasowania:

- `replace-tree-lost-write.test.ts:33-45` mockuje `serializeKosztorys`, czyli hook tworzący sam wyścig.
  Gdy implementacja przestanie przez niego przechodzić, test przechodzi na zielono nie testując niczego.
  Potrzebuje flagi liveness (`firedInWindow`).
- `save-lanes.test.ts` nigdy nie pinuje `itemFieldLane`/`stageLane` — czyli faktycznego kontraktu EX-526.

### 10. Pojedyncze przypadki kategorii A/B

`kosztorys-calc.test.ts:257-292` — cały `describe('brutto = netto × (1 + vatRate)')` asertuje **własne
mnożenie testu**; żaden kod produkcyjny tam nie liczy brutto (5 `it`, ~32 LOC). Dalej `:370-375` —
passthrough tożsamościowy. `lib/env/schema.test.ts:96` — `expect(PROD_BLOB_STORE_ID).toBe('oJHLWhvHKJrsgWiN')`.
`lib/google/sheets.test.ts:307` — przepisana tablica configu. `use-hidden-columns.test.tsx:84` —
`expect(result.current.isHidden(GROSS)).toBe(DEFAULT_HIDDEN_COLUMNS.has(GROSS))`.
`subcontractor-price-guard.test.ts:38` — `expect(MAX_CLIENT_SHARE).toBe(0.8)`.
`section-band-rows.test.ts:39` — powtórzenie wzoru na id. `row-height.test.ts:19-20,:28` — używa
`LINE_HEIGHT` z testowanego modułu jako magicznej liczby. `dashboard-aggregation.test.ts:98-106` —
sześć `toHaveProperty`, które tsc już wymusza.

### 11. Jedna prawdziwie zwietrzała fixture

`collections/cash-registers-delete-guard.test.ts:30` wstawia `'EMPLOYEE_EXPENSE'::enum_transactions_type`
— typ transferu wycofany przez `src/migrations/20260310_workers_as_registers.ts`, ocalały tylko jako
nieużywana etykieta enuma w PG. Guard chroni wiersz, którego żaden użytkownik nie może utworzyć.

### 12. Co jest zdrowe i czego NIE ruszać

`financial-golden-master-db.test.ts:356-386` — `DATASET_FLOOR` z porównaniem `<=`, więc próg 0 wymaga
≥1. To realnie zamyka **ryzyko #8** (fixture EX-725, która zgubiła całą płaszczyznę). **Lista zostaje
w całości.** Dla kontrastu `investment-render-parity-db.test.ts:247-251` ma tylko
`expect(investments.length).toBeGreaterThan(0)` — to jest luka, nie nadmiar.

298 pominiętych testów **nie jest dziurą** — to 68 plików bramkowanych `ENV_READY`, poprawnie
uruchamianych przez `pnpm test:integration` na 5435.

### 13. Warstwa DOM (18 plików `.test.tsx`, 2 276 LOC, 99 `it`, ~17 nieśledzonych)

Świeża, jeszcze nie zdążyła zgnić. ~190 LOC do odzysku przez `src/__tests__/helpers/dom.tsx`:
`renderWithUser`, generyczny `CellHost` zastępujący trzy ręczne harnessy dsg, `pricingRow()` na fixture
`ViewPricingT` skopiowaną 3× w dwóch runnerach, `renderInMenu`. Plus podniesienie
`vi.mock('@/lib/utils/toast')` (5 plików) i mocka `next/navigation` (3 pliki) do `setup/dom.ts`.
Jedno naruszenie mirrora: `grid/menus/sort-and-row-commands.test.tsx:6` importuje z `grid/`, nie
`grid/menus/`.

### 14. E2E (8 specs, 9 testów)

CIĄĆ: `smoke.spec.ts` — w całości zawarty w `auth.spec.ts:8` → `helpers.ts:33-38`.
ZOSTAJE: `auth`, `transfer-create`, `transfer-cancel` (ale asercje o disabled-button przy długości
powodu, `:35-39`, zdegradować do DOM), `investments-listing-kosztorys`,
`kosztorys-global-discount-failed-save`, `kosztorys-share-link`, `kosztorys-section-headers` (test 1
wchłonąć do testu collapse).
`context/changes/2026-09-15-e2e-backlog-audit/audit.md:30` niesie nieaktualną liczbę („14 testów
w 10 plikach" — jest 9 w 8).

### 15. Szacunki odzysku per partycja

| partycja                              | LOC     | do odzysku                                                   | %      |
| ------------------------------------- | ------- | ------------------------------------------------------------ | ------ |
| `lib/` bez kosztorysu                 | ~15 800 | ~3 100                                                       | 20 %   |
| `lib/kosztorys/`                      | 12 185  | ~1 330 brutto / ~1 030 netto po nowych helperach             | 11 %   |
| korzeń + legacy                       | 7 888   | ~700 mechanicznie / ~1 100 z przepisaniem `transfer-actions` | 9–14 % |
| DOM + e2e                             | 2 276   | ~190                                                         | 8 %    |
| przekrojowe (nakłada się na powyższe) | —       | ~1 228 przy 0 zmienionych asercjach                          | —      |

## Code References

- `src/__tests__/lib/google/__snapshots__/sheets-golden.test.ts.snap` — 1 218 LOC, największy plik drzewa testowego, jedyny `.snap`
- `src/__tests__/lib/google/sheets-golden.test.ts:1-30` — nagłówek deklarujący zamek na refaktor, który już wylądował
- `src/__tests__/lib/actions/sheets-sync.test.ts:244-897` — 35 `it` na mocku granicy googleapis
- `src/__tests__/lib/google/tab-rows.test.ts:162-329` — te same cztery reguły, czysto i 3× taniej
- `src/__tests__/transfer-actions.test.ts:1-105` — preambuła mockująca cały Payload
- `src/__tests__/transfer-actions.test.ts:269,:275,:297` — gołe `toHaveBeenCalled()` / `toBeTruthy()`
- `src/__tests__/lib/kosztorys/reconciliation.test.ts:63-69` — oczekiwanie wywiedzione z testowanej strony
- `src/__tests__/lib/kosztorys/reconciliation.test.ts:148,:175,:194,:234` — jak to zrobić dobrze
- `src/__tests__/financial-golden-master-db.test.ts:356-386` — `DATASET_FLOOR`, zamyka ryzyko #8, nie ruszać
- `src/__tests__/investment-render-parity-db.test.ts:247-251` — jedyny guard datasetu to `toBeGreaterThan(0)`
- `src/__tests__/collections/cash-registers-delete-guard.test.ts:30` — fixture na wycofanym `EMPLOYEE_EXPENSE`
- `src/__tests__/lib/kosztorys/kosztorys-calc.test.ts:257-292` — describe asertujący własne mnożenie
- `src/__tests__/lib/kosztorys/replace-tree-lost-write.test.ts:33-45` — mock `serializeKosztorys` bez flagi liveness
- `src/__tests__/components/forms/deposit-form/deposit-payment-method.test.tsx:129` — CZERWONY, nieśledzony, 13,24 s
- `src/__tests__/helpers/kosztorys-db-tree.ts` — `createKosztorysTree`, 13 importerów vs 11 ręcznych
- `scripts/test-integration.sh` — odkrywa specy przez `grep -rl 'skipIf(!ENV_READY)'`
- `vitest.config.ts` — plugin `stubServerActions`, aliasy stubów, dwa projekty

## Architecture Insights

- **Rozszerzenie pliku JEST środowiskiem.** `.test.ts` → node, `.test.tsx` → jsdom. Nie ma drugiego
  przełącznika; pomyłka w rozszerzeniu to pomyłka w runnerze.
- **`skipIf(!ENV_READY)` jest infrastrukturą, nie idiomem.** Odkrywanie specs DB-owych to grep po tym
  literale. Każdy refaktor deduplikujący ten warunek musi zostawić literał na miejscu.
- **`vi.mock` hoistowany per-moduł zabija najoczywistszy fix** na powtarzalny boilerplate: helper
  importowany dla efektu ubocznego nie zadziała. Wyjście to fabryki mocków.
- **Korelacja gęstości testów z ryzykiem jest odwrotna.** `lib/db` 3,59× test:src, `components/ui`
  0,04×. Testowany jest ten kod, który _łatwo_ testować, nie ten, który _trzeba_.
- **Wzorzec porażki jest jeden i powtarzalny**: gdy oracle jest drogi (stan w bazie, druga
  powierzchnia), spec sięga po mocka albo wyprowadza oczekiwanie z testowanego kodu — i wtedy
  najgrubszy plik chroni najmniej. `transfer-actions` i `reconciliation` to ten sam błąd na dwóch
  różnych warstwach.
- **Akrecja, nie generacja.** 103 z 287 śledzonych specs dodano raz i nigdy nie tknięto. Tylko 2
  commity dodały ≥5 specs naraz — to nie jest efekt jednorazowej masówki, tylko trzech miesięcy
  dokładania bez przeglądu.

## Historical Context (from prior changes)

- `context/foundation/test-plan.md` §1 — reguła nadrzędna: oracle z niezależnego źródła; asercja
  o wartości wziętej z implementacji jest **defektem testu**. §7 wyklucza Sheets, cache/rewalidację,
  snapshoty UI i panel Payloada. §8 — ostatni przegląd 2026-07-08; §4 mówi „52 pliki" przy obecnych 348.
- `context/changes/2026-09-15-e2e-backlog-audit/audit.md` — wzorcowy podział ryzyka DOM vs E2E; niesie
  dwie nieaktualne liczby (`:30`).
- EX-635 (docblock `helpers/kosztorys-db-tree.ts`) — wersja inline kosztowała ~60 linii, zanim spec
  cokolwiek zaasertował.
- EX-725 — fixture, która zgubiła całą płaszczyznę; źródło `DATASET_FLOOR`.
- EX-526 — kontrakt lanes, którego `save-lanes.test.ts` nie pinuje.
- Incydent 2026-08 — osiem arkuszy klientów, 36 obcych wierszy; uzasadnia zachowanie specs
  credentialowych mimo wykluczenia Sheets w §7.

## Related Research

- `context/changes/2026-09-15-e2e-backlog-audit/audit.md` — audyt warstwy E2E, komplementarny zakresem
- `context/foundation/test-plan.md` — mapa ryzyk i strategia, dokument nadrzędny wobec tego audytu

## Open Questions

1. **§7 `test-plan.md` jest nieaktualne w punkcie Sheets — ROZSTRZYGNIĘTE 2026-09-15 (właściciel).**
   „Retired at cutover S-09" nie obowiązuje: integracja nie znika i długo nie zniknie, bo przez dłuższy
   czas będą istnieć dwie wersje aplikacji — zintegrowana z Sheets i standalone. **Do zrobienia:**
   przepisać ten punkt §7, żeby plan przestał usprawiedliwiać kasowanie testów Sheets. Otwarte zostaje
   tylko cache/rewalidacja (83 LOC specs przeciw wykluczeniu).
2. **Co z `deposit-payment-method.test.tsx`?** Czerwony i nieśledzony. Naprawić asercję, naprawić
   implementację, czy skasować? Plus osobno: 13,24 s za 4 testy woła o diagnozę.
3. **Czy `transfer-actions` przepisać na DB, czy skasować?** Przepisanie zamyka ryzyko #2, ale to
   robota na osobny change, nie na sweep.
4. **Czy korzeń `src__tests__/` domigrowywać do mirrora?** 45 plików, 18 % pakietu. Odkrywalność jest
   OK, więc to czysta higiena — koszt review vs wartość.
5. **Czy ~6 300 LOC nietestowanego UI to świadoma decyzja?** Jeśli tak, §7 powinien to nazwać. Jeśli
   nie, to jest większa dziura niż wszystko, co ten audyt proponuje wyciąć.
