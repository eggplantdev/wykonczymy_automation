# Eksport kosztorysu do CSV (płaski + grupowany) — design

- **Data:** 2026-06-20
- **Change:** `kosztorys-poc-in-app` (pytanie do właściciela #3 — eksport)
- **Status:** zatwierdzony (właściciel, 2026-06-20)

## Cel

Eksport bieżącego, widocznego stanu edytora kosztorysu do **CSV** — dwie wersje
(płaska i grupowana) do porównania w bake-offie. CSV dobrze ląduje w Google Sheets
(BOM UTF-8). Bez druku HTML, bez osobnej strony, bez migracji/auth/Drive — czysto
lokalne.

**Dlaczego nie PDF/druk HTML:** kosztorys ma kilkanaście stron → druk przeglądarki
byłby nieczytelny. Odrzucone świadomie.

**Dlaczego CSV, nie zapis przez Google Sheets API:** dobry CSV wczytany do Sheets
załatwia „zapis w Sheets". Adapter pisania przez API (service account) niesie
ograniczenie Drive (SA nie tworzy nowych arkuszy na koncie prywatnym — patrz
[[project_kosztorys_sa_no_drive_storage]]) i zostaje jako ewentualne v2 na tym samym
rdzeniu. Pomijamy w v1.

## Model: WYSIWYG snapshot bieżącego stanu

Eksport bierze **dokładnie to, co widać** w edytorze w chwili kliknięcia — to
najprostszy model mentalny (właściciel, 2026-06-20):

- `viewRows` — wiersze już przefiltrowane (szukajka / filtr sekcji) i posortowane,
- widoczne kolumny — zestaw kolumn minus `hidden` (Twój toggle „Kolumny"),
- aktywny widok ceny (`PriceViewT`: Robocizna / Z narzędziami / Bez narzędzi).

Filtry to te same kontrolki, które już są w edytorze. Ustawiasz widok pod klienta,
podglądasz, pobierasz. Nic się nie zapisuje (świeży snapshot za każdym razem).

## Widoczność — co ster​uje „co widać" (EWOLUCJA 2026-06-20)

Pierwotnie „widoczność" = tylko ukrywanie kolumn + szukajka + filtr jednej sekcji.
To za mało: nie da się powiedzieć _„cały kosztorys oprócz sekcji Klimatyzacja"_ ani
wykluczyć pojedynczej pozycji. Model docelowy: **eksportuj co widać**, gdzie „widać"
sterujesz na trzech poziomach (właściciel: per sekcja **i** per pozycja są wymagane):

- **Kolumny** — ukrywasz istniejącym togglem „Kolumny" (działa na siatkę i eksport).
- **Sekcje** — **oczko widoczności per sekcja w panelu „Sekcje"** (multi: pokaż/ukryj
  dowolny podzbiór). Ukrycie sekcji = wyklucza wszystkie jej pozycje z eksportu.
- **Pozycje** — **checkbox „w eksporcie" per wiersz** (kolumna z lewej siatki).
  Wykluczona pozycja jest **wyszarzona w siatce, ale ZOSTAJE edytowalna** — pomijamy
  ją tylko w podglądzie i pliku, nie chowamy z edytora. To wymóg twardy.

**Stan widoczności = transient, JEDNO źródło prawdy:** `excludedItems: Set<number>`
(id pozycji), domyślnie pusty (wszystko widoczne), reset po reloadzie. Zbiór do
eksportu/podglądu = `viewRows.filter(r => !excludedItems.has(r.id))`. Subtotale/sumy
w podglądzie i pliku liczone po tym samym przefiltrowanym zbiorze — dokument zawsze
sumuje się do tego, co widać.

> **Oczko sekcji = operacja zbiorcza na pozycjach, nie osobny zbiór.** Ukrycie sekcji
> dodaje id wszystkich jej pozycji do `excludedItems`; odkrycie — usuwa. Dzięki temu
> po zbiorczym ukryciu sekcji można **odkryć pojedynczą pozycję** (odznaczasz jej
> wykluczenie) bez specjalnej logiki — bo jest tylko jeden zbiór. Stan oczka sekcji =
> pochodny: wszystkie pozycje wykluczone → „ukryta", część → stan nieokreślony
> (indeterminate), żadna → „widoczna".

## Podgląd eksportu — weryfikacja (NOWE 2026-06-20)

Wymóg właściciela: **musi być wgląd w wygenerowany plik przed pobraniem** — bo
kosztorys to hierarchia (sekcje → pozycje → subtotale), nie płaska lista, i trzeba
zobaczyć, co realnie wyjdzie.

- Przycisk „CSV" otwiera **podgląd** (nie od razu pobranie): modal/drawer renderujący
  **dokładnie ten snapshot** jako zwykłą tabelę HTML — te same widoczne kolumny i
  wiersze, **pogrupowane po sekcji z subtotalami + suma netto/VAT/brutto**. Widzisz
  1:1, co wyląduje w pliku.
- **Przyciski pobierania (płaski / grupowany) są w podglądzie.** Flow: klik → zobacz
  → pobierz. To jest też powierzchnia bake-offu (płaski vs grupowany widać obok siebie).
- Podgląd jest read-only — żadnej edycji; to render snapshotu, nie druga siatka. Przy
  ~1000 wierszy renderujemy zwykłą `<table>` (nie wirtualizowaną) — akceptowalne, bo
  to chwilowy modal, nie stały widok; jeśli zamula, dołożymy prostą paginację/limit.

> _Decyzja do potwierdzenia:_ podgląd jako **modal/drawer nad edytorem** (rekomendacja,
> zostajesz w kontekście) vs **osobna strona** `/inwestycje/[id]/kosztorys-eksport`.

## Architektura

Jeden wspólny rdzeń (snapshot + rejestr kolumn), na nim dwa buildery i kontrolka UI.

### 1. `src/lib/export/csv-cell.ts` — wspólny `escapeCsv` (refactor)

`escapeCsv` żyje dziś prywatnie w `src/lib/export/csv.ts` (eksport transferów).
Wyciągamy do `src/lib/export/csv-cell.ts` i reużywamy w obu ścieżkach (transfery +
kosztorys). `csv.ts` importuje go zamiast trzymać lokalnie — zero zmiany zachowania.

### 2. `src/lib/export/kosztorys-columns.ts` — rejestr kolumn

```ts
type KosztorysExportColumnT = {
  label: string
  getValue: (row: KosztorysV2RowT, view: PriceViewT) => string
}
export const KOSZTORYS_EXPORT_COLUMNS: Record<string, KosztorysExportColumnT>
export function kosztorysExportColumnIds(stages: KosztorysStageT[]): string[]
```

- Kolumny statyczne: `section` (nazwa sekcji), `description`, `unit`, `measuredQty`,
  `price` (wg widoku), `discount`, `net` (wg widoku), `vat`, `gross`. Reuse
  `formatPLN` i helpery z `calc.ts` (`viewPrice`, `rowNetForView`, VAT z
  `vatRate ?? sectionVatRate`).
- Kolumny dynamiczne etapów: `stage_<id>` → ilość wykonana w etapie (z wiersza v2).
- `kosztorysExportColumnIds(stages)` daje pełną listę id w kolejności prezentacji —
  z niej UI odfiltrowuje `hidden`, dając „widoczne kolumny".

### 3. `src/lib/export/kosztorys-csv.ts` — dwa buildery

```ts
export function buildKosztorysCsvFlat(
  rows: KosztorysV2RowT[],
  visibleColumnIds: string[],
  view: PriceViewT,
): string

export function buildKosztorysCsvGrouped(
  rows: KosztorysV2RowT[],
  visibleColumnIds: string[],
  view: PriceViewT,
  subtotals: SectionSubtotalT[],
): string
```

- **Płaski:** nagłówek + jeden wiersz na pozycję; „Sekcja" jako kolumna. Mirror
  `buildTransferCsv` (escape, `join(',')`, `join('\n')`).
- **Grupowany:** per sekcja → wiersz-nagłówek z nazwą sekcji, pod nim pozycje, pod
  nimi wiersz „Subtotal <sekcja>" (netto z `subtotals`); na końcu pusty wiersz +
  „Suma netto / VAT / brutto". Reuse `sectionSubtotalsForView` (już istnieje).
  Wiersze nie-pozycyjne wyrównane do tych samych kolumn (puste komórki gdzie trzeba).

### 4. Kontrolka eksportu + pobieranie — `kosztorys-csv-button.tsx` (ZBUDOWANE, ewoluuje)

- **Obecnie (zbudowane):** dropdown „CSV płaski" / „CSV grupowany" → pobranie od razu.
  Blob z BOM `﻿` + `triggerDownload`, nazwa `kosztorys-<inwestycja>-<data>-<wariant>.csv`.
- **Docelowo (po dołożeniu podglądu):** przycisk „CSV" otwiera **podgląd** (część 6),
  a przyciski pobierania (płaski/grupowany) przenoszą się do podglądu.

### 5. Widoczność per sekcja / per pozycja — stan w edytorze + kontrolki

- **Stan:** `const [excludedItems, setExcludedItems] = useState<Set<number>>(new Set())`
  w `kosztorys-editor-v2.tsx`. Transient, reset po reloadzie.
- **Checkbox per pozycja:** kolumna datasheet-grid z lewej (component renderujący
  `<input type="checkbox">` lub ikonę oka). `disabled`/`keepFocus` jak kolumna akcji
  (kosza) — wzorzec z `actionColumn` w `kosztorys-v2-columns.tsx`. Toggle dodaje/
  usuwa `r.id` z `excludedItems`. Wykluczony wiersz wyszarzony (klasa na komórkach).
- **Oczko per sekcja w panelu „Sekcje":** ikona obok ＋/ołówek/kosz. Klik = zbiorczy
  toggle wszystkich pozycji sekcji w `excludedItems` (patrz „operacja zbiorcza"
  wyżej). Stan ikony pochodny z `excludedItems` ∩ pozycje sekcji (widoczna /
  nieokreślona / ukryta).
- **Filtr eksportu/podglądu:** `exportRows = viewRows.filter(r => !excludedItems.has(r.id))`.
  Subtotale do podglądu/pliku liczone z `exportRows` (nie z pełnego panelu).

### 6. Podgląd eksportu — `kosztorys-export-preview.tsx` (NOWE)

- Modal/drawer (rekomendacja) renderujący `exportRows` jako zwykłą `<table>` HTML,
  **pogrupowaną po sekcji** z subtotalami + suma netto/VAT/brutto — 1:1 z plikiem.
- Read-only. Przy ~1000 wierszy zwykła tabela (nie wirtualizowana) — chwilowy modal,
  akceptowalne; gdyby zamulało, prosta paginacja/limit.
- W stopce podglądu przyciski „Pobierz CSV płaski" / „Pobierz CSV grupowany"
  (logika z części 4, na `exportRows`).

## Integracja z edytorem (`kosztorys-editor-v2.tsx`)

Edytor już trzyma `viewRows`, `view`, `hidden`, `subtotals`, `investmentName`.
Dokładamy: stan `excludedItems`, kolumnę-checkbox (część 5), oczko w panelu sekcji,
`exportRows = viewRows.filter(...)`, oraz przycisk otwierający podgląd (część 6).
Logika siatki/autosave bez zmian — checkbox to osobna, nieedytowalna kolumna; stan
widoczności żyje obok `rows`, nie miesza się z diffem/zapisem.

## Bake-off

Dwie wersje współistnieją (dwa wyjścia jednej kontrolki). Właściciel generuje oba,
otwiera w Google Sheets, ocenia czytelność/użyteczność. Zwycięzca zostaje, drugi
builder się usuwa — wzorzec jak przy bake-offie edytora v1/v2.

## Jakość (POC — bez testów)

Faza POC: **bez testów jednostkowych** — POC może pójść do piachu, testy dochodzą
na etapie MVP (patrz [[feedback_no_tests_in_poc_phase]]). Bramka jakości:
`pnpm typecheck` + `pnpm exec next build` + weryfikacja w przeglądarce (oba pliki
otwarte w Sheets wyglądają poprawnie, escaping przecinków/cudzysłowów OK, liczby
czytelne).

## Poza zakresem (YAGNI / v2)

- Zapis przez Google Sheets API (SA + ograniczenie Drive) — ten sam rdzeń snapshotu.
- Eksport PDF / druk HTML — odrzucony (nieczytelny przy wielu stronach). Podgląd
  (część 6) to render do **weryfikacji na ekranie**, nie do druku.
- **Trwałe** flagi widoczności (`hiddenInExport` w bazie) — NIE w POC. Widoczność jest
  transient (`excludedItems`, reset po reloadzie). Kolumna `hidden_in_export` w
  schemacie zostaje nieużyta; ewentualne utrwalenie wyboru = osobna decyzja na MVP.

## Stan implementacji + blocker (2026-06-20)

- **Zbudowane i zweryfikowane w przeglądarce:** rdzeń CSV — `csv-cell.ts`,
  `kosztorys-export-columns.ts`, `kosztorys-csv.ts` (płaski+grupowany), przycisk
  `kosztorys-csv-button.tsx` wpięty w pasek. Oba pliki pobrane, escaping/sumy OK.
- **PENDING (ten spec, części 5–6):** widoczność per sekcja/pozycja + podgląd.
- **BLOCKER:** drzewo chwilowo **nie kompiluje** (~45 błędów) — równoległy refactor
  modelu cen podwykonawcy (narzuty/współczynniki: `ViewPricingT`, `wToolsCoeff`,
  `wToolsOverrideType`…) jest w toku i niedokończony (`v2-rows.ts` ma błędy). Rdzeń
  eksportu oberwał rykoszetem (2 drobiazgi: `asSection`/`sectionOf` bez nowych pól
  `wToolsCoeff`/`ownToolsCoeff`; `viewPrice`/`rowNetForView` chcą `ViewPricingT`, nie
  `KosztorysItemT` — przekazać `r` wprost zamiast rzutować). **Implementacja części
  5–6 i naprawa rdzenia czekają, aż refactor cen wyląduje zielony.**

## Decyzje do potwierdzenia

1. Podgląd: **modal/drawer nad edytorem** (rekomendacja) vs osobna strona
   `/inwestycje/[id]/kosztorys-eksport`.
2. Format liczb w CSV: `formatPLN` (`3000,00 zł`, tekst w Sheets — parytet z eksportem
   wydatków, obecny) vs surowe liczby (sumowalne w Sheets). Rozstrzygnie bake-off.
3. Bake-off płaski vs grupowany — który zostaje (po obejrzeniu w podglądzie/Sheets).
