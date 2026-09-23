---
date: 2026-09-23T17:16:32+02:00
researcher: Claude Opus 5
git_commit: cc7baeedd8e8bd9578315c519be61bce1f8539fe
branch: spike/wydruk-oferty
repository: wykonczymy
topic: 'Wydruk oferty z kosztorysu — PDF dla klienta'
tags: [research, kosztorys, print, client-view, disclosure, offer]
status: complete
last_updated: 2026-09-23
last_updated_by: Claude Opus 5
---

# Research: wydruk oferty z kosztorysu (PDF dla klienta)

**Date**: 2026-09-23T17:16:32+02:00
**Researcher**: Claude Opus 5
**Git Commit**: cc7baeedd8e8bd9578315c519be61bce1f8539fe
**Branch**: spike/wydruk-oferty
**Repository**: wykonczymy

## Research Question

Spike („Wygeneruj ofertę w PDF" w menu Inwestor) działa i respektuje zapisane ustawienia podglądu.
Co musi się wydarzyć, żeby zamienić go w porządny change: gdzie ta funkcja siedzi względem blokady
ujawniania, czy powtarza istniejącą infrastrukturę wydruku, jakie figury drukuje, czego brakuje
względem arkusza właściciela, i jaką powierzchnię testową jest winna.

## Summary

Spike jest poprawny w tym, co zdecydował **świadomie** (czyta zapisaną konfigurację podglądu
zamiast wymyślać własny filtr, drukuje `rows` a nie `viewRows`, liczy figurę ofertową
`rowPlannedNetForView`), i ma cztery rzeczy, których nikt nie zdecydował:

1. **Ta praca odwraca zapisaną decyzję właściciela.** Slice **S-14 `kosztorys-export` został ścięty
   w całości 2026-08-15** (`context/foundation/roadmap.md:596-618`) — CSV (EX-400) **oraz PDF**
   (EX-666) — z uzasadnieniem, że żywy link dla klienta robi obie te prace.
   `context/foundation/prd.md:98-102` zmienia pod to kryteria sukcesu, a FR-008 jest celowo
   niezaimplementowane. Nic tego dziś nie odwołuje na piśmie. Cięcie przeniosło jeden wymóg dalej:
   _„Any future export must make such a column physically absent from the file, with no formula
   referencing it"_ — builder to spełnia, ale przez przypadek, nie przez zapis.
2. **Dokument drukowany stoi CAŁKOWICIE poza blokadą ujawniania.** Obie połowy zamka
   (`assertDisclosurePair`) są w wydruku przepisane ręcznie: allowlista jako pięcioelementowa
   stała `OFFER_COLUMNS`, plan cenowy jako literał `'client'` w dwóch wywołaniach. Nic nie rzuca
   wyjątkiem, żaden test nie pilnuje. Dopisanie `note` („komentarz", wewnętrzny z decyzji
   właściciela 2026-07-20) albo kolumny stawki podwykonawcy to jedna linia.
3. **Globalny rabat nigdy nie schodzi z drukowanego „Razem netto"** — to błąd figury, nie braki
   w stylach.
4. **Zero testów**, przy czym najtańsza warstwa (node) pokrywa 5 z 7 linii ryzyka.

Poza tym wydruk jest trzecim wywołaniem `openPrintWindow` i pierwszym użyciem `escapeHtml`
w kontekście atrybutu — obie rzeczy zmieniają arytmetykę decyzji podjętych wcześniej przy dwóch
wywołaniach.

## Detailed Findings

### 1. Blokada ujawniania — gdzie jest i dlaczego wydruk jest poza nią

Zamek to **dwie połowy trzymane razem** w jednym punkcie:
`src/components/kosztorys/editor/grid/column-selection.ts:40` — `assertDisclosurePair` rzuca
`previewVisible requires view='client'`. Wołane wyłącznie z `selectV2Columns` (`:65`), osiągalne
wyłącznie przez `buildV2Grid` ← `use-kosztorys-editor.ts:512`.

- **Połowa 1 — allowlista.** `PREVIEW_VISIBLE_COLUMNS` (`src/lib/kosztorys/column-config.ts:213`),
  spłaszczenie `CLIENT_VIEW_GROUPS` (`:180-211`). Jej zasięg to TOŻSAMOŚĆ kolumny, nie plan cenowy.
- **Połowa 2 — przypięty plan.** `use-kosztorys-view-state.ts:63` —
  `const view = preview ? 'client' : …`. Bez tego klient ustawiający
  `localStorage['kosztorys-view:<id>']` renderuje sobie plan podwykonawcy.
- **Trzecia warstwa, wyłącznie odejmująca.** `use-kosztorys-editor.ts:469` —
  `previewHiddenColumns`; sanitizer `client-view-settings.ts:66` filtruje każdy klucz przez
  `PREVIEW_VISIBLE_COLUMNS` i **zawodzi zamknięty**.

`build-offer-print-html.ts` nie dotyka żadnego z tych punktów. Odtwarza obie połowy ręcznie:
allowlistę jako `OFFER_COLUMNS` (`:146-187`), plan jako literały `viewPrice(row, 'client')` (`:177`)
i `rowPlannedNetForView(row, 'client')` (`:185`, `:243`).

Co z tego wynika, po kolei od najgorszego:

1. **Dopisanie kolumny do `OFFER_COLUMNS` nie jest sprawdzane przez nic.** `note`, `priceMode`,
   cztery kolumny stawek per-plan i kolumna rozjazdu są jedną linią od druku.
2. **Plan to literał, nie pin.** Gdyby ktoś sparametryzował ofertę aktywnym `view` siatki
   (prawdopodobne — akcja i tak czyta `useKosztorysEditorContext`), wydruk pójdzie za planem
   `w_tools`/`own_tools` i wydrukuje bazę kosztową podwykonawcy pod nagłówkiem „Cena j.m.".
3. **Promień rażenia jest mniejszy niż na stronie share.** HTML składa się po stronie klienta,
   w przeglądarce **właściciela**, z danych, które właściciel i tak ma;
   `readClientViewSettings` robi `requireAuth(MANAGEMENT_ROLES)`. Nie powstaje nowa nieuwierzytelniona
   powierzchnia. Klasa wycieku to czysto „co trafia na papier, który właściciel wręcza klientowi".

**Kontekst, który to podbija:** payload podglądu **niczego nie odcina** —
`src/lib/queries/preview-kosztorys.ts:25-30` zapisuje to jako politykę („the owner accepted the
leak, so the full payload ships… that is not laziness, it is the anti-drift rule"). Cały reżim
ujawniania jest warstwą renderu. Wydruk jest nową warstwą renderu bez zamka.

### 2. Figury — co wydruk liczy i gdzie się rozjeżdża

`rowPlannedNetForView` (`calc.ts:225`) to właściwa figura oferty — arkuszowe `S = N×Q − N×Q×R`,
rabat wchodzi przez `netForQtyForView`, więc nie może po cichu wypaść. To jest dobrze wybrane.

Rozjazdy:

- **Globalny rabat.** `applyDiscount` (`calc.ts:58-63`) robi short-circuit przy
  `globalDiscountActive`, bo globalny rabat schodzi **raz, na poziomie sumy** —
  `globalDiscountAmount(totalNet, discount)` (`calc.ts:310`), używane przez
  `clientTotalsFromSubtotals` (`settlement-client-totals.ts:61-69`). Wydruk nie robi ani jednego,
  ani drugiego (`build-offer-print-html.ts:243-245`, `:261-266`). Przy rabacie kwotowym drukowane
  „Razem netto" zawyża ofertę o cały globalny rabat i nie zgadza się z panelem.
  _Uwaga domenowa:_ baza globalnego rabatu to **praca wykonana**, a oferta stoi na przedmiarze —
  więc „odejmij globalny rabat" nie jest mechanicznym fixem, tylko pytaniem do właściciela.
- **Zaokrąglenia.** `zloty` (`:27`) zaokrągla każdy wiersz; sumy sekcji i suma główna zaokrąglają
  nieokrojony akumulator (`:244-245`). Klient dodający kolumnę dostaje inną liczbę niż drukowana
  suma. Komentarz przy `zloty` (`:21-26`) twierdzi, że „parts and the sum are read off one scale" —
  nieprawda.
- **`colspan` schodzi do zera.** `closeSection` emituje `colspan="${columns.length - 1}"` (`:223`).
  `description` jest w `PREVIEW_VISIBLE_COLUMNS`, więc da się je ukryć z dialogu; przy samym
  `plannedNet` to `colspan="0"`.
- **`remaining` („Pozostało") jest w `OFFER_VISIBLE_COLUMNS`** (`client-view-settings.ts:27-34`),
  ale nie ma wpisu w `OFFER_COLUMNS` — właściciel, który zostawi ją widoczną, dostaje ją na
  ekranie i nie dostaje na papierze.
- **Tryb `SETTLEMENT`.** Akcja woła `clientViewSettingsForMode(config)` (`offer-print-action.tsx:62`),
  więc przy zapisanym trybie SETTLEMENT stosuje settlementowy zbiór ukrytych kolumn do ofertowego
  zestawu — i drukuje po cichu to, co przeżyje. Żadna kolumna settlementowa (`stageQtySum`, `net`,
  grupy etapów, `donePercent`) nie jest drukowalna.
- **Kolumny brutto** (`priceGross`, `plannedGross`) i rabatowe (`discountType`/`discountValue`/
  `discountAmount`) są allowlistowane i klikalne na ekranie, niedrukowalne na papierze.
- **Benign:** sumy ekranowe idą z `rows`, drukowane z przefiltrowanego zbioru — bez różnicy, bo
  `client-empty` to wiersz zerowy na obu osiach (`row-conditions/registry.ts:321-334`).

### 3. Arkusz właściciela — czego wydruk jeszcze nie ma

Widok ofertowy w arkuszu (screeny w `context/reference/kosztorys-sheet/`):

- **Nagłówek**: logo z telefonem firmowym `505-805-425`, komórka tytułowa
  `WPISAĆ ADRES Imię i nazwisko oraz adres inwestycji`, oraz **puste, opisane sloty**
  `tel kontaktowy` / `adres mail`. Aplikacja nie ma dziś żadnego z tych pól w payloadzie podglądu
  (`getPreviewKosztorysById` daje `investmentName`) i **nie istnieje żadna decyzja** na ten temat.
- **Kolumny w kolejności**: nazwa sekcji (A), liczba porządkowa (B), opis (C), dziesięć kolumn
  `etap ilość` pod pasmem `wykonano`, `Przedmiar` (N), `Pomiar z natury` (O), `j.m.` (P),
  `cena j.m.` (Q), **`R rabat` ukryta**, `Wartość przedmiar` (S), `Wartość pomiar z natury` (T).
  **Bez kolumny komentarz.**
- **Pieniądze bez groszy, grupowane, z sufiksem `zł`** — to potwierdza wybór `zloty()`
  w spike'u przeciw aplikacyjnemu `formatNet` (2 miejsca), którego używa żywy podgląd klienta.
  Ta sama oferta w linku i na papierze pokazuje więc tę samą kwotę w dwóch precyzjach.
- **Puste sekcje nadal się drukują**, z podsumą `0 zł`. Aplikacja je wywala (`hideEmptyRows` →
  wiersze znikają → pasmo sekcji nigdy nie powstaje). Realny rozjazd z arkuszem.
- **Stopka, wiersze 456–464**: `wartość netto` (pogrubione) — i dopiero potem blok rozliczeniowy
  (`8,00%` + `suma transzy`, `Pozostałe koszty`, `Materiały wykończeniowe`, `Materiały budowlane`,
  `aktualnie do zapłaty R + M netto/brutto`, `R netto/brutto - suma prac wykonannych`).
  **Tylko wiersz 456 i wykres kołowy są figurami oferty**; 457–464 to dokument rozliczeniowy.
- **Wykres kołowy**: udział wartości netto per sekcja, etykiety na zewnątrz z odnośnikami, nazwa +
  szary procent, bez legendy.

### 4. Infrastruktura wydruku — trzecie wywołanie zmienia arytmetykę

`openPrintWindow` ma dziś trzech wywołujących: `print-transfers-button.tsx`,
`media-preview-dialog.tsx` i ofertę. Wspólny helper wydruku został **jawnie odrzucony przy dwóch**
wywołujących (`context/archive/2026-09-14-transfer-print-return/review-gate.md:44`) i tydzień
później i tak wyekstrahowany. Przy trzecim tamten rachunek już nie stoi.

Siedem konkretnie zduplikowanych spraw między `build-transfers-print-html.ts` a ofertą: szkielet
doctype (6 z 8 linii bajt w bajt), preambuła arkusza wydruku, emisja wiersza nagłówków, emisja
wiersza treści, typ deskryptora kolumny (`PrintColumnT` vs `OfferColumnT`), choreografia po stronie
wywołującego, oraz przyjęty wyjątek lintowy na `document.write` (oferta dziedziczy go bez żadnego
zapisu).

**Wydruk transferów robi to bezpieczniej i inaczej**: bierze `table.getVisibleLeafColumns()` czytelnika
i formatuje przez `columnDef.meta.printValue` (`src/components/tables/column-meta.ts`), a wiersze
dociąga nie-paginowane przez `fetchFilteredTransfers`. Czyli wydruk jest **wyprowadzony z powierzchni,
którą odbija**, zamiast z drugiej ręcznie utrzymywanej listy kolumn — dokładnie ta własność, której
ofercie brakuje. (Ryzyko z tej rodziny: EX-777 / EX-781, „sort na ekranie ≠ sort na wydruku", oba Done.)

Reszta drobiazgów:

- `escapeHtml` (`src/lib/utils/escape-html.ts:2-3`) escapuje tylko `& < >`, **nie cudzysłowy**.
  Spike wprowadza pierwsze użycie w atrybucie (`<img src="${escapeHtml(logoUrl)}">`, `:270`);
  pozostałe interpolacje atrybutowe (`style="border-left-color:${sectionFill}"`) są w ogóle
  nieescapowane i bezpieczne tylko dlatego, że wartości pochodzą z mapy palety i
  `window.location.origin`.
- `zloty()` to **trzecia skala pieniędzy** w repo obok `formatPLN` (2 miejsca + „zł") i `formatNet`
  (2 miejsca, goły). Jeśli przeżyje, jej miejscem jest `src/lib/kosztorys/format.ts`.
- Etykiety kolumn dublują `COLUMN_LABELS` i **już się rozjeżdżają**: `price` → `'Cena j.m. netto'`
  vs oferta `'Cena j.m.'`; `plannedNet` → `'Wartość przedmiaru netto'` vs oferta `'Wartość netto'`.
  `column-config.ts:10-11` mówi, że ta mapa jest „the single source for both the header and the
  column picker".
- `SECTION_COLORS` trzyma stringi `var(--color-section-*)`; **nic w aplikacji nie rozwiązuje ich do
  wartości policzonych** — `resolveSectionFills` jest naprawdę nowe. Precedens umiejscowienia:
  `src/lib/utils/text-measure.ts`, albo `section-colors.ts` jeśli ma zostać palette-specific.
- Logo: `public/logo-wykonczymy.png`, 360 × 280, opakowane przez `BrandLogo` (`LOGO_ASPECT`).
- **Podwójny odczyt**: `useInvestorActions` już pobiera i cachuje `clientView`
  (`investor-actions.tsx:39`, `:54-62`), a `GenerateOfferMenuItem` strzela własnym
  `readClientViewSettings` (`offer-print-action.tsx:56`).
- **Brak bramki roli**: oba sąsiednie punkty menu mają `disabled={!allowed}` przez
  `useMayServeTheClient()` (`investor-actions.tsx:119-146`); oferta nie ma. MANAGER wydrukuje
  dokument klienta. Zgodnie z `feedback_missing_guard_is_not_a_bug` — to pytanie o intencję, nie
  finding.

### 5. Powierzchnia testowa

Oba pliki spike'u są nieśledzone i mają **zerowe pokrycie**.

Ryzyka, które `context/foundation/test-plan.md` już nazywa:

| id                    | ryzyko                                                                                   | trafność                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#1** (`:52`, `:68`) | „Two app surfaces disagree — investment totals ≠ kosztorys totals"                       | drukowane „Razem netto" to **czwarte** zwinięcie `Σ rowPlannedNetForView(row,'client')` obok `sectionSubtotalsForView`, `columnTotalsForRows` i memo `plannedNet` w hooku |
| **#9** (`:60`)        | „The client's offer is unreadable…"                                                      | jedyny wiersz ryzyka już zakresowany na dokument ofertowy klienta                                                                                                         |
| **#5** (`:56`)        | „…different numbers than the Google Sheet it replaces — clients billed on wrong figures" | wydruk to artefakt wręczany klientowi                                                                                                                                     |

**Ujawnianie nie jest nazwane w mapie ryzyk** — „czego klient NIE może zobaczyć" trzyma dziś
wyłącznie kod (`assertDisclosurePair`) i `preview-columns.test.ts`. Żeby zakotwiczyć spec
ujawniania na ryzyku planu, `/10x-test-plan` musi je najpierw dopisać.

§7 `:179` wyklucza snapshoty wizualne — jedyny snapshot w repo (`sheets-golden.test.ts`) to
charakteryzacja payloadu API, nie renderu dokumentu. Wzorzec do skopiowania to
`src/__tests__/lib/transfers/build-transfers-print-html.test.ts` (57 linii): celowane
`toContain`/`indexOf` na stringu, wspólny fixture, zero snapshotów.

Fixtures — **nie klepać `as never`**: `row()` + `CTX` z
`src/__tests__/lib/kosztorys/row-conditions/fixtures.ts:23-50` (jego `CTX` to dokładnie ten kształt,
który wydruk przekazuje), albo `makeTree` + `treeToRows`
(`src/__tests__/helpers/kosztorys-tree.ts:11-42`) gdy spec potrzebuje realnej topologii sekcji /
globalnego rabatu. Najbliższy tematycznie istniejący spec:
`src/__tests__/lib/kosztorys/client-document-subtotals.test.ts` — buduje dwusekcyjne drzewo i robi
**identyczne** wywołanie `applyRowConditions(rows, clientConditionIds(true), ctx)`.

Warstwa DOM: jsdom nie implementuje `window.open`, więc `openPrintWindow` zwraca `null` i gałąź
„popup zablokowany" (`offer-print-action.tsx:50-53`) jest testowalna za darmo; happy path potrzebuje
`vi.spyOn(window, 'open')` z atrapą okna. `readClientViewSettings` to moduł `'use server'`, więc
`stubServerActions` (`vitest.config.ts:33-49`) podmienia go na rzucającą atrapę — spec **musi**
go `vi.mock`-ować. Kształt renderu pozycji menu Radix:
`src/__tests__/components/kosztorys/editor/grid/sort-menu-items.test.tsx:13-40` (wymuszone
`<DropdownMenu open>`, klik po roli `menuitem`, nigdy `onSelect` wprost).

E2E: jedyny szczery kandydat to realny popup + realny print przez granicę klient→akcja→DB
(`e2e/transfer-sort-and-print.spec.ts:38-42`, `:82-84` neutralizuje `window.print` przez
`addInitScript` i czyta `<thead>/<tbody>` printoutu; połowa ujawniająca z
`e2e/client-share.spec.ts:151-200`). Audyt z 2026-09-15 (`:40-47`) każe spychać wszystko, co się da,
do node/dom — pełny przebieg to ~1 h. Odroczenie musi mieć id issue z labelem `e2e-backlog`, inaczej
`slice-review-gate` Step 3 blokuje archiwizację.

## Code References

- `src/lib/kosztorys/build-offer-print-html.ts:146-187` — `OFFER_COLUMNS`, trzecia allowlista
- `src/lib/kosztorys/build-offer-print-html.ts:223` — `colspan="${columns.length - 1}"`
- `src/lib/kosztorys/build-offer-print-html.ts:243-245,261-266` — sumy bez globalnego rabatu
- `src/lib/kosztorys/build-offer-print-html.ts:27` — `zloty()`, trzecia skala pieniędzy
- `src/components/kosztorys/editor/actions/offer-print-action.tsx:19-33` — `resolveSectionFills`
- `src/components/kosztorys/editor/actions/offer-print-action.tsx:56` — własny odczyt konfiguracji
- `src/components/kosztorys/editor/grid/column-selection.ts:40,53,65,84` — `assertDisclosurePair`
- `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts:45,63` — przypięty plan
- `src/lib/kosztorys/column-config.ts:161-174,180-213` — allowlista i grupy
- `src/lib/kosztorys/client-view-settings.ts:27-43,66-83,106` — warianty, sanitizer, wybór trybu
- `src/lib/kosztorys/calc.ts:58-63,174,208,225,310` — rabat, plany, figura oferty, rabat globalny
- `src/lib/kosztorys/settlement-client-totals.ts:54-69` — gdzie globalny rabat faktycznie schodzi
- `src/lib/queries/preview-kosztorys.ts:23-30,48,94-101,143-146` — payload podglądu, brak odcięcia
- `src/lib/transfers/build-transfers-print-html.ts` + `src/components/tables/column-meta.ts` — wzorzec
- `src/lib/utils/print-window.ts:11-16` — `openPrintWindow` / `printThenClose`
- `src/lib/utils/escape-html.ts:2-3` — escapuje tylko `& < >`

## Architecture Insights

- **Reżim ujawniania w tej aplikacji jest w całości warstwą renderu.** Dane jadą do klienta
  w komplecie i to jest zapisana, świadoma decyzja (anty-drift). Konsekwencja dla tego change'u:
  każda **nowa powierzchnia renderu jest nową powierzchnią ujawniania** i musi wejść pod ten sam
  chokepoint albo dorobić sobie równoważną asercję. Wydruk jest pierwszą taką powierzchnią od
  czasu strony share.
- **Wydruk wyprowadzony z powierzchni, którą odbija, nie rozjeżdża się; wydruk z własną listą
  kolumn — rozjeżdża.** Transfery wybrały pierwsze i EX-777/EX-781 pokazały, co kosztuje drugie.
- **Jedna figura, jedno źródło.** `rowPlannedNetForView` jest właściwym wyborem dokładnie dlatego,
  że „has no arithmetic of its own and cannot drift from the sheet". Suma nad nim **ma** własną
  arytmetykę (zaokrąglenie per wiersz, brak rabatu globalnego) i dlatego się rozjeżdża.
- **Trzeci wywołujący zmienia rachunek ekstrakcji** — odrzucenie wspólnego helpera przy dwóch było
  słuszne i przestało być prawdziwe przy trzech.

## Historical Context (from prior changes)

- `context/foundation/roadmap.md:596-618` — **S-14 `kosztorys-export` ścięty 2026-08-15**, CSV
  (EX-400) i PDF (EX-666); przeniesiony wymóg o fizycznej nieobecności kolumny w pliku.
- `context/foundation/prd.md:98-102` — kryteria sukcesu zmienione pod to cięcie; FR-008 celowo
  niezaimplementowane.
- `context/archive/2026-08-19-kosztorys-client-view-offer-settlement-variants/change.md` — warianty OFFER/SETTLEMENT: wariant jest trwałym stanem
  inwestycji, jedną decyzją a nie dwiema; zmiana podnosi „Uwaga — zmiana widoczna dla inwestora!";
  „Zapisz jako domyślne" rusza jeden wariant. **Wniosek: przycisk wydruku nie może oferować
  własnego wyboru OFFER/SETTLEMENT — czyta aktywny wariant.**
- `context/archive/2026-09-14-transfer-print-return/review-gate.md:44` — wspólny helper wydruku
  odrzucony przy dwóch wywołujących.
- `context/changes/2026-09-15-e2e-backlog-audit/audit.md:17-47` — koszt E2E i reguła spychania
  ryzyka w dół.
- Decyzja właściciela 2026-07-20: `note` („komentarz") jest wewnętrznym tekstem właściciela i DTO
  klienta go zrzuca.
- EX-777 / EX-781 (Done) — „sort na ekranie ≠ sort na wydruku" na wydruku transferów.

## Open Questions

Do rozstrzygnięcia w planie (własne) albo z właścicielem (oznaczone **[właściciel]**):

1. **[właściciel]** Globalny rabat na ofercie: jego bazą jest praca **wykonana**, a oferta stoi na
   **przedmiarze**. Co ma znaczyć „Razem netto" na ofercie przy aktywnym rabacie globalnym?
2. **[właściciel]** Telefon / e-mail / adres inwestycji w nagłówku — arkusz ma cztery sloty,
   aplikacja nie ma żadnej decyzji i żadnego pola w payloadzie podglądu.
3. **[właściciel]** Puste sekcje: arkusz drukuje je z `0 zł`, aplikacja je wywala.
4. **[właściciel]** Bramka roli — czy MANAGER ma móc wydrukować dokument klienta.
5. Czy przepiąć wydruk pod `selectV2Columns` z `previewVisible: true` (pełny zamek), czy zostawić
   własną listę plus asercja `OFFER_COLUMNS ⊆ PREVIEW_VISIBLE_COLUMNS` w specu node.
6. Ekstrakcja wspólnej powłoki wydruku przy trzecim wywołującym — teraz czy osobnym changem.
7. `zloty()` do `format.ts` czy zostaje lokalne; i czy żywy podgląd klienta ma pójść na tę samą
   precyzję.
8. Etykiety kolumn z `COLUMN_LABELS` czy własne (dziś rozjazd na dwóch z pięciu).
9. `remaining` — dodać wpis do `OFFER_COLUMNS` czy wyciąć z `OFFER_VISIBLE_COLUMNS`.
10. Wykres kołowy udziału sekcji — zakres tego change'u czy następnego.
11. Zapis odwrócenia cięcia S-14 — gdzie (roadmap `O-0x` czy nota w prd).
12. Przypadek 2 wydruku (nieopisany) pozostaje poza zakresem.
