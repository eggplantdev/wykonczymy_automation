# Zdjęcia i pliki inwestycji w edytorze kosztorysu v2 — plan wdrożenia

## Overview

Galeria „Zdjęcia i pliki" ma być dostępna z poziomu edytora kosztorysu v2 — podgląd, dodawanie
i usuwanie, **identycznie** jak z karty inwestycji. Realizujemy to przez wydzielenie **jednej**
kontrolki (`InvestmentAssetsControl`), której używają obie powierzchnie, i doklejenie jednego
zapytania do istniejącego fan-outu trasy.

## Current State Analysis

- `InvestmentAssets` (`src/components/investments/investment-assets.tsx:35`) to `<section>` +
  `<h2>Zdjęcia i pliki</h2>` + jeden przycisk + **trzy dialogi, które montuje sam**
  (`InvoicePreviewButton`, `InvoiceUploadDialog`, `ConfirmDialog`). Stan trzymają
  `useInvestmentAssetsUpload` i `useMediaRemoval`; `isBusy = isUploading || isRemoving` odbiera
  drugiej stronie afordancję na czas własnego zapisu.
- Edytor renderuje toolbar w **jednym** miejscu (`kosztorys-editor-body.tsx:386`), i tylko gdy
  `preview` jest fałszywe. Toolbar nie bierze dziś żadnych propsów.
- `fetchInvestmentAssets` (`src/lib/queries/investment-assets.ts:14`) jest już cache'owane tagami
  `[investments, investment:<id>]`. Trasa `kosztorys_v2` ma `Promise.all` z sześcioma zapytaniami
  (`page.tsx:58-70`).
- **Warunek konieczny, już w drzewie roboczym (niezacommitowany):** odwrócenie pustego stanu —
  przy zerze plików sekcja renderuje `MediaUploadButton` zamiast `null`. Bez tego edytor przy
  inwestycji bez zdjęć nie miałby czego pokazać.

### Key Discoveries:

- Kompozyt jest przenośny bez zmian — dialogi montuje sam, więc **nie potrzebuje opakowania**
  w kolejny dialog (`research.md` → „Galeria jako komponent").
- **Menu odpada.** `DropdownMenuContent` odmontowuje dzieci przy zamknięciu — to jest wprost powód
  istnienia `KosztorysActionsProvider` (`kosztorys-actions-context.tsx:33`).
- **Żaden nowy fetch nie jest potrzebny i nie mógłby być `'use server'`** — moduł
  `fetchInvestmentAssets` wołają komponenty serwerowe, dlatego istnieje osobny
  `src/lib/queries/investment-asset-ids.ts:7-14`.
- Bramkowanie: `assets === undefined` znaczy „ta powierzchnia nie ma galerii", `[]` znaczy „pusta
  galeria" — ten sam kształt co `payoutTransactions` / `hasSheet` / `workers`
  (`src/lib/kosztorys/types.ts:153,164,173`).
- Body edytora **nie remountuje się** po uploadzie: `treeToken` to `tree.revision` + liczba pozycji
  (`kosztorys-editor-v2.tsx:32`), a zdjęcie nie rusza żadnego z nich.

## Desired End State

W toolbarze edytora kosztorysu v2 (trasa `/inwestycje/[id]/kosztorys_v2`) stoi **ta sama** kontrolka
co na karcie inwestycji: „Zdjęcia i pliki (N)" gdy pliki są, „Dodaj pliki" gdy ich nie ma. Otwiera
ten sam podgląd z tymi samymi akcjami (dodaj / usuń / usuń wszystkie), z tą samą blokadą `isBusy`.
Licznik i lista są świeże po każdym zapisie.

W **warsztacie szablonów** (`/szablony/[id]`) kontrolki nie ma. W **podglądzie klienta**
(`(share)/k/[token]`, `(share)/podglad-inwestora/[id]`) toolbar w ogóle się nie renderuje.

Weryfikacja: na karcie inwestycji i w edytorze przycisk wygląda i zachowuje się tak samo, bo to
jeden plik; `assets` nie dociera do żadnej powierzchni share'a.

## What We're NOT Doing

- **Nie ruszamy `KosztorysEditorProvider`** — AGENTS.md zakazuje dokładania do niego (regresja perf
  EX-496). Prop idzie do toolbara bezpośrednio.
- **Nie serializujemy `setUploadField` po stronie serwera.** EX-832 zostaje w backlogu; ta zmiana
  dokłada do issue dopisek o trzeciej powierzchni piszącej (decyzja z `change.md`).
- **Nie ruszamy `router.refresh()` w `useMediaUpload`.** Podejrzenie redundancji po EX-597 dotyczy
  **wszystkich** powierzchni medialnych, nie tylko tej — to osobna zmiana.
- **Nie dodajemy miniatur** ani żadnej innej odmiany galerii. „Identycznie" znaczy identycznie.
- Nie cache'ujemy `getKosztorysTree` (osobny, znany koszt trasy).

## Implementation Approach

Trzy fazy, każda samodzielnie zielona:

1. **Wydzielenie kontrolki** — czysty refaktor, zero zmian zachowania na karcie inwestycji.
2. **Podpięcie do edytora** — jedna linia w fan-oucie, jedno pole w typie, dwa propy, jeden render.
3. **Domknięcie dokumentacji** — `manual-checks.md`, dopisek do EX-832.

### Krytyczny szczegół: gdzie stoi bramka

Styl domu w edytorze to `return null` **w samej kontrolce** (`save-template-button.tsx:16`). Tutaj
świadomie od niego odstępujemy: kontrolka jest współdzielona z kartą inwestycji, gdzie `assets` jest
**wymagane** — wpuszczenie do niej `assets?: MediaFileT[] | undefined` osłabiłoby kontrakt tamtej
powierzchni, żeby obsłużyć przypadek, którego tam nie ma. Warunek stoi więc w toolbarze
(`{assets && <InvestmentAssetsControl … />}`). To jest ta sama decyzja co przy `{!readOnly &&
<KosztorysAddMenu />}` linijkę wyżej.

Uwaga do zapisania w kodzie: gwarancja „share nie dostaje `assets`" jest dziś **po stronie danych**
(payload share'a nigdy tego propa nie konstruuje), nie po stronie typu — i to jest mocniejsza połowa
(`lessons.md:497`). Toolbar i tak nie renderuje się pod `preview`.

---

## Phase 1: Wydzielenie `InvestmentAssetsControl`

### Overview

Rozcięcie dzisiejszej sekcji na chrom (zostaje na karcie) i kontrolkę (wędruje do obu powierzchni).
Zero zmian zachowania.

### Changes Required:

#### 1. Nowa kontrolka

**File**: `src/components/investments/investment-assets-control.tsx`

**Intent**: Przenieść tu **całą** dzisiejszą zawartość `InvestmentAssets` poza `<section>`
i `<h2>` — oba hooki, `isBusy`, `openUpload`, `InvoicePreviewButton` / `MediaUploadButton` oraz oba
dialogi. To ma być jedyna implementacja galerii assetów inwestycji.

**Contract**: `InvestmentAssetsControl({ investmentId, assets }: { investmentId: number; assets:
MediaFileT[] })` — **oba wymagane**; kontrolka nie zna pojęcia „brak galerii". Renderuje fragment
(bez własnego `<section>`), z `className="w-fit"` / `h-8 … text-xs` jak dziś, żeby wpasować się
w linię toolbara i nie urosnąć na karcie.

Spinner `isUploading` przy niepustej galerii wisi dziś w nagłówku sekcji
(`investment-assets.tsx:64-66`) — **musi zejść do kontrolki**, inaczej edytor traci jedyny feedback
trwającego uploadu, gdy galeria nie jest pusta. Przy pustej galerii feedback niesie sam
`MediaUploadButton` (`isUploading` → „Przesyłanie…").

Dom kontrolki to `investments/`, nie `media/`: seam `media/` biegnie w jedną stronę, a ta kontrolka
woła akcje inwestycji (`research.md` → Architecture Insights).

#### 2. Karta inwestycji zużywa kontrolkę

**File**: `src/components/investments/investment-assets.tsx`

**Intent**: Zostaje wyłącznie chromem sekcji — `<section>` + `<h2>Zdjęcia i pliki</h2>` +
`<InvestmentAssetsControl {...props} />`. Cała reszta (hooki, stałe `ASSET_REMOVAL_LABELS`, dialogi)
wyprowadzona do kontrolki.

**Contract**: `InvestmentAssetsPropsT` bez zmian (`investmentId`, `assets`) — trasa i dialog
„Edytuj inwestycję" nic o tym refaktorze nie wiedzą.

#### 3. Spec sekcji

**File**: `src/__tests__/components/investments/investment-assets.test.tsx`

**Intent**: Spec dalej montuje `InvestmentAssets` i asertuje to samo zachowanie — to jest dowód, że
refaktor niczego nie zgubił. Poprawić tylko te asercje, które celują w **miejsce** spinnera
(nagłówek → kontrolka), nie w jego istnienie.

**Contract**: 7 istniejących przypadków zostaje, w tym „brak afordancji usuwania w trakcie uploadu"
(kliencka obrona przed wyścigiem `setUploadField`).

### Success Criteria:

#### Automated Verification:

- Spec sekcji przechodzi bez zmian zachowania: `pnpm exec vitest run src/__tests__/components/investments/investment-assets.test.tsx`
- Spec pola w formularzu przechodzi: `pnpm exec vitest run src/__tests__/components/forms/investment-form/investment-assets-field.test.tsx`

#### Manual Verification:

- Karta inwestycji: galeria wygląda i działa dokładnie jak przed refaktorem (podgląd, dodawanie,
  usuwanie jednego, usuwanie wszystkich).
- Przy trwającym uploadzie do niepustej galerii widać spinner.

**Implementation Note**: Po zielonych testach fazy — commit i dalej; ręczna weryfikacja zbiera się
raz, na końcu zmiany, do rejestru `manual-checks.md`.

---

## Phase 2: Podpięcie kontrolki do edytora kosztorysu v2

### Overview

Assety docierają do edytora istniejącym fan-outem trasy i renderują się w prawej grupie toolbara.
Warsztat szablonów i podgląd klienta nic nie dostają.

### Changes Required:

#### 1. Kontrakt danych edytora

**File**: `src/lib/kosztorys/types.ts`

**Intent**: Dołożyć `assets` do `KosztorysEditorDataT` jako **opcjonalne**, z komentarzem
nazywającym, co znaczy jego brak.

**Contract**: `assets?: MediaFileT[]` — `undefined` = „ta powierzchnia nie ma galerii" (warsztat
szablonów, oba share'y), `[]` = „inwestycja nie ma jeszcze plików". Import typu z `@/types/media`.

#### 2. Fan-out trasy

**File**: `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`

**Intent**: Dorzucić `fetchInvestmentAssets(investmentId)` do istniejącego `Promise.all` i przekazać
wynik jako prop `assets` do `KosztorysEditorV2`. Poprawić tekst logu `[PERF] … 6-fetch fan-out`,
który po tej zmianie kłamie.

**Contract**: `Promise.all` rośnie z sześciu do siedmiu pozycji; siódma jest cache'owana tagami
`[investments, investment:<id>]`, więc upload assetu unieważnia dokładnie ją (i tak już
unieważniał trasę przez tag `investments`).

#### 3. Przekazanie do toolbara

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: Wyjąć `assets` z propsów i podać toolbarowi razem z `investmentId`. Nic więcej —
**do `KosztorysEditorProvider` to nie wchodzi** (EX-496).

**Contract**: `<KosztorysEditorToolbar investmentId={investmentId} assets={assets} />` w jedynym
miejscu renderu toolbara (`:386`). Gałąź `preview` nietknięta.

#### 4. Render w prawej grupie toolbara

**File**: `src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx`

**Intent**: Toolbar zaczyna brać propsy i renderuje kontrolkę w prawej grupie, obok
`SaveTemplateButton`. Kontrolka nie ma własnej bramki — warunek stoi u wołającego (uzasadnienie
w „Krytyczny szczegół" wyżej; w kodzie wystarczy jedno zdanie, że `undefined` = powierzchnia bez
galerii).

**Contract**: `KosztorysEditorToolbarPropsT = Pick<KosztorysEditorDataT, 'investmentId' | 'assets'>`;
render `{assets && <InvestmentAssetsControl investmentId={investmentId} assets={assets} />}`
w grupie `sm:ml-auto` (`:82-96`). Pozycja: przed `SaveTemplateButton` — „Zapisz szablon" jest
akcją kończącą i zostaje pierwszym elementem od lewej w tej grupie tylko wtedy, gdy w ogóle się
renderuje, a warsztat szablonów jest jedyną powierzchnią, gdzie te dwa mogłyby się spotkać (a tam
`assets` jest `undefined`) — więc konflikt o kolejność nie istnieje.

#### 5. Spec bramki

**File**: `src/__tests__/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.test.tsx`

**Intent**: Ryzyko jest jedno i jest to ryzyko **ujawnienia**: warsztat szablonów pokazuje galerię
ukrytej inwestycji. Spec montuje toolbar dwa razy — z `assets` i bez — i asertuje obecność oraz
nieobecność przycisku. Toolbar nie ma dziś specu na żadnej warstwie, więc ten plik powstaje od zera.

**Contract**: montaż wymaga `KosztorysEditorProvider` z minimalną wartością kontekstu (`search`,
`setSearch`, `view`, `setView`, `subtotals`, `readOnly` + to, czego żądają menu). Pułapki harnessu:
moduły `'use server'` są podmieniane na stuby, które **rzucają** przy wywołaniu — akcje assetów
trzeba `vi.mock`'ować; `matchMedia` / `ResizeObserver` / `scrollIntoView` stubuje już
`src/__tests__/setup/dom.ts`. Rozszerzenie kontekstu o dalsze pola, gdyby menu tego zażądały, jest
częścią tej fazy — nie powód do rezygnacji ze specu.

### Success Criteria:

#### Automated Verification:

- Spec bramki toolbara przechodzi: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.test.tsx`

#### Manual Verification:

- `/inwestycje/<id>/kosztorys_v2`: przycisk „Zdjęcia i pliki (N)" stoi w prawej grupie toolbara;
  otwiera ten sam podgląd co karta inwestycji.
- Inwestycja bez plików: w toolbarze edytora widać „Dodaj pliki"; po wgraniu licznik rośnie bez
  ręcznego odświeżenia, a siatka nie gubi stanu (brak remountu).
- Usunięcie pliku ze stopki podglądu w edytorze znika z karty inwestycji po przejściu na nią.
- `/szablony/<id>`: w toolbarze **nie ma** żadnego przycisku plików.
- `/k/<token>` i `/podglad-inwestora/<id>`: toolbara nie ma w ogóle, więc i galerii.
- Zamknięta („Zakończona") inwestycja: dodawanie plików z edytora dalej działa (akcja świadomie
  omija `investmentAction`).

---

## Phase 3: Domknięcie dokumentacji i backlogu

### Overview

Dwa zapisy, które bez tej fazy zapraszają kogoś do cofnięcia świadomych decyzji.

### Changes Required:

#### 1. Rejestr ręcznych sprawdzeń

**File**: `context/foundation/manual-checks.md`

**Intent**: Przepisać linię 493. Odhaczone dziś zdanie „Inwestycja bez plików nie pokazuje w sekcji
żadnego przycisku — dodać można tylko z »Edytuj inwestycję«" jest po odwróceniu pustego stanu
**nieprawdziwe**; zostawione zaprasza kogoś do „naprawienia" tego z powrotem.

**Contract**: Nowe brzmienie opisuje stan docelowy: przy zerze plików sekcja (i toolbar edytora)
pokazują przycisk „Dodaj pliki". Plus dopisanie sprawdzeń ręcznych z Fazy 2 do rejestru.

#### 2. EX-832

**File**: (Linear, projekt „Wykonczymy")

**Intent**: Dopisać do issue komentarz, że doszła **trzecia** powierzchnia pisząca w `assets`
(toolbar edytora kosztorysu v2) i że jest to ta, która z definicji bywa otwarta równolegle z kartą
inwestycji w drugiej zakładce — czyli wyścig `setUploadField` przesuwa się z „teoretyczny"
w „osiągalny normalną pracą". Skutek pozostaje cichy: osierocony plik w Blobie. Issue zostaje
w backlogu.

**Contract**: Komentarz do EX-832, bez zmiany priorytetu i bez zmiany statusu. Jeśli Linear MCP jest
nieosiągalny — powiedzieć to wprost i nie udawać, że dopisek powstał.

#### 3. Identyfikator zmiany

**File**: `context/changes/2026-09-22-kosztorys-editor-assets/change.md`

**Intent**: `status: planned` → `implemented` na koniec, `updated` na dzień domknięcia.

**Contract**: frontmatter zmiany.

### Success Criteria:

#### Automated Verification:

- Faza jest czysto dokumentacyjna — nie ma dla niej sprawdzenia automatycznego. Pokrycie daje bramka
  całego drzewa poniżej.

#### Manual Verification:

- `manual-checks.md` nie zawiera już zdania opisującego skasowany pusty stan.
- EX-832 ma komentarz o trzeciej powierzchni (albo jest jawnie odnotowane, że MCP był nieosiągalny).

---

## Testing Strategy

### Unit Tests:

Brak nowych. Cała logika, jaka tu jest, siedzi w hookach, które mają już pokrycie
(`use-media-removal`, akcje w `investment-assets.db.test.ts`).

### Component/DOM Tests:

- `investment-assets.test.tsx` (istniejący) — dowód, że wydzielenie kontrolki nie zmieniło
  zachowania karty; w szczególności interlock `isBusy`.
- `kosztorys-editor-toolbar.test.tsx` (nowy) — bramka `assets`: jest / nie ma.

### E2E:

**Nie w tej zmianie.** Ryzyko, które E2E by tu domykało — upload przez granicę klient → akcja → DB →
rewalidacja — jest już pokryte przez `investment-assets.db.test.ts` po stronie zapisu i przez spec
DOM po stronie afordancji. Dochodzi wyłącznie **drugie miejsce renderu tego samego komponentu**,
a to jest dokładnie ten rodzaj ryzyka, który warstwa DOM łapie taniej. Nie odkładamy nic do backlogu
E2E.

## Performance Considerations

Siódme zapytanie w fan-oucie nie jest realnym kosztem: leci równolegle, jest cache'owane, a trasa
i tak przelicza się w całości przy każdym unieważnieniu tagu `investments` — bo `getKosztorysTree`
**nie jest cache'owane wcale**, a `fetchReferenceData` wisi m.in. na tym samym tagu. Upload assetu
już dziś, z karty inwestycji, kosztuje pełny render tej trasy przy następnym wejściu.

Znane, świadomie nietknięte: `router.refresh()` w `useMediaUpload` jest po EX-597 prawdopodobnie
drugą rundą renderu — osobna zmiana, wszystkie powierzchnie naraz.

## Migration Notes

Brak. Zero zmian w schemacie, zero migracji, zero danych do przeniesienia.

## Whole-tree Gate

Uruchomić **raz**, po ostatniej fazie:

- Typy: `pnpm typecheck`
- Lint: `pnpm lint`
- Pełny zestaw: `pnpm test`
- Build: `pnpm build`

## References

- Research: `context/changes/2026-09-22-kosztorys-editor-assets/research.md`
- Decyzje właściciela: `context/changes/2026-09-22-kosztorys-editor-assets/change.md`
- Bliźniak bez chromu sekcji: `src/components/transfers/invoice-cell.tsx:18`
- Wzorzec bramki w toolbarze: `src/components/kosztorys/editor/toolbar/save-template-button.tsx:16`
- Poprzednie decyzje o galerii: `context/archive/2026-09-21-investment-assets-dialog/change.md:16-31`
- EX-597 (render trasy przy unieważnieniu tagu): `context/foundation/lessons.md:652-672`

## Odstępstwa od planu (spisane w bramce przeglądu, 2026-09-22)

Bloki faz zostają nienaruszone; poniżej to, czym rzeczywistość różniła się od planu.

1. **Odwrócenie pustego stanu nie było warunkiem wstępnym, tylko częścią tej zmiany.** Plan opisał
   je jako niezacommitowaną pracę leżącą już w drzewie. Na `staging` go nie ma — kasacja
   `if (visibleFiles.length === 0 && !isBusy) return null` wjechała w commicie `495816eb`, który
   zapowiada refaktor bez zmian zachowania. Decyzja jest udokumentowana (research, change.md,
   rejestr sprawdzeń); rozjeżdżał się tylko zapis. To odwraca ustalenie z EX-802 (2026-09-21).
2. **`SaveTemplateButton` już nie istnieje** — skasował go `7e9714ec` („warsztat szablonu zapisuje
   się sam"), zanim ta zmiana ruszyła. Kontrakt pozycji („przed `SaveTemplateButton`") i cytowany
   za nim wzorzec bramki są martwe. Kontrolka stanęła ostatnia w prawej grupie; żywy precedens
   bramki po stronie wywołującego to `{!isWorkshop && <KosztorysViewMenu />}` linijkę wyżej.
3. **Etykieta pustego stanu to „Dodaj zdjęcia lub pliki", nie „Dodaj pliki".** Plan i brief mówią
   inaczej; kod używa istniejącej stałej `INVESTMENT_ASSETS_UPLOAD_TITLE`, wspólnej dla trzech
   powierzchni — i to jest właściwy wybór.
4. **Faza 1 dowiozła pięć plików, nie trzy.** Ponad plan wyszedł prymityw przycisku pickera
   (dedup trzech powierzchni) i przepisanie pola w „Edytuj inwestycję". Bramka przeglądu przeniosła
   ten prymityw do warstwy prymitywów jako `src/components/ui/upload-button.tsx` (`UploadButton`) —
   nie zna domeny, a żaden z jego konsumentów nie mieszkał w `components/media/`.

## Progress

> Konwencja: `- [ ]` pending, `- [x]` done. Dopisz ` — <commit sha>`, gdy krok wyląduje. Nie zmieniaj tytułów kroków.

### Phase 1: Wydzielenie `InvestmentAssetsControl`

#### Automated

- [x] 1.1 Spec sekcji przechodzi bez zmian zachowania — 495816eb
- [x] 1.2 Spec pola w formularzu przechodzi — 495816eb

### Phase 2: Podpięcie kontrolki do edytora kosztorysu v2

#### Automated

- [x] 2.1 Spec bramki toolbara przechodzi — b1be6168

### Phase 3: Domknięcie dokumentacji i backlogu

#### Automated

- [x] 3.1 Brak sprawdzenia automatycznego (faza dokumentacyjna) — pokrycie daje bramka całego drzewa
