# Autozapis szablonu w warsztacie — plan wdrożenia

## Overview

Warsztat szablonu (`/szablony/[id]`) renderuje ten sam edytor co inwestycja i ma dwa różne modele
trwałości naraz: komórki zapisują się same do inwestycji-warsztatu, a treść szablonu trafia do
biblioteki (`kosztorys_presets.payload`) dopiero po kliknięciu „Zapisz szablon". Ta zmiana likwiduje
drugi model: szablon zapisuje się sam, przycisk znika, a warsztat przestaje oferować pola, których
szablon i tak nie przenosi.

## Current State Analysis

Trzy plany trwałości na jednym ekranie (research §1):

| Plan                                                               | Kiedy zapisywany               |
| ------------------------------------------------------------------ | ------------------------------ |
| Stan siatki (`useState`)                                           | natychmiast, optymistycznie    |
| Drzewo warsztatu (`kosztorys_items` inwestycji `status='szablon'`) | automatycznie, 500 ms debounce |
| `kosztorys_presets.payload`                                        | **tylko po kliknięciu**        |

Warsztat jest zwykłą inwestycją o statusie `szablon`, celowo niezablokowaną
(`src/lib/constants/investment-lock.ts:26`) — stąd niespójność: połowa ekranu zachowuje się jak
inwestycja, bo **jest** inwestycją.

Ograniczenia, które kształtują rozwiązanie (pełne uzasadnienie w `research.md`):

- **Nie ma klienckiego punktu, przez który przechodzi wszystko** — `use-debounced-save.ts:36` łapie
  ~4 z ~36 ścieżek zapisu w drzewo. Serwerowy punkt istnieje: `investmentAction`.
- **Licznik `revision` nie jest sygnałem „brudne"** — jest ślepy na etapy, dodawanie pozycji,
  ustawienia i hurtowe zastąpienie. Bramka auto-snapshotu oparta na nim nie nadaje się do skopiowania.
- **Jeden mirror to ~250 KB ruchu do Neona** (≈125 KB odczyt drzewa + ≈125 KB zapis całego jsonb
  - ~25 KB świeżego TOAST-u; kolumna `payload` ma `attstorage='x'`, więc HOT update jest niemożliwy).
    Bez dławika wklejenie 50 komórek to ~12,5 MB na jedno Ctrl-V.
- **`updateTag('presets')` z trasy `/szablony/[id]` jest zakazane** — ta trasa czyta
  `getWorkshopView` + całe drzewo + `getWorkCatalogue()` + `getPresets()`, więc wymuszony re-render
  przywraca dokładnie ten koszt, który zdjął EX-597 (`src/lib/cache/tags.ts:68`).
- **Dziś nic nie chroni payloadu przed wyścigiem** — `serializeKosztorysAsPreset` czyta na własnym
  połączeniu, `updatePresetPayload` pisze osobnym stwierdzeniem bez predykatu wersji, a
  `lockInvestmentForReplace` bierze dziś wyłącznie `replaceTreeWithSnapshot`.

## Desired End State

Praca w warsztacie trafia do biblioteki sama, bez żadnego gestu. Wyjście z ekranu, zamknięcie karty
i przełączenie na inny szablon nie gubią niczego. Warsztat pokazuje wyłącznie to, co szablon
naprawdę niesie, więc nie da się wpisać pola, które po cichu wyparuje. W menu Opcje nie ma pozycji,
która mogłaby skasować otwarty szablon.

Weryfikacja: edytuj cenę w warsztacie, odczekaj ~15 s, otwórz ten szablon w drugiej karcie — nowa
cena tam jest. Bez żadnego kliknięcia.

### Key Discoveries

- `investmentAction` (`src/lib/actions/investment-action.ts:27`) sam deklaruje się jako jedyny
  chokepoint i **już robi SELECT po statusie inwestycji** (`isInvestmentLocked`/`lockStatusFor`,
  `src/lib/db/investment-lock.ts:26,41`) — dołożenie `template_preset_id` do tych zapytań kosztuje
  zero dodatkowych round tripów.
- `PREVIEW_VISIBLE_COLUMNS` (`src/lib/kosztorys/column-config.ts:215`) + gałąź podglądu w
  `selectV2Columns` (`src/components/kosztorys/editor/grid/column-selection.ts:65-67`) to **gotowy
  wzorzec sufitu dozwolonych kolumn** — zamknięta lista warsztatu jest jego bliźniakiem.
- `templatePresetId` jest dziś **tylko w kontekście** (`use-kosztorys-editor-context.tsx:21`), a hook
  składający kolumny (`use-kosztorys-editor.ts:505`) go nie widzi — trzeba go doprowadzić do wejść hooka.
- `buildV2Grid` jest wołany **w trakcie renderu, bez memoizacji** (`use-kosztorys-editor.ts:505`), więc
  nowa opcja musi być stabilna między renderami.
- `reloadFromPresetAction` zastępuje drzewo **nie ruszając** `template_preset_id`
  (`reload-from-preset-dialog.tsx:56`) — pod autozapisem to ścieżka kasująca otwarty szablon.
- `saveWorkshopPresetAction` (`src/lib/actions/kosztorys-presets.ts:198`) ma już strażnika wskaźnika
  (`:206`) — akcja przeżywa zmianę, zmienia się tylko jej wyzwalacz.
- `kosztorys_presets` **nie ma `updated_at`**, a `updatePresetPayload` nadpisuje `created_by` przy
  każdym zapisie (`src/lib/db/presets.ts:77-90`).

## What We're NOT Doing

- **Nie robimy warsztatów per szablon.** „Jeden warsztat na całą instalację" zostaje w mocy
  (`context/archive/2026-09-14-szablony-crud/change.md:20`).
- **Nie dodajemy wskaźnika zapisu ani statusu „Zapisano 10:42"** — ani w warsztacie, ani na
  inwestycji. Sukces zostaje niemy, tak jak dziś na inwestycji.
- **Nie zagęszczamy punktów przywracania** — zostają co 10 minut. Świadomie przyjęte okno.
- **Nie przestajemy wycinać przedmiaru, rabatów i etapów** przy serializacji szablonu. Wyjątkiem
  jest wyłącznie komentarz.
- **Nie ruszamy edytora inwestycji** poza jednym rzeczownikiem w etykietach i zmianą nazwy
  „Zapisz jako szablon…" → „Zapisz jako nowy szablon…".
- **Nie dodajemy `beforeunload`** — dopchnięcie przy odmontowaniu i przed eksmisją wystarcza,
  a strażnik nawigacji to osobna funkcja o własnym koszcie UX.

## Implementation Approach

Mirror po stronie serwera, w `investmentAction`, dławiony znacznikiem czasu w bazie — bo to jedyny
punkt, przez który przechodzi każdy z ~36 sposobów zmiany drzewa. Dławik załatwia częstotliwość
(wklejka 50 komórek = jeden mirror), ale **z definicji gubi ostatnią zmianę**, więc obok niego stoi
dopchnięcie: po dłuższej bezczynności, przy opuszczeniu ekranu i przed eksmisją warsztatu.

Dopchnięcie jest **bezwarunkowe** — nie sprawdza, czy coś się zmieniło. Rozważona alternatywa
(flaga `mirror_dirty` na warsztacie) wymagałaby dodatkowego zapisu przy każdej akcji, żeby uniknąć
kilku nadmiarowych mirrorów na sesję. Nieopłacalne.

## Critical Implementation Details

**Kolejność dopchnięcia i dławika.** Bezczynność musi być **dłuższa** niż dławik (15 s vs 10 s),
inaczej naturalne pauzy w pisaniu przebiją dławik i wrócimy do mirrora per-zmiana. Podczas pracy
rządzi dławik; dopchnięcie strzela raz, gdy naprawdę przestajesz.

**Odczyt i zapis muszą być w jednej transakcji pod `lockInvestmentForReplace`.** Dziś
`serializeKosztorysAsPreset` czyta na własnym połączeniu, a `updatePresetPayload` pisze osobno —
mirror, który przeczytał drzewo przed twoją edycją, a commituje po niej, cofa ją w szablonie,
podczas gdy warsztat nadal ją pokazuje, i **nic tego nie wykryje**. Strażnik wskaźnika
(`template_preset_id`) czytany jest w **tej samej** transakcji, nie przed nią.

**Wyścig międzyścieżkowy przy eksmisji.** `openPresetInWorkshopAction` zamienia drzewo, a _potem_
przesuwa wskaźnik. Dopchnięcie przed eksmisją musi być **pierwszym** krokiem tej akcji, wewnątrz
tego samego zamka co wymiana drzewa — inaczej mirror w locie przeczyta drzewo nowego szablonu
i wstempluje je w wiersz starego.

## Phase 1: Warstwa danych — dławik, data modyfikacji, transakcyjny zapis

### Overview

Migracja i warstwa `src/lib/db`: miejsce na znacznik dławika i datę modyfikacji, oraz zapis payloadu,
który nie nadpisuje autora i daje się wywołać wewnątrz cudzej transakcji.

### Changes Required

#### 1. Migracja

**File**: `src/migrations/20260922_0_preset_autosave.ts` (+ wpis w `src/migrations/index.ts`)

**Intent**: Dołożyć na `kosztorys_presets` znacznik ostatniego automatycznego zapisu (dławik) i datę
modyfikacji, żeby lista szablonów mogła pokazać, że szablon żyje.

**Contract**: `kosztorys_presets` zyskuje `mirrored_at timestamptz NULL` i `updated_at timestamptz
NULL`. Obie nullowalne — istniejące wiersze nie mają czego wpisać, a `NULL` w `mirrored_at` znaczy
„nigdy nie lustrzony", czyli dławik przepuszcza pierwszy zapis. **Pisana ręcznie**, wzorem
`src/migrations/20260914_2_snapshot_template_preset.ts` (`pnpm migrate:create` emituje fantomowy
drift — patrz `AGENTS.md`).

#### 2. Zapis payloadu

**File**: `src/lib/db/presets.ts`

**Intent**: `updatePresetPayload` przestaje nadpisywać `created_by` (dziś „kto założył szablon" cicho
zmienia się w „kto ostatnio stuknął w klawisz"), stempluje `updated_at` i `mirrored_at`, i przyjmuje
egzekutor, żeby dało się ją wywołać wewnątrz transakcji mirrora.

**Contract**: sygnatura przyjmuje `DbExecutorT` zamiast pozyskiwać własny; `SET payload,
schema_version, updated_at = now(), mirrored_at = now()` — bez `created_by`. Zachowane zachowanie
„nie wskrzesza szablonu skasowanego w trakcie" (`WHERE id`, zero wierszy = brak wskrzeszenia) —
istniejący test na to robi się ostrzejszy, nie zbędny.

#### 3. Odczyt dławika

**File**: `src/lib/db/presets.ts`

**Intent**: Jedna funkcja odpowiadająca „czy od ostatniego automatycznego zapisu tego szablonu
minęło więcej niż N sekund".

**Contract**: predykat liczony **w bazie** (`mirrored_at IS NULL OR mirrored_at < now() - interval`),
nie w Node — zegar aplikacji na serverless nie jest wspólny między instancjami. Interwał jako
nazwana stała, nie literał w zapytaniu.

#### 4. Warsztat w zapytaniu o blokadę

**File**: `src/lib/db/investment-lock.ts`

**Intent**: `isInvestmentLocked` i `lockStatusFor` zaczynają zwracać `templatePresetId` obok statusu,
żeby `investmentAction` wiedział, czy pisze do warsztatu, **bez dodatkowego round tripu**.

**Contract**: oba `SELECT` dobierają `i.template_preset_id`; typy zwrotne zyskują
`templatePresetId: number | null`. `isInvestmentLocked` zwraca dziś `boolean` — zmienia się w obiekt,
więc jego trzy wywołania trzeba przepiąć.

### Success Criteria

#### Automated Verification

- Migracja stosuje się na czystej bazie testowej: `pnpm db:import:test && pnpm exec vitest run --project node src/__tests__/lib/db/presets.test.ts`
- Spec warstwy danych przechodzi, w tym „nie wskrzesza szablonu skasowanego w trakcie": `pnpm exec vitest run src/__tests__/lib/db/presets.test.ts`
- Nowy spec: zapis payloadu **nie zmienia** `created_by` i **zmienia** `updated_at`
- Nowy spec: predykat dławika przepuszcza przy `mirrored_at IS NULL` i odmawia tuż po zapisie

#### Manual Verification

- Lista szablonów nadal się renderuje i sortuje po dotychczasowej kolumnie (brak regresji przed Fazą 6)

---

## Phase 2: Mirror serwerowy w `investmentAction`

### Overview

Każda udana mutacja drzewa warsztatu przepisuje szablon do biblioteki — o ile dławik przepuści.

### Changes Required

#### 1. Mirror

**File**: `src/lib/actions/mirror-workshop-preset.ts` (nowy)

**Intent**: Jedna funkcja: „jeśli ta inwestycja jest warsztatem trzymającym szablon i dławik
przepuszcza — zserializuj drzewo i przepisz je do szablonu, w jednej transakcji".

**Contract**: przyjmuje `{ db, investmentId, templatePresetId, force }`. `force` pomija dławik (używa
go dopchnięcie z Fazy 3). Całość wewnątrz `lockInvestmentForReplace(investmentId)`
(`src/lib/db/lock-investment.ts:16`) — ten sam wzorzec, którym repo serializuje wymianę drzewa.
Wskaźnik czytany **wewnątrz** transakcji i porównywany z `templatePresetId`; rozjazd = ciche
odstąpienie (nie błąd — to normalny wyścig z przełączeniem warsztatu). Nigdy nie rzuca: mirror to
efekt uboczny udanej mutacji, więc jego awaria nie może wywrócić zapisu, który już się udał.

#### 2. Podpięcie do chokepointu

**File**: `src/lib/actions/investment-action.ts`

**Intent**: Po **udanym** handlerze wywołać mirror, jeśli rozstrzygnięty wcześniej
`templatePresetId` nie jest pusty.

**Contract**: mirror leci po `handler(...)` i tylko dla `result.success === true`. `templatePresetId`
pochodzi z gałęzi, która już zapytała o blokadę (Faza 1, punkt 4) — obie gałęzie (`investmentId`
i `kind`/`id`) muszą go podać. Wynik akcji nie zmienia kształtu.

#### 3. Cache

**File**: `src/lib/actions/investment-action.ts` (przekazanie opcji) oraz wywołania akcji kosztorysowych

**Intent**: Unieważnić `presets`, ale **nigdy** nie wymuszać re-renderu z trasy `/szablony/[id]`.

**Contract**: mirror dokłada `presets` do unieważnianych tagów wyłącznie przez gałąź
`deferRefresh: true` (→ `EXPIRE_NEXT`). Zero tagów też jest złe — dodanie sekcji w warsztacie
naprawdę zmienia to, co ma pokazać picker szablonów.

### Success Criteria

#### Automated Verification

- Nowy spec DB: mutacja pozycji w warsztacie przepisuje treść do szablonu (odczyt payloadu **z bazy**, nie z wyniku akcji)
- Nowy spec DB: druga mutacja w oknie dławika **nie** rusza `mirrored_at`
- Nowy spec DB: mutacja na zwykłej inwestycji nie dotyka żadnego szablonu
- Nowy spec DB: gdy wskaźnik warsztatu wskazuje inny szablon niż w chwili startu, mirror nic nie pisze
- Istniejące specy akcji kosztorysowych przechodzą bez zmian kształtu wyniku

#### Manual Verification

- Zmiana ceny w warsztacie pojawia się w szablonie otwartym w drugiej karcie po odświeżeniu
- Wklejenie ~50 komórek nie powoduje widocznego zamulenia edytora

---

## Phase 3: Domknięcie ogona i zniknięcie przycisku

### Overview

Dławik z definicji gubi ostatnią zmianę. Trzy dopchnięcia to zamykają, a przycisk „Zapisz szablon"
przestaje być potrzebny.

### Changes Required

#### 1. Dopchnięcie bezwarunkowe

**File**: `src/lib/actions/kosztorys-presets.ts`

**Intent**: `saveWorkshopPresetAction` przestaje serializować samodzielnie i staje się cienkim
wywołaniem mirrora z `force: true`. Strażnik wskaźnika zostaje — przenosi się do wnętrza transakcji
mirrora.

**Contract**: ta sama sygnatura i ten sam `ActionResultT`, żeby dopchnięcia mogły ją wołać
fire-and-forget. `deferRefresh: true` (dziś jest bez — patrz `kosztorys-presets.ts:224`).

#### 2. Dopchnięcie po bezczynności i przy odmontowaniu

**File**: `src/components/kosztorys/editor/hooks/use-workshop-mirror-flush.ts` (nowy leaf hook pod `editor/hooks/`)

**Intent**: Po ~15 s bez żadnej zmiany oraz przy odmontowaniu edytora wywołać dopchnięcie.

**Contract**: aktywny **tylko** gdy `templatePresetId != null`. Bezczynność liczona od ostatniej
zmiany, nie od montowania. Interwał bezczynności musi być dłuższy niż dławik, inaczej pauzy
w pisaniu przebiją dławik (patrz Critical Implementation Details). Ryzykiem tego hooka jest cykl
życia (nakładające się wywołania, odmontowanie w locie), więc spec idzie do projektu `dom` przez
`renderHook`, wzorem `use-kosztorys-settings.test.tsx`.

#### 3. Dopchnięcie przed eksmisją

**File**: `src/lib/actions/kosztorys-presets.ts` (`openPresetInWorkshopAction`)

**Intent**: Zanim warsztat zostanie zmieciony treścią innego szablonu, przepisać to, co w nim jest,
do szablonu, który dotąd trzymał.

**Contract**: mirror z `force: true` jako **pierwszy** krok akcji, wewnątrz tego samego zamka co
`reloadInvestmentFromPreset`, przed wymianą drzewa i przed `setWorkshopPreset`. Istniejący punkt
ochronny („Przed wczytaniem: B") zostaje bez zmian.

#### 4. Przycisk znika

**File**: `src/components/kosztorys/editor/toolbar/save-template-button.tsx` (kasacja),
`src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx:83`

**Intent**: Usunąć przycisk i jego import. Nic nie staje w jego miejsce.

**Contract**: po kasacji `templatePresetId` nie ma już konsumenta w toolbarze — zostaje w kontekście,
bo Faza 4 i 5 go potrzebują. Kasację bramkować typecheckiem, nie grepem.

### Success Criteria

#### Automated Verification

- Spec DB: pojedyncza zmiana, po której nic już nie następuje, trafia do szablonu po dopchnięciu
- Spec DB: `openPresetInWorkshopAction` zostawia w szablonie A treść, którą warsztat miał przed przełączeniem
- Spec `dom` (`renderHook`): dopchnięcie strzela raz po bezczynności i raz przy odmontowaniu, i nie strzela wcale bez `templatePresetId`
- Przepisany `src/__tests__/lib/actions/kosztorys-presets.test.ts:333` — strażnik wskaźnika działa z poziomu mirrora
- Brak odwołań do `SaveTemplateButton`: `pnpm typecheck`

#### Manual Verification

- Zmień jedną cenę, nie rób nic przez ~20 s, odśwież listę szablonów — zmiana jest w szablonie
- Zmień cenę i natychmiast przejdź na inny ekran — zmiana jest w szablonie
- Otwórz szablon B z listy, mając niezapisane zmiany w A — A ma je w bibliotece, a „Wersje" A mają punkt ochronny

---

## Phase 4: Warsztat przestaje oferować to, czego nie przenosi

### Overview

Szablon niesie sekcje, prace, jednostki, ceny i współczynniki. Reszta siatki nie ma się w warsztacie
budować — nie „być domyślnie schowana" i nie „być readonly".

### Changes Required

#### 1. Zamknięta lista kolumn

**File**: `src/lib/kosztorys/column-config.ts`

**Intent**: Stała mówiąca, które kolumny w ogóle istnieją w warsztacie.

**Contract**: `WARSZTAT_VISIBLE_COLUMNS: ReadonlySet<string>` obok `PREVIEW_VISIBLE_COLUMNS`
(`:215`), zawierająca `sectionName`, `description`, `unit`, `price`, `priceGross`, `priceMode`,
`note`. Dokumentacja przy stałej mówi **dlaczego** reszta jest nieobecna (szablon jej nie niesie),
żeby kolumna dodana później została opt-inowana świadomie.

#### 2. Sufit przy składaniu siatki

**File**: `src/components/kosztorys/editor/grid/column-selection.ts`

**Intent**: Nałożyć listę jako sufit — w siatce i w pickerze.

**Contract**: gałąź w predykacie `keep` (`:63-77`), bliźniacza do podglądu (`:65-67`), plus ten sam
warunek w `selectV2ToggleItems` (`:84`, wzorzec wczesnego wyjścia na `:92`). **Sufit, nie zapisany
ptaszek** — `table-columns:kosztorys` jest globalny na przeglądarkę
(`use-hidden-columns.ts:12-16`), więc zapis przeciekłby na wszystkie kosztorysy.
Sprawdzić `columnBaseRanks` (`column-selection.ts:132`), który liczy się z **niefiltrowanego**
złożenia — okno kolejności kolumn nie może wyliczać rang dla kolumn, których nie ma.

#### 3. Flaga warsztatu w hooku

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`,
`src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: Doprowadzić `templatePresetId` (albo wyprowadzony z niego boolean) do wejść
`useKosztorysEditor`, bo dziś siedzi tylko w kontekście, a to hook składa kolumny.

**Contract**: nowe wejście hooka, przekazane z `kosztorys-editor-body.tsx:109-120`; wchodzi do
`columnOpts` (`:468-504`). `buildV2Grid` jest wołany bez memoizacji (`:505`), więc wartość musi być
stabilna między renderami — boolean, nie nowy `Set` per render.

#### 4. Picker kolumn i menu „Dodaj"

**File**: `src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx`,
`src/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu.tsx`

**Intent**: W warsztacie nie pokazywać pickera kolumn (nie ma czym sterować) ani pozycji „Etap — …"
(szablon nie niesie etapów).

**Contract**: `KosztorysViewMenu` (toolbar `:95`) niewidoczne w warsztacie; pozycje etapów
(`kosztorys-add-menu.tsx:88-93`) też. Menu nie ma dziś bramkowania per pozycja poza `!readOnly` —
dokładamy jeden warunek, nie mechanizm. Rozważyć oś „Warstwy" w menu widoku (`kosztorys-view-menu.tsx:128-134`),
która w warsztacie też nie ma sensu; precedens warunkowego zdjęcia całej sekcji jest tam na `:83`.

#### 5. Komentarz przenosi się do szablonu

**File**: `src/lib/kosztorys/serialize-preset.ts`

**Intent**: Przestać zerować `note`. Uwaga o samej pracy („cena zawiera transport") przenosi się na
każdą kolejną budowę; przedmiar, rabat i etapy nie.

**Contract**: `note` wypada z listy zerowanych pól (`:14-21`). Reszta bez zmian. Komentarz zacznie
też trafiać na inwestycje zasiane z szablonu — to jest zamierzone. Istniejące szablony nie mają
żadnych komentarzy (dotąd były zerowane przy każdym zapisie), więc nie ma czego migrować.

### Success Criteria

#### Automated Verification

- Nowy spec: `selectV2Columns` w trybie warsztatu zwraca wyłącznie kolumny z `WARSZTAT_VISIBLE_COLUMNS`
- Nowy spec: globalna preferencja ukrycia **nie** odsłania kolumny spoza listy warsztatu
- Nowy spec: `selectV2ToggleItems` w trybie warsztatu jest pusty
- Nowy spec: `serializeKosztorysAsPreset` zachowuje `note` i nadal zeruje przedmiar, rabat i etapy
- Przepisane specy siatki i serializacji przechodzą

#### Manual Verification

- Warsztat pokazuje pięć kolumn plus komentarz; nie ma przycisku „Kolumny"
- Menu „Dodaj" w warsztacie nie oferuje etapu
- Komentarz wpisany w warsztacie jest widoczny po ponownym otwarciu szablonu
- Kosztorys na inwestycji ma komplet kolumn bez zmian

---

## Phase 5: Porządki w menu Opcje

### Overview

Menu mówi „kosztorys" na ekranie, na którym jest szablon, i zawiera pozycję, która pod autozapisem
kasuje otwarty szablon.

### Changes Required

#### 1. „Wczytaj szablon…" przełącza warsztat

**File**: `src/components/kosztorys/editor/actions/reload-preset-action.tsx`,
`src/components/kosztorys/editor/dialogs/reload-from-preset-dialog.tsx`

**Intent**: W warsztacie ta pozycja ma znaczyć „przełącz warsztat na tamten szablon" — ta sama
ścieżka co kliknięcie szablonu na liście — zamiast zastępować treść bez ruszania wskaźnika.

**Contract**: w warsztacie okno woła `openPresetInWorkshopAction` (przesuwa wskaźnik, robi punkt
ochronny, dopchnięcie z Fazy 3 chroni bieżący szablon) zamiast `reloadFromPresetAction`; etykieta
„Przełącz na inny szablon…", a opis w oknie mówi, że bieżący szablon zostaje w bibliotece — zamiast
dzisiejszego „cała rozpiska zostanie zastąpiona". Na inwestycji bez zmian.

#### 2. Rzeczownik edytora

**File**: `src/components/kosztorys/editor/**` (etykiety), źródło rzeczownika w kontekście edytora

**Intent**: Edytor dostaje wyraz, którym o sobie mówi — „kosztorys" na inwestycji, „szablon"
w warsztacie — zamiast generycznych etykiet, które psułyby oba ekrany naraz.

**Contract**: dotyczy `clear-kosztorys-action.tsx:15,16`, `clear-kosztorys-dialog.tsx:45,46`,
`kosztorys-actions-menu.tsx:98`, `kosztorys-editor-body.tsx:449` („Kosztorys jest pusty"),
`catalogue-compare-action.tsx:16`, `catalogue-compare-dialog.tsx:90`. Zdania, które mówią
o inwestycjach, a nie tylko zawierają rzeczownik (`save-preset-dialog.tsx:53`), przepisać w całości —
podmiana jednego słowa ich nie naprawia.

#### 3. Rzeczy bez adresata

**File**: `src/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.tsx`

**Intent**: Szablon nie ma inwestora, więc podgląd inwestora i udostępnianie linku nie mają
w warsztacie sensu.

**Contract**: `KosztorysInvestorMenu` (`:50`) niewidoczne w warsztacie. Sekcja „Arkusz Google" już
się nie pokazuje (bramkowana `hasSheet`, a szablon nie ma podpiętego arkusza) — potwierdzić, nie
dokładać warunku.

#### 4. Zmiana nazwy

**File**: `src/components/kosztorys/editor/actions/save-preset-action.tsx:39`,
`src/components/kosztorys/editor/dialogs/save-preset-dialog.tsx:52`

**Intent**: Po zniknięciu przycisku „Zapisz jako szablon…" zostaje jedynym słowem „Zapisz" na
ekranie, który zapisuje się sam.

**Contract**: „Zapisz jako nowy szablon…" w etykiecie i tytule okna, na obu ekranach. Sprawdzić
E2E `e2e/kosztorys-presets.spec.ts:129`, który celuje w tę etykietę.

### Success Criteria

#### Automated Verification

- Przepisany `e2e/kosztorys-presets.spec.ts:129` celuje w nową etykietę (spec **napisany**, nie uruchamiany — patrz Testing Strategy)
- Nowy spec DB: przełączenie szablonu z poziomu menu w warsztacie przesuwa wskaźnik i zostawia punkt ochronny
- Nowy spec `dom`: w warsztacie menu Opcje nie renderuje pozycji inwestora

#### Manual Verification

- Menu Opcje w warsztacie mówi wszędzie „szablon", nigdzie „kosztorys"
- „Przełącz na inny szablon…" przełącza warsztat, a poprzedni szablon ma w bibliotece swoją ostatnią treść
- Menu Opcje na inwestycji wygląda jak dotąd, poza nową nazwą „Zapisz jako nowy szablon…"

---

## Phase 6: Lista szablonów pokazuje, że szablon żyje

### Overview

Bez tego lista nigdy nie drgnie, choć szablon zmieniał się tysiąc razy.

### Changes Required

#### 1. Kolumna „Zmieniono"

**File**: `src/lib/db/presets.ts` (odczyt listy, dziś sortowanie po `created_at` na `:181`),
komponent listy szablonów

**Intent**: Pokazać datę modyfikacji obok daty utworzenia i sortować po niej domyślnie — bo to ona
mówi, co się dzieje.

**Contract**: `updated_at` dołącza do wiersza listy; sortowanie domyślne przechodzi na
`updated_at DESC NULLS LAST` (istniejące szablony mają `NULL`, więc nie wyparowują z widoku).
Kolumna „Utworzono" zostaje.

### Success Criteria

#### Automated Verification

- Nowy spec DB: lista zwraca `updated_at` i sortuje po nim, a szablon bez `updated_at` nie wypada z wyniku

#### Manual Verification

- Edycja w warsztacie przesuwa szablon na górę listy po odświeżeniu

---

## Testing Strategy

Warstwa dobierana pod ryzyko, nie pod plik (`context/foundation/test-plan.md`).

### Unit / DB (`node`)

Ciężar leży tutaj, bo całe ryzyko tej zmiany jest serwerowe: **czy treść naprawdę wylądowała
w trzecim planie trwałości**. `context/foundation/lessons.md:1762` — „liczba na ekranie to nie
zapis" — więc każda asercja czyta payload **z bazy**, nigdy z wyniku akcji.

- dławik: przepuszcza / odmawia / przepuszcza po wygaśnięciu
- mirror: pisze, nie pisze przy cudzym wskaźniku, nie rusza zwykłej inwestycji
- transakcja: mirror nie zostawia payloadu z drzewa sprzed równoległej edycji
- dopchnięcie: pojedyncza zmiana trafia do szablonu; eksmisja nie gubi treści
- serializacja: komentarz zostaje, reszta nadal wycinana
- `created_by` niezmienione, `updated_at` zmienione

### DOM (`dom`)

- `use-workshop-mirror-flush` przez `renderHook` — ryzykiem jest cykl życia
- menu Opcje w warsztacie nie renderuje pozycji inwestora
- warsztat nie renderuje przycisku „Kolumny"

### E2E

Spec przełączenia szablonu w warsztacie **jest do napisania**, ale nie jest uruchamiany w ramach tej
zmiany (pełny przebieg to ~godzina). Jeśli nie powstanie przy wdrożeniu — odkłada się go jako issue
z etykietą `e2e-backlog` w projekcie „Wykonczymy", zgodnie z bramką z `AGENTS.md`.

### Specy do przepisania

- `src/__tests__/lib/actions/kosztorys-presets.test.ts:333,407,417`
- `src/__tests__/lib/db/presets.test.ts:192,207`
- `src/__tests__/lib/db/snapshots.test.ts:180`
- `src/__tests__/lib/db/workshop-investment.test.ts:70`, `src/__tests__/helpers/workshop.ts:13`
- `e2e/kosztorys-presets.spec.ts:129` (etykieta)

### Manual checks do przepisania

`context/foundation/manual-checks.md:554` (otwarty wpis z `empty-preset-create`).

## Performance Considerations

Jeden mirror to ≈250 KB ruchu do Neona i nowy łańcuch TOAST. Dławik 10 s sprowadza wklejkę
w 50 komórek z ~12,5 MB do ~250 KB. Górna granica przy nieprzerwanym pisaniu to ~6 mirrorów na
minutę — rząd wielkości powyżej auto-snapshotu (≤6/h), ale trzy rzędy poniżej wariantu
per-klawisz.

Sprawdzenie dławika kosztuje **zero** dodatkowych round tripów — dokłada się do zapytania
o blokadę, które `investmentAction` już wykonuje.

Najostrzejsza pułapka jest w cache: `updateTag('presets')` z trasy `/szablony/[id]` przywraca koszt
zdjęty przez EX-597 (90–193 ms na zapis, plus trzy odczyty wielkości drzewa). Stąd `deferRefresh`
w Fazie 2.

## Migration Notes

Migracja jest **addytywna** (dwie nullowalne kolumny), więc zgodnie z `AGENTS.md` idzie na produkcję
**przed** wypchnięciem kodu. Stosuje ją człowiek przez `pnpm db:migrate:prod` — nigdy agent.
Pisana ręcznie, wzorem najnowszego pliku w `src/migrations/`.

Istniejące szablony wchodzą z `mirrored_at = NULL` (dławik przepuszcza pierwszy zapis)
i `updated_at = NULL` (sortowanie `NULLS LAST` ich nie gubi). Żadnego backfillu.

## Whole-tree Gate

- Typy: `pnpm typecheck`
- Lint: `pnpm lint`
- Pełny zestaw: `pnpm test`
- Build: `pnpm build`

## References

- Research: `context/changes/2026-09-22-szablon-autosave/research.md`
- Decyzje właściciela: `context/changes/2026-09-22-szablon-autosave/change.md`
- Precedens lustra na warstwie trwałości: `src/hooks/transfers/sync-sheet.ts:10`
- Precedens sufitu kolumn: `src/lib/kosztorys/column-config.ts:215`, `src/components/kosztorys/editor/grid/column-selection.ts:65`
- Reguła EX-597 o `updateTag` w akcji: `src/lib/cache/tags.ts:68`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Warstwa danych — dławik, data modyfikacji, transakcyjny zapis

#### Automated

- [x] 1.1 Migracja stosuje się na czystej bazie testowej
- [x] 1.2 Spec warstwy danych przechodzi, w tym „nie wskrzesza szablonu skasowanego w trakcie"
- [x] 1.3 Zapis payloadu nie zmienia `created_by` i zmienia `updated_at`
- [x] 1.4 Predykat dławika przepuszcza przy `mirrored_at IS NULL` i odmawia tuż po zapisie

### Phase 2: Mirror serwerowy w `investmentAction`

#### Automated

- [x] 2.1 Mutacja pozycji w warsztacie przepisuje treść do szablonu (odczyt z bazy)
- [x] 2.2 Druga mutacja w oknie dławika nie rusza `mirrored_at`
- [x] 2.3 Mutacja na zwykłej inwestycji nie dotyka żadnego szablonu
- [x] 2.4 Mirror nic nie pisze, gdy wskaźnik warsztatu wskazuje inny szablon
- [x] 2.5 Istniejące specy akcji kosztorysowych przechodzą bez zmian kształtu wyniku

### Phase 3: Domknięcie ogona i zniknięcie przycisku

#### Automated

- [x] 3.1 Pojedyncza zmiana, po której nic nie następuje, trafia do szablonu po dopchnięciu
- [x] 3.2 `openPresetInWorkshopAction` zostawia w szablonie A treść sprzed przełączenia
- [x] 3.3 Spec `dom`: dopchnięcie strzela raz po bezczynności i raz przy odmontowaniu, i nie strzela bez `templatePresetId`
- [x] 3.4 Przepisany spec strażnika wskaźnika działa z poziomu mirrora
- [x] 3.5 Brak odwołań do `SaveTemplateButton`

### Phase 4: Warsztat przestaje oferować to, czego nie przenosi

#### Automated

- [x] 4.1 `selectV2Columns` w trybie warsztatu zwraca wyłącznie kolumny z listy warsztatu
- [x] 4.2 Globalna preferencja ukrycia nie odsłania kolumny spoza listy warsztatu
- [x] 4.3 `selectV2ToggleItems` w trybie warsztatu jest pusty
- [x] 4.4 `serializeKosztorysAsPreset` zachowuje `note` i nadal zeruje przedmiar, rabat i etapy
- [x] 4.5 Przepisane specy siatki i serializacji przechodzą

### Phase 5: Porządki w menu Opcje

#### Automated

- [x] 5.1 Przepisany E2E celuje w nową etykietę „Zapisz jako nowy szablon…"
- [x] 5.2 Przełączenie szablonu z menu w warsztacie przesuwa wskaźnik i zostawia punkt ochronny
- [x] 5.3 Spec `dom`: w warsztacie menu Opcje nie renderuje pozycji inwestora

### Phase 6: Lista szablonów pokazuje, że szablon żyje

#### Automated

- [x] 6.1 Lista zwraca `updated_at`, sortuje po nim, a szablon bez `updated_at` nie wypada z wyniku
