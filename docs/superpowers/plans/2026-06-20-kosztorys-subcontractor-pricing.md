# Kosztorys — ceny podwykonawcy przez współczynniki narzutu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cena podwykonawcy (widoki „Z narzędziami"/„Bez narzędzi") liczona z ceny klienta przez współczynnik narzutu dziedziczony globalny→sekcja, z dwustanowym override per pozycja (coeff/amount).

**Architecture:** Współczynnik kaskaduje wzorcem `effectiveVat` (globalny na inwestycji → sekcja nullable → dziedziczy). Cena podwykonawcy liczona w locie czystą funkcją w `calc.ts`; przechowywany tylko override (typ+wartość per widok, wzorzec rabatu `discountType`/`discountValue`). Płaski wiersz v2 niesie zdenormalizowane współczynniki sekcji i globalne, żeby derivacja była czysta na wierszu.

**Tech Stack:** Next.js + Payload CMS, Postgres (`@payloadcms/db-vercel-postgres`), Vitest, react-datasheet-grid, Zod.

## Global Constraints

- **Polish UI, English code** (AGENTS.md).
- **Migracje hand-written** — `migrate:create` emituje phantom drift; kopiuj strukturę najnowszego pliku w `src/migrations/`, snake_case kolumn (Payload mapuje camelCase→snake_case) (AGENTS.md).
- **Wszystkie migracje TYLKO na `wykonczymy-poc`** (docker, port 5434, db `wykonczymy-poc`); zero kontaktu z Neon/prod. Potwierdź `DB_POSTGRES_URL` przed migracją (change.md).
- **`payload-types.ts` jest gitignored** — nigdy `git add`; regeneruje `pnpm generate:types` (AGENTS.md).
- **Nie dodawaj `readonly`** do typów/propsów (AGENTS.md).
- **Mutacje przez `protectedAction()`**, walidacja Zod, zwrot `ActionResultT` (AGENTS.md).
- **Test single-file:** `pnpm exec vitest run src/__tests__/<plik>.test.ts`.
- **Dead-code/refactor gate = typecheck**, nie grep (`pnpm exec tsc --noEmit`) — usunięcie pola bez naprawy wszystkich konsumentów wywali build.

### Kanoniczne kształty (używane przez wszystkie taski)

```ts
// types/kosztorys.ts
export type SubcontractorOverrideTypeT = 'coeff' | 'amount'

// KosztorysSectionT — DODAJ:
wToolsCoeff: number | null // null = dziedziczy globalny (z inwestycji)
ownToolsCoeff: number | null

// KosztorysItemT — USUŃ subcontractorWToolsPrice / subcontractorOwnToolsPrice, DODAJ:
wToolsOverrideType: SubcontractorOverrideTypeT | null // null = wyprowadź ze współczynnika
wToolsOverrideValue: number
ownToolsOverrideType: SubcontractorOverrideTypeT | null
ownToolsOverrideValue: number

// NOWY — globalne współczynniki na inwestycję, niesione przez drzewo:
export type KosztorysGlobalCoeffsT = { wTools: number; ownTools: number }
// KosztorysTreeT — DODAJ: globalCoeffs: KosztorysGlobalCoeffsT

// KosztorysV2RowBaseT — DODAJ (denormalizacja do derivacji na wierszu):
sectionWToolsCoeff: number | null
sectionOwnToolsCoeff: number | null
globalWToolsCoeff: number
globalOwnToolsCoeff: number
```

Domyślne globalne współczynniki: `wTools = 0.65`, `ownTools = 0.55`.

---

### Task 1: Typy + czysta derivacja w calc.ts

**Files:**

- Modify: `src/types/kosztorys.ts`
- Modify: `src/lib/kosztorys/calc.ts`
- Test: `src/__tests__/kosztorys-calc.test.ts`

**Interfaces:**

- Produces: `effectiveCoeff(row, view) -> number`, `subcontractorPrice(row, view) -> number`; `viewPrice` i rodzina `*ForView` przyjmują `ViewPricingT`.

- [ ] **Step 1: Zaktualizuj typy** w `src/types/kosztorys.ts` wg „Kanoniczne kształty": dodaj `SubcontractorOverrideTypeT`; w `KosztorysSectionT` dodaj `wToolsCoeff`/`ownToolsCoeff`; w `KosztorysItemT` usuń `subcontractorWToolsPrice`/`subcontractorOwnToolsPrice` i dodaj cztery pola override; dodaj `KosztorysGlobalCoeffsT` i `globalCoeffs` w `KosztorysTreeT`; w `KosztorysV2RowBaseT` dodaj cztery pola coeff. Dodaj typ pomocniczy:

```ts
// Minimalny kształt do derivacji ceny widoku — KosztorysV2RowT go spełnia.
export type ViewPricingT = KosztorysItemT & {
  sectionWToolsCoeff: number | null
  sectionOwnToolsCoeff: number | null
  globalWToolsCoeff: number
  globalOwnToolsCoeff: number
}
```

- [ ] **Step 2: Napisz failujące testy** — dopisz do `src/__tests__/kosztorys-calc.test.ts`. Najpierw zaktualizuj istniejący fixture (usuń `subcontractorWToolsPrice: 12`/`subcontractorOwnToolsPrice: 10`, dodaj `wToolsOverrideType: null, wToolsOverrideValue: 0, ownToolsOverrideType: null, ownToolsOverrideValue: 0, sectionWToolsCoeff: null, ownToolsCoeff…` — użyj helpera niżej). Dodaj:

```ts
import { effectiveCoeff, subcontractorPrice } from '@/lib/kosztorys/calc'

const pricing = (over: Partial<ViewPricingT> = {}): ViewPricingT => ({
  id: 1,
  sectionId: 1,
  displayOrder: 0,
  description: 'x',
  unit: 'm2',
  plannedQty: 0,
  measuredQty: 2,
  discountType: null,
  discountValue: 0,
  clientPrice: 100,
  costVariant: null,
  vatRate: null,
  hiddenInExport: false,
  note: null,
  wToolsOverrideType: null,
  wToolsOverrideValue: 0,
  ownToolsOverrideType: null,
  ownToolsOverrideValue: 0,
  sectionWToolsCoeff: null,
  sectionOwnToolsCoeff: null,
  globalWToolsCoeff: 0.65,
  globalOwnToolsCoeff: 0.55,
  ...over,
})

describe('effectiveCoeff', () => {
  it('dziedziczy globalny gdy sekcja null', () => {
    expect(effectiveCoeff(pricing(), 'w_tools')).toBe(0.65)
  })
  it('sekcja nadpisuje globalny', () => {
    expect(effectiveCoeff(pricing({ sectionWToolsCoeff: 0.8 }), 'w_tools')).toBe(0.8)
  })
})

describe('subcontractorPrice', () => {
  it('null override = klient × efektywny współczynnik', () => {
    expect(subcontractorPrice(pricing(), 'w_tools')).toBe(65) // 100 × 0.65
  })
  it('coeff override = klient × wartość override', () => {
    expect(
      subcontractorPrice(
        pricing({ wToolsOverrideType: 'coeff', wToolsOverrideValue: 1.2 }),
        'w_tools',
      ),
    ).toBe(120)
  })
  it('amount override = płaska wartość', () => {
    expect(
      subcontractorPrice(
        pricing({ wToolsOverrideType: 'amount', wToolsOverrideValue: 700 }),
        'w_tools',
      ),
    ).toBe(700)
  })
  it('own_tools używa własnego współczynnika', () => {
    expect(subcontractorPrice(pricing(), 'own_tools')).toBe(55) // 100 × 0.55
  })
})
```

- [ ] **Step 3: Uruchom — ma failować**: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts`. Expected: FAIL („effectiveCoeff is not a function" / typy).

- [ ] **Step 4: Zaimplementuj w `calc.ts`**. Dodaj import `ViewPricingT`, `SubcontractorOverrideTypeT`. Dodaj:

```ts
/** Efektywny współczynnik narzutu wg widoku: sekcja nadpisuje globalny (z inwestycji). */
export function effectiveCoeff(row: ViewPricingT, view: 'w_tools' | 'own_tools'): number {
  if (view === 'w_tools') return row.sectionWToolsCoeff ?? row.globalWToolsCoeff
  return row.sectionOwnToolsCoeff ?? row.globalOwnToolsCoeff
}

/** Cena podwykonawcy wg widoku: null→wyprowadzona, coeff→klient×%, amount→płaska. */
export function subcontractorPrice(row: ViewPricingT, view: 'w_tools' | 'own_tools'): number {
  const type = view === 'w_tools' ? row.wToolsOverrideType : row.ownToolsOverrideType
  const value = view === 'w_tools' ? row.wToolsOverrideValue : row.ownToolsOverrideValue
  if (type === 'amount') return value
  if (type === 'coeff') return row.clientPrice * value
  return row.clientPrice * effectiveCoeff(row, view)
}
```

Zmień sygnatury `viewPrice`, `rowNetForView`, `stageValueForView`, `rowRemainingForView`, `sectionSubtotalsForView` z `KosztorysItemT`→`ViewPricingT`. Zaktualizuj `viewPrice`:

```ts
export function viewPrice(row: ViewPricingT, view: PriceViewT): number {
  if (view === 'w_tools' || view === 'own_tools') return subcontractorPrice(row, view)
  return row.clientPrice
}
```

Usuń `variantPrice` i `rowSubcontractorNet` (używane tylko tu, oparte na usuniętych polach; gdyby typecheck wykrył konsumenta — zaadaptuj do `subcontractorPrice(row, effectiveCostVariant(...))`).

- [ ] **Step 5: Uruchom — ma przejść**: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/kosztorys.ts src/lib/kosztorys/calc.ts src/__tests__/kosztorys-calc.test.ts
git commit -m "feat(kosztorys): derivacja ceny podwykonawcy ze współczynnika (calc + typy)"
```

---

### Task 2: v2-rows — denormalizacja współczynników, pola diffu, pusty wiersz

**Files:**

- Modify: `src/lib/kosztorys/v2-rows.ts`
- Test: `src/__tests__/kosztorys-v2-rows.test.ts`

**Interfaces:**

- Consumes: typy z Task 1.
- Produces: `treeToRows` denormalizuje `sectionWToolsCoeff`/`sectionOwnToolsCoeff`/`globalWToolsCoeff`/`globalOwnToolsCoeff`; `ITEM_FIELDS` zawiera 4 pola override.

- [ ] **Step 1: Zaktualizuj testy** w `src/__tests__/kosztorys-v2-rows.test.ts` — w fixture'ach zamień `subcontractorWToolsPrice`/`subcontractorOwnToolsPrice` na cztery pola override (`null`/`0`) i dodaj coeffy sekcji/globalne. Dodaj test:

```ts
it('treeToRows denormalizuje współczynniki sekcji i globalne', () => {
  const tree = makeTree({ sectionWToolsCoeff: 0.7, globalCoeffs: { wTools: 0.65, ownTools: 0.55 } })
  const [row] = treeToRows(tree)
  expect(row.sectionWToolsCoeff).toBe(0.7)
  expect(row.globalWToolsCoeff).toBe(0.65)
})
```

(Dostosuj `makeTree`/inline tree do istniejącego stylu pliku — sekcja dostaje `wToolsCoeff`/`ownToolsCoeff`, tree dostaje `globalCoeffs`.)

- [ ] **Step 2: Uruchom — FAIL**: `pnpm exec vitest run src/__tests__/kosztorys-v2-rows.test.ts`.

- [ ] **Step 3: Implementacja** w `v2-rows.ts`:
  - W `ITEM_FIELDS` usuń `'subcontractorWToolsPrice'`,`'subcontractorOwnToolsPrice'`; dodaj `'wToolsOverrideType'`,`'wToolsOverrideValue'`,`'ownToolsOverrideType'`,`'ownToolsOverrideValue'`.
  - W `treeToRows`, w pushowanym obiekcie dodaj:
    ```ts
    sectionWToolsCoeff: section.wToolsCoeff,
    sectionOwnToolsCoeff: section.ownToolsCoeff,
    globalWToolsCoeff: tree.globalCoeffs.wTools,
    globalOwnToolsCoeff: tree.globalCoeffs.ownTools,
    ```
  - W `buildBlankRow`: usuń dwa `subcontractor*Price: 0`, dodaj `wToolsOverrideType: null, wToolsOverrideValue: 0, ownToolsOverrideType: null, ownToolsOverrideValue: 0`; do `BlankRowInputT` i ciała dodaj `sectionWToolsCoeff`/`sectionOwnToolsCoeff`/`globalWToolsCoeff`/`globalOwnToolsCoeff` (przekazywane z edytora przy dodawaniu pozycji).

- [ ] **Step 4: Uruchom — PASS**: `pnpm exec vitest run src/__tests__/kosztorys-v2-rows.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kosztorys/v2-rows.ts src/__tests__/kosztorys-v2-rows.test.ts
git commit -m "feat(kosztorys): denormalizacja współczynników do wiersza v2 + pola override w diffie"
```

---

### Task 3: Migracja bazy (hand-written)

**Files:**

- Create: `src/migrations/20260620_1_subcontractor_coeffs.ts`
- Modify: `src/migrations/index.ts` (dodaj import + wpis w tablicy, wzorem istniejących)

- [ ] **Step 1: Potwierdź bazę**: `echo $DB_POSTGRES_URL` musi kończyć się `wykonczymy-poc`. Jeśli nie — STOP.

- [ ] **Step 2: Napisz migrację** (kopiuj nagłówek z `20260620_add_kosztorys_tables.ts`):

```ts
import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments"
      ADD COLUMN IF NOT EXISTS "w_tools_coeff" numeric NOT NULL DEFAULT 0.65,
      ADD COLUMN IF NOT EXISTS "own_tools_coeff" numeric NOT NULL DEFAULT 0.55;

    ALTER TABLE "kosztorys_sections"
      ADD COLUMN IF NOT EXISTS "w_tools_coeff" numeric,
      ADD COLUMN IF NOT EXISTS "own_tools_coeff" numeric;

    ALTER TABLE "kosztorys_items"
      ADD COLUMN IF NOT EXISTS "w_tools_override_type" varchar,
      ADD COLUMN IF NOT EXISTS "w_tools_override_value" numeric NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "own_tools_override_type" varchar,
      ADD COLUMN IF NOT EXISTS "own_tools_override_value" numeric NOT NULL DEFAULT 0;

    ALTER TABLE "kosztorys_items"
      DROP COLUMN IF EXISTS "subcontractor_w_tools_price",
      DROP COLUMN IF EXISTS "subcontractor_own_tools_price";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items"
      ADD COLUMN IF NOT EXISTS "subcontractor_w_tools_price" numeric NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "subcontractor_own_tools_price" numeric NOT NULL DEFAULT 0,
      DROP COLUMN IF EXISTS "w_tools_override_type",
      DROP COLUMN IF EXISTS "w_tools_override_value",
      DROP COLUMN IF EXISTS "own_tools_override_type",
      DROP COLUMN IF EXISTS "own_tools_override_value";
    ALTER TABLE "kosztorys_sections"
      DROP COLUMN IF EXISTS "w_tools_coeff", DROP COLUMN IF EXISTS "own_tools_coeff";
    ALTER TABLE "investments"
      DROP COLUMN IF EXISTS "w_tools_coeff", DROP COLUMN IF EXISTS "own_tools_coeff";
  `)
}
```

- [ ] **Step 3: Zarejestruj** w `src/migrations/index.ts` (import + wpis w tablicy, na końcu, wzorem poprzednich).

- [ ] **Step 4: Uruchom migrację**: `pnpm payload migrate`. Expected: „Done." z wykonaną nową migracją.

- [ ] **Step 5: Commit**

```bash
git add src/migrations/20260620_1_subcontractor_coeffs.ts src/migrations/index.ts
git commit -m "feat(kosztorys): migracja — współczynniki narzutu + pola override podwykonawcy"
```

---

### Task 4: Kolekcje Payload

**Files:**

- Modify: `src/collections/investments.ts`
- Modify: `src/collections/kosztorys-sections.ts`
- Modify: `src/collections/kosztorys-items.ts`

- [ ] **Step 1: investments** — dodaj do `fields`:

```ts
{ name: 'wToolsCoeff', type: 'number', required: true, defaultValue: 0.65,
  label: { en: 'Subcontractor coeff (with tools)', pl: 'Współczynnik podwykonawcy (z narzędziami)' } },
{ name: 'ownToolsCoeff', type: 'number', required: true, defaultValue: 0.55,
  label: { en: 'Subcontractor coeff (own tools)', pl: 'Współczynnik podwykonawcy (bez narzędzi)' } },
```

- [ ] **Step 2: kosztorys-sections** — dodaj do `fields` (nullable = dziedziczy z inwestycji):

```ts
{ name: 'wToolsCoeff', type: 'number', label: { en: 'Coeff (with tools)', pl: 'Współczynnik (z narzędziami)' } },
{ name: 'ownToolsCoeff', type: 'number', label: { en: 'Coeff (own tools)', pl: 'Współczynnik (bez narzędzi)' } },
```

- [ ] **Step 3: kosztorys-items** — usuń dwa pola `subcontractor*Price`, dodaj:

```ts
{ name: 'wToolsOverrideType', type: 'text' },
{ name: 'wToolsOverrideValue', type: 'number', required: true, defaultValue: 0 },
{ name: 'ownToolsOverrideType', type: 'text' },
{ name: 'ownToolsOverrideValue', type: 'number', required: true, defaultValue: 0 },
```

Zaktualizuj komentarz nagłówkowy pliku (ceny = wyprowadzane ze współczynnika + override, nie snapshoty).

- [ ] **Step 4: Regeneruj typy**: `pnpm generate:types` (NIE `git add` `payload-types.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/collections/investments.ts src/collections/kosztorys-sections.ts src/collections/kosztorys-items.ts
git commit -m "feat(kosztorys): pola współczynników (inwestycja/sekcja) + override podwykonawcy (pozycja)"
```

---

### Task 5: Query — czytanie nowych pól + globalne współczynniki na drzewie

**Files:**

- Modify: `src/lib/queries/kosztorys.ts`

**Interfaces:**

- Produces: `getKosztorysTree` zwraca `globalCoeffs` i sekcje/pozycje z nowymi polami.

- [ ] **Step 1:** Pobierz inwestycję dla globalnych współczynników. Po `getPayload`, dołóż do `Promise.all` (lub osobno):

```ts
const investment = await payload.findByID({ collection: 'investments', id: investmentId, depth: 0 })
const globalCoeffs = {
  wTools: num((investment as { wToolsCoeff?: unknown }).wToolsCoeff) || 0.65,
  ownTools: num((investment as { ownToolsCoeff?: unknown }).ownToolsCoeff) || 0.55,
}
```

- [ ] **Step 2:** W mapowaniu `items` usuń `subcontractor*Price`, dodaj:

```ts
wToolsOverrideType: (d.wToolsOverrideType as 'coeff' | 'amount' | null) ?? null,
wToolsOverrideValue: num(d.wToolsOverrideValue),
ownToolsOverrideType: (d.ownToolsOverrideType as 'coeff' | 'amount' | null) ?? null,
ownToolsOverrideValue: num(d.ownToolsOverrideValue),
```

- [ ] **Step 3:** W mapowaniu `sections` dodaj:

```ts
wToolsCoeff: d.wToolsCoeff == null ? null : num(d.wToolsCoeff),
ownToolsCoeff: d.ownToolsCoeff == null ? null : num(d.ownToolsCoeff),
```

- [ ] **Step 4:** Zwróć `{ sections, stages, progress, globalCoeffs }`.

- [ ] **Step 5: Typecheck**: `pnpm exec tsc --noEmit`. Expected: brak błędów w `queries/kosztorys.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/queries/kosztorys.ts
git commit -m "feat(kosztorys): query czyta override podwykonawcy + globalne współczynniki inwestycji"
```

---

### Task 6: Akcje — schemat patcha pozycji, defaulty addItem, zapis współczynników

**Files:**

- Modify: `src/lib/actions/kosztorys.ts`

**Interfaces:**

- Produces: `ItemPatchT` z polami override; `updateSectionFieldAction` przyjmuje `wToolsCoeff`/`ownToolsCoeff`; nowa `updateInvestmentCoeffsAction(investmentId, patch)`.

- [ ] **Step 1:** W `itemPatchSchema` usuń `subcontractorWToolsPrice`/`subcontractorOwnToolsPrice`, dodaj:

```ts
wToolsOverrideType: z.enum(['coeff', 'amount']).nullable(),
wToolsOverrideValue: z.coerce.number(),
ownToolsOverrideType: z.enum(['coeff', 'amount']).nullable(),
ownToolsOverrideValue: z.coerce.number(),
```

- [ ] **Step 2:** W `sectionPatchSchema` dodaj `wToolsCoeff: z.coerce.number().nullable()`, `ownToolsCoeff: z.coerce.number().nullable()`.

- [ ] **Step 3:** W `addItemAction` (ok. linii 162) usuń dwa `subcontractor*Price: 0`; pola override mają defaulty z kolekcji (`null`/`0`), więc nic nie ustawiaj.

- [ ] **Step 4:** Dodaj akcję globalnych współczynników:

```ts
const investmentCoeffsSchema = z
  .object({ wToolsCoeff: z.coerce.number(), ownToolsCoeff: z.coerce.number() })
  .partial()
export type InvestmentCoeffsPatchT = z.infer<typeof investmentCoeffsSchema>

export async function updateInvestmentCoeffsAction(
  investmentId: number,
  patch: InvestmentCoeffsPatchT,
) {
  return protectedAction(
    'updateInvestmentCoeffsAction',
    async ({ payload }) => {
      const parsed = validateAction(investmentCoeffsSchema, patch)
      if (!parsed.success) return parsed
      await payload.update({ collection: 'investments', id: investmentId, data: parsed.data })
      return { success: true }
    },
    ['kosztorysSections'],
  )
}
```

- [ ] **Step 5: Typecheck**: `pnpm exec tsc --noEmit`. Expected: błędy zostają tylko w UI (Task 7/8) i seedach (Task 9) — `actions/kosztorys.ts` czysty.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/kosztorys.ts
git commit -m "feat(kosztorys): akcje — override podwykonawcy + zapis współczynników (sekcja/inwestycja)"
```

---

### Task 7: Siatka — wyprowadzona cena + komórka typu override

**Files:**

- Modify: `src/lib/tables/kosztorys-v2-columns.tsx`

**Interfaces:**

- Consumes: `viewPrice`/`subcontractorPrice` (Task 1), pola override z wiersza.

- [ ] **Step 1: Kolumna „Cena" w widoku podwykonawcy.** Usuń `PRICE_FIELD` map oparte na usuniętych polach. W widoku `client` zostaje edytowalna `keyCol('clientPrice', …)`. W widokach `w_tools`/`own_tools` „Cena" to komórka pokazująca `viewPrice(row, view)`; gdy override `null` — styl szary/kursywa. Edycja zapisuje `*OverrideValue` + ustawia `*OverrideType` na bieżący tryb (domyślnie `coeff` jeśli wcześniej `null`? — patrz Step 2), czyszczenie ustawia typ na `null`. Komórka custom (wzór `DiscountTypeCell` + `setRowData`), pisząca do pól `wTools*`/`ownTools*` zależnie od `view`:

```tsx
function makeSubcontractorPriceCell(view: 'w_tools' | 'own_tools') {
  const typeField = view === 'w_tools' ? 'wToolsOverrideType' : 'ownToolsOverrideType'
  const valueField = view === 'w_tools' ? 'wToolsOverrideValue' : 'ownToolsOverrideValue'
  return function SubcontractorPriceCell({
    rowData,
    setRowData,
  }: CellProps<KosztorysV2RowT, unknown>) {
    const derived = rowData[typeField] == null
    const price = viewPrice(rowData as unknown as ViewPricingT, view)
    return (
      <input
        className={`size-full bg-transparent px-2 text-right text-sm outline-none ${derived ? 'text-muted-foreground italic' : ''}`}
        value={derived ? '' : String(rowData[valueField])}
        placeholder={derived ? price.toFixed(2) : ''}
        inputMode="decimal"
        onChange={(e) => {
          const raw = e.target.value.trim()
          if (raw === '') {
            setRowData({ ...rowData, [typeField]: null, [valueField]: 0 })
            return
          }
          const num = Number(raw.replace(',', '.'))
          if (Number.isNaN(num)) return
          const nextType = rowData[typeField] ?? 'amount' // domyślny tryb przy pierwszym wpisie — patrz Step 2
          setRowData({ ...rowData, [typeField]: nextType, [valueField]: num })
        }}
      />
    )
  }
}
```

- [ ] **Step 2: Kolumna „Tryb" (override) w widokach podwykonawcy** — select `—/×coeff/zł` wzorem `discountTypeColumn`, widoczny tylko gdy `view !== 'client'`, piszący `*OverrideType` (`null`/`coeff`/`amount`). To rozwiązuje wybór trybu z Step 1 (zamiast zgadywać `nextType`): wpis wartości + wybór trybu są rozdzielone, jak rabat (typ + wartość). W `buildV2Columns`, gdy `view !== 'client'`, wstaw tę kolumnę obok „Cena".

- [ ] **Step 3: Złóż kolumnę „Cena"** w `buildV2Columns`: dla `view === 'client'` użyj istniejącej `keyCol('clientPrice', floatColumn, { id:'price', … })`; dla podwykonawcy użyj `{ id:'price', title: title('price','Cena',opts), minWidth:90, component: makeSubcontractorPriceCell(view), copyValue:({rowData})=>String(viewPrice(rowData as unknown as ViewPricingT, view)), deleteValue:({rowData})=>({...rowData,[typeField]:null,[valueField]:0}) }`.

- [ ] **Step 4: Typecheck + ręczna weryfikacja**: `pnpm exec tsc --noEmit` (czysto). Potem `PORT=3001 pnpm dev`, wejdź `/inwestycje/6/kosztorys-edytor-v2`, przełącz „Z narzędziami": pozycje bez override pokazują szarą wyprowadzoną cenę (klient × 0.65); wpisanie wartości + wybór trybu nadpisuje; wyczyszczenie wraca do szarej.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tables/kosztorys-v2-columns.tsx
git commit -m "feat(kosztorys): siatka — wyprowadzona cena podwykonawcy + komórka trybu override"
```

---

### Task 8: Panel sekcji — inputy współczynników (globalny + per sekcja)

**Files:**

- Modify: `src/components/kosztorys/kosztorys-section-summary.tsx`
- Modify: `src/components/kosztorys/kosztorys-editor-v2.tsx` (przekazanie propsów + handlerów)

**Interfaces:**

- Consumes: `updateInvestmentCoeffsAction`, `updateSectionFieldAction` (Task 6).

- [ ] **Step 1:** Rozszerz `PropsT` w `kosztorys-section-summary.tsx` o: `globalCoeffs: { wTools: number; ownTools: number }`, `sectionCoeffs: Map<number, { wTools: number | null; ownTools: number | null }>`, `onGlobalCoeffChange: (patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) => void`, `onSectionCoeffChange: (sectionId: number, patch: { wToolsCoeff?: number | null; ownToolsCoeff?: number | null }) => void`.

- [ ] **Step 2:** Dodaj wiersz „Domyślnie" u góry listy: dwa `Input` (% z narzędziami / bez), wartości z `globalCoeffs`, `onBlur`→`onGlobalCoeffChange`. Dla każdej sekcji w istniejącej liście dodaj dwa małe `Input` (puste = dziedziczy; `placeholder` = wartość globalna), `onBlur`→`onSectionCoeffChange(sectionId, …)` (puste → `null`).

- [ ] **Step 3:** W `kosztorys-editor-v2.tsx`: zbuduj `sectionCoeffs` z `tree.sections`, przekaż `globalCoeffs={tree.globalCoeffs}` i handlery wołające akcje (`updateInvestmentCoeffsAction(investmentId, …)`, `updateSectionFieldAction(sectionId, …)`), po sukcesie `router.refresh()` (współczynnik zmienia wyprowadzone ceny wszystkich nienadpisanych — pełny refresh, nie optymistyka per pole). Edytor zna już `investmentId` (prop).

- [ ] **Step 4: Ręczna weryfikacja**: zmień globalny współczynnik w panelu → wyprowadzone ceny w widoku podwykonawcy przeliczają się; nadpisz współczynnik sekcji → tylko jej pozycje (bez override) się zmieniają.

- [ ] **Step 5: Commit**

```bash
git add src/components/kosztorys/kosztorys-section-summary.tsx src/components/kosztorys/kosztorys-editor-v2.tsx
git commit -m "feat(kosztorys): panel sekcji — współczynniki narzutu (globalny + per sekcja)"
```

---

### Task 9: Seedy + dokumentacja

**Files:**

- Modify: `src/scripts/poc-seed-kosztorys.ts`
- Modify: `src/scripts/poc-perf-seed-kosztorys.ts`
- Modify: `context/changes/kosztorys-poc-in-app/change.md`

- [ ] **Step 1: `poc-seed-kosztorys.ts`** — usuń `subcontractorWToolsPrice: 0`/`subcontractorOwnToolsPrice: 0` (pola override mają default `null`/`0` z kolekcji → pozycje startują jako wyprowadzone). Nic nie dodawaj.

- [ ] **Step 2: `poc-perf-seed-kosztorys.ts`** — zamień dwa `subcontractor*Price: …` na override testowe, np. co kilka wierszy `wToolsOverrideType: i % 5 === 0 ? 'amount' : null`, `wToolsOverrideValue: i % 5 === 0 ? 700 : 0` (reszta wyprowadzona) — żeby perf-seed pokrywał oba stany.

- [ ] **Step 3:** Przeseeduj poc: `node --env-file=.env --import tsx src/scripts/poc-seed-kosztorys.ts` (potwierdź wcześniej `wykonczymy-poc`).

- [ ] **Step 4: change.md** — w #2 dopisz „ROZWIĄZANE planem `docs/superpowers/plans/2026-06-20-kosztorys-subcontractor-pricing.md`"; zaktualizuj #P4 (ceny już nie „3 kolumny snapshot" — model współczynnikowy + override); popraw komentarz „ceny = niezależne snapshoty" w `kosztorys-items.ts` jeśli jeszcze nie w Task 4.

- [ ] **Step 5: Pełny typecheck + testy**: `pnpm exec tsc --noEmit` (czysto) oraz `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts src/__tests__/kosztorys-v2-rows.test.ts` (PASS).

- [ ] **Step 6: Commit**

```bash
git add src/scripts/poc-seed-kosztorys.ts src/scripts/poc-perf-seed-kosztorys.ts context/changes/kosztorys-poc-in-app/change.md
git commit -m "chore(kosztorys): seedy na model override + domknięcie #2 w change.md"
```

---

## Self-Review

- **Spec coverage:** model danych (Task 1,3,4), dziedziczenie + dual-mode derivacja (Task 1), kalkulacja (Task 1), UI panel (Task 8) i siatka (Task 7), schemat/migracja (Task 3,4), seed (Task 9), granica zakresu (bez room/eksport/historia — nieujęte celowo). Pokryte.
- **Placeholdery:** brak „TBD/TODO"; jedyna otwarta decyzja ze speca (afordancja trybu override) rozstrzygnięta w Task 7 Step 2 (osobna kolumna „Tryb" jak rabat).
- **Type consistency:** `ViewPricingT` spełniany przez `KosztorysV2RowT`; pola override (`wToolsOverrideType`/`Value`, `ownTools…`), coeffy (`*Coeff`, `globalCoeffs`) spójne między Task 1↔2↔5↔6↔7. `effectiveCoeff`/`subcontractorPrice` jedne sygnatury.
