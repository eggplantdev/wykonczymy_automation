# Kosztorys v2 — VAT per inwestycja (zejście z odrzuconej kaskady)

**Status:** zaakceptowany (decyzja właściciela 2026-06-20) · **Change:** `context/changes/kosztorys-poc-in-app`

Korekta dryfu implementacji względem **udokumentowanej, pewnej** decyzji właściciela. Kod
trzyma VAT per sekcja + per pozycja z kaskadą — **wariant jawnie odrzucony**. Schodzimy na
model docelowy: **jedna stawka VAT na inwestycję**, bez sekcji, bez pozycji, bez kaskady,
bez override'ów. Czyścimy schemat na czysto (migracja usuwa martwe kolumny) — nie zostawiamy
ich „na potem", bo to dokładnie ta rozbieżność dokument↔kod, która nas tu wpuściła.

## Tło — rozbieżność

- **Decyzja (`context/changes/kosztorys-poc-in-app/change.md:50`, `[PEWNE]`, 2026-06-20):**
  „VAT per inwestycja — jedna `vat_rate` na inwestycję, NIE per sekcja, NIE per pozycja. Bez
  kaskady i bez override'ów. Wariant kaskadowy sekcja→pozycja **odrzucony**."
- **Kod (stan zastany):** `kosztorys-sections.vatRate` + `kosztorys-items.vatRate` (nullable =
  „dziedzicz z sekcji"), `calc.ts effectiveVat = item.vatRate ?? section.vatRate`. `investments`
  **nie ma** pola VAT. To jest odrzucony wariant; model docelowy nie istnieje w schemacie.
- **Ułatwienie:** w UI **nie ma** edytowalnej kolumny ani pola VAT (siatka bez kolumny `vatRate`,
  panel jej nie edytuje). Per-sekcja/pozycja VAT to dziś martwy default `0.08` z momentu
  tworzenia. Subtotale liczą **tylko netto** (gross nigdzie). Więc usunięcie to schemat + `calc`
  - typy + denormalizacja + autosave-schematy + 2 pliki testów — bez wyrywania UI edycji VAT.

## Model docelowy

- Jedno pole `vatRate` na `investments` (jak istniejące `wToolsCoeff`/`ownToolsCoeff`), default
  `0.08`, edytowalne. Stawka 23/8 wg kontekstu rozliczeniowego klienta „siedzi na inwestycji".
- Brutto wiersza = `netto × (1 + vatInwestycji)`. Koniec `effectiveVat`/kaskady.
- Stawka jedzie do edytora **drzewem** (jak `globalCoeffs`) i jest zdenormalizowana **jednym**
  polem na wierszu (zamiast `item.vatRate` + `sectionVatRate`).

**Poza zakresem:** netto/brutto B2B-designation (`change.md` #11b — model ma nieść, czy
robocizna jest netto czy brutto wg kontekstu). To osobny temat; tu tylko stawka.

## Schemat + migracja

Migracja **ręczna** (AGENTS.md — `migrate:create` emituje phantom drift), **tylko na
`wykonczymy-poc`**:

- `investments`: `ADD COLUMN "vat_rate" numeric NOT NULL DEFAULT 0.08`.
- `kosztorys_items`: `DROP COLUMN "vat_rate"`.
- `kosztorys_sections`: `DROP COLUMN "vat_rate"`.

Kolekcje Payload: dodać pole `vatRate` do `src/collections/investments.ts` (mirror coeffów,
default 0.08, label PL/EN); usunąć pole `vatRate` z `kosztorys-items.ts` i `kosztorys-sections.ts`.

## Punkty dotyku (pełna mapa — z grep `vatRate|sectionVatRate|effectiveVat`)

**Kalkulacje (`src/lib/kosztorys/calc.ts`):**

- Usunąć `effectiveVat(item, section)`.
- `rowGross(item, section)` → `rowGross(item, vatRate: number)` = `rowNet(item) * (1 + vatRate)`.
  (Albo wariant przyjmujący wiersz z jednym `vatRate` — patrz „Wiersz".)

**Typy (`src/types/kosztorys.ts`):**

- `KosztorysSectionT`: usunąć `vatRate`.
- `KosztorysItemT`: usunąć `vatRate`.
- `KosztorysTreeT`: dodać `vatRate: number` (obok `globalCoeffs`) — stawka inwestycji.
- `KosztorysV2RowBaseT`: usunąć `sectionVatRate`, dodać `vatRate: number` (zdenormalizowana
  stawka inwestycji na wierszu).
- `ViewPricingT` nie dotyczy VAT — bez zmian.

**Drzewo (`src/lib/queries/kosztorys.ts`):**

- `investment` już pobierany (`findByID`) — dodać `vatRate: num(investment.vatRate) || 0.08` do
  zwracanego drzewa. Usunąć `vatRate` z mapowania sekcji (linia 73) i pozycji (linia 64).

**Wiersz (`src/lib/kosztorys/v2-rows.ts`):**

- `treeToRows`: zamiast `sectionVatRate: section.vatRate` → `vatRate: tree.vatRate` na każdym
  wierszu. Usunąć `'vatRate'` z `ITEM_FIELDS` (diff autosave).
- `buildBlankRow` / `BlankRowInputT`: `sectionVatRate` → `vatRate` (stawka inwestycji).
- `NEW_SECTION_DEFAULTS`: usunąć `vatRate` (sekcja nie ma już VAT).

**Edytor (`src/components/kosztorys/kosztorys-editor-v2.tsx`):**

- `sortValue` case `'gross'`: `rowNetForView(row, view) * (1 + row.vatRate)` (bez `?? sectionVatRate`).
- `handleAddItem` / `handleAddSection`: budowa wiersza z `vatRate: tree.vatRate` (zamiast
  `sample?.sectionVatRate ?? NEW_SECTION_DEFAULTS.vatRate`).
- Przekazać stawkę do panelu + handler edycji (patrz UI).

**Kolumny (`src/lib/tables/kosztorys-v2-columns.tsx`):**

- `asSection`/`computedColumn 'gross'`: kolumna „Brutto" liczy `rowNetForView × (1 + row.vatRate)`.
  Usunąć import `effectiveVat`, `vatRate: r.sectionVatRate` z `asSection`.

**Eksport (`src/lib/export/kosztorys-csv.ts`, `kosztorys-export-columns.ts`):**

- Gross: `rowNetForView(item, view) * (1 + row.vatRate)`. Usunąć `effectiveVat`/`sectionOf`/`asSection`
  ścieżkę VAT. `vatRate: r.sectionVatRate` → `r.vatRate`.

**Akcje (`src/lib/actions/kosztorys.ts`):**

- `itemPatchSchema`: usunąć `vatRate`.
- `sectionPatchSchema`: usunąć `vatRate`.
- `addSectionAction`: usunąć `vatRate: 0.08` z `data`.
- `investmentCoeffsSchema` / `updateInvestmentCoeffsAction`: dodać `vatRate` (edycja stawki
  inwestycji tym samym kanałem co współczynniki).

**UI edycji stawki (panel `kosztorys-section-summary.tsx`):**

- W obszarze ustawień globalnych (obok współczynników podwykonawcy) dodać **jedno** pole
  „VAT (%)" inwestycji → `onVatChange` → `updateInvestmentCoeffsAction(investmentId, { vatRate })`
  → `router.refresh()` (jak coeffy). Wartość z `tree.vatRate`.

**Seedy/skrypty (`poc-seed-kosztorys.ts`, `poc-perf-seed-kosztorys.ts`):**

- Usunąć `vatRate: 0.08` z tworzenia sekcji; (opcjonalnie) ustawić `vatRate` na inwestycji.

**Testy (`src/__tests__/kosztorys-calc.test.ts`, `kosztorys-v2-rows.test.ts`):**

- Zaktualizować fixture'y: usunąć `sectionVatRate`/`item.vatRate`, dodać `vatRate` na wierszu;
  asercje brutto liczone z jednej stawki. **POC nie dopisuje nowych testów**, ale istniejące
  MUSZĄ się kompilować i przechodzić (inaczej `pnpm build`/typecheck czerwone).

## Sprzątanie dokumentacji (część zakresu — bez tego rozbieżność wraca)

Skasować / poprawić wzmianki o „różnych stawkach VAT w sekcji / Σ brutto per pozycja /
`effectiveVat = item.vatRate ?? section.vatRate`" w:

- `…specs/2026-06-20-kosztorys-add-remove-struktura-slice1-design.md` (sekcja „GOTCHA VAT").
- `…specs/2026-06-20-kosztorys-section-subtotals-design.md` (jeśli wspomina kaskadę).
- `…specs/2026-06-20-kosztorys-reorder-items-slice2-design.md` (jeśli wspomina).
- Commit `40efb4b` („gotcha VAT — brutto sekcji to suma brutto per pozycja") — opis był o
  nieistniejącym/odrzuconym modelu; zostawić w historii, ale nie powielać w żywych docach.
  Zaktualizować `change.md` stan implementacji: VAT zaimplementowany zgodnie z `[PEWNE]`.

## Weryfikacja (POC gate)

`pnpm typecheck` + `pnpm exec vitest run` (istniejące testy zielone) + `pnpm build`
(migracja przejdzie na `wykonczymy-poc`). Browser: pole VAT w panelu zmienia stawkę → kolumna
„Brutto" i CSV przeliczone; brak kolumn VAT na sekcji/pozycji.

## Odrzucone alternatywy

- **Zostawić martwe kolumny `vatRate`, tylko `calc` patrzy na inwestycję** — odrzucone przez
  właściciela: martwe pola VAT „wrócą na 100%" i znów rozjadą dokument z kodem. Czyścimy schemat.
