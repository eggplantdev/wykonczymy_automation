# Zakładka „Inwestycja" w panelu Podsumowanie — plan wdrożenia

## Overview

Panel Podsumowania w edytorze kosztorysu v2 dostaje szóstą zakładkę — „Inwestycja" — z kompletem
danych inwestycji (adres, kontakt, notatki/zakres prac, opinia, status) w trybie tylko do odczytu,
z przyciskiem otwierającym istniejący `EditInvestmentDialog`. Do tej samej zakładki przenosi się
„Dokumentacja", dziś stojąca w rzędzie narzędzi siatki. Żeby galeria nie znikała na świeżej
inwestycji, panel zaczyna montować się także na pustym kosztorysie — tam domyślnie zwinięty, więc
nie zasłania ekranu „Pobierz z arkusza Google…".

Motyw: zakres prac żyje w notatce inwestycji i jest niewidoczny z poziomu edytora, w którym ten
zakres się wycenia.

## Current State Analysis

- Pasek zakładek to `SUMMARY_VIEW_OPTIONS` w `src/components/kosztorys/summary/summary-panel-content.tsx:37`
  — pięć pozycji: Podsumowanie | Materiały | Robocizna | Podwykonawcy | Marża. Wartości pochodzą
  z `SummaryViewT` (`summary/hooks/use-summary-view.ts:8`), gdzie stoi też `VALID_VIEWS`.
- Kto którą zakładkę widzi, rozstrzyga `summary/allowed-summary-views.ts` — dwie bramki na dwóch
  różnych sygnałach: „Podwykonawcy" na samym `preview`, „Marża" dodatkowo na `hasMarginInputs`.
- Zapisany wybór zakładki jest globalny i może wskazać widok, którego dany host nie oferuje —
  `summary-panel-content.tsx:187` ma już fallback na pierwszy dozwolony, więc nowa zakładka nie
  potrzebuje własnego.
- Rekord inwestycji jest **za darmo** na stronie edytora: `kosztorys_v2/page.tsx:41` robi
  `refData.investments.find(...)` dla samego sprawdzenia istnienia, a `InvestmentRefT`
  (`src/types/reference-data.ts:21`) niesie `status, address, phone, email, contactPerson, notes,
  review`. Dziś ze znalezionego rekordu schodzą w dół tylko `name`, `hasSheet` i `status`.
- Karta inwestycji renderuje dokładnie ten zestaw pól przez `InfoList`
  (`src/app/(frontend)/inwestycje/[id]/page.tsx:72-80`) i obok stawia `EditInvestmentDialog`, który
  przyjmuje cały `InvestmentRefT`. Oba są gotowe do ponownego użycia.
- „Dokumentacja" to `InvestmentAssetsControl`, montowany w toolbarze edytora
  (`editor/toolbar/kosztorys-editor-toolbar.tsx:97`) za bramką `assets &&`; `assets` przyjeżdża
  przez kontekst edytora (`use-kosztorys-editor-context.tsx:32`). Poza toolbarem tę samą kontrolkę
  montuje `InvestmentAssetsSection` na karcie inwestycji — ta zostaje bez zmian.
- Panel **nie montuje się** na pustym kosztorysie: `kosztorys-editor-body.tsx:532` gatuje go na
  `subtotals.length > 0`, a oba przełączniki mają `disabled={subtotals.length === 0}`
  (toolbar `:45`, nagłówek podglądu klienta `:389`). Komentarz przy montowaniu podaje powód: panel
  jest domyślnie otwarty, na pustym kosztorysie pokazuje same zera i zamalowuje `EmptyState`
  z jedynym wejściem „Pobierz z arkusza Google…".
- Stan otwarcia panelu trzyma `useTotalsPanelOpen` → `usePersistedEnum`, który jest prawdziwym
  `useSyncExternalStore` ze wspólnym zbiorem listenerów — każda instancja hooka widzi ten sam stan,
  więc przełącznik w toolbarze i panel nigdy się nie rozjeżdżają.
- Strona inwestycji montuje ten sam `SummaryPanelContent` przez `InvestmentSummaryPanel`, ale
  z własną białą listą `INVESTMENT_PANEL_VIEWS = ['summary', 'expenses', 'margin']` — nowa zakładka
  nie pojawi się tam sama z siebie i nie ma po co (karta inwestycji **jest** tymi danymi).
- Warsztat szablonów (`templatePresetId`) renderuje ten sam korpus edytora bez żadnej inwestycji —
  tam rekordu nie będzie, więc zakładka musi z niego wypaść tym samym mechanizmem co „Marża".

## Desired End State

W edytorze kosztorysu v2 pasek Podsumowania kończy się zakładką „Inwestycja". Zakładka pokazuje
komplet pól z karty inwestycji plus „Dokumentację" — podgląd, dodawanie i usuwanie plików —
i przycisk „Edytuj inwestycję" otwierający istniejący dialog. W rzędzie narzędzi siatki nie ma już
galerii. Na świeżej inwestycji z pustym kosztorysem panel jest zamontowany, ale zwinięty: widać
`EmptyState` z importem z arkusza, a jedno kliknięcie w „Podsumowanie" otwiera panel, w którym
„Inwestycja" ma pełną treść (pozostałe zakładki mają swoje istniejące stany pustki). Dokument
klienta (`preview`) nie zna tej zakładki w ogóle — jak „Podwykonawców".

Weryfikacja: na inwestycji bez kosztorysu galeria jest osiągalna z edytora, a `EmptyState` nie jest
niczym zasłonięty; na inwestycji z kosztorysem zakładka pokazuje notatki i pliki; podgląd inwestora
pokazuje pięć zakładek jak dotąd.

### Key Discoveries:

- `kosztorys_v2/page.tsx:41` — rekord inwestycji już jest na stronie, nowy fetch niepotrzebny.
- `summary-panel-content.tsx:187` — fallback „pierwsza dozwolona zakładka" już istnieje.
- `allowed-summary-views.ts:23-25` — wzorzec bramkowania zakładki dwoma sygnałami, gotowy do
  rozszerzenia o trzeci przypadek.
- `use-summary-view.ts:16` — precedens **drugiego klucza localStorage z inną wartością domyślną**
  (`PREVIEW_STORAGE_KEY`), zamiast flagi nadpisującej odczyt. Dokładnie tego kształtu wymaga
  „na pustym kosztorysie zwinięty".
- `usePersistedEnum` to wspólny store — dwa hooki z tym samym kluczem to jeden stan.
- `KosztorysEditorDataT.assets` (`src/lib/kosztorys/types.ts:178`) — precedens opcjonalnego pola,
  którego `undefined` znaczy „ta powierzchnia nie ma tego w ogóle". `investment` dostaje ten sam
  kontrakt.

## What We're NOT Doing

- **Nie robimy edycji w miejscu.** Notatki są tylko do odczytu; edycja idzie przez istniejący
  `EditInvestmentDialog`. Autozapis pola notatek to własna zmiana, nie dodatek do tej.
- **Nie ruszamy karty inwestycji** — `InvestmentAssetsSection` i `InfoList` na
  `/inwestycje/[id]` zostają dokładnie jak są.
- **Nie ruszamy panelu na stronie inwestycji** — `INVESTMENT_PANEL_VIEWS` zostaje trzyelementowe.
- **Nie zmieniamy zachowania podglądu klienta**: nagłówek `(share)` zachowuje
  `disabled={subtotals.length === 0}` na swoim przełączniku. Klient nie dostaje zakładki
  „Inwestycja", więc pusty kosztorys nie ma tam czego pokazać i panel nie ma po co się otwierać.
- **Nie zmieniamy nazw** pozostałych napisów „Zdjęcia i pliki" (karta inwestycji, formularz,
  kolekcje Payloada, `INVESTMENT_ASSETS_UPLOAD_TITLE`). Osobna decyzja, poza tą zmianą.
- Żadnych nowych zapytań do bazy ani nowych akcji serwerowych.

## Implementation Approach

Trzy fazy idą od danych do chromu: najpierw zakładka z danymi inwestycji (to wymaga przepchnięcia
rekordu przez korpus edytora), potem przeniesienie do niej galerii (to **zdejmuje** `assets`
z kontekstu edytora — po przeprowadzce nikt w toolbarze go nie czyta), na końcu montowanie panelu
na pustym kosztorysie.

Rekord inwestycji i pliki jadą do panelu **propsem**, nie przez `KosztorysEditorProvider`: korpus
edytora ma jedno i drugie wprost z propsów strony, a panel jest jego bezpośrednim dzieckiem.
Kontekst edytora obsługuje toolbar i siatkę — dokładanie tam wartości, których czyta wyłącznie
panel, poszerzałoby kontrakt bez powodu.

## Phase 1: Zakładka „Inwestycja"

### Overview

Nowa wartość widoku, jej bramkowanie, komponent zakładki i przepchnięcie `InvestmentRefT`
ze strony do panelu. Bez galerii — ta dochodzi w fazie 2.

### Changes Required:

#### 1. Wartość widoku

**File**: `src/components/kosztorys/summary/hooks/use-summary-view.ts`

**Intent**: Dołożyć `'investment'` jako szósty widok panelu.

**Contract**: `SummaryViewT` zyskuje wariant `'investment'`; `VALID_VIEWS` zyskuje tę samą wartość.
`SUMMARY_VIEW_DEFAULT` zostaje `'summary'` — nowa zakładka jest ostatnia, nie domyślna.

#### 2. Bramka widoczności

**File**: `src/components/kosztorys/summary/allowed-summary-views.ts`

**Intent**: „Inwestycja" jest odcięta od dokumentu klienta (notatka wewnętrzna nie jest dla
inwestora) i od powierzchni, która żadnej inwestycji nie ma (warsztat szablonów, oba shares).

**Contract**: `ViewDisclosureT` zyskuje `hasInvestmentInfo: boolean`; filtr zyskuje
`if (value === 'investment') return !preview && hasInvestmentInfo` — ten sam kształt co istniejąca
gałąź `'margin'`.

#### 3. Komponent zakładki

**File**: `src/components/kosztorys/summary/tabs/summary-investment-tab.tsx` (nowy)

**Intent**: Wyrenderować komplet pól inwestycji w tej samej kolejności i tymi samymi etykietami co
karta inwestycji, plus wejście w edycję. Jeden zestaw pól, dwie powierzchnie — nie dwa zestawy.

**Contract**: `PropsT = { investment: InvestmentRefT }`. Renderuje `InfoList` z pozycjami Adres /
Telefon / Email / Osoba kontaktowa / Notatki / Opinia / Status (`ContactLink` przy telefonie
i mailu, `STATUS_LABELS` przy statusie, puste pola odfiltrowane — jak na karcie) oraz
`EditInvestmentDialog` z `showLabel`. Kolejność pozycji i etykiety muszą zgadzać się z
`inwestycje/[id]/page.tsx:72-80`.

#### 4. Panel przyjmuje rekord

**File**: `src/components/kosztorys/summary/summary-panel-content.tsx`

**Intent**: Dołożyć zakładkę na koniec paska i wyrenderować ją, gdy rekord dotarł.

**Contract**: Nowy opcjonalny prop `investment?: InvestmentRefT` (opcjonalny z tego samego powodu
co `assets`: `undefined` = ta powierzchnia nie ma inwestycji). `SUMMARY_VIEW_OPTIONS` dostaje
`{ value: 'investment', label: 'Inwestycja' }` **jako ostatnią pozycję**. Wywołanie
`allowedSummaryViews` przekazuje `hasInvestmentInfo: investment !== undefined`. W `SummaryScrollRegion`
dochodzi gałąź `view === 'investment' && investment` renderująca `SummaryInvestmentTab`.

#### 5. Kanał danych: strona → korpus → panel

**Files**: `src/lib/kosztorys/types.ts`, `src/components/kosztorys/editor/kosztorys-editor-body.tsx`,
`src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`

**Intent**: Przepchnąć znaleziony na stronie `InvestmentRefT` do panelu, bez nowego fetcha.

**Contract**: `KosztorysEditorDataT` zyskuje `investment?: InvestmentRefT` z komentarzem w tym samym
duchu co `assets` — `undefined` znaczy „ta powierzchnia nie ma inwestycji" (warsztat szablonów, oba
shares). Korpus destrukturyzuje `investment` obok `assets` (żeby nie wpadło do `...panelData`)
i podaje je `KosztorysTotalsPanel`. Strona dokłada `investment={investment}` do
`KosztorysEditorV2` — rekord pochodzi z `refData.investments.find(...)`, który już tam stoi.

### Success Criteria:

#### Automated Verification:

- Nowy spec DOM zakładki przechodzi: `pnpm exec vitest run src/__tests__/components/kosztorys/summary/tabs/summary-investment-tab.test.tsx`
- Spec panelu potwierdza obie bramki — zakładka obecna dla hosta z rekordem, nieobecna przy
  `preview` i przy braku rekordu: `pnpm exec vitest run src/__tests__/components/kosztorys/summary/summary-panel-content.test.tsx`

#### Manual Verification:

- Zakładka „Inwestycja" stoi jako ostatnia w pasku i pokazuje notatki/zakres prac inwestycji
- „Edytuj inwestycję" otwiera dialog nad panelem, a zapis odświeża wartości w zakładce
- Podgląd inwestora (`/podglad-inwestora/[id]` i `/k/[token]`) nie ma tej zakładki
- Warsztat szablonów nie ma tej zakładki i nic się tam nie wysypuje

---

## Phase 2: „Dokumentacja" przenosi się do zakładki

### Overview

Galeria znika z rzędu narzędzi siatki i pojawia się w zakładce „Inwestycja". `assets` przestaje
być wartością kontekstu edytora, bo po przeprowadzce czyta je już tylko panel.

### Changes Required:

#### 1. Galeria w zakładce

**File**: `src/components/kosztorys/summary/tabs/summary-investment-tab.tsx`

**Intent**: Dołożyć „Dokumentację" do zakładki — ta sama kontrolka co na karcie inwestycji.

**Contract**: `PropsT` zyskuje `assets?: MediaFileT[]`. Gdy `assets` dotarło, zakładka montuje
`InvestmentAssetsControl` (`investmentId={investment.id}`) pod własnym nagłówkiem sekcji.
`undefined` = powierzchnia bez galerii — nie renderuje nic, tak jak dziś bramka w toolbarze.

#### 2. Wyjęcie z toolbara

**File**: `src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx`

**Intent**: Usunąć galerię z rzędu narzędzi siatki. Domyka to otwarty punkt bramki przeglądu
poprzedniej zmiany: „Usuń wszystkie" przestaje być jedyną nieodwracalną akcją wśród odwracalnych
w rzędzie narzędzi.

**Contract**: Znika blok `{assets && <InvestmentAssetsControl … />}` wraz z komentarzem bramki
i importem; `assets` oraz `investmentId` wypadają z destrukturyzacji `useKosztorysEditorContext()`
(o ile nie są czytane przez nic innego w pliku — sprawdzić przed usunięciem `investmentId`).

#### 3. Zwężenie kontraktu kontekstu

**Files**: `src/components/kosztorys/editor/use-kosztorys-editor-context.tsx`,
`src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: `assets` trafia do panelu propsem, więc przestaje być potrzebne w kontekście edytora.
Zostawienie go byłoby martwym polem kontraktu, który czyta cała siatka.

**Contract**: `KosztorysEditorContextT` traci `assets?: MediaFileT[]`; literał `editor={{…}}`
w korpusie traci klucz `assets`; korpus podaje `assets` bezpośrednio `KosztorysTotalsPanel`
(obok `investment` z fazy 1). Gate na typecheck — jeśli `assets` czyta jeszcze jakiś inny konsument
kontekstu, zostaje w kontekście i ten krok odpada.

#### 4. Specy

**Files**: `src/__tests__/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.test.tsx`,
`src/__tests__/components/kosztorys/summary/tabs/summary-investment-tab.test.tsx`

**Intent**: Asercje galerii przenoszą się razem z galerią — z toolbara do zakładki.

**Contract**: Ze specu toolbara znikają helpery `galleryTrigger` / `addTrigger` i przypadki, które
ich używają. Spec zakładki przejmuje pokrycie: przycisk „Dokumentacja" bez licznika przy zerze
plików, z licznikiem powyżej zera, oraz brak galerii, gdy `assets` jest `undefined`. Zachowanie
samej kontrolki jest już pokryte przez `investment-assets-control.test.tsx` — tego nie duplikujemy.

### Success Criteria:

#### Automated Verification:

- Spec zakładki pokrywa trzy stany galerii: `pnpm exec vitest run src/__tests__/components/kosztorys/summary/tabs/summary-investment-tab.test.tsx`
- Spec toolbara przechodzi bez asercji galerii: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.test.tsx`
- Spec kontrolki galerii dalej zielony: `pnpm exec vitest run src/__tests__/components/investments/investment-assets-control.test.tsx`

#### Manual Verification:

- W rzędzie narzędzi siatki nie ma już „Dokumentacji"
- Z zakładki „Inwestycja" da się obejrzeć pliki, dodać nowy i usunąć istniejący
- Karta inwestycji (`/inwestycje/[id]`) ma swoją galerię nietkniętą

---

## Phase 3: Panel na pustym kosztorysie

### Overview

Panel montuje się niezależnie od liczby pozycji, a na pustym kosztorysie startuje zwinięty —
żeby zakładka „Inwestycja" (a z nią Dokumentacja) była osiągalna na świeżej inwestycji, nie
zasłaniając ekranu „Pobierz z arkusza Google…".

### Critical Implementation Details

**Nie nadpisujemy odczytu flagą.** Wymuszenie „zamknięty, gdy pusto" przez nadpisanie wartości
z `usePersistedEnum` zrobiłoby z przełącznika martwy przycisk: kliknięcie zapisałoby `'open'`,
a odczyt i tak zwróciłby `false`. Zamiast tego pusty kosztorys czyta **własny klucz localStorage
z domyślną `'closed'`** — ten sam wzorzec, którym `useSummaryView` rozdziela czytanie właściciela
od czytania klienta. Otwarcie panelu na pustym kosztorysie jest wtedy normalne i trwałe, a wybór
zapamiętany dla kosztorysu z pozycjami nie decyduje o pierwszym ekranie nowej inwestycji.

### Changes Required:

#### 1. Dwa klucze stanu otwarcia

**File**: `src/components/kosztorys/summary/hooks/use-totals-panel-open.ts`

**Intent**: Pusty kosztorys ma własną preferencję otwarcia, domyślnie zwiniętą.

**Contract**: `useTotalsPanelOpen(hasRows = true)`. `hasRows === false` czyta klucz
`'table-columns:kosztorys-totals-open-empty'` z fallbackiem `'closed'`; `true` zachowuje dzisiejszy
klucz i fallback `'open'`. Zapis idzie do tego klucza, który był czytany — obie preferencje żyją
obok siebie. Komentarz w pliku ma tłumaczyć **dlaczego dwa klucze, a nie flaga** (patrz wyżej).

#### 2. Montowanie i przełączniki

**Files**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`,
`src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx`,
`src/components/kosztorys/summary/kosztorys-totals-panel.tsx`,
`src/components/kosztorys/summary/kosztorys-totals-panel-toggle.tsx`

**Intent**: Panel i przełącznik właściciela przestają zależeć od liczby pozycji; oba muszą czytać
ten sam stan, więc obu trzeba podać `hasRows`. Podgląd klienta zostaje bez zmian.

**Contract**:
- `kosztorys-editor-body.tsx:532` — znika bramka `subtotals.length > 0 &&`; komentarz nad
  montowaniem opisuje nowy układ (zwinięty na pustym, własny klucz), a nie stary powód.
- `KosztorysTotalsPanel` i `KosztorysTotalsPanelToggle` przyjmują `hasRows?: boolean` i przekazują
  je do `useTotalsPanelOpen`.
- Toolbar (`:45`) traci `disabled={subtotals.length === 0}` i podaje `hasRows={subtotals.length > 0}`.
- Nagłówek podglądu klienta (`kosztorys-editor-body.tsx:389`) **zachowuje** `disabled` — klient nie
  ma zakładki „Inwestycja", więc pusty kosztorys nie daje mu tam nic do otwarcia. Komentarz przy
  tej linii ma to powiedzieć wprost, żeby nie wyglądała na przeoczenie.
- `KosztorysTotalsPanelToggle`: `disabled` zostaje jako prop (używa go podgląd), ale jego komentarz
  o „pustym kosztorysie, gdzie korpus nie montuje panelu" przestaje być prawdą dla edytora —
  poprawić.

### Success Criteria:

#### Automated Verification:

- Nowy spec DOM hooka stanu otwarcia: pusty kosztorys startuje zwinięty mimo zapisanego `'open'`,
  a otwarcie na pustym nie zmienia stanu kosztorysu z pozycjami —
  `pnpm exec vitest run src/__tests__/components/kosztorys/summary/hooks/use-totals-panel-open.test.tsx`
- Spec toolbara potwierdza, że przełącznik „Podsumowanie" nie jest `disabled` przy zerowej liczbie
  pozycji: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.test.tsx`

#### Manual Verification:

- Inwestycja bez kosztorysu: panel zamontowany, ale zwinięty; `EmptyState` z „Pobierz z arkusza
  Google…" w pełni widoczny i klikalny
- Na tej samej inwestycji kliknięcie „Podsumowanie" otwiera panel, a zakładka „Inwestycja" ma pełną
  treść wraz z Dokumentacją
- Powrót na inwestycję z kosztorysem otwiera panel zgodnie z wcześniejszą preferencją (nie została
  nadpisana przez otwarcie na pustym)
- Podgląd inwestora dla pustego kosztorysu: przełącznik dalej nieaktywny, bez zmian względem dziś

---

## Testing Strategy

Warstwa DOM (`*.test.tsx`, projekt `dom`) obsługuje całość — ryzyka są renderowe: obecność zakładki
pod dwiema bramkami, przeniesiona kontrolka, stan zwinięcia przy pustym zbiorze. Nic tu nie
przekracza granicy klient → akcja serwerowa → baza, więc Playwright nie ma czego dołożyć, a warstwa
node nie widzi renderu.

### Unit / DOM Tests:

- `allowedSummaryViews` z nowym sygnałem — przypadki `preview` i braku rekordu
- Zakładka: komplet pól, puste pola odfiltrowane, wejście w dialog edycji
- Zakładka: trzy stany galerii (brak, zero plików, n plików)
- `useTotalsPanelOpen`: rozdział dwóch kluczy i dwóch wartości domyślnych

### Manual Testing Steps:

1. Świeża inwestycja bez kosztorysu → edytor v2: `EmptyState` widoczny, panel zwinięty
2. Otworzyć panel → zakładka „Inwestycja" → wgrać plik → podejrzeć → usunąć
3. Inwestycja z kosztorysem: zakładka pokazuje notatki; „Edytuj inwestycję" zapisuje i odświeża
4. Podgląd inwestora obu wejść: pięć zakładek, brak „Inwestycji"
5. Warsztat szablonów: brak zakładki, brak błędów

## Whole-tree Gate

- Typy: `pnpm typecheck`
- Lint: `pnpm lint`
- Pełny zestaw: `pnpm test`
- Build: `pnpm build`

## References

- Bramka przeglądu poprzedniej zmiany (otwarty punkt o „Usuń wszystkie"):
  `context/changes/2026-09-22-kosztorys-editor-assets/review-gate.md`
- Wzorzec dwóch kluczy localStorage: `src/components/kosztorys/summary/hooks/use-summary-view.ts:16`
- Zestaw pól inwestycji: `src/app/(frontend)/inwestycje/[id]/page.tsx:72-80`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Zakładka „Inwestycja"

#### Automated

- [x] 1.1 Spec DOM zakładki przechodzi
- [x] 1.2 Spec panelu potwierdza obie bramki widoczności

### Phase 2: „Dokumentacja" przenosi się do zakładki

#### Automated

- [x] 2.1 Spec zakładki pokrywa trzy stany galerii
- [x] 2.2 Spec toolbara przechodzi bez asercji galerii
- [x] 2.3 Spec kontrolki galerii dalej zielony

### Phase 3: Panel na pustym kosztorysie

#### Automated

- [x] 3.1 Spec DOM hooka stanu otwarcia — dwa klucze, dwie wartości domyślne
- [x] 3.2 Spec toolbara — przełącznik aktywny przy zerowej liczbie pozycji
