# Kosztorys v2 — Reorder pozycji w sekcji (Slice 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **ZREALIZOWANE 2026-06-20 — z dwoma odchyleniami od tego planu (źródło prawdy = spec
> `2026-06-20-kosztorys-reorder-items-slice2-design.md`):**
>
> 1. **Mechanizm zapisu:** plan zakładał `reorderItemsAction` (renumeracja całej sekcji) w
>    Task 4. Przy 1000+ wierszach dławiło (N×`payload.update` na klik). Zastąpione
>    `swapItemOrderAction` (2 update'y — swap `display_order` dwóch sąsiadów) + helperem
>    `sectionNeighbor`. `reorderItemsAction` została w kodzie na przyszły cross-section move.
> 2. **Skąd odpalana akcja:** plan odpalał akcję po `setRows`; runtime wymusił odpalenie z
>    event-handlera (nie z updatera `setRows`) — w updaterze rewalidacja cache rusza Router w
>    trakcie renderu (błąd React). Świeży `rows` z „latest-value" `rowsRef`.
>
> Obie lekcje zapisane w `context/foundation/lessons.md`. Poniższe taski (zwł. 1 i 4) opisują
> pierwotny model — czytaj przez pryzmat powyższego.

**Goal:** Dodać ręczne przestawianie pozycji w obrębie sekcji strzałkami ▲▼ w siatce edytora v2, z natychmiastowym optymistycznym zapisem `display_order`.

**Architecture:** Czysty helper `swapItemInSection` przestawia dwie pozycje tej samej sekcji w master `rows` (operując na sekwencji wyświetlania, nie na ciągłości bloku). Edytor robi optymistyczny `setRows` + odpala w tle `reorderItemsAction(sectionId, orderedIds)`, która renumeruje `display_order` całą listą. Strzałki żyją w kolumnie akcji obok kosza; są wyszarzone przy aktywnym sorcie kolumnowym (siatka remountuje się na przejściu `null↔sort`, bo dsg zamraża `columns` na montażu).

**Tech Stack:** Next.js App Router, server actions (`protectedAction`), Payload Local API, react-datasheet-grid, Zustand-free lokalny `useState`, lucide-react.

## Global Constraints

- **Polish UI, English code.** (AGENTS.md)
- **Faza POC — testy odłożone.** Gate = `pnpm typecheck` + `pnpm lint`, weryfikacja w przeglądarce na końcu. Nie pisać testów. (`feedback_no_tests_in_poc_phase`, spec §Testy)
- **Baza lokalna:** Docker `wykonczymy-poc`, port 5433 — nie `wykonczymy-db`. Nie pushować, commit po jawnej ścieżce. (handoff)
- **Mutacje przez `protectedAction`** w `src/lib/actions/kosztorys.ts`, z tagiem rewalidacji. (AGENTS.md §Mutation Pattern)
- **Bez `readonly`** na typach/propsach. (`feedback_no_readonly_props`)
- **`lockRows` zostaje** — struktura zmienia się wyłącznie przez `setRows`, nie przez mechanikę wierszy dsg. (Slice 1)

---

### Task 1: Server action `reorderItemsAction`

**Files:**

- Modify: `src/lib/actions/kosztorys.ts` (dopisać na końcu sekcji „Struktura", po `removeItemAction` ~linia 206)

**Interfaces:**

- Produces: `reorderItemsAction(sectionId: number, orderedItemIds: number[]): Promise<ActionResultT>` — renumeruje `display_order = index` pozycji sekcji wg listy.

- [ ] **Step 1: Dopisz schemat walidacji i akcję**

W `src/lib/actions/kosztorys.ts`, po `removeItemAction` (kończy się ~linia 206), dodaj:

```ts
const reorderItemsSchema = z.object({
  sectionId: z.number(),
  orderedItemIds: z.array(z.number()).min(1),
})

// Renumeracja display_order pozycji sekcji wg pełnej listy id (nie swap dwóch) — serwer
// dostaje całą prawdę o kolejności i renumeruje od zera. Idempotentne, odporne na dryf.
// Transakcyjność pomijamy (POC, parytet z addSection→addItem ze Slice 1).
export async function reorderItemsAction(
  sectionId: number,
  orderedItemIds: number[],
): Promise<ActionResultT> {
  return protectedAction(
    'reorderItemsAction',
    async ({ payload }) => {
      const parsed = validateAction(reorderItemsSchema, { sectionId, orderedItemIds })
      if (!parsed.success) return parsed
      await Promise.all(
        parsed.data.orderedItemIds.map((id, index) =>
          payload.update({ collection: 'kosztorys-items', id, data: { displayOrder: index } }),
        ),
      )
      return { success: true }
    },
    ['kosztorysItems'],
  )
}
```

`z`, `validateAction`, `protectedAction`, `ActionResultT` są już zaimportowane na górze pliku (linie 3-6).

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (brak błędów; nowy eksport typuje się jako `Promise<ActionResultT>`).

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/kosztorys.ts
git commit -m "feat(kosztorys): reorderItemsAction — renumeracja display_order pozycji sekcji"
```

---

### Task 2: Helper `swapItemInSection`

**Files:**

- Modify: `src/lib/kosztorys/v2-rows.ts` (dopisać po `sectionItemCount`, ~linia 205)

**Interfaces:**

- Consumes: `KosztorysV2RowT` (już importowany w pliku).
- Produces: `swapItemInSection(rows: KosztorysV2RowT[], itemId: number, dir: 'up' | 'down'): KosztorysV2RowT[]` — zwraca nową tablicę z przestawioną pozycją; **tę samą referencję** gdy ruch jest no-opem (brzeg bloku sekcji / nieznane id).

- [ ] **Step 1: Dopisz helper**

W `src/lib/kosztorys/v2-rows.ts`, po `sectionItemCount` (kończy się ~linia 205), dodaj:

```ts
// Przestaw pozycję w obrębie JEJ sekcji o jedno miejsce (▲/▼). Operuje na sekwencji
// wyświetlania pozycji tej samej sekcji (kolejność w `rows`), NIE na ciągłości bloku —
// dzięki temu toleruje pozycję dodaną przez applyAddItem na koniec `rows` (Slice 1).
// Zwraca tę samą referencję przy no-opie (brzeg bloku / nieznane id) — sygnał dla edytora,
// że nie ma czego zapisywać.
export function swapItemInSection(
  rows: KosztorysV2RowT[],
  itemId: number,
  dir: 'up' | 'down',
): KosztorysV2RowT[] {
  const target = rows.find((r) => r.id === itemId)
  if (!target) return rows
  // Indeksy w `rows` pozycji tej samej sekcji, w kolejności tablicy (= kolejności wyświetlania).
  const sameSection = rows
    .map((r, i) => ({ id: r.id, i }))
    .filter((_, idx) => rows[idx].sectionId === target.sectionId)
  const pos = sameSection.findIndex((x) => x.id === itemId)
  const targetPos = dir === 'up' ? pos - 1 : pos + 1
  if (targetPos < 0 || targetPos >= sameSection.length) return rows // brzeg bloku → no-op
  const a = sameSection[pos].i
  const b = sameSection[targetPos].i
  const next = [...rows]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/kosztorys/v2-rows.ts
git commit -m "feat(kosztorys): swapItemInSection — swap pozycji w obrebie sekcji (no-op na brzegu)"
```

---

### Task 3: Strzałki ▲▼ w kolumnie akcji

**Files:**

- Modify: `src/lib/tables/kosztorys-v2-columns.tsx` (import ikon ~linia 4; typ `BuildV2ColumnsOptsT` ~linie 53-68; `actionColumn` ~linie 291-320; warunek zwrotu w `buildV2Columns` ~linia 400)

**Interfaces:**

- Consumes: `swapItemInSection` (Task 2) — pośrednio, przez callback `onReorderItem` z edytora; `V2SortStateT` (już w pliku) do wyszarzenia.
- Produces: rozszerzony `BuildV2ColumnsOptsT` o `onReorderItem?: (row: KosztorysV2RowT, dir: 'up' | 'down') => void`. Kolumna akcji renderuje ▲▼ wyszarzone gdy `opts.sort != null`.

- [ ] **Step 1: Dodaj import ikon strzałek**

W `src/lib/tables/kosztorys-v2-columns.tsx` linia 4, zmień:

```ts
import { Trash2 } from 'lucide-react'
```

na:

```ts
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
```

- [ ] **Step 2: Rozszerz `BuildV2ColumnsOptsT` o `onReorderItem`**

W bloku `onRemoveItem?: ...` / `getSectionItemCount?: ...` (~linie 66-67) dopisz pod nimi:

```ts
  // Reorder pozycji w obrębie sekcji (▲/▼). Czyta świeży `rows` z editora (ref) — bo dsg
  // zamraża `columns` na montażu. Wyszarzony przy aktywnym sorcie kolumnowym (patrz `sort`).
  onReorderItem?: (row: KosztorysV2RowT, dir: 'up' | 'down') => void
```

- [ ] **Step 3: Dodaj ▲▼ do `actionColumn`**

Zastąp całą funkcję `actionColumn` (~linie 289-320) poniższą wersją (szerokość 44→64px, ▲▼ przed koszem, wyszarzone przy sorcie):

```tsx
// Kolumna akcji: ▲▼ reorder pozycji w sekcji + kosz usuwający pozycję. Sztywne 64px,
// nie-resizable, nie-toggleable. Kosz nieaktywny gdy to ostatnia pozycja sekcji (inwariant
// „sekcja ma ≥1 pozycję"). Strzałki wyszarzone przy aktywnym sorcie kolumnowym — „w górę"
// względem listy posortowanej po cenie nie ma odwzorowania w display_order; najpierw zdejmij
// sort. (Brzeg bloku sekcji nie wyszarza strzałki — to no-op po stronie handlera, TODO MVP.)
function actionColumn(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT> {
  const onRemove = opts.onRemoveItem
  const onReorder = opts.onReorderItem
  const getCount = opts.getSectionItemCount
  const sortActive = opts.sort != null
  return {
    id: 'actions',
    title: '',
    basis: 64,
    grow: 0,
    shrink: 0,
    minWidth: 64,
    maxWidth: 64,
    disabled: true,
    component: ({ rowData }) => {
      const isLast = getCount ? getCount(rowData.sectionId) <= 1 : false
      return (
        <div className="flex size-full items-center justify-center gap-1">
          {onReorder && (
            <div className="flex flex-col leading-none">
              <button
                type="button"
                disabled={sortActive}
                title={sortActive ? 'Najpierw zdejmij sortowanie kolumną' : 'Przesuń w górę'}
                onClick={() => onReorder(rowData, 'up')}
                className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                disabled={sortActive}
                title={sortActive ? 'Najpierw zdejmij sortowanie kolumną' : 'Przesuń w dół'}
                onClick={() => onReorder(rowData, 'down')}
                className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          )}
          <button
            type="button"
            disabled={isLast}
            title={isLast ? 'Sekcja musi mieć co najmniej jedną pozycję' : 'Usuń pozycję'}
            onClick={() => onRemove?.(rowData)}
            className="text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    },
  }
}
```

- [ ] **Step 4: Pokaż kolumnę akcji także gdy podano tylko `onReorderItem`**

W `buildV2Columns` ostatnia linia (~400) zmień:

```ts
return opts.onRemoveItem ? [actionColumn(opts), ...base] : base
```

na:

```ts
return opts.onRemoveItem || opts.onReorderItem ? [actionColumn(opts), ...base] : base
```

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tables/kosztorys-v2-columns.tsx
git commit -m "feat(kosztorys): kolumna akcji ze strzalkami reorder (wyszarzone przy sorcie)"
```

---

### Task 4: Wpięcie reorderu w edytor

**Files:**

- Modify: `src/components/kosztorys/kosztorys-editor-v2.tsx` (importy ~16-49; `rowsRef` przy `prevById` ~106; `buildV2Columns` opts ~120-129; handler obok `handleRemoveItem` ~193-205; `key` siatki ~378)

**Interfaces:**

- Consumes: `reorderItemsAction` (Task 1), `swapItemInSection` (Task 2), `onReorderItem` w `BuildV2ColumnsOptsT` (Task 3).
- Produces: `handleReorderItem(row, dir)` — optymistyczny `setRows` + `reorderItemsAction` w tle.

- [ ] **Step 1: Dodaj importy**

W imporcie z `@/lib/kosztorys/v2-rows` (linie 17-31) dopisz `swapItemInSection,` do listy (np. po `sortRows,`).

W imporcie z `@/lib/actions/kosztorys` (linie 39-49) dopisz `reorderItemsAction,` do listy (np. po `removeItemAction,`).

- [ ] **Step 2: Dodaj `rowsRef` (świeży `rows` dla handlera reorderu)**

Pod linią 106 (`const prevById = useRef(...)`) dodaj:

```ts
// Świeży `rows` (kolejność wyświetlania) do event-time reorderu — handler żyje w zamrożonej
// na montażu kolumnie dsg, więc closure musi czytać ref, nie stan z mountu. Kolejność tablicy
// jest tu istotna (inaczej niż prevById, mapa po id), stąd osobny ref.
const rowsRef = useRef(rows)
rowsRef.current = rows
```

- [ ] **Step 3: Dodaj handler `handleReorderItem`**

Pod `handleRemoveItem` (kończy się linią 205) dodaj:

```ts
function handleReorderItem(row: KosztorysV2RowT, dir: 'up' | 'down') {
  const next = swapItemInSection(rowsRef.current, row.id, dir)
  if (next === rowsRef.current) return // brzeg bloku → no-op
  setRows(next)
  // Pełna lista id sekcji w nowej kolejności → serwer renumeruje display_order od zera.
  const orderedIds = next.filter((r) => r.sectionId === row.sectionId).map((r) => r.id)
  void reorderItemsAction(row.sectionId, orderedIds)
}
```

- [ ] **Step 4: Przekaż `onReorderItem` do `buildV2Columns`**

W obiekcie opt `buildV2Columns({ ... })` (linie 120-129) dopisz po `onRemoveItem: handleRemoveItem,`:

```ts
    onReorderItem: handleReorderItem,
```

(`sort` jest już przekazywany — linia 122 — więc wyszarzenie strzałek działa.)

- [ ] **Step 5: Remountuj siatkę na przejściu `null↔sort`**

W `<DataSheetGrid>` zmień `key` (linia 378) z:

```tsx
            key={`${view}:${widthsKey}`}
```

na:

```tsx
            key={`${view}:${sort ? 'sorted' : 'natural'}:${widthsKey}`}
```

Komentarz nad `key` (linie 375-377) rozszerz o jedno zdanie:

```tsx
// Remount przy zmianie szerokości kolumn ORAZ widoku: dsg zamraża `columns`
// na montażu i nie podnosi nowych wiązań (cena→pole, netto wg widoku) bez
// remountu — bez `view` w kluczu wszystkie 3 widoki pokazywały cenę klienta.
// `sorted/natural` w kluczu: strzałki reorderu (wyszarzone przy sorcie) muszą się
// przebudować na wejściu/zejściu z sortu — asc↔desc nie remountuje (stan strzałek bez zmian).
```

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. (`buildV2Columns` jest już owinięte `// eslint-disable-next-line react-hooks/refs` — linia 119 — co pokrywa też `handleReorderItem` czytający `rowsRef.current`.)

- [ ] **Step 7: Commit**

```bash
git add src/components/kosztorys/kosztorys-editor-v2.tsx
git commit -m "feat(kosztorys): wepnij reorder pozycji (strzalki + optymistyczny setRows)"
```

---

### Task 5: Weryfikacja w przeglądarce (POC gate)

**Files:** brak zmian — weryfikacja ręczna na działającej appce (baza `wykonczymy-poc`, dev często na 3001).

**Interfaces:** brak.

- [ ] **Step 1: Pełny gate**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 2: Odpal appkę i wejdź w kosztorys v2**

Uruchom dev (`pnpm dev`), zaloguj się (patrz `project_local_login_and_test_fixtures.md` — tymczasowy OWNER przez Local API), otwórz istniejący kosztorys w edytorze v2.

- [ ] **Step 3: Sprawdź scenariusze**

Potwierdź wzrokowo:

1. **Reorder w środku sekcji:** ▲ na pozycji w środku bloku → zamienia się z poprzednią; ▼ z następną. Siatka reaguje natychmiast.
2. **Brzeg bloku = no-op:** ▲ na pierwszej pozycji sekcji nic nie robi (nie wskakuje do innej sekcji); ▼ na ostatniej — też nic.
3. **Trwałość:** po przestawieniu odśwież stronę (F5) — nowa kolejność została (zapis `display_order` przeszedł).
4. **Sort wyszarza strzałki:** kliknij nagłówek „Netto" (sort) → strzałki szare i nieklikalne; trzeci klik w „Netto" (zdejmij sort) → strzałki znów aktywne, kolejność = ostatnio zapisana ręcznie.
5. **Filtr do sekcji:** zawęź do jednej sekcji w panelu „Sekcje" → ▲▼ dalej działają w jej obrębie.

- [ ] **Step 4: (jeśli wszystko gra) zaktualizuj pamięć POC**

Dopisz do `project_kosztorys_poc_in_app.md`, że Slice 2 (reorder pozycji w sekcji) jest zrobiony i zweryfikowany w przeglądarce.

---

## Self-Review

**Spec coverage:**

- §Akcja `reorderItemsAction` → Task 1. ✓
- §Helper `swapItemInSection` → Task 2. ✓
- §UX strzałki ▲▼ w kolumnie akcji, no-op na brzegu, wyszarzenie przy sorcie → Task 3 (kolumna) + Task 4 (remount na sort, handler no-op). ✓
- §Model stanu — natychmiastowy optymistyczny splice, `prevById` bez zmian, refresh bezpieczny → Task 4 (handler). ✓
- §„Przywrócić nieposortowane" = zdjąć sort kolumnowy → istniejący cykl sortu (asc→desc→off), zweryfikowany w Task 5 krok 3.4. ✓
- §Zazębienie z `applyAddItem` (tolerancja na sekwencji sekcji) → Task 2 helper + komentarz. ✓
- §Świadomie POC: brzeg = no-op zamiast disabled → Task 3 komentarz + Task 5 krok 3.2. ✓
- §Testy odłożone → brak tasków testowych, gate typecheck/lint/browser. ✓

**Placeholder scan:** brak TBD/TODO-do-uzupełnienia; wszystkie kroki mają kompletny kod lub komendę.

**Type consistency:** `reorderItemsAction(sectionId: number, orderedItemIds: number[]): Promise<ActionResultT>`, `swapItemInSection(rows, itemId, dir: 'up'|'down'): KosztorysV2RowT[]`, `onReorderItem?: (row, dir: 'up'|'down') => void`, `handleReorderItem(row, dir)` — sygnatury spójne między Task 1-4. ✓
