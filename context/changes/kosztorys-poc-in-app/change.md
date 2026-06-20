---
id: kosztorys-poc-in-app
title: Kosztorys robocizny w aplikacji — POC przejścia z Google Sheets
status: planned
created: 2026-06-19
updated: 2026-06-20
---

# Kosztorys robocizny w aplikacji — POC przejścia z Google Sheets

POC pełnego przejścia edytowalnej rozpiski robocizny z Google Sheets do aplikacji.
Czysty start (bez importu arkuszy), baza aplikacji = źródło prawdy, współistnienie
z istniejącą zakładką „Arkusz".

- **Spec (zaakceptowany):** `docs/superpowers/specs/2026-06-19-kosztorys-poc-in-app-design.md`
- **Brain dump:** `docs/superpowers/specs/2026-06-19-kosztorys-poc-in-app-notes.md`
- **Plan:** `context/changes/kosztorys-poc-in-app/plan.md`
- **Brief:** `context/changes/kosztorys-poc-in-app/plan-brief.md`

## Decyzje POC → MVP (do review właściciela)

> Rejestr decyzji, które zapadły w POC i które **przenosimy do MVP**. Legenda statusu:
> **[PEWNE]** = zaakceptowane, niesiemy bez zmian · **[SKRÓT POC]** = świadome
> uproszczenie na czas POC, do rewizji przy MVP · **[ZALEŻNE]** = wiąże się z otwartym
> pytaniem właściciela (patrz „Pytania do właściciela" na końcu). Otwarte pytania NIE są
> tu decyzjami — są w sekcji pytań.

### A. Model danych i kalkulacje

- **[PEWNE] Czysty start, baza appki = źródło prawdy, ZERO importu arkuszy.** Arkusze
  dowiedzione jako niewiarygodne (drift od bazy: brak backfillu wydatków, kolizje ID
  transferów, rozjazd sum wypłat). Appka i tak liczy wszystkie actuals; arkusz wnosił
  tylko rozpiskę robocizny — i to ona trafia do edytora.
- **[PEWNE] Schemat rdzenia:** `kosztorys_sections` / `kosztorys_items` /
  `kosztorys_stages` / `stage_progress` (+ `kosztorys_rooms`). **Brak osobnej tabeli
  materiałów** — materiały = `INVESTMENT_EXPENSE` (już w appce).
- **[PEWNE] Model widoku płaski** (`KosztorysV2RowT`): sekcja jako denormalizowana,
  sortowalna/filtrowalna kolumna, NIE wiersz-nagłówek — żeby sort/filtr działały jak w
  pozostałych tabelach appki. Subtotale per sekcja = osobny temat (pytanie #1).
- **[PEWNE] Wartości liczone, nie przechowywane** (czyste funkcje w `calc.ts`): netto,
  brutto, „pozostało", sumy sekcji/całości, marża. Zapisywane = TYLKO inputy. Gwarancja:
  zero dryfu formuł, zero ręcznej synchronizacji między widokami.
- **[PEWNE] Przedmiar i pomiar = dwie niezależne, edytowalne kolumny.** Wartość liczona
  z **pomiaru**. W szablonie pomiar startuje skopiowany z przedmiaru (żeby nie był pusty).
- **[PEWNE] Etapy dynamiczne** (wiersze `kosztorys_stages`, kolumny renderowane z danych);
  `stage_progress` rzadkie (brak wiersza = 0). Usunięcie etapu z wpisanym postępem =
  BLOKADA (najpierw wyczyść). Etap = ordinal + opcjonalna nazwa.
- **[PEWNE] Rabat dwutrybowy:** `discount_type ∈ {percent, amount}` + `discount_value`.
- **[PEWNE] VAT kaskadowo:** ceny wpisywane **netto**, brutto = netto × (1+vat) liczone.
  `vat_rate` na sekcji (+ globalny default), pozycja dziedziczy. (Domyślna stawka =
  pytanie #P7; override per pozycja — otwarte.)
- **[PEWNE] „Pozostało do wykonania" = kontrola postępu robót** (wartość pozycji − Σ
  wartości wykonanych etapów), wskaźnik informacyjny, NIE figura rozliczeniowa z klientem.
- **[ZALEŻNE] Ceny = 3 niezależne kolumny snapshot w jednym wierszu** (`clientPrice`,
  `subcontractorWToolsPrice`, `subcontractorOwnToolsPrice`) — wariant **A**. Relacja
  podwykonawca↔klient NIE jest formułą (raz %, raz inna absolutna). POC zaimplementował A;
  formalnie A vs B (dynamiczna tabela wariantów) **nierozstrzygnięte** — patrz pytanie #P4.

### B. Edytor — stack, UX, funkcje

- **[PEWNE] Edytor = v2 `react-datasheet-grid`** (bake-off wygrany, decyzja właściciela
  2026-06-20). v1 (TanStack) **usunięta** po sportowaniu przewag. Bramka zgodności z
  React 19 / Next 16 / React Compiler — zdana natywnie.
- **[PEWNE] „Jeden zbiór, trzy widoki"** — przełącznik aktywnej ceny (Robocizna /
  Z narzędziami / Bez narzędzi) zmienia kolumnę „Cena" i jej liczone; pomiar i etapy bez
  zmian. To raison d'être całego podejścia (koniec 3 zduplikowanych arkuszy).
  **Bug naprawiony 2026-06-20:** dsg zamraża `columns` na montażu, więc sam przełącznik
  widoku nie podnosił nowych wiązań — wszystkie 3 widoki pokazywały cenę klienta. Fix:
  `view` w kluczu remountu siatki (`key={`${view}:${widthsKey}`}`). Lekcja poszerzona w
  `context/foundation/lessons.md` (klucz remountu musi obejmować KAŻDY wymiar kształtujący
  kolumny, nie tylko szerokości).
- **[PEWNE] Autosave per pole, optymistycznie, debounced; BEZ przycisku „Zapisz".**
  Zapisujemy tylko zmienione pole (skala 1000+). + **revert-on-error** (cofa edycję przy
  odrzuceniu serwera).
- **[PEWNE] Funkcje siatki:** sort per kolumna (nietrwały po reloadzie — parytet z appką),
  filtr/szukajka (opis/sekcja/j.m.), przełącznik widoczności kolumn (TRWAŁY, localStorage),
  kolumna „Pozostało", select typu rabatu, suma netto w toolbarze (respektuje filtr+widok).
- **[PEWNE] Rozszerzanie kolumn (drag-resize).** Uchwyt na krawędzi nagłówka; prowadnica
  w trakcie dragu; **commit-on-release** (na puść) + zapis do localStorage, trwały po
  reloadzie. **Ograniczenie biblioteki:** dsg nie ma natywnego resize i nie przelicza
  szerokości bez remountu — stąd commit-on-release + remount siatki przez `key`. Live-drag
  (podgląd szerokości na żywo) niewykonalny bez forka. Zob. lekcję w
  `context/foundation/lessons.md` („no native column resize … remount with a `key`").
- **[PEWNE] Layout:** pełna wysokość strony (jak widok arkusza), mniejsza czcionka,
  `DataSheetGrid` ze stałym `rowHeight`, fix migotania (tor `grid-cols-[minmax(0,1fr)]`).
- **[SKRÓT POC] `lockRows` włączone** — dodawanie/usuwanie pozycji/sekcji/etapów to
  osobny, zaplanowany slice (pytanie #7). Akcje serwerowe (`addItem`/`addStage`/
  `removeItem`/`updateSection`) już istnieją jako infrastruktura pod ten slice.
- **[SKRÓT POC] Trwałość UI per przeglądarka (localStorage), globalnie dla wszystkich
  kosztorysów** (widoczność i szerokości kolumn, klucze `kosztorys-v2-*`). W MVP rozważyć
  per-użytkownik i/lub per-kosztorys.

### C. Dostęp i role

- **[PEWNE] Bramka:** `requireAuth(MANAGEMENT_ROLES)` = **ADMIN / OWNER / MANAGER** widzą
  i edytują wszystko. **EMPLOYEE — zero dostępu** (nie widzi kosztorysu).
- **[SKRÓT POC] Brak ukrywania wrażliwych kolumn przed MANAGEREM.** Follow-on: ceny
  podwykonawcy (koszt/marża) tylko dla OWNER/ADMIN — pytanie #P10.

### D. Zakres i współistnienie

- **[PEWNE] Współistnienie z zakładką „Arkusz"** — edytor nie zastępuje jeszcze arkusza,
  żyje obok (link wejścia na detalu inwestycji „Kosztorys (edytor)").
- **[PEWNE] Domyślne POC:** PLN, hard-delete, reorder strzałkami (bez drag), bez
  `work_catalogue`, bez multi-waluty, bez teardownu Sheets, bez synchronizacji dwukierunkowej.
- **[ZALEŻNE] Forward-scope (wydatki klienckie read-only z transferów)** — osobny późniejszy
  slice; które transfery `INVESTMENT_EXPENSE` wchodzą = pytanie #5.

## Baza danych (ZWERYFIKOWANE 2026-06-19)

**Wszystkie migracje POC idą wyłącznie na `wykonczymy-poc`** — osobną bazę w
lokalnym Dockerze (kontener `wykonczymy`, port 5433). Potwierdzone:

- Worktree `.env` → `DB_POSTGRES_URL = postgres://postgres:****@localhost:5433/wykonczymy-poc`
  (jedyny, bez nadpisań; `.env.copy` to backup, nieładowany).
- Kontener `wykonczymy` mapuje `0.0.0.0:5433->5432`; w kontenerze są dwie bazy:
  `wykonczymy-db` (lokalny main — **NIETKNIĘTY**) oraz `wykonczymy-poc` (cel POC).
- `wykonczymy-poc` zaseedowana z dumpa Neona (80 inwestycji); tabele kosztorysu
  dodaje migracja `20260620_add_kosztorys_tables`.
- Prod (Neon) = `DB_POSTGRES_URL_PROD`, osobna zmienna — `payload migrate` jej nie
  używa. **Zero kontaktu z prod.**

Przed jakąkolwiek migracją/SQL potwierdź, że `DB_POSTGRES_URL` wskazuje
`wykonczymy-poc` (nie `wykonczymy-db`).

## Testowy arkusz (dane do populacji)

Źródło realnych danych do POC = arkusz **`testy_full_kosztorys`**, zakładka
`kosztorys_robocizny`:

- ID: `1TWZuU7ZDElhUameN4ii2U5TztmQG387Gqcn9NgwwObE`
- Link: https://docs.google.com/spreadsheets/d/1TWZuU7ZDElhUameN4ii2U5TztmQG387Gqcn9NgwwObE/edit
- Dostępny dla service accountu (read-only). Pobranie:
  `SHEET_ID=1TWZuU7ZDElhUameN4ii2U5TztmQG387Gqcn9NgwwObE TABS=kosztorys_robocizny node --env-file=.env scripts/inspect-sheet.mjs`
- Mapa kolumn (potwierdzona): A ordinal · B opis/sekcje (wiersz-nagłówek =
  nazwa sekcji) · C–H „N etap ilość" (postęp) · I przedmiar · J pomiar z natury ·
  K j.m. · L cena j.m. (klient) · M rabat % · N wartość netto · O komentarz ·
  P+ wartości etapów (liczone).

Seed: `src/scripts/poc-seed-kosztorys.ts` (czyta UNFORMATTED, mapuje na schemat,
`context.skipRevalidation` bo poza requestem; czyści inwestycję przed seedem).
Pierwszy run: inwestycja **6** = 8 sekcji, 224 pozycje, 6 etapów, 123 wpisy postępu.

## Tabela edytora — stack i decyzje (ZAKTUALIZOWANE)

POC od razu w wyglądzie aplikacji, nie surowy `<table>`. Decyzje:

- **TanStack Table** (`@tanstack/react-table`) — sortowanie i filtrowanie, jak w
  pozostałych tabelach. **TanStack Virtual** (`@tanstack/react-virtual`, już w
  zależnościach) — wirtualizacja dla 1000+ wierszy.
- **Reuse `src/components/ui/data-table/data-table.tsx`** (shadcn) — wygląd 1:1 z
  tabelami transferów/inwestycji: zaokrąglona ramka, nagłówki z ikoną sortowania,
  `ColumnToggle` („Kolumny"), wirtualizacja, persist widoczności kolumn.
- **Edycja inline** przez `EditableCell` w rendererach kolumn
  (`src/lib/tables/kosztorys-columns.tsx`); stan optymistyczny w
  `kosztorys-editor.tsx`, zapis debounced (`use-debounced-save.ts`).
- **Pełna funkcjonalność:** sortowanie (per kolumna), filtrowanie (szukajka po
  opisie/sekcji/j.m.), przełącznik kolumn, dynamiczne kolumny etapów, liczone
  netto/brutto/pozostało, suma netto w toolbarze.
- **Model widoku = płaski** (`KosztorysEditorRowT`): sekcja jako sortowalna/
  filtrowalna kolumna (denormalizowana z sekcji), nie wiersz-nagłówek — żeby sort/
  filtr działały jak w tabelach aplikacji. Subtotale per sekcja = follow-on.

## Stan implementacji — handoff (2026-06-19)

> ⚠️ **HISTORYCZNE (2026-06-19).** Aktualny stan: edytor = **v2** (jedna trasa
> `kosztorys-edytor-v2`), v1 usunięta, pełna wysokość + mniejsza czcionka, 5 przewag
> v1 przeniesione, revert-on-error, perf ~1000 zmierzony, inw. 7 = „test kosztorys
> Sienicka" (realne dane). Pliki v1 z listy poniżej (`kosztorys-editor.tsx`,
> `kosztorys-columns.tsx`, `editable-cell.tsx`, trasa `kosztorys-edytor/`) **już nie
> istnieją** — patrz sekcje „Sportowanie przewag…" i „UI/layout…" niżej.

**Slice 1 DZIAŁA, zweryfikowany w przeglądarce.** Pliki:

- Schemat: `src/migrations/20260620_add_kosztorys_tables.ts` (+ rejestr w
  `index.ts`), kolekcje `src/collections/kosztorys-*.ts` + `stage-progress.ts`
  (+ `payload.config.ts`, `lib/cache/tags.ts`). Migracja zaaplikowana na
  `wykonczymy-poc`.
- Edytor: `src/app/(frontend)/inwestycje/[id]/kosztorys-edytor/page.tsx`,
  `src/components/kosztorys/{kosztorys-editor,editable-cell,use-debounced-save}`,
  `src/lib/tables/kosztorys-columns.tsx`, `src/lib/actions/kosztorys.ts`,
  `src/lib/queries/kosztorys.ts`, `src/lib/kosztorys/calc.ts`,
  `src/types/kosztorys.ts`. Link wejścia w `inwestycje/[id]/page.tsx`.
- Tooling: `src/scripts/poc-seed-kosztorys.ts`, `src/scripts/poc-temp-user.ts`.

**Jak wznowić:**

1. `PORT=3001 pnpm dev`; login temp OWNER `poc@local.test` / `poc12345`
   (jeśli brak: `node --env-file=.env --import tsx src/scripts/poc-temp-user.ts`).
2. Dane: `node --env-file=.env --import tsx src/scripts/poc-seed-kosztorys.ts`
   (idempotentny — czyści inwestycję 6 i seeduje ponownie). Parametry env:
   `INV=<id>` (cel), `RENAME="…"` (zmiana nazwy inwestycji). Inw. 7 = „test kosztorys
   Sienicka": `INV=7 RENAME="test kosztorys Sienicka" node … poc-seed-kosztorys.ts`.
   Duży zbiór do perf: `INV=<id> node … poc-perf-seed-kosztorys.ts` (~1000 wierszy).
3. Wejście: `/inwestycje/6/kosztorys-edytor-v2` (lub inny `id`).
4. Setup `node_modules` (jeśli świeży worktree): `pnpm install` →
   `pnpm install --force` (naprawia arm64 sharp/lightningcss) → `pnpm generate:types`.

**Następne kroki — budowane na v2** (decyzja bake-offu niżej; kolejność wg
priorytetu właściciela):

- ✅ **Sportowanie przewag v1 + usunięcie v1** — ZROBIONE 2026-06-20 (sekcja niżej).
- ✅ **Perf ~1000 wierszy** — ZMIERZONE 2026-06-20, PASS (sekcja niżej).
- ✅ **revert-on-error** — ZROBIONE 2026-06-20 (autosave cofa edycję przy błędzie serwera).
- ⏸ **Pozostałe wymagają decyzji właściciela** (patrz „Pytania do właściciela" na
  końcu): subtotale per sekcja · doseed cen podwykonawcy (zakładki „zakres z/bez
  narzędzi") · panel plan-vs-actual · eksport PDF/CSV · UI pokoi · forward-scope
  (read-only wydatki z transferów).

## Bake-off siatki edytora (2026-06-19)

Faza 3 (edytowalna siatka) to rdzeń POC i **nie idziemy dalej, dopóki nie
zdecydujemy, że siatka jest dość szybka/niezawodna/„sheet-like"**. Decyzja:
budujemy drugą wersję na **react-datasheet-grid** (v2) obok obecnej TanStack (v1)
i porównujemy. v2 = docelowy fundament — pozostałe funkcjonalności POC dokładamy
na nim. Spec: `docs/superpowers/specs/2026-06-19-kosztorys-editor-grid-bakeoff-design.md`.
Plan: `docs/superpowers/plans/2026-06-19-kosztorys-editor-v2-datasheet-grid.md`.

**Warunek podstawowy (raison d'être):** trzy zduplikowane kosztorysy (robocizna /
zakres z narzędziami / zakres bez narzędzi) → **jeden zbiór, trzy widoki** przez
przełącznik aktywnej ceny. Gwarancja strukturalna: trzy ceny w jednym wierszu
`kosztorys_items`, etapy w jednej `kosztorys_stages`; formuły to czyste funkcje
(`calc.ts`), nie komórki — zero dryfu, zero ręcznej synchronizacji.

### Werdykt bake-offu (2026-06-20) — DECYZJA: v2 wybrana przez właściciela

v2 (`react-datasheet-grid` 4.11.6) zaimplementowana i działa obok v1. Obie trasy
żyją: v1 `/inwestycje/:id/kosztorys-edytor`, v2 `/inwestycje/:id/kosztorys-edytor-v2`
(link wejścia obok siebie na detalu inwestycji). Plan zrealizowany w 6 taskach;
wspólny rdzeń (`queries`/`actions`/`calc`/`types`) reużyty, v1 nietknięta, `calc.ts`
rozszerzony tylko addytywnie (`PriceViewT`/`viewPrice`/`rowNetForView`).

**Zweryfikowane obiektywnie (browser + testy + build), inwestycja 6:**

- **Bramka zgodności (główne ryzyko) — ZDANA.** Montaż, edycja komórki, nawigacja
  strzałkami/Tab, Enter/Esc, copy-paste — wszystko natywnie pod React 19.2 /
  Next 16.1 / React Compiler. Jedyny zgrzyt: transitywny `react-resize-detector`
  ma peer `react ≤18` (tylko WARN przy instalacji, runtime OK). Fallback na
  react-data-grid **nie jest potrzebny**.
- **Warunek podstawowy „jeden zbiór, trzy widoki" — DZIAŁA.** Przełącznik
  Robocizna / Z narzędziami / Bez narzędzi zmienia aktywną kolumnę „Cena"
  (`clientPrice` → `subcontractorWToolsPrice` → `subcontractorOwnToolsPrice`) i jej
  liczone; pomiar i etapy bez zmian — ten sam wiersz. (Zaobserwowane: cena
  3000 → 0 przy przełączeniu, reszta wiersza stała.)
- **Autosave per pole — DZIAŁA.** Edycja „Pomiar" 1→7 zapisana i trwała po
  reloadzie; `[PERF] updateItemFieldAction` = zapis jednego rekordu, nie arkusza.
- **Bramka ról** = `requireAuth(MANAGEMENT_ROLES)`, mirror v1 (parytet kodu).
- `pnpm typecheck` PASS, `pnpm exec next build` PASS (obie trasy), 6 testów
  jednostkowych adaptera/kolumn PASS.

**DECYZJA (właściciel, 2026-06-20): v2 = docelowy fundament POC.** Sheet-feel
oceniony w przeglądarce i zaakceptowany. Bramka zgodności — jedyne twarde ryzyko —
zdana, warunek podstawowy spełniony natywnie i bez duplikacji. Idziemy dalej na v2.

**Konsekwencje decyzji:**

- Wszystkie kolejne funkcjonalności POC budujemy **na v2**: subtotale per sekcja,
  plan-vs-actual, pokoje, eksport PDF, dodawanie/usuwanie sekcji/etapów, oraz
  forward-scope (read-only wydatki z transferów).
- **v1 (TanStack) do usunięcia po sportowaniu jej przewag**, których v2 jeszcze nie
  ma: sort/filtr per kolumna, przełącznik widoczności kolumn, kolumna „Pozostało",
  select typu rabatu (`percent|amount`), suma netto w toolbarze. Dopóki nieportowane
  — v1 zostaje jako referencja; nie kasujemy przedwcześnie.
- **Perf przy ~1000 wierszy — ZMIERZONY 2026-06-20 (PASS).** Patrz sekcja poniżej.

### Sportowanie przewag v1 → v2 + usunięcie v1 (2026-06-20)

Wszystkie przewagi v1 przeniesione na v2; **v1 usunięta**. Edytor kosztorysu = jedna
trasa `/inwestycje/:id/kosztorys-edytor-v2` (link wejścia na detalu inwestycji
przemianowany na „Kosztorys (edytor)").

**Co przeniesiono (5 funkcji, zweryfikowane w przeglądarce, inw. 6 = 224 pozycje):**

- **Sort per kolumna** — klikalny nagłówek (`SortHeader`, `title` w datasheet-grid
  przyjmuje ReactNode), cykl asc → desc → brak. Sort liczy też kolumny pochodne
  (cena/netto/brutto/pozostało) wg aktywnego widoku. _Zweryfikowane: klik „Cena" →
  wiersze rosnąco 0,0,…,6,7,8,10._
- **Filtr (szukajka)** — po opisie / sekcji / j.m. (`filterRows`). _Zweryfikowane:
  „kominek" → 1 pozycja, suma netto przeliczona 145 830 → 352._
- **Przełącznik widoczności kolumn** — `DatasheetColumnToggle` (dropdown shadcn) +
  trwałość w localStorage przez `useHiddenColumns` (`useSyncExternalStore`, nie
  `useState(localStorage)` — to dawało **błąd hydracji**, naprawione). _Zweryfikowane:
  ukrycie „Cena" znika z siatki i utrzymuje się po reloadzie._
- **Kolumna „Pozostało"** — wg widoku: `rowRemainingForView(item, Σ etapów wg widoku,
view)`; helpery `stageValueForView` / `rowRemainingForView` (calc) + `rowDoneNetForView`
  (v2-rows), pokryte testami.
- **Select typu rabatu** (`—`/`%`/`zł`) — własna kolumna datasheet-grid (`component`
  z natywnym `<select>` → `setRowData` → diff → autosave). _Zweryfikowane: zmiana na
  „%" trwała po reloadzie._
- **Suma netto** w toolbarze — `Σ rowNetForView` po wierszach widoku (respektuje filtr
  i widok cenowy).

**Decyzje podjęte po drodze (do ewentualnej rewizji przez właściciela):**

- **`lockRows` = włączone.** Stopka „Add rows" datasheet-grid była niefunkcjonalna
  (brak `createRow` → puste wiersze psułyby autosave). Edycja przez filtr/sort wymaga
  mapowania zmian z powrotem do pełnego zbioru po `id` (`onChange` scala po id) — co
  jest bezpieczne tylko przy stałej liczbie wierszy. Dodawanie/usuwanie pozycji to
  osobny, zaplanowany slice; do tego czasu wiersze są zablokowane.
- **Sort nietrwały po reloadzie** (świadomie; tak samo działał v1/TanStack). Trwała
  jest tylko widoczność kolumn — parytet z `DataTable` (storageKey).
- Serwerowe akcje `addItemAction` / `addStageAction` / `removeItemAction` /
  `updateSectionFieldAction` **zostawione mimo braku użycia** — to infrastruktura pod
  zaplanowany slice dodawania/usuwania sekcji/etapów, nie cruft po v1.

**Dodatkowo: revert-on-error (2026-06-20).** `useDebouncedSave` przyjmuje teraz
`onError`; gdy serwer odrzuci zapis pola, edytor cofa optymistyczną edycję do stanu
sprzed zapisu (`revertField`, czysta + testowana) — z guardem „current === attempted",
żeby nie zadeptać świeższej edycji użytkownika. Cofa też snapshot diffu (`prevById`).

**Stan jakości:** `pnpm typecheck` PASS, pełny `vitest` PASS (673/674, 1 skip),
`next build` PASS (jedna trasa edytora), nowe testy: `kosztorys-calc.test.ts`
(3) + rozszerzony `kosztorys-v2-rows.test.ts` (filter/sort/doneNet/revertField).

**Usunięte pliki v1:** `kosztorys-editor.tsx`, `kosztorys-columns.tsx`,
`editable-cell.tsx` (tylko v1), trasa `kosztorys-edytor/`, typ `KosztorysEditorRowT`.
`column-toggle.tsx` (shadcn) **zostaje** — współdzielony z tabelami transferów/kas/
użytkowników/inwestycji.

### Pomiar wydajności v2 przy ~1000 wierszy (2026-06-20)

Dataset syntetyczny: `src/scripts/poc-perf-seed-kosztorys.ts` → **inwestycja 7**
(„Madalinskiego 67", wcześniej bez kosztorysu): 10 sekcji × 100 pozycji = **1000
pozycji**, 7 etapów, 520 wpisów postępu. Pomiary w **trybie dev** (Turbopack,
nieminifikowany React + React Compiler dev — produkcja będzie ~2–3× szybsza):

| Metryka                           | Wynik                               | Uwaga                                                                                                                 |
| --------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Wiersze w DOM (wirtualizacja)     | **15** / 763 węzłów                 | niezależne od rozmiaru zbioru — datasheet-grid wirtualizuje                                                           |
| Suma netto nad 1000 wierszy       | 643 940,00                          | liczona po całym zbiorze, poprawnie                                                                                   |
| Keystroke filtra (1000→11)        | **44 ms, 1 klatka**                 | brak long-tasku, płynnie                                                                                              |
| Sort 1000 wierszy (klik nagłówka) | **93 ms commit, 1 long-task 56 ms** | krótki blip przy jawnej akcji, akceptowalne                                                                           |
| Nawigacja/SSR do interaktywności  | ~3,2 s (dev)                        | **zdominowane przez serwerowy `getKosztorysTree`** (1000 pozycji + 520 postępów) + SSR/hydracja dev, nie przez siatkę |

**Werdykt: PASS.** v2 obsługuje 1000 wierszy interaktywnie — edycja/filtr płynne,
sort z jednoklatkowym blipem. Jedyny realny koszt przy skali to **serwerowy fetch
drzewa** (nie siatka); ewentualna optymalizacja (paginacja/stream/`select` pól) to
osobny temat, nie blokuje POC.

**Sprzątanie:** syntetyczny zbiór perf został później ZASTĄPIONY realnymi danymi —
inw. 7 przemianowana na **„test kosztorys Sienicka"** i przeseedowana z realnego
arkusza (8 sekcji, 224 pozycje, real nazwy/ceny) na życzenie właściciela. Perf-seed
(`poc-perf-seed-kosztorys.ts`) zostaje jako narzędzie do regeneracji ~1000 wierszy.

### UI/layout edytora v2 + naprawa migotania (2026-06-20)

Na życzenie właściciela: edytor na **pełną wysokość strony** jak widok arkusza,
**mniejsza czcionka**, kompaktowy pasek górny (tytuł + przełącznik widoków + szukajka

- suma + „Kolumny" w jednym rzędzie), **bez „← Pulpit"** w treści (nawigacja przez
  górny navbar/sidebar — parytet z `SheetIframeView`). Strona v2 nie używa już
  `PageWrapper` (renderuje własny `flex h-full flex-col`).

* **Grid: `DynamicDataSheetGrid` → `DataSheetGrid`** (stały `rowHeight=32`, sheet-feel,
  szybsze, bez per-wierszowych ResizeObserverów).
* **Wysokość**: `useElementHeight` (`@/hooks`) liczy `window.innerHeight − rect.top − gap`
  (mount + resize okna, BEZ ResizeObservera, ref-cleanup React 19). Decoupled od własnej
  wysokości grida → brak sprzężenia.
* **GOTCHA / naprawiony bug migotania:** datasheet-grid w kontenerze flex **migotał**
  (DevTools Issues +~900/s, navbar/„Kolumny" mrugały). Przyczyna: suma min-szerokości
  kolumn (~1650px) > viewport → w kontekście flex szerokość oscylowała viewport↔treść,
  a wewnętrzny resize-detector grida wpadał w pętlę. **Fix: tor `grid-cols-[minmax(0,1fr)]`**
  na kontenerze siatki — daje DEFINITYWNĄ szerokość, siatka przewija kolumny wewnętrznie.
  (Zweryfikowane: szerokość stała 1200px, 60 fps, 0 oscylacji.) Dodatkowo `router.refresh()`
  w `onChange` tylko przy realnej zmianie (bezwarunkowy potrafił dokładać do pętli).

## Forward scope — deliverable dla klienta (brain dump, mniejszy problem, później)

Osobny późniejszy slice, **poza** planem bake-offu. Finalny kosztorys wysyłany
klientowi składa nie tylko robocizną, ale i **wydatkami** — przede wszystkim
wydatki inwestycyjne (transfery `INVESTMENT_EXPENSE`), przynajmniej część (które
dokładnie = TBD), z możliwością filtrowania/ukrywania (jak reguła eksportu P12).
**Wydatki read-only — składane z istniejących transferów, nie edytowane w
kosztorysie** (edycja zostaje w transferach; jedno źródło prawdy). To, co dziś
rozbite na zakładki arkusza, w appce pokazane też **zbiorczo** (jedno zestawienie
dla klienta). Doprecyzowanie i plan — przy starcie tego slice'u, po bake-offie.

## Pytania do właściciela (zaparkowane decyzje — 2026-06-20)

Trzy punkty z sesji zrobione (port przewag v1 → v2, perf ~1000, usunięcie v1) +
bonus revert-on-error. Dalsze funkcje POC **wymagają decyzji** — żadnej nie podjąłem
za właściciela. Do rozstrzygnięcia, zanim ruszą:

1. **Subtotale per sekcja vs sort.** Siatka v2 jest płaska i sortowalna per kolumna.
   Subtotale per sekcja mają sens tylko w kolejności pogrupowanej sekcjami — przy
   sortowaniu po cenie/netto sekcje się przeplatają i subtotale tracą sens. Decyzja:
   (a) subtotale w osobnym panelu/stopce liczonej zawsze po sekcji niezależnie od
   sortu, czy (b) subtotale tylko w trybie „bez sortu" (grupowanie wyłącza sort)?
2. **Źródło cen podwykonawcy** — USTALONE z arkusza źródłowego + decyzja właściciela.
   Zakładki `zakres z/bez narzędzi` w arkuszu to **widoki pochodne** od `kosztorys_robocizny`
   (kolumny A–L ciągnięte formułą 1:1 po numerze wiersza), nie osobne źródło. Reguła z formuł:
   `cena z narzędziami = clientPrice × 0,65`, `cena bez narzędzi = z_narzędziami × 0,85`
   (≈ `client × 0,5525`) — ALE pojedyncze wiersze nadpisują to **ręczną wartością absolutną**
   (dowód: wiersz r07 ma `700` zamiast `60×0,65=39`).
   **Decyzja właściciela (2026-06-20): współczynniki są PER-POZYCJA — nie globalne i nie
   per-inwestycja.** W ramach jednej inwestycji każda pozycja ma domyślną wartość wyprowadzoną,
   ale może być nadpisana ręcznie. → **waliduje wariant A** (3 niezależne kolumny snapshot,
   #P4): czysta formuła nie wystarcza, bo override'y istnieją. Trzymamy wyliczoną **cenę**
   (snapshot), NIE współczynnik per pozycja (współczynnik w bazie = dryf między ceną a mnożnikiem).
   **Mechanizm wypełniania (do zaprojektowania): bulk-apply input** — zawęź pozycje istniejącym
   filtrem/szukajką i zastosuj do nich albo **procent** od ceny klienta, albo **wartość
   absolutną**; override per pozycja zostaje. **Otwarte:** UX bulk-apply + czy default 0,65/0,85
   gdzieś podpowiadać. (Po fixie remountu — sekcja B — widoki „z/bez narzędzi" pokazują teraz
   poprawnie 0, bo pola są puste; to potwierdza, że problem to brak danych, nie wiązanie kolumny.)
3. **Eksport — format.** PDF czy CSV najpierw? Dla CSV: jak spłaszczyć zagnieżdżenie
   (sekcje → pozycje → etapy) do jednej tabeli? Dla PDF: które kolumny w dokumencie
   klienckim (z/bez cen wariantów, z/bez etapów)?
4. **UI pokoi (S-05).** Czy pozycja ma opcjonalny link do pokoju w tej fazie (PRD Q7),
   czy pokoje to osobny rejestr bez powiązania z pozycjami? Load-bearing dla schematu.
5. **Forward-scope wydatków.** Które transfery `INVESTMENT_EXPENSE` wchodzą do
   kosztorysu klienckiego (wszystkie / wybrane kategorie / reguła jak P12)? (TBD z briefu.)
6. ~~Sprzątanie danych perf na inw. 7~~ — ROZWIĄZANE: inw. 7 przemianowana na
   „test kosztorys Sienicka" + przeseedowana realnymi danymi (224 poz.). Perf-seed
   zostaje jako narzędzie. (Uwaga: widoki „Z narzędziami"/„Bez narzędzi" pokazują tam
   0 — to wraca do pytania #2 o źródło cen podwykonawcy.)
7. **Dodawanie/usuwanie pozycji w siatce.** Obecnie `lockRows` (stopka „Add rows"
   datasheet-grid była niefunkcjonalna). Osobny slice — potwierdzić priorytet i UX
   (przycisk „+ pozycja" do sekcji, usuwanie per wiersz jak w v1)?
8. **Zawijanie wierszy.** react-datasheet-grid renderuje wiersze o stałej wysokości,
   jednoliniowo — długi `opis` jest ucinany. Decyzja: (a) zostawić jednoliniowo
   z ucięciem + tooltip/rozwijanie na hover/klik, czy (b) zawijać tekst ze zmienną
   wysokością wiersza? Wariant (b) jest kosztowny w datasheet-grid (wirtualizacja
   zakłada stałą wysokość) — potwierdzić, czy w ogóle potrzebne dla danych klienta.
9. **Cofanie akcji + historia wersji.** react-datasheet-grid **nie ma** wbudowanego
   undo/redo; obecny edytor nie obsługuje żadnej historii (jest tylko revert-on-error
   przy nieudanym zapisie — to nie to samo). Ctrl+Z działa najwyżej w obrębie pojedynczej
   edytowanej komórki, nie na poziomie siatki — przypadkowa edycja, wklejenie czy
   usunięcie wiersza są nieodwracalne. **Realny problem, nie kosmetyka.** Dwie różne osie
   bezpieczeństwa (jak warstwy Google Sheets): warstwa 1 = szybkie cofnięcie tu i teraz,
   warstwa 2 = powrót do wcześniejszego stanu z przeszłości (chroni przed sekwencyjnym
   błędem, którego lock z #10 nie łapie, i przed „wysłaliśmy klientowi starą wersję").
   **Decyzja kierunkowa (2026-06-20): OBIE warstwy.**
   - **Warstwa 1 — lokalny stos Command** (szybkie cofnięcia). Trzymany w pamięci karty,
     undo wyzwalane **przyciskiem w toolbarze ORAZ skrótem Cmd+Z** (redo: Cmd+Shift+Z).
     Wykonalne jako prosty model jednoosobowy dzięki lockowi (#10) — bez OT/CRDT.
   - **Warstwa 2 — okresowe snapshoty** (historia wersji). Materializacja stanu kosztorysu
     co N zdarzeń / interwał, z UI „przywróć wersję". Potrzebna **niezależnie** od locka.
   - **Notka implementacyjna:** rozważyć jeden append-only log zmian
     (`{kiedy, kto, item_id, pole, było, jest}`) jako wspólne źródło dla warstwy 1 (replay
     wstecz = undo), warstwy 2 (replay do timestampu = wersja) i audytu zmian cen — wzorzec
     Event Sourcing; snapshoty = optymalizacja odtwarzania przy 1000+ wierszy (jak Git:
     snapshot + delty). Osobny slice. Do potwierdzenia przez właściciela.
10. **Współbieżność edycji (konflikty zapisu).** Edytor zapisuje per pole (debounced) —
    przy dwóch managerach na jednym kosztorysie to **last-write-wins**: późniejszy zapis
    cicho nadpisuje wcześniejszy, bez merge i bez ostrzeżenia. To problem logicznie
    _przed_ undo (#9): nie ma sensu cofać, jeśli najpierw tracisz edycje przez nadpisanie.
    **Decyzja kierunkowa (2026-06-20): na ten moment lock — jeden edytor naraz.** Najtańsza
    obrona, a dodatkowo odblokowuje najprostszy undo (model jednoosobowy → lokalny stos
    Command, patrz #9). Do dopracowania przy implementacji: zakres locka (per kosztorys vs
    per sekcja), zwolnienie (timeout/heartbeat na porzuconą kartę), UX dla zablokowanego
    (read-only + „edytuje X"). Pełny merge wielu edytorów (OT/CRDT) świadomie **odrzucony**
    na tym etapie. Do potwierdzenia przez właściciela.
