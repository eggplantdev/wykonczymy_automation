---
id: kosztorys-poc-in-app
title: Kosztorys robocizny w aplikacji — POC przejścia z Google Sheets
status: planned
created: 2026-06-19
updated: 2026-06-19
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
