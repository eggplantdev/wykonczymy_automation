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
   (idempotentny — czyści inwestycję 6 i seeduje ponownie).
3. Wejście: `/inwestycje/6/kosztorys-edytor`.
4. Setup `node_modules` (jeśli świeży worktree): `pnpm install` →
   `pnpm install --force` (naprawia arm64 sharp/lightningcss) → `pnpm generate:types`.

**Następne kroki (kolejność wg priorytetu właściciela):** subtotale per sekcja ·
doseed cen podwykonawcy (zakładki „zakres z/bez narzędzi") · panel plan-vs-actual ·
eksport PDF · UI pokoi · revert-on-error.

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

### Werdykt bake-offu (2026-06-20) — v2 zbudowana, bramka zgodności ZDANA

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

**Do oceny przez właściciela (subiektywne / nieautomatyzowalne tu):** „sheet-feel"
v1 vs v2 obok siebie; płynność edycji przy ~1000 wierszy (seed inw. 6 ma 14
pozycji w tej bazie — perf-test wymaga doseedowania); resize kolumn i zmienna
wysokość wiersza.

**Decyzja (rekomendacja):** **v2 = docelowy fundament POC.** Bramka — jedyne
twarde ryzyko — zdana, warunek podstawowy spełniony natywnie i bez duplikacji.
Na v2 dokładamy resztę: subtotale per sekcja, plan-vs-actual, pokoje, PDF,
dodawanie/usuwanie sekcji/etapów, oraz forward-scope (read-only wydatki z
transferów). v1 do usunięcia **po** sportowaniu jej przewag, których v2 jeszcze
nie ma: sort/filtr per kolumna, przełącznik widoczności kolumn, kolumna
„Pozostało", select typu rabatu (`percent|amount`), suma netto w toolbarze.
Ostateczne „v2 zostaje" warunkowane potwierdzeniem sheet-feel + perf przez
właściciela.

## Forward scope — deliverable dla klienta (brain dump, mniejszy problem, później)

Osobny późniejszy slice, **poza** planem bake-offu. Finalny kosztorys wysyłany
klientowi składa nie tylko robocizną, ale i **wydatkami** — przede wszystkim
wydatki inwestycyjne (transfery `INVESTMENT_EXPENSE`), przynajmniej część (które
dokładnie = TBD), z możliwością filtrowania/ukrywania (jak reguła eksportu P12).
**Wydatki read-only — składane z istniejących transferów, nie edytowane w
kosztorysie** (edycja zostaje w transferach; jedno źródło prawdy). To, co dziś
rozbite na zakładki arkusza, w appce pokazane też **zbiorczo** (jedno zestawienie
dla klienta). Doprecyzowanie i plan — przy starcie tego slice'u, po bake-offie.
