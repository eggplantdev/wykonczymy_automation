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
  `kosztorys_stages` / `stage_progress`. **Brak tabeli `kosztorys_rooms`** — pokoje
  wypadły z zakresu (właściciel, 2026-06-20; patrz pytanie #4). **Brak osobnej tabeli
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
- **[PEWNE] VAT per inwestycja** (właściciel, 2026-06-20): ceny wpisywane **netto**,
  brutto = netto × (1+vat) liczone. **Jedna `vat_rate` na inwestycję** — NIE per sekcja,
  NIE per pozycja. Bez kaskady i bez override'ów. (Wcześniej rozważany wariant kaskadowy
  sekcja→pozycja — odrzucony.) **ZAIMPLEMENTOWANE 2026-06-20** zgodnie z tą decyzją: pole
  `investments.vat_rate` (edytowalne w panelu „Sekcje"), martwe kolumny `vat_rate` na
  sekcji/pozycji usunięte migracją `20260620_2_vat_per_investment`. Spec:
  `docs/superpowers/specs/2026-06-20-kosztorys-vat-per-investment-design.md`.
  **TODO (właściciel, 2026-06-20): wywalić kontrolkę VAT z panelu „Sekcje".** VAT to
  ustawienie INWESTYCJI, nie sekcji — w panelu sekcji nie ma czego szukać (ta sama myśl co
  follow-up „ustawienia wyliczania cen wydzielić z panelu bocznego"). Model `investments.vat_rate`
  ZOSTAJE; znika tylko kontrolka z panelu. **Dom edycji — ROZSTRZYGNIĘTE (właściciel,
  2026-06-20): detal inwestycji ALBO przyszły panel „Podsumowanie" (jeszcze nie istnieje).**
  Razem z VAT przenosimy też **współczynniki cen podwykonawcy** (ta sama klasa: ustawienia
  inwestycji wciśnięte w panel boczny). Do czasu powstania tej powierzchni — VAT na default 8%.
  **Pole nadal per-inwestycja — to NIE powrót do VAT per sekcja.**
- **[PEWNE] „Pozostało do wykonania" = kontrola postępu robót** (wartość pozycji − Σ
  wartości wykonanych etapów), wskaźnik informacyjny, NIE figura rozliczeniowa z klientem.
- **[PEWNE] Robocizna = suma wszystkich etapów = wartość pracy WYKONANEJ** (właściciel,
  2026-06-20; doprecyzowane). Mechanizm potwierdzony rzeczywistością: **pozycja jest
  jednostką** (żyje w kosztorysie z ceną), a **etap to nakładka postępu** — wykonawca wpisuje
  tylko `qtyDone` (ile wykonał). „Suma etapów" = Σ po etapach (Σ pozycji: qtyDone × cena
  z kosztorysu). To NIE partycjonowanie pozycji na etapy. **Zgodne z obecnym schematem**
  (`StageProgressT = { itemId, stageId, qtyDone }`) — żadnej zmiany modelu nie trzeba.
  Figura nagłówkowa (suma w toolbarze) **WYWALONA 2026-06-20** — nie pokazujemy żadnej sumy
  w nagłówku (ani planu, ani wykonania); patrz pytanie #11a.
- **[PEWNE] Robocizna netto vs brutto = pochodna kontekstu rozliczeniowego klienta**
  (właściciel, 2026-06-20). To NIE jest otwarte pytanie — jest zdeterminowane: czy klient
  rozlicza się **B2B czy nie**, oraz jaką ma **stawkę VAT (23% vs 8%)**. Te dwa wejścia
  decydują, czy robocizna jest netto czy brutto. Powiązane z „[PEWNE] VAT per inwestycja"
  wyżej (stawka 23/8 siedzi na inwestycji). Obecnie w appce jest gołe „robocizna" bez
  oznaczenia — do domknięcia w modelu kalkulacji (patrz pytanie #11), ale reguła wyboru
  jest znana, nie do decyzji.
- **[PEWNE] Ceny podwykonawcy = współczynnik narzutu + override dwustanowy** (zaimplementowane
  2026-06-20, zastępuje dawny wariant „3 kolumny snapshot"). `clientPrice` to snapshot; ceny
  z/bez narzędzi wyprowadzane przez współczynnik dziedziczony globalny (inwestycja) → sekcja
  (nullable), z override per pozycja (`coeff`/`amount`/null). Szczegóły i geneza: pytanie #2
  oraz `docs/superpowers/specs/2026-06-20-kosztorys-subcontractor-pricing-design.md`.

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
  kolumna „Pozostało", select typu rabatu. (Suma netto w toolbarze — WYWALONA 2026-06-20, #11a.)
- **[PEWNE] Rozszerzanie kolumn (drag-resize).** Uchwyt na krawędzi nagłówka; prowadnica
  w trakcie dragu; **commit-on-release** (na puść) + zapis do localStorage, trwały po
  reloadzie. **Ograniczenie biblioteki:** dsg nie ma natywnego resize i nie przelicza
  szerokości bez remountu — stąd commit-on-release + remount siatki przez `key`. Live-drag
  (podgląd szerokości na żywo) niewykonalny bez forka. Zob. lekcję w
  `context/foundation/lessons.md` („no native column resize … remount with a `key`").
- **[PEWNE] Layout:** pełna wysokość strony (jak widok arkusza), mniejsza czcionka,
  `DataSheetGrid` ze stałym `rowHeight`, fix migotania (tor `grid-cols-[minmax(0,1fr)]`).
- **[PEWNE] `lockRows` zostaje** (blokuje tylko niefunkcjonalną natywną stopkę dsg) — CRUD
  idzie przez własne UI: pozycje (toolbar „+ pozycja" + gutter kosz + reorder ▲▼), sekcje
  (panel add/remove/rename), **dodawanie etapu** (toolbar „+ etap", 2026-06-20). Kasowanie
  etapu i multi-select etapów → MVP. Szczegóły i stan: pytanie #7.
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

**Wszystkie migracje POC idą wyłącznie na `wykonczymy-poc`** — osobny kontener Dockera.
Potwierdzone (ZAKTUALIZOWANE 2026-06-20 — wcześniej błędnie wpisany port 5433/jeden kontener):

- Worktree `.env` → `DB_POSTGRES_URL = postgres://postgres:postgres@localhost:5434/wykonczymy-poc`.
- **Dwa osobne kontenery:** `wykonczymy-poc` mapuje `0.0.0.0:5434->5432` (cel POC, baza
  `wykonczymy-poc`); `wykonczymy` mapuje `0.0.0.0:5433->5432` (lokalny main, baza
  `wykonczymy-db` — **NIETKNIĘTY**).
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

## Stan implementacji — handoff

### Sesja 2026-06-20 — ceny podwykonawcy (współczynniki + override) + 2 fixy dsg

**Zaimplementowane i zacommitowane** (gałąź `poc-kosztorys-in-app`, NIE pushnięte):

- **Ceny podwykonawcy przez współczynnik narzutu + dwustanowy override** (rozwiązuje #2).
  Spec: `docs/superpowers/specs/2026-06-20-kosztorys-subcontractor-pricing-design.md`,
  plan (9 tasków): `docs/superpowers/plans/2026-06-20-kosztorys-subcontractor-pricing.md`.
  - Model: `effectiveCoeff`/`subcontractorPrice` w `calc.ts`; współczynniki na `investments`
    (default 0,65/0,55) + `kosztorys_sections` (nullable→dziedziczy); override per pozycja
    (`{w,own}ToolsOverride{Type,Value}`, typ ∈ coeff/amount/null) zamiast snapshotów cen.
  - Migracja: `src/migrations/20260620_1_subcontractor_coeffs.ts` — **zaaplikowana na
    `wykonczymy-poc`** (5434). Re-seed niepotrzebny (override null → ceny wyprowadzone).
  - UI: panel sekcji (globalne + per-sekcja współczynniki), siatka w widokach podwykonawcy
    (kolumna „Cena" wyprowadzona/override + „Tryb liczenia ceny").
- **Fix dsg #1:** przełącznik widoku gubił wiązania kolumn (3 widoki = cena klienta) —
  `view` w kluczu remountu. **Zweryfikowany w przeglądarce** (bez narzędzi = 0 przy pustych).
- **Fix dsg #2:** „Kolumny" (widoczność) nie działało — `hidden` dodany do klucza remountu.
  **Zweryfikowany w przeglądarce (właściciel, 2026-06-20): ukryj/pokaż + trwałość po reloadzie OK.**
  - **TODO (wymóg właściciela, 2026-06-20):** dropdown „Kolumny" potrzebuje akcji
    **„zaznacz wszystkie / odznacz wszystkie"** (toggle wszystkich naraz), żeby nie klikać
    kolumn po jednej. Drobny dodatek do `DatasheetColumnToggle`.
- Lekcja w `lessons.md` poszerzona: klucz remountu dsg musi obejmować KAŻDY wymiar
  kształtujący kolumny (szerokości, widok, ukryte kolumny).

**Status weryfikacji:** fix #1 oraz **fix #2 (widoczność kolumn) potwierdzone w przeglądarce**.
**Ceny podwykonawcy — wstępnie OK (właściciel, 2026-06-20: „działa chyba")**, pełne
potwierdzenie end-to-end (panel współczynników, edycja override, wszystkie tryby) odłożone.
**Subtotale per sekcja — weryfikacja ODŁOŻONA na MVP (właściciel, 2026-06-20)** — feature
zbudowany, browser-verify nie teraz.

**Świadomie odłożone (udokumentowane w #2 „Follow-up UX" i planie):**

- Wyjaśnienie trybów liczenia ceny **nad tabelą** w danym widoku (model nieoczywisty) —
  treść opisów już zapisana w #2.
- Ustawienia wyliczania cen prawdopodobnie **wydzielić z panelu bocznego** na osobny ekran.
- **Testy** — odłożone na MVP (zmigrowano tylko fixture'y, by `tsc` był zielony).

---

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
  narzędzi") · panel plan-vs-actual · eksport PDF/CSV · forward-scope
  (read-only wydatki z transferów). (Pokoje wypadły — patrz pytanie #4.)

**Panel plan-vs-actual / marża planowana (spec §8) — ROZSTRZYGNIĘTE (właściciel,
2026-06-20): marża planowana NIEPOTRZEBNA — odpada (nie POC, nie MVP).** „Marża planowana"
miała być = `Σ(pomiar × cena_klienta) − Σ(pomiar × cena_podwykonawcy)` (rozpiętość klient−
podwykonawca z kosztorysu); różniłaby się od rzeczywistej tylko o realne odchylenia (`PAYOUT`
≠ plan, `RABAT`, `LOSS`). Właściciel uznał, że tej założonej figury nie potrzebuje — marża
rzeczywista (wzór appki) wystarcza. **Wiersz „marża planowana" ze spec §8 wykreślony.** (Reszta
§8 — wykonano/zafakturowano/wypłacono/materiały — to actuals, nie plan; osobno, jeśli kiedyś.)

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
  plan-vs-actual, eksport PDF, dodawanie/usuwanie sekcji/etapów, oraz
  forward-scope (read-only wydatki z transferów). (Pokoje wypadły — patrz pytanie #4.)
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

## Forward scope — deliverable dla klienta (decyzja kierunkowa 2026-06-20, patrz #5)

Osobny późniejszy slice, **poza** planem bake-offu. Finalny kosztorys wysyłany
klientowi składa nie tylko robocizną, ale i **wydatkami/transakcjami przypiętymi do
inwestycji**. Reguła: można wpiąć wszystkie typy przypięte do inwestycji, bo rządzi
**widoczność warunkowa** — **defaulty widoczności istnieją (np. zaliczki/strata ukryte
dla klienta), ale wszystko nadal edytowalne przed eksportem** (multi-select, analogiczny
do przełącznika kolumn — nowy wymóg). Default = stan wyjściowy, nie blokada.
**Read-only — składane z istniejących transferów, edycja zostaje w transferach** (jedno
źródło prawdy). To, co dziś rozbite na zakładki arkusza, w appce pokazane **zbiorczo**.

### Mapa typów transakcji (trwała referencja)

> **Źródło prawdy = `src/collections/transfers.ts` (`TRANSFER_TYPES`).** Lista
> dezaktualizowała się już w przeszłości — przy wątpliwości czytaj kod, nie tę kopię.
> Snapshot 2026-06-20. „Inwestycja?" = czy typ ma pole `investment` (`showInvestment`).

| value                | PL (UI)                     | EN                 | Inwestycja? | Rola / uwaga (forward-scope)                                                  |
| -------------------- | --------------------------- | ------------------ | ----------- | ----------------------------------------------------------------------------- |
| `INVESTOR_DEPOSIT`   | Wpłata od inwestora         | Investor Deposit   | ✅          | Uwzględniona. Wpłata — rusza bilans.                                          |
| `INVESTMENT_EXPENSE` | Wydatek inwestycyjny        | Investment Expense | ✅          | Uwzględniony. Materiały/koszt. Zawiera już efekt korekt.                      |
| `LABOR_COST`         | Koszty robocizny            | Labor Cost         | ✅          | = suma etapów (#11), two-way binding — TO jest kosztorys. Bez kasy źródłowej. |
| `PAYOUT`             | Wypłata                     | Payout             | ✅          | = zaliczki. Uwzględnione; **default: ukryte dla klienta** (edytowalne).       |
| `RABAT`              | Rabat                       | Rebate             | ✅          | Uwzględniony. Bez kasy źródłowej; ↓marża, ↑bilans.                            |
| `LOSS`               | Strata                      | Loss               | ✅          | Uwzględniona; **default: ukryta dla klienta** (edytowalne). Bez kasy; ↓marża. |
| `CORRECTION`         | Korekta                     | Correction         | ✅          | **Nie osobna linia** — pomniejsza `INVESTMENT_EXPENSE`. Może być ujemna.      |
| `COMPANY_FUNDING`    | Zasilenie z konta firmowego | Company Funding    | ❌          | Poza kosztorysem (brak pola inwestycji).                                      |
| `OTHER_DEPOSIT`      | Inna wpłata                 | Other Deposit      | ❌          | Poza kosztorysem.                                                             |
| `REGISTER_TRANSFER`  | Transfer między kasami      | Register Transfer  | ❌          | Poza kosztorysem. Ruch między kasami.                                         |
| `OTHER`              | Inny wydatek                | Other Expense      | ❌          | Poza kosztorysem.                                                             |
| `CANCELLATION`       | Anulowanie                  | Cancellation       | ❌          | Poza kosztorysem. Link audytowy do anulowanej transakcji.                     |

**Przypięte do inwestycji (7):** `INVESTOR_DEPOSIT`, `INVESTMENT_EXPENSE`, `LABOR_COST`,
`PAYOUT`, `RABAT`, `LOSS`, `CORRECTION`. **Nieprzypięte (5):** `COMPANY_FUNDING`,
`OTHER_DEPOSIT`, `REGISTER_TRANSFER`, `OTHER`, `CANCELLATION`.

## Pytania do właściciela (zaparkowane decyzje — 2026-06-20)

Trzy punkty z sesji zrobione (port przewag v1 → v2, perf ~1000, usunięcie v1) +
bonus revert-on-error. Dalsze funkcje POC **wymagają decyzji** — żadnej nie podjąłem
za właściciela. Do rozstrzygnięcia, zanim ruszą:

1. **Subtotale per sekcja vs sort.** Siatka v2 jest płaska i sortowalna per kolumna.
   Subtotale per sekcja mają sens tylko w kolejności pogrupowanej sekcjami — przy
   sortowaniu po cenie/netto sekcje się przeplatają i subtotale tracą sens. Decyzja:
   (a) subtotale w osobnym panelu/stopce liczonej zawsze po sekcji niezależnie od
   sortu, czy (b) subtotale tylko w trybie „bez sortu" (grupowanie wyłącza sort)?
2. **Źródło cen podwykonawcy** — ✅ ROZWIĄZANE (zaimplementowane 2026-06-20). Ceny
   podwykonawcy wyprowadzane z ceny klienta przez **współczynnik narzutu** dziedziczony
   globalny (inwestycja) → sekcja (nullable), z **dwustanowym override per pozycja**
   (`coeff` = klient × %, `amount` = płaska kwota, null = wyprowadź). Cena liczona w locie
   (zero dryfu); panel sekcji ustawia współczynniki, siatka edytuje override w widokach
   podwykonawcy. Spec: `docs/superpowers/specs/2026-06-20-kosztorys-subcontractor-pricing-design.md`,
   plan: `docs/superpowers/plans/2026-06-20-kosztorys-subcontractor-pricing.md`. (Uwaga:
   wcześniejsza notatka „snapshot, nie współczynnik" + „bulk-apply" **nieaktualna** — model
   zmienił się w brainstormingu na współczynnik+override, bo override jako współczynnik
   podąża za ceną klienta, a `amount` pokrywa płaskie wartości jak r07=700.) Domyślne
   globalne współczynniki: 0,65 / 0,55.

   **Follow-up UX (z weryfikacji w przeglądarce 2026-06-20 — model jest nieoczywisty):**
   - **Wyjaśnienie trybów MUSI być nad tabelą, w ramach danego widoku** (nie tylko w
     dropdownie) — bardzo nieoczywiste. Treść do pokazania (zachowana tu, żeby nie zniknęła): - **auto (z współczynnika)** — cena liczona = `cena klienta × współczynnik narzutu`
     (z sekcji, a jeśli sekcja pusta — globalny). Domyślny stan; podąża za ceną klienta
     i zmianą współczynnika. - **× mnożnik ceny klienta** (`coeff`) — własny mnożnik tej pozycji: `cena klienta ×
wpisana wartość`. Też podąża za ceną klienta, ale ignoruje współczynnik sekcji/globalny. - **kwota zł** (`amount`) — płaska, wpisana kwota; nie zależy od ceny klienta.
   - **Ustawienia wyliczania cen prawdopodobnie lepiej wydzielić z panelu bocznego na osobny
     ekran/sekcję** — w panelu sekcji są mało oczywiste. (Decyzja na później, nie teraz.)
   - Zrobione od ręki 2026-06-20: kolumna nazwana „Tryb liczenia ceny", etykiety trybów
     opisowe, etykiety współczynników w panelu pełne („z narzędziami"/„bez narzędzi").

3. **Eksport — PDF i arkusz, oba wymagane** (właściciel, 2026-06-20). To nie „albo/albo" —
   dwa różne momenty u klienta:
   - **Podpisywanie umowy → tylko PDF.**
   - **Po wykonaniu prac → arkusz (Excel / Google Sheets)**, żeby klient sam zweryfikował
     i przeliczył, czy wszystko się zgadza.
     **Utrudnienie load-bearing:** appka liczy figury z **SQL-a, nie z formuł komórkowych** —
     więc płaski zrzut wartości nie da się zweryfikować. Skrypt eksportu musi **przetłumaczyć
     kalkulacje appki na żywe formuły arkusza** przy zapisie do Sheets/Excela (klient ma
     widzieć matematykę, nie same liczby). PDF i układ wartości to łatwa połowa. Otwarte:
     które kolumny w PDF klienckim (z/bez cen wariantów, z/bez etapów); jak spłaszczyć
     zagnieżdżenie (sekcje → pozycje → etapy) w arkuszu.
     **Bezpieczeństwo eksportu — twarde wymaganie (właściciel, 2026-06-20):** w arkuszach
     robiono to **naiwnie — kolumny były tylko ukryte**, więc każdy ogarnięty w Excelu mógł
     je odkryć i zobaczyć dane (ceny zakupu, marże, ceny podwykonawcy). **W aplikacji tak
     NIE wolno.** Kolumny/dane, których klient nie ma widzieć, muszą być **fizycznie wycięte
     z eksportowanego pliku** — nie ukryte, nie zahasłowane, ich w pliku ma w ogóle nie być.
     Dotyczy obu formatów (PDF i arkusz) oraz tłumaczenia formuł: formuła w eksporcie nie
     może odwoływać się do wartości, której kolumny w pliku nie ma.
4. ~~**UI pokoi (S-05).**~~ — ROZWIĄZANE (właściciel, 2026-06-20): **pokoje WYPADAJĄ z zakresu.**
   Zakładka „pokoje" do wywalenia, nie będzie w apce. Konsekwencja: tabela `kosztorys_rooms`
   i jakikolwiek link pozycja→pokój znikają ze schematu POC/MVP.
   **⚠️ Trwała instrukcja dla przyszłych sesji:** pokoje **mogą wrócić** w arkuszach
   źródłowych pokazywanych w trakcie pracy nad apką (właściciel może podrzucić arkusz, który
   ma pokoje). To **nieistotne** — traktuj jako szum, **NIE przenoś do aplikacji** i **NIE
   otwieraj ponownie tematu** ani nie pytaj o pokoje. Decyzja jest ostateczna: pokoje out.
5. **Forward-scope wydatków** — ROZWIĄZANE kierunkowo (właściciel, 2026-06-20).
   **⚠️ ZAKRES: przeniesione do MVP (właściciel, 2026-06-20) — NIE POC.** Kierunek poniżej
   stoi; sam slice (read-only wydatki z transferów + multi-select widoczności) budujemy przy MVP.
   **Reguła:** wszystkie transakcje **przypięte do inwestycji** mogą wejść do kosztorysu
   („walnąć wszystko, co chcemy"), bo i tak rządzi **widoczność warunkowa** — przełączasz,
   co widać. 7 typów z polem `investment` (lista z `transfers.ts`): `INVESTOR_DEPOSIT`,
   `INVESTMENT_EXPENSE`, `LABOR_COST`, `PAYOUT`, `RABAT`, `LOSS`, `CORRECTION`. Ustalenia:
   **Zasada nadrzędna:** **defaulty widoczności istnieją** (punkt startowy), **ale wszystko
   nadal jest edytowalne przed eksportem** — default to nie blokada, tylko stan wyjściowy,
   który da się dowolnie nadpisać per eksport.
   - **LABOR_COST („Koszty robocizny")** = suma etapów (patrz #11), two-way binding — to JEST kosztorys.
   - **INVESTOR_DEPOSIT („Wpłata od inwestora")** — uwzględniona (oczywiste).
   - **RABAT („Rabat")** — uwzględniony w kosztorysie.
   - **CORRECTION („Korekta")** — **nie osobna linia**: korekty **pomniejszają wydatki
     inwestycyjne**, więc są już zawarte w `INVESTMENT_EXPENSE`. (Do potwierdzenia w modelu.)
   - **PAYOUT („Wypłata") = zaliczki** — uwzględnione; **default: ukryte dla klienta** (edytowalne).
   - **LOSS („Strata")** — uwzględniona; **default: ukryta dla klienta** (edytowalne).
   - **Wydatki read-only** — składane z istniejących transferów, edycja zostaje w transferach
     (jedno źródło prawdy).
     **Nowy wymóg UI (load-bearing):** dziś widoczność sekcji jest **albo jedna, albo wszystkie**.
     Trzeba dodać **multi-select** wyboru, co widoczne — **analogicznie do przełącznika kolumn** —
     żeby przed eksportem dało się dowolnie nadpisać defaulty i złożyć, co klient zobaczy. Ten sam
     mechanizm obsłuży **sekcje, typy transakcji (forward-scope) i etapy** (multi-select etapów = MVP, #7).
6. ~~Sprzątanie danych perf na inw. 7~~ — ROZWIĄZANE: inw. 7 przemianowana na
   „test kosztorys Sienicka" + przeseedowana realnymi danymi (224 poz.). Perf-seed
   zostaje jako narzędzie. (Uwaga: widoki „Z narzędziami"/„Bez narzędzi" pokazują tam
   0 — to wraca do pytania #2 o źródło cen podwykonawcy.)
7. **Dodawanie/usuwanie w siatce** — dla POC ZAMKNIĘTE (weryfikacja kodu 2026-06-20;
   wcześniejszy wpis „wszystko gated/lockRows" był nieaktualny). `lockRows` zostaje (blokuje
   tylko niefunkcjonalną natywną stopkę dsg) — CRUD idzie przez własne UI + istniejące akcje.
   Kasowanie etapu i multi-select etapów przeniesione na MVP (niżej):
   - ✅ **Pozycje:** dodawanie (toolbar „+ pozycja" do aktywnej sekcji + per sekcja),
     kasowanie (kosz w gutterze, inwariant „sekcja ≥1 pozycja"), reorder strzałkami ▲▼.
     (`kosztorys-editor-v2.tsx` `handleAddItem`/`handleRemoveItem`/`handleReorderItem`;
     gutter w `kosztorys-v2-columns.tsx` `Trash2`/`Chevron`.)
   - ✅ **Sekcje:** add/remove/rename w panelu (`KosztorysSectionSummary`).
   - ✅ **Etapy — dodawanie ZROBIONE (2026-06-20).** Button **„+ etap"** w toolbarze
     (`handleAddStage` → `addStageAction`, optymistycznie: `stages` jako stan, nowa kolumna
     przez `stagesKey` w kluczu remountu; nowy etap = puste komórki postępu, sparse=0).
     typecheck+build PASS, **browser ✅ (zweryfikowane 2026-06-20)**.
   - **[MVP] Kasowanie etapu z UI** (właściciel, 2026-06-20: na MVP, nie POC). Akcja
     `removeStageAction` z blokadą „etap z postępem" (3.6) gotowa; brak tylko kontrolki.
     Odłożone, bo splata się z undo (kasowanie = cascade, patrz #9) — czyli z warstwą historii MVP.
   - **[MVP] Select/multi-select etapów** — wciąż brak wyboru widocznych etapów,
     **analogicznie do sekcji** (i do multi-selecta widoczności z #5). Oczywiste, ale nie na
     POC — **do MVP.** Ten sam mechanizm widoczności obejmie sekcje, typy transakcji (#5)
     i etapy.
8. ~~**Zawijanie wierszy.**~~ — ROZWIĄZANE (właściciel, 2026-06-20): **wariant (a) —
   jednoliniowo z ucięciem + tooltip pokazujący całą treść.** Bez zawijania (wariant b
   odrzucony — kosztowny w datasheet-grid przy wirtualizacji stałej wysokości). Dodatkowo
   resize kolumn jest już dodany, więc użytkownik może i tak poszerzyć kolumnę opisu —
   tooltip to wystarczające dopełnienie dla naprawdę długich wpisów. Do zrobienia: tooltip
   na komórce `opis` (pełny tekst na hover). **⚠️ ZAKRES: przeniesione do MVP (właściciel,
   2026-06-20) — NIE POC.** Resize kolumn wystarcza na POC; tooltip dokładamy przy MVP.
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
   - **⚠️ ZAKRES: to NIE POC — to PRD/MVP** (właściciel, 2026-06-20). Cofanie i historia
     nie wchodzą do POC; należą do właściwego wydania. Świadomie poza bieżącym scope.
   - **Twardy przypadek dla undo: kasowanie etapu = cascade** (właściciel, 2026-06-20).
     `DELETE` etapu kasuje na poziomie FK (`ON DELETE CASCADE`) WSZYSTKIE wpisy `stage_progress`
     tego etapu dla wszystkich pozycji (patrz #7). Cofnięcie takiego usunięcia musi odtworzyć
     cały skasowany kaskadą zbiór, nie tylko sam wiersz etapu — nietrywialne. Dziś bramka
     w `removeStageAction` (blokada etapu z `qty_done<>0`) ogranicza utratę, ale undo i tak
     musi to ogarnąć. Skomplikowane — świadomie odłożone na warstwę historii MVP, nie POC.
   - **⚠️ PRIORYTET TESTOWY: #2** (właściciel, 2026-06-20). Cofanie + historia to wysoki
     potencjał problemów, ale **ryzyko #1 to źle liczone formuły i wynikające z nich ryzyko
     finansowe** — to jest pierwsze do testowania, undo/historia drugie. Gdy powstanie
     `context/foundation/test-plan.md` (`/10x-test-plan`), undo = ryzyko #2.
   - **Uwaga z historii (lessons.md):** mieliśmy już dziesiątki testów, które **nic nie
     sprawdzały** (tautologiczne / tylko-zielone) — patrz lekcja „test parytetu/regresji
     musi wołać realne funkcje na realnych danych i być udowodniony red→green". Plan testów
     dla formuł MUSI tego uniknąć: asercje na **realnych kalkulacjach** (`calc.ts` na danych
     z bazy), nie na atrapach, każda udowodniona red.
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
11. **Robocizna: definicja sumy + obsługa netto/brutto w modelu.** (właściciel, 2026-06-20)
    (a) ~~spójność modelu~~ **ROZWIĄZANE:** etap = nakładka postępu (`qtyDone` per pozycja),
    pozycja jest jednostką — obecny schemat poprawny, „suma etapów" = wartość wykonana
    (Σ qtyDone × cena). Bez zmiany modelu.
    **Figura nagłówkowa — WYWALONA (właściciel, 2026-06-20: „wywalamy nagłówek").** Żadnej
    sumy w nagłówku/toolbarze edytora. Usunięto istniejącą sumę „netto" z toolbara
    (`kosztorys-editor-v2.tsx`; został tylko licznik „X pozycji"). Nie wprowadzamy żadnej
    figury nagłówkowej — ani planu, ani wykonania. Powód: liczba bez jasnego pytania, na
    które odpowiada, jest szumem.
    **Zostaje jako rozumienie modelu (nie jako UI):** `LABOR_COST` = praca wykonana
    (Σ etapów), a plan (Σ pomiar × cena) to tylko odniesienie do oceny odchylenia — nie druga
    figura rozliczeniowa. Gdyby kiedyś wróciło porównanie plan/wykonanie, miejscem jest panel
    plan-vs-actual, NIE nagłówek (a panel sam jest odłożony — patrz niżej).
    (b) **netto/brutto** — reguła znana (pochodna B2B vs nie + stawka VAT 23/8, patrz sekcja A);
    dziś w appce gołe „robocizna" bez oznaczenia. Do zrobienia: model musi nieść tę informację,
    żeby robocizna była jednoznacznie netto albo brutto wg kontekstu inwestycji.
12. **[POST-MVP] „Ślepy" kosztorys wykonawcy → mapowanie 1:1 na kosztorys główny.**
    (właściciel, 2026-06-20) Funkcja na **dalszą kolejność, po MVP** (nie POC). Podwykonawca/
    pracownik dostaje **okrojony kosztorys bez stawek i bez cen** — tylko lista prac
    - jednostki + pola do wpisania ile wykonał. Wypełnia **jeden etap**. To, co wpiszą
      (`qtyDone` per pozycja), wraca i **mapuje się 1:1 na kosztorys główny bez ręcznego
      przepisywania** — pyk, od razu na właściwym kosztorysie, gdzie dochodzą pełne formuły
      i cennik (np. 1 mb × cena z kosztorysu → wartość, dalej kalkulacja). Spina się
      bezpośrednio z modelem etapu z #11a (etap = nakładka `qtyDone`) — ten „ślepy arkusz"
      to po prostu kanał wejścia dla jednego etapu. Wymagania (właściciel, 2026-06-20):
    * **Mobile-first.** Wykonawcy często nie mają komputerów — interfejs głównie pod telefon.
    * **Mapowanie po ID pracy, nie po nazwie.** Nazwy prac mogą wymagać tłumaczenia
      (inny język wykonawcy), więc powiązanie wejścia z pozycją idzie po **identyfikatorze
      pozycji**, a etykieta jest tylko warstwą prezentacji.
    * **Pozycja potrzebuje stabilnego, unikalnego ID w ramach kosztorysu.** Dziś
      `kosztorys_items.id` to globalny PK — wystarcza technicznie do mapowania, ale do
      potwierdzenia, czy potrzebny jest osobny **biznesowy/stały identyfikator pozycji**
      (czytelny, odporny na zmianę nazwy/kolejności), żeby „ślepy arkusz" i tłumaczenia
      działały pewnie. Decyzja na etapie projektowania S-11.
    * Do skminienia po MVP: forma dystrybucji (link/eksport/osobny widok roli), walidacja wejścia.
13. **[MVP] Podsumowanie wartości per etap (rozliczenia etapów).** (właściciel, 2026-06-20)
    W oryginalnym arkuszu każdy etap miał **liczoną wartość** (mapa kolumn: „P+ wartości etapów
    liczone"); przy porcie na siatkę zostały tylko kolumny **ilości** (`qtyDone`), a wartości/sumy
    etapów **zniknęły**. Model już to liczy per wiersz (`stageValueForView` → karmi „Pozostało"),
    ale brak **agregatu per etap** = `Σ_pozycji (qtyDone_w_etapie × cena)` („ile cenowo wykonano
    w etapie N"). Wzór potwierdzony: `Pozostało = Σ(pomiar × cena) − Σ_etapów[Σ_pozycji(qtyDone×cena)]`
    — dziś prawa strona widoczna jako jedna kwota łączna, chcemy ją **rozbitą per etap**
    (analogia do subtotali per sekcja, tylko po osi etapów).
    - **Kierunek (właściciel, 2026-06-20): odtworzyć strukturę oryginalnego arkusza** — prace
      osobno → rozliczenia (wartości) osobno → podsumowanie. Gdzie konkretnie (stopka per kolumna
      etapu vs osobny panel „Podsumowanie etapów" vs oba) + czy też kolumna wartości per wiersz —
      **TBD, do przegadania, nie teraz.**
    - **Nowa oś widoczności (load-bearing, do przegadania):** widoczność rozbić na **dwie
      rzeczy** — (1) widoczność etapów per etap ORAZ (2) widoczność „wykonane prace" vs
      „podsumowanie finansowe" (osobne przełączanie warstwy prac i warstwy rozliczeń). Spina się
      z multi-selectem widoczności z #5/#7 (ten sam mechanizm obejmie sekcje, typy transakcji,
      etapy i teraz warstwy prace/finanse).
    - Wszystko **MVP**, nie POC. Naturalny dom = przyszły panel „Podsumowanie" (jeszcze nie istnieje;
      ten sam, do którego idą VAT + współczynniki cen — sekcja A).
14. **[MVP] Przesuwanie kolumn (reorder).** (właściciel, 2026-06-20) Dziś jest tylko
    reorder **wierszy** (pozycje ▲▼, sekcja B/#7) — kolumn nie da się przestawiać. Dodać
    możliwość zmiany kolejności kolumn. Trwałość per przeglądarka (localStorage), analogicznie
    do widoczności i szerokości kolumn (`kosztorys-v2-*`). Uwaga implementacyjna: dsg nie ma
    natywnego reorderu kolumn i zamraża `columns` na montażu — najpewniej ta sama klasa co
    resize/widoczność (przebudowa listy kolumn + remount przez `key`, patrz lekcja w
    `lessons.md`). MVP, nie POC.
15. **[MVP] Flow etapów × ceny (z/bez narzędzi) jest konceptualnie mglisty — rework UX+model.**
    (właściciel, 2026-06-20) Diagnoza właściciela: „jest cena niby za coś, ale nie wiem za co".
    Korzeń = **brak przelicznika per etap (#13)**: kolumny etapów pokazują tylko ilości
    (`qtyDone`), nigdzie nie rozwiązują się w **pieniądze per etap**, więc cena wisi w powietrzu —
    widać stawkę i ilości, ale nie „ten etap = tyle zł". Drugi czynnik = **tryby z/bez narzędzi
    nieoczywiste bez objaśnienia nad tabelą** (już zapisany follow-up w #2). To NIE błąd
    liczenia — model (współczynnik → cena podwykonawcy, Σ etapów → wykonanie) jest poprawny;
    to luka **prezentacji i tłumaczenia konceptu**. Do zrobienia przy MVP łącznie z #13 i
    follow-upem UX z #2: pokazać wartość per etap, objaśnić tryb ceny w danym widoku, tak żeby
    „za co jest ta cena" było czytelne bez domyślania się. MVP.
