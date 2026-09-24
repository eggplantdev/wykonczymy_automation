# Wydruk oferty — utwardzenie spike'u

## Overview

Spike „Wygeneruj ofertę w PDF" działa i jest zbudowany. Ten change go **nie rozbudowuje** — zamyka
to, co riserczy pokazały jako złe albo niezdecydowane: trzy błędy liczbowe w dokumencie wręczanym
klientowi, brak zamka ujawniania na nowej powierzchni renderu, dwa rozjazdy między ekranem a
papierem, i zerowe pokrycie testami.

## Current State Analysis

Trzy pliki: `src/lib/kosztorys/build-offer-print-html.ts` (nieśledzony),
`src/components/kosztorys/editor/actions/offer-print-action.tsx` (nieśledzony),
`src/components/kosztorys/editor/toolbar/menus/kosztorys-investor-menu.tsx` (zmodyfikowany).

Co spike zrobił dobrze i co zostaje bez zmian: czyta zapisaną konfigurację podglądu zamiast
wymyślać własny filtr, drukuje `rows` a nie `viewRows`, filtruje pozycje przez
`applyRowConditions` + `clientConditionIds`, liczy figurę ofertową `rowPlannedNetForView`
(arkuszowe `S = N×Q − N×Q×R`), otwiera popup synchronicznie z kliknięciem i czeka na logo przed
`print()`. Cały układ wydruku — szyny sekcji, pasma, model `border-collapse: separate`,
`zloty()` bez groszy — jest zatwierdzony przez właściciela i nietykalny.

Defekty (wszystkie zweryfikowane w kodzie, nie z raportu agenta):

1. **Wydruk liczy sumy po swojemu.** Akumulatory `sectionNet` / `totalNet`
   (`build-offer-print-html.ts:243-245`) to czwarte niezależne zwinięcie
   `Σ rowPlannedNetForView(row, 'client')` — obok `sectionSubtotalsForView`, `columnTotalsForRows`
   i memo `plannedNet` w edytorze. Edytor ma tę kwotę policzoną i zapamiętaną
   (`use-kosztorys-editor.ts:651-663`) i to ona renderuje się w podglądzie klienta jako wiersz
   „Razem" (`kosztorys-editor-body.tsx:229`). Dwie implementacje tej samej kwoty to ryzyko #1
   z `test-plan.md:52`.
2. **Σ(drukowanych wierszy) ≠ drukowana Σ.** `zloty` (`:27`) zaokrągla każdy wiersz do pełnych
   złotych, sumy zaokrąglają nieokrojony akumulator. Siatka ma tę samą własność (komórki i „Razem"
   idą przez `formatNet` do groszy), więc po przejściu sum na figury edytora różnica zostaje —
   jest wtedy cechą prezentacji, nie rozjazdem papieru z aplikacją. Komentarz przy `zloty`
   (`:21-26`) twierdzi przeciwnie i idzie do poprawy.
3. **`colspan="0"`.** `closeSection` (`:223`) emituje `columns.length - 1`; `description` jest w
   `PREVIEW_VISIBLE_COLUMNS`, więc da się je ukryć z dialogu.
4. **Zero zamka ujawniania.** `OFFER_COLUMNS` (`:146-187`) to trzecia, ręczna allowlista, której
   nie sprawdza nic — ani `assertDisclosurePair` (`column-selection.ts:40`), ani żaden test.
   `note` („komentarz", wewnętrzny z decyzji właściciela 2026-07-20) i kolumny stawki podwykonawcy
   są jedną linią od druku.
5. **`remaining` widoczne na ekranie, nieobecne na papierze** — jest w `OFFER_VISIBLE_COLUMNS`
   (`client-view-settings.ts:27-34`), nie ma wpisu w `OFFER_COLUMNS`.
6. **Tryb SETTLEMENT.** Akcja woła `clientViewSettingsForMode(config)`
   (`offer-print-action.tsx:62`), więc przy zapisanym trybie SETTLEMENT nakłada settlementowy zbiór
   ukryć na ofertowy zestaw kolumn i drukuje po cichu to, co przeżyje.

**Skreślone po weryfikacji:** „wydruk zawyża ofertę o cały rabat globalny". Porównanie szło
z `laborCostsNet` (`doneNet − globalDiscountNet`), figurą **rozliczeniową** stojącą na pracach
wykonanych; wydruk sumuje **przedmiar**. Powierzchnią, którą papier ma odtwarzać, jest „Razem"
w podglądzie klienta, czyli `columnTotals.get('plannedNet')` — a rabat globalny z założenia nie
wchodzi do tej kolumny (`column-totals.ts:30-33`: nie jest figurą per wiersz, schodzi raz w panelu
rozliczeniowym). Wydruk zgadza się z tą kolumną co do złotówki i nic tu nie jest do odjęcia.

## Desired End State

Menu „Inwestor" → „Wygeneruj ofertę w PDF" drukuje dokument, którego każda kwota zgadza się
z panelem i z linkiem klienta, którego kolumny nie mogą wyjść poza `PREVIEW_VISIBLE_COLUMNS`
bez wywalenia testu, i który pokazuje dokładnie to, co widać w podglądzie ofertowym.

## What We're NOT Doing

- **Wykres kołowy udziału sekcji.** Jest w stopce arkusza, nie ma go w wydruku; osobna robota.
- **Telefon / e-mail / adres inwestycji w nagłówku.** Wymagałoby nowych pól na inwestycji.
- **Ekstrakcja wspólnej powłoki wydruku.** Trzeci wywołujący `openPrintWindow`, ale oferta ma
  pasma sekcji, sumy sekcji i szyny, a transfery płaską tabelę — wspólny builder wyszedłby
  parametryzowany pod jednego konsumenta. Duplikat szkieletu doctype zostaje świadomie.
- **Przepięcie kolumn pod `selectV2Columns`.** Zwraca deskryptory siatki z rendererami React;
  wydruk potrzebuje stringa HTML, więc i tak powstałaby warstwa tłumacząca.
- **`zloty()` do `format.ts`** ani zmiana precyzji żywego podglądu klienta. Arkusz właściciela
  drukuje ofertę bez groszy i to jest referencja dla papieru.
- **Etykiety z `COLUMN_LABELS`.** „Cena j.m." / „Wartość netto" to nazwy z arkusza ofertowego;
  `COLUMN_LABELS` opisuje siatkę właściciela („Cena j.m. netto", „Wartość przedmiaru netto").
- **Bramka roli na pozycji menu.** Sąsiednie pozycje mają `useMayServeTheClient()`, ta nie —
  nie wiem, czy to niedopatrzenie czy decyzja; zgodnie z regułą nie zmieniam tego, co użytkownik
  MOŻE zrobić, bez potwierdzenia. Trafia do manualnych checków jako pytanie.
- **Puste sekcje z `0 zł`.** Arkusz je drukuje, aplikacja wywala przez `hideEmptyRows`. Zgodność
  z aplikacją bije zgodność z arkuszem — podgląd i papier mają pokazywać to samo.
- **E2E.** Odroczone do `e2e-backlog` (Faza 4).

## Implementation Approach

Trzy fazy kodu, każda z własnym specem, plus faza zapisu. Kolejność jest podyktowana tym, że
Faza 1 zmienia sygnaturę `OfferPrintArgsT` (dochodzą gotowe sumy), a Faza 2 opiera się na liście
kolumn, którą Faza 3 rozszerza.

**Reguła nadrzędna dla całego changeʼu: wydruk niczego nie wylicza.** Wartość wiersza zostaje przy
tej samej funkcji, którą woła komórka siatki, a każda suma przychodzi gotowa z edytora. Wydruk jest
formatowaniem, nie kalkulatorem.

---

## Phase 1: Wydruk nic nie liczy

### Overview

Wydruk traci własną arytmetykę. Wartości wierszy zostają przy wspólnej funkcji, którą woła komórka
siatki; obie sumy — sekcji i główna — przychodzą gotowe z edytora, tymi samymi, które widzi klient
w podglądzie.

### Changes Required:

#### 1. Sumy przychodzą z edytora, nie z akumulatora

**Files**: `src/lib/kosztorys/build-offer-print-html.ts`,
`src/components/kosztorys/editor/actions/offer-print-action.tsx`

**Intent**: `sectionNet` / `totalNet` liczą po raz czwarty kwotę, którą edytor ma zapamiętaną
i renderuje klientowi. Dopóki wydruk ma własną pętlę, papier i ekran mogą się rozjechać po każdej
zmianie reguły wyceny — ryzyko #1 z `test-plan.md:52`.

**Contract**: `OfferPrintArgsT` zyskuje `totalNet: number` oraz
`sectionNetById: ReadonlyMap<string, number>`; obie pętle akumulujące znikają. Akcja podaje
`columnTotals.get('plannedNet')` i `sectionColumnTotals` → `.get('plannedNet')`, oba prosto
z `useKosztorysEditorContext()` (wystawione na `:1262-1263`). Gdy mapa nie ma wpisu dla sekcji,
wiersz sumy sekcji nie powstaje — brak figury jest uczciwszy niż wydrukowane `0 zł`.

**Dlaczego to bezpieczne mimo filtra pozycji**: `columnTotals` liczy się na pełnym zbiorze wierszy,
a jedyny warunek, który wydruk nakłada, to `client-empty` — pozycja pusta na obu osiach, z definicji
wnosząca zero do obu sum (`registry.ts:145`). Filtr nie rusza kwoty, więc suma z pełnego zbioru jest
sumą tego, co wydrukowano.

**Czego to NIE zmienia**: `cell` dla `plannedNet` i `price` dalej wołają
`rowPlannedNetForView(row, 'client')` / `viewPrice(row, 'client')` — te same wywołania, które robi
komórka siatki (`kosztorys-v2-columns.tsx:331`). Jedna funkcja, dwa miejsca wywołania, ta sama
liczba; pośrednik czytający to przez deskryptory kolumn nic by nie dołożył.

#### 2. `colspan` nie schodzi poniżej 1

**File**: `src/lib/kosztorys/build-offer-print-html.ts`

**Intent**: Przy ukrytym `description` wiersz sumy sekcji emituje `colspan="0"` — nieprawidłowy
HTML, przeglądarka rozjeżdża tabelę.

**Contract**: `closeSection` liczy `Math.max(1, columns.length - 1)`. Gdy `columns.length === 1`,
etykieta „Razem — <sekcja>" i kwota lądują w jednej komórce zamiast w dwóch.

#### 3. Komentarz przy `zloty` przestaje kłamać

**File**: `src/lib/kosztorys/build-offer-print-html.ts:21-26`

**Intent**: Twierdzi, że suma jest sumą zaokrąglonych wierszy. Nie jest i po tej fazie tym bardziej
nie będzie — suma to figura aplikacji sformatowana bez groszy, więc dodanie kolumny na kartce może
dać różnicę rzędu kilku złotych. To świadomy wybór (zgodność z aplikacją bije zgodność kolumny)
i komentarz ma go nazwać.

#### 4. Spec

**File**: `src/__tests__/lib/kosztorys/build-offer-print-html.test.ts` (nowy)

**Intent**: Zamrozić powyższe oraz mechanikę dokumentu, wzorem
`src/__tests__/lib/transfers/build-transfers-print-html.test.ts` — celowane asercje na stringu,
bez snapshotów (`test-plan.md` §7 `:179` je wyklucza).

**Contract**: projekt `node`. Wiersze z `row()` i `CTX` z
`src/__tests__/lib/kosztorys/row-conditions/fixtures.ts:23-50`. Wyrocznia dla sum **nie jest
liczona ręcznie** — jest nią `columnTotalsForRows` na tych samych wierszach, bo to dokładnie
kontrakt tej fazy: papier drukuje figurę aplikacji. Przypadki: suma główna == `columnTotalsForRows`
→ `plannedNet`, suma sekcji == jej wpis w mapie, sekcja bez wpisu nie dostaje wiersza sumy,
`colspan ≥ 1` przy jednej kolumnie, pozycja pusta na obu osiach odfiltrowana przy `hideEmptyRows`
nie zmienia sumy, wolny tekst i nazwa inwestycji nie otwierają znacznika, brak pozycji → sam
nagłówek, ukryty `plannedNet` zabiera wszystkie sumy.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/build-offer-print-html.test.ts` przechodzi
- W `build-offer-print-html.ts` nie ma już `+=` na kwocie

#### Manual Verification:

- „Razem — <sekcja>" na wydruku == wiersz sumy sekcji w podglądzie klienta, kosztorys po kosztorysie
- „Razem netto" na wydruku == „Razem" pod kolumną „Wartość netto przedmiar" w podglądzie klienta

---

## Phase 2: Zamek ujawniania

### Overview

Wydruk to nowa powierzchnia renderu, a w tej aplikacji cały reżim ujawniania jest warstwą renderu
(payload podglądu świadomie niczego nie odcina — `preview-kosztorys.ts:25-30`). Ta faza daje
wydrukowi odpowiednik obu połów zamka.

### Changes Required:

#### 1. Sufit kolumn

**File**: `src/lib/kosztorys/build-offer-print-html.ts`

**Intent**: Dopisanie kolumny do `OFFER_COLUMNS` ma być niemożliwe bez przejścia przez ten sam
sufit, co siatka. Dziś `note`, `priceMode` i cztery kolumny stawek per-plan są jedną linią od
wydrukowania się klientowi, i nic tego nie zauważy.

**Contract**: przy budowie listy `OFFER_COLUMNS` jest filtrowana przez
`PREVIEW_VISIBLE_COLUMNS.has(key)` — zawodzi zamknięty tak samo jak `sanitizeClientViewVariant`.
Plan cenowy zostaje literałem `'client'`, ale przestaje być powtarzany w pięciu miejscach:
`cell` dostaje `view` jako argument z jednego wywołania, więc nie da się zmienić go częściowo.

#### 2. Spec sufitu

**File**: `src/__tests__/lib/kosztorys/build-offer-print-html.test.ts`

**Intent**: Asercja, którą widać przy przeglądaniu diffa dodającego kolumnę.

**Contract**: `describe('sufit ujawniania')` — każdy klucz `OFFER_COLUMNS` należy do
`PREVIEW_VISIBLE_COLUMNS`; `note` i przykładowa kolumna stawki podwykonawcy nie wychodzą
w HTML-u nawet wpisane wprost do listy. Wzorzec: `preview-columns.test.ts:139-176`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/build-offer-print-html.test.ts` przechodzi

#### Manual Verification:

- Brak — faza jest w całości zamknięta testem

---

## Phase 3: Papier pokazuje to, co ekran

### Overview

Dwa rozjazdy między podglądem a wydrukiem, oba po stronie wyboru kolumn.

### Changes Required:

#### 1. `remaining`

**File**: `src/lib/kosztorys/build-offer-print-html.ts`

**Intent**: „Pozostało" jest w `OFFER_VISIBLE_COLUMNS`, więc właściciel może je zostawić
widoczne w podglądzie — i wtedy dostaje je na ekranie, a nie dostaje na papierze.

**Contract**: wpis w `OFFER_COLUMNS` po `plannedNet`, liczony `rowRemainingForView(row, stages,
'client')` (`settlement-rows.ts:58`), z etykietą i szerokością kolumny jak `plannedNet`.
Colgroup rośnie o jedną klasę.

#### 2. Wydruk czyta wariant OFFER

**File**: `src/components/kosztorys/editor/actions/offer-print-action.tsx`

**Intent**: Pozycja menu nazywa się „Wygeneruj ofertę", więc dokument jest ofertą niezależnie od
tego, w jakim trybie stoi podgląd. Dziś przy trybie SETTLEMENT nakładamy settlementowy zbiór
ukryć na ofertowy zestaw kolumn i drukujemy po cichu to, co przeżyje — czyli zbiór, którego
właściciel nigdy nie widział.

**Contract**: zamiast `clientViewSettingsForMode(config)` akcja czyta `config.variants.OFFER`.
Nie dodaje żadnego wyboru w UI — wariant zostaje trwałym stanem inwestycji
(`context/archive/2026-08-19-kosztorys-client-view-offer-settlement-variants/change.md`), wydruk
po prostu zawsze mówi o ofercie.

#### 3. Jeden odczyt ustawień

**File**: `src/components/kosztorys/editor/actions/offer-print-action.tsx`

**Intent**: `useInvestorActions` już pobiera i cachuje `clientView` (`investor-actions.tsx:39`,
`:54-62`); pozycja menu strzela drugim, niezależnym `readClientViewSettings`.

**Contract**: pozycja bierze konfigurację z tego samego źródła co reszta menu „Inwestor".
Popup nadal otwiera się synchronicznie z kliknięciem — jeśli konfiguracja jest już w ręku,
dokument wypełnia się od razu, bez `.then`; gałąź błędu odczytu zostaje.

#### 4. Spec DOM

**File**: `src/__tests__/components/kosztorys/editor/actions/offer-print-action.test.tsx` (nowy)

**Intent**: Trzy gałęzie, których spec node nie zobaczy, a które są jedynym, co użytkownik
odczuje przy awarii.

**Contract**: projekt `dom`. Pozycja renderowana bare w wymuszonym `<DropdownMenu open>`, klik po
roli `menuitem` (wzorzec `sort-menu-items.test.tsx:13-40`). Kontekst edytora przez
`vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', …)`;
`readClientViewSettings` to moduł `'use server'`, więc `stubServerActions` podmienia go na
rzucającą atrapę i spec **musi** go zamockować. Przypadki: pusta rozpiska → toast „Brak pozycji
do wydruku" i zero `window.open`; `window.open` zwraca `null` (jsdom robi to z pudełka) → toast
o zablokowanym oknie; odrzucony odczyt ustawień → okno zamknięte i toast.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/actions/offer-print-action.test.tsx` przechodzi
- `pnpm exec vitest run src/__tests__/lib/kosztorys/build-offer-print-html.test.ts` przechodzi

#### Manual Verification:

- Podgląd w trybie ROZLICZENIE, wydruk nadal daje dokument ofertowy z kolumnami wariantu OFERTA
- Odznaczenie „Pozostało" w ustawieniach podglądu zabiera kolumnę i z ekranu, i z wydruku
- MANAGER (nie OWNER) — czy „Wygeneruj ofertę w PDF" ma być dla niego dostępne? Sąsiednie pozycje
  menu są wygaszane przez `useMayServeTheClient()`, ta nie. **Pytanie do właściciela**, nie defekt.

---

## Phase 4: Zapis

### Overview

Change odwraca zapisaną decyzję właściciela i zaciąga dług E2E. Obie rzeczy mają zostać na piśmie.

### Changes Required:

#### 1. Odwrócenie cięcia S-14

**File**: `context/foundation/roadmap.md`

**Intent**: S-14 `kosztorys-export` został ścięty w całości 2026-08-15 — CSV (EX-400) **i PDF**
(EX-666) — bo „żywy link bije plik". Ten change wraca po PDF. Bez zapisu następny czytelnik
tombstone'u zobaczy sprzeczność między roadmapą a kodem.

**Contract**: dopisek w bloku `#### kosztorys-export — CUT (S-14 tombstone)` — data, zakres
(sam wydruk oferty z kosztorysu, nie CSV i nie arkusz z formułami), i że wymóg przeniesiony przy
cięciu („ukryta kolumna musi być **fizycznie nieobecna** w pliku") jest spełniony przez Fazę 2,
nie przypadkiem. Tombstone zostaje tombstone'em — nie wskrzeszamy slice'a.

#### 2. Nota w PRD

**File**: `context/foundation/prd.md`

**Intent**: Amendment z 2026-08-15 (`:98-102`) mówi, że print/PDF jest cięty. Nie jest już prawdą
w całości.

**Contract**: jedno zdanie przy tym amendmencie — wydruk oferty z kosztorysu wrócił, reszta
eksportu (CSV, arkusz z formułami) pozostaje ścięta; FR-008 nadal niezaimplementowane.

#### 3. Dług E2E

**Intent**: Slice na poziomie przeglądarki jest winien E2E; „odroczone" w commicie tego nie
spłaca (`AGENTS.md` → Testing).

**Contract**: issue w Linear, projekt „Wykonczymy", label `e2e-backlog`: realny popup + realny
`print()` przez granicę klient→akcja serwerowa→DB, wzorem `e2e/transfer-sort-and-print.spec.ts:38-42`,
`:82-84` (neutralizacja `window.print` przez `addInitScript`, `waitForEvent('popup')`, odczyt
`<thead>/<tbody>` printoutu) plus połowa ujawniająca z `e2e/client-share.spec.ts:151-200`.
Dyspozycja testowa zapisana w issue. Jeśli Linear MCP nie odpowiada — wpis w `roadmap.md` i
jawna informacja, że filing się nie udał.

### Success Criteria:

#### Automated Verification:

- Brak — faza jest wyłącznie prozą i wpisem w trackerze

#### Manual Verification:

- Blok S-14 w `roadmap.md` czyta się spójnie z tym, co robi kod
- Issue `e2e-backlog` istnieje i ma zapisaną dyspozycję testową

---

## Testing Strategy

### Unit (node):

`build-offer-print-html.test.ts` — sumy (główna i sekcji czytane z `columnTotalsForRows` jako
wyroczni), struktura (`colspan`, pasmo raz na sekcję, kolejność sekcji, sumy znikają z ukrytym
`plannedNet`), filtr pozycji, escaping, sufit ujawniania. Pokrywa 5 z 7 linii ryzyka
z `test-plan.md`.

### Component (dom):

`offer-print-action.test.tsx` — pusta rozpiska, zablokowany popup, odrzucony odczyt ustawień.

### E2E:

Odroczone do `e2e-backlog` (Faza 4). Jedyne genuine przejście klient→serwer→DB to sam popup;
audyt z 2026-09-15 (`:40-47`) każe spychać resztę w dół, a pełny przebieg kosztuje ~1 h.

### Manual:

Zebrane w rejestrze `context/foundation/manual-checks.md` na ostatniej fazie.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

## References

- Riserczy: `context/changes/2026-09-23-wydruk-oferty/research.md`
- Wzorzec specu wydruku: `src/__tests__/lib/transfers/build-transfers-print-html.test.ts`
- Wzorzec specu ujawniania: `src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts:139-176`
- Wzorzec specu pozycji menu Radix: `src/__tests__/components/kosztorys/editor/grid/sort-menu-items.test.tsx:13-40`
- Najbliższy tematycznie spec figur: `src/__tests__/lib/kosztorys/client-document-subtotals.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Wydruk nic nie liczy

#### Automated

- [x] 1.1 `build-offer-print-html.test.ts` przechodzi — 6ee38caf

### Phase 2: Zamek ujawniania

#### Automated

- [x] 2.1 `build-offer-print-html.test.ts` przechodzi (blok „sufit ujawniania") — a48376dc

### Phase 3: Papier pokazuje to, co ekran

#### Automated

- [x] 3.1 `offer-print-action.test.tsx` przechodzi — 52a4cb45
- [x] 3.2 `build-offer-print-html.test.ts` przechodzi (kolumna „Pozostało") — 52a4cb45

### Phase 4: Zapis

#### Automated

- [x] 4.1 brak — faza prozą i wpisem w trackerze
