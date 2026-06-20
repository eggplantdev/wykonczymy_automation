# Subtotale per sekcja — prawy panel (edytor kosztorysu v2)

- **Data:** 2026-06-20
- **Change:** `kosztorys-poc-in-app` (pytanie do właściciela #1 z `change.md` — rozstrzygnięte)
- **Status:** zatwierdzony (właściciel, 2026-06-20)

## Cel

Roboczy przegląd kosztu **per sekcja** w edytorze v2. Edytujesz płaską, sortowalną
siatkę 224–1000 pozycji i chcesz na bieżąco widzieć, ile kosztuje każda sekcja —
bez gubienia tego przy sortowaniu/filtrowaniu.

**Zakres:** wyłącznie wgląd w edytorze. Format kliencki (subtotale w eksporcie
PDF/CSV) — **poza zakresem**, osobny slice eksportu.

## Decyzje (zebrane w brainstormie 2026-06-20)

1. **Podejście A — osobny panel, nie wiersze w siatce.** Siatka v2
   (`react-datasheet-grid` + `lockRows` + wirtualizacja) trzyma płaską tablicę
   wierszy-pozycji mapowaną 1:1 po `id` (`rowKey`, `diffRow`, autosave).
   Wstrzykiwanie wierszy-nagłówków grup psułoby ten model. Panel obok siatki omija
   to całkowicie. (To realizuje wariant (a) z `change.md` #1; wariant (b) —
   grupowanie wyłączające sort — odłożony, wróci ewentualnie przy eksporcie.)
2. **Prawy panel, zwijany, domyślnie otwarty.** Stała kolumna ~`w-72`, przycisk
   w toolbarze zwija/rozwija. Pionowa lista sekcji czyta się naturalnie.
3. **Subtotale liczą zawsze pełny zbiór** — niezależne od szukajki i sortu. Panel
   to stabilna rozpiska kosztu wszystkich sekcji, nie skacze przy filtrowaniu.
   Toolbar grand-net zostaje **filtro-świadomy** (bez zmian) — dwa różne liczniki
   celowo: filtrowana suma bieżąca w toolbarze, stały przegląd w panelu.
4. **Metryki per sekcja:** nazwa · netto (wg aktywnego widoku cenowego) · udział %
   w sumie całkowitej · liczba pozycji. Stopka panelu: suma netto (pełny zbiór).

## Architektura

### 1. `src/lib/kosztorys/calc.ts` — `sectionSubtotalsForView` (czysta, addytywna)

```ts
export function sectionSubtotalsForView(
  rows: KosztorysV2RowT[],
  view: PriceViewT,
): SectionSubtotalT[]
```

- Grupuje `rows` po `sectionId`, sumuje `rowNetForView(row, view)` (rabat + widok
  cenowy już w środku), liczy `itemCount`.
- `share = grandNet > 0 ? net / grandNet : 0` (guard dzielenia przez zero).
- Wynik uporządkowany wg `displayOrder` sekcji (rosnąco). Kolejność bierzemy
  z pierwszego napotkanego wiersza sekcji — `rows` z `treeToRows` są już w
  porządku sekcja→displayOrder, więc kolejność pierwszego wystąpienia = porządek
  sekcji.
- Czysta funkcja — żadnych efektów, liczona na żywo z inputów (spójne z resztą
  `calc.ts`).

Typ `SectionSubtotalT` → `src/types/kosztorys.ts` (cross-cutting kosztorysu):

```ts
export type SectionSubtotalT = {
  sectionId: number
  sectionName: string
  net: number
  share: number // 0..1, udział w sumie netto wszystkich sekcji
  itemCount: number
}
```

### 2. `src/components/kosztorys/kosztorys-section-summary.tsx` — panel (nowy)

- Czysto prezentacyjny, bez własnego stanu. `PropsT` kolokowany:
  `{ subtotals: SectionSubtotalT[]; grandNet: number; onClose: () => void }`.
- Lista sekcji: nazwa, netto (`toLocaleString('pl-PL', 2 miejsca)`), udział %
  (`(share * 100).toFixed(1)%`), liczba pozycji. Stopka: „Suma netto".
- Nagłówek panelu z tytułem + przyciskiem zwijania (`onClose`).
- Styl spójny z resztą (shadcn, `border-border`, `text-muted-foreground`).

### 3. `src/components/kosztorys/kosztorys-editor-v2.tsx` — okablowanie

- `const [summaryOpen, setSummaryOpen] = useState(true)`.
- Przycisk-toggle w toolbarze obok `DatasheetColumnToggle` („Sekcje" /
  „Podsumowanie").
- `const subtotals = useMemo(() => sectionSubtotalsForView(rows, view), [rows, view])`
  — **z `rows` (pełny zbiór), NIE `viewRows`**. Przelicza się przy edycji i zmianie
  widoku; ignoruje `search` i `sort`.
- Layout: owijam siatkę + panel w **flex row**. Wrapper siatki `flex-1 min-w-0`
  z **zachowanym** wewnętrznym `grid grid-cols-[minmax(0,1fr)]`; panel obok
  `w-72 shrink-0` (zwinięty → `hidden`).

## Gotcha (load-bearing) — nie wskrzesić migotania

Naprawa migotania v2 opiera się na tym, że kontener siatki ma **definitywną
szerokość** (`grid-cols-[minmax(0,1fr)]`), więc siatka nie rozpycha się do sumy
min-szerokości kolumn (~1650px), tylko przewija je wewnętrznie. Dodanie panelu
**nie może** tego naruszyć:

- Wrapper siatki zachowuje `grid grid-cols-[minmax(0,1fr)]` + dostaje `min-w-0`,
  żeby flex pozwolił mu się kurczyć poniżej treści.
- Panel ma stałą szerokość (`w-72 shrink-0`) — nie negocjuje miejsca z siatką.
- `useElementHeight` mierzy wrapper siatki jak dotąd; flex-row nie zmienia
  wysokości (panel i siatka równej wysokości w `flex-1` rodzica).

Weryfikacja w przeglądarce: otwórz/zwiń panel, sprawdź że szerokość siatki jest
stała i nie ma oscylacji (DevTools Issues 0/s).

## Data flow

```
rows (pełny zbiór, stan edytora)
  └─ useMemo sectionSubtotalsForView(rows, view) ──> KosztorysSectionSummary
       (przelicz przy edycji rows lub zmianie view; ignoruj search/sort)
```

## Testy

Unit w `src/__tests__/kosztorys-calc.test.ts` (`sectionSubtotalsForView`):

- sumy per sekcja poprawne; pozycje jednej sekcji zsumowane, innej nie zmieszane;
- kolejność wynikowa wg `displayOrder` sekcji;
- view-awareness: `client` vs `w_tools` daje inne `net` (różne ceny);
- rabat zastosowany (pozycja z `percent`/`amount` obniża `net`);
- `Σ share ≈ 1` gdy grandNet > 0;
- guard: grandNet = 0 (wszystkie ceny 0) → `share = 0`, bez `NaN`.

Browser-verify panelu (pure-fn nie wymaga testu siatki):

- otwarcie/zwinięcie panelu przyciskiem;
- przełącznik widoku (Robocizna/Z narzędziami/Bez narzędzi) → panel przelicza;
- szukajka → panel **stabilny** (nie reaguje), toolbar grand-net reaguje;
- szerokość siatki stała (brak nawrotu migotania).

## Poza zakresem (YAGNI teraz)

- Klik sekcji w panelu → scroll/filtr siatki do tej sekcji (nice-to-have, później).
- Subtotale brutto / kolumna VAT w panelu (na razie tylko netto).
- Subtotale w eksporcie klienckim (osobny slice eksportu).
- Wariant (b): wiersze-subtotale w siatce z trybem grupowania.
