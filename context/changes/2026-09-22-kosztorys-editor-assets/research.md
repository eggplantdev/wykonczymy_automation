---
date: 2026-09-22T06:37:31Z
researcher: ex-Plant
git_commit: 211993777e17d04e4edab8312b89b46a54e7e489
branch: empty-preset-create
repository: wykonczymy
topic: 'Zdjęcia i pliki inwestycji dostępne z poziomu edytora kosztorysu v2'
tags: [research, codebase, investment-assets, kosztorys-editor, media, cache]
status: complete
last_updated: 2026-09-22
last_updated_by: ex-Plant
---

# Research: Zdjęcia i pliki inwestycji w edytorze kosztorysu v2

**Date**: 2026-09-22T06:37:31Z
**Researcher**: ex-Plant
**Git Commit**: `21199377`
**Branch**: `empty-preset-create`
**Repository**: wykonczymy

## Research Question

Galeria „Zdjęcia i pliki" żyje dziś tylko na karcie inwestycji i w dialogu „Edytuj inwestycję".
Jak udostępnić ją z poziomu edytora kosztorysu v2 — podgląd, dodawanie i usuwanie, **identycznie**
jak z karty inwestycji?

## Summary

Zmiana jest mała, bo cały flow jest już przenośnym klientem: `InvestmentAssets` to przycisk plus
trzy dialogi, które sam montuje. Wsadzenie go w toolbar edytora nie wymaga ani nowego zapytania,
ani opakowania w dialog, ani ruszania kontekstu edytora.

Research wyciągnął jednak cztery rzeczy, których nie widać z samego kodu galerii:

1. **Zerowy stan sekcji był skasowany świadomą decyzją właściciela** (`b62ad2fb`, `7b5b9e26`) —
   „jedyną drogą jest dialog edycji". Niezacommitowana zmiana w drzewie roboczym tę decyzję
   odwraca i jest **warunkiem koniecznym** dla tej funkcji.
2. **EX-832 jest otwarte i ta zmiana je zaostrza** — `setUploadField` to nieserializowany
   read-modify-write, a jedyną obroną jest kliencki `isBusy` per powierzchnia. Trzecia
   powierzchnia to trzeci pisarz.
3. **Render trasy kosztorys_v2 jest drogi, bo `getKosztorysTree` NIE jest cache'owane w ogóle.**
   Upload unieważnia tag `investments`, co i tak wymusza pełny render trasy — a `useMediaUpload`
   dokłada do tego `router.refresh()`, czyli prawdopodobnie drugi taki render.
4. **Bramkowanie ma w edytorze ustalony styl domu**: kontrolka sama zwraca `null`, jak
   `SaveTemplateButton`. To jedno `if` zamyka naraz warsztat szablonów i podgląd klienta.

## Detailed Findings

### Galeria jako komponent — co dokładnie da się przenieść

`InvestmentAssets` (`src/components/investments/investment-assets.tsx:35`) to `<section>` z
nagłówkiem `<h2>Zdjęcia i pliki</h2>` (`:62-64`), jednym przyciskiem i trzema dialogami:
`InvoicePreviewButton` (podgląd z akcjami dodaj/usuń/usuń wszystkie), `InvoiceUploadDialog`
i `ConfirmDialog`. Dialogi montuje sam, więc **nie potrzebuje opakowania w kolejny dialog**.

Stan trzymają dwa hooki: `useInvestmentAssetsUpload` (`src/hooks/use-investment-assets-upload.ts:9`)
i `useMediaRemoval` (`src/hooks/use-media-removal.ts:38`). `isBusy = isUploading || isRemoving`
(`investment-assets.tsx:51`) odbiera drugiej stronie afordancję na czas własnej pracy — komentarz
w kodzie nazywa powód: `setUploadField` jest read-modify-write, więc nakładające się dodanie
i usunięcie zapisują sobie nawzajem listę sprzed zmiany.

Bliźniak bez nagłówka już istnieje: `InvoiceCell` (`src/components/transfers/invoice-cell.tsx:18`)
składa tę samą trójkę w gołym fragmencie, w komórce tabeli. Czyli „kontrolka bez chromu sekcji"
nie jest w tym repo nowym kształtem.

Osiem innych powierzchni montuje te same prymitywy (`src/components/media/**`,
`dialogs/invoice-*`), w tym trzy wewnątrz otwartego dialogu (`promote-lead-dialog.tsx:112`,
`lead-assets-dialog.tsx:185,214`, `lead-answers-dialog.tsx:42`). **Żadna powierzchnia nie reużywa
kompozytu innej** — każda składa prymitywy sama.

### Gdzie wsadzić kontrolkę — i dlaczego nie do menu

Toolbar edytora (`src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx:28`) nie
bierze dziś żadnych propsów; wszystko czyta z `useKosztorysEditorContext()`.

**Menu odpada.** `DropdownMenuContent` odmontowuje dzieci przy zamknięciu, a `onSelect` menu
zamyka — to jest wprost powód istnienia `KosztorysActionsProvider`
(`src/components/kosztorys/editor/actions/kosztorys-actions-context.tsx:33`). Wrzucenie galerii do
„Opcje" znaczyłoby rozbicie jej stanu na provider, czyli przepisanie tego, co ma działać
identycznie. Żadna powierzchnia medialna w repo nie siedzi dziś w dropdownie.

**Zostaje przycisk w prawej grupie toolbara** (`:82-96`). Jest tam ciasno: na trasie inwestycji
żywych kontrolek jest 8–9 (Podsumowanie, widok cen, Dodaj, szukajka, Inwestor, Opcje, Problemy gdy
są, Filtry, Sekcje, Widok). Poniżej `sm` (=768px, `src/styles/globals.css:27`) toolbar dzieli się
na wiersz stały i rozwijaną nakładkę (`:60-65`); od 768 w górę to jeden zawijający się rząd.
Siódma kontrolka w prawej grupie to realny koszt zatłoczenia na tablecie.

### Dane — żaden nowy fetch nie jest potrzebny, i nie może być `'use server'`

`fetchInvestmentAssets` (`src/lib/queries/investment-assets.ts:42`) jest cache'owane tagami
`[investments, investment:<id>]`. Strona `kosztorys_v2` ma już `Promise.all` z sześcioma
zapytaniami (`src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:58-70`) — dorzucenie
siódmego to jedna linia, leci równolegle, a licznik na przycisku dostajemy gratis.

Wariant „czytaj na otwarcie" jest **droższy niż wygląda**: `fetchInvestmentAssets` wołają
komponenty serwerowe, więc jego moduł nie może dostać `'use server'` — to jest dokładnie powód,
dla którego istnieje osobny plik `src/lib/queries/investment-asset-ids.ts:7-14` (dokblok mówi to
wprost, commit `96e183bd`/EX-841). Klient musiałby więc dostać **trzeci** moduł z tym samym
odczytem.

### Koszt renderu — większy niż zakładałem, ale nie z powodu siódmego zapytania

`protectedAction(..., ['investments'])` → `revalidateCollections` (`src/lib/actions/run-action.ts:55-58`)
→ `updateTag('collection:investments')` (`src/lib/cache/revalidate.ts:32-33`). Jeden tag.

Co po tym przelicza trasa kosztorys_v2:

| Zapytanie | Cache | Po unieważnieniu |
|---|---|---|
| `getKosztorysTree` (`page.tsx:44`) | **brak `unstable_cache`** (`lib/queries/kosztorys.ts:14-45`) | zawsze liczy od nowa — 5 odczytów DB na każdy render trasy |
| `fetchReferenceData` (`page.tsx:37`) | tag `investments` m.in. (`reference-data.ts:156-165`) | **przelicza** całego firmowego bloba |
| `fetchWholeInvestmentFinancials`, 3× transakcje, `getWorkCatalogue` | tagi `transfers` / `workCatalogue` | trafienia w cache |
| *(nowe)* `fetchInvestmentAssets` | `[investments, investment:<id>]` | przelicza — i o to chodzi |

Czyli sam upload i tak wymusza pełny render trasy z niecache'owanym drzewem. Zgodnie z lekcją
EX-597 (`context/foundation/lessons.md:652-672`) `updateTag` ustawia `pathWasRevalidated`, więc
świeży render jedzie już na odpowiedzi POST — a `router.refresh()`
(`src/hooks/use-media-upload.ts:44`) jest **prawdopodobnie drugą taką rundą**. Nie zweryfikowano
na źródle zainstalowanego `next` ani pomiarem; lekcja opisuje trace Next 16.1.7.

Body edytora się przy tym **nie remountuje**: `treeToken` to `tree.revision` + liczba pozycji
(`kosztorys-editor-v2.tsx:32`), a upload zdjęcia nie rusza ani jednego. Stan siatki i edycje
przeżywają.

### Bramkowanie — trzy powierzchnie renderują ten sam body

- `(share)/k/[token]` i `(share)/podglad-inwestora/[id]` montują `KosztorysEditorBody` z `preview`
  i payloadem z `preview-kosztorys.ts`; **toolbar pod `preview` w ogóle się nie renderuje**
  (`kosztorys-editor-body.tsx:369-389`). Dodatkowo `readOnly = preview || locked`
  (`use-kosztorys-editor.ts:151`).
- `szablony/[id]` renderuje **ten sam toolbar** na ukrytej inwestycji
  (`src/app/(frontend)/szablony/[id]/page.tsx:37-53`) — tu bramka jest konieczna.

Styl domu jest jednoznaczny: kontrolka sama zwraca `null`, nie warunek w miejscu wywołania.
`SaveTemplateButton` robi `if (templatePresetId == null) return null`
(`save-template-button.tsx:16`); „Arkusz Google" chowa się przez `{!readOnly && hasSheet && …}`
(`kosztorys-actions-menu.tsx:110`). Analogicznie `if (assets == null) return null` zamyka naraz
warsztat szablonów (nie poda propa) i podgląd klienta (nie ma toolbara).

`assets?:` jako opcjonalne na `KosztorysEditorDataT` (`src/lib/kosztorys/types.ts:135`) ma ten sam
kształt co `payoutTransactions` / `hasSheet` / `workers` (`:153,164,173`). `undefined` = „ta
powierzchnia nie ma galerii", `[]` = „pusta galeria". **Uwaga:** to gwarancja po stronie danych
(share nigdy propa nie konstruuje), ale typ jej nie wymusza — przyszły payload share'a mógłby go
podać. Obrona jest dziś komentarzem, nie typem (por. lekcja o przeniesieniu gwarancji ujawniania
z warstwy danych do renderu, `lessons.md:497`).

Kontekstu edytora nie ruszamy — AGENTS.md zakazuje dokładania do `KosztorysEditorProvider`
(regresja perf EX-496). Toolbar renderowany jest w **jednym** miejscu
(`kosztorys-editor-body.tsx:386`), więc prop kosztuje trzy linijki typów.

### Historia — dwie decyzje, które ta zmiana dotyka

Galeria powstała w `context/archive/2026-09-18-lead-delivery/` (EX-802), a dzisiejszy kształt dał
`context/archive/2026-09-21-investment-assets-dialog/`. Z `change.md:16-31` tamtej zmiany,
„potwierdzone przez właściciela":

> **Zero plików → żadnego przycisku podglądu.** … Miniatur nie ma wcale — w 99% przypadków nikt
> nie chce ich oglądać, chce pobrać.

Domknęły to dwa commity:

- `b62ad2fb` — „Sekcja … **traci własny przycisk „Dodaj pliki"** … Przy zerze plików sekcja nie
  renderuje więc nic i **jedyną drogą jest dialog edycji**."
- `7b5b9e26` — „Przy zerze plików cała sekcja była nagłówkiem nad pustym miejscem … Teraz jej nie
  ma."

Odbicie w `context/foundation/manual-checks.md:493`: „Inwestycja bez plików nie pokazuje w sekcji
żadnego przycisku — dodać można tylko z „Edytuj inwestycję"".

**Niezacommitowana zmiana w drzewie roboczym odwraca tę decyzję** — `investment-assets.tsx` renderuje
teraz przy zerze plików `MediaUploadButton`, a spec `investment-assets.test.tsx` został przepisany
pod nowe zachowanie. Bez tego edytor przy inwestycji bez zdjęć nie miałby czego pokazać.

**Dla edytora / listingu / share'u nie ma żadnej wcześniejszej decyzji** — ani zezwalającej, ani
zakazującej. Pytanie pada pierwszy raz w tej zmianie.

### EX-832 — otwarte i zaostrzane przez tę zmianę

`context/archive/2026-09-21-investment-assets-dialog/review-gate.md:10,30` — 🔴 Backlog/High:
`setUploadField` jest nieserializowanym read-modify-write, a kliencki `isBusy` broni tylko jednej
powierzchni. Issue **wprost** wskazuje dwóch istniejących pisarzy (sekcja karty + pole w dialogu
edycji) jako powód, dla którego gate po stronie klienta nie wystarcza.

Edytor jest trzecim pisarzem, i to takim, który z definicji bywa otwarty **równolegle** z kartą
inwestycji w drugiej zakładce. To nie blokuje tej zmiany, ale przesuwa EX-832 z „teoretyczne"
w „osiągalne normalną pracą".

### Testy

Istnieje: `src/__tests__/components/investments/investment-assets.test.tsx` (7 przypadków, w tym
brak afordancji usuwania w trakcie uploadu — czyli właśnie wyścig `setUploadField`),
`…/forms/investment-form/investment-assets-field.test.tsx`,
`src/__tests__/lib/actions/investment-assets.db.test.ts`.

**Luka: `kosztorys-editor-toolbar.tsx` nie ma specu na żadnej warstwie** — ani rozwijanie
`toolsOpen`, ani bramkowanie `!readOnly`, ani skład kontrolek. `useMediaUpload` też nie ma specu.

Nowy spec DOM: `src/__tests__/components/kosztorys/editor/toolbar/<nazwa>.test.tsx` (katalog
istnieje). Pułapki harnessu: moduły `'use server'` są podmieniane na stuby, które **rzucają** przy
wywołaniu — `addInvestmentAssetsAction` trzeba `vi.mock`'ować; `matchMedia` / `ResizeObserver` /
`scrollIntoView` są stubowane w `src/__tests__/setup/dom.ts` pod Radiksowe dropdowny.

## Code References

- `src/components/investments/investment-assets.tsx:35` — galeria; `:51` interlock `isBusy`; `:62-64` chrom sekcji
- `src/components/investments/investment-assets-section.tsx:5` — serwerowa granica odczytu
- `src/components/transfers/invoice-cell.tsx:18` — ta sama trójka bez chromu sekcji
- `src/hooks/use-media-upload.ts:44` — `router.refresh()` po uploadzie
- `src/lib/actions/investment-assets.ts:18` — akcja; celowo omija `investmentAction` (zamknięta inwestycja nie blokuje zdjęć)
- `src/lib/queries/investment-assets.ts:42` — cache'owany odczyt
- `src/lib/queries/investment-asset-ids.ts:7-14` — dlaczego `'use server'` wymusza osobny moduł
- `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx:58-70` — fan-out
- `src/components/kosztorys/editor/kosztorys-editor-body.tsx:369-389` — rozwidlenie preview/toolbar; `:386` jedyne miejsce renderu toolbara
- `src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx:82-96` — prawa grupa
- `src/components/kosztorys/editor/toolbar/save-template-button.tsx:16` — wzorzec bramki
- `src/components/kosztorys/editor/actions/kosztorys-actions-context.tsx:33` — dlaczego menu nie utrzyma dialogu
- `src/lib/kosztorys/types.ts:135` — `KosztorysEditorDataT`
- `src/lib/cache/revalidate.ts:32-33`, `src/lib/actions/run-action.ts:55-58` — ścieżka unieważnienia

## Architecture Insights

- **Prymitywy medialne są reużywane, kompozyty nie.** Dziewięć powierzchni składa
  `media/**` + `dialogs/invoice-*` samodzielnie. Wydzielenie `InvestmentAssetsControl` będzie
  **pierwszym** reużyciem kompozytu — to nie łamie konwencji, ale ją poszerza.
- **Seam `media/` biegnie w jedną stronę**: `media/*` importują katalogi feature'owe, nigdy
  odwrotnie. Kontrolka woła akcje inwestycji, więc jej dom to
  `src/components/investments/investment-assets-control.tsx`, nie `media/`.
- **Bramka kontrolki = `return null` w niej samej**, nie warunek u wołającego.
- **Cache nie jest tu narzędziem optymalizacji renderu** — każdy zapis unieważniający cokolwiek
  renderuje trasę w całości (EX-597), a drzewo kosztorysu i tak nie jest cache'owane.

## Historical Context (from prior changes)

- `context/archive/2026-09-18-lead-delivery/plan.md:400-411` — kontrakt: galeria czyta własnym
  zapytaniem, nie przez `fetchReferenceData`; sekcja we własnym `Suspense`
- `context/archive/2026-09-21-investment-assets-dialog/change.md:16-31` — decyzje właściciela
  (zero plików → brak przycisku; usuwanie w stopce podglądu; wybór pliku JEST zapisem)
- `context/archive/2026-09-21-investment-assets-dialog/review-gate.md:10,30` — EX-832
- `context/archive/2026-09-21-fullscreen-zoom-preview/change.md:13-16` — `InvoicePreviewDialog`
  jest świadomie surfacem trzech konsumentów; `:98-107` — pliki z aplikacji są kompresowane
  bezpowrotnie (1920×1080, q0.6)
- `context/foundation/lessons.md:652-672` — EX-597, render trasy przy każdym unieważnieniu tagu
- `context/foundation/lessons.md:497` — gwarancja ujawniania po stronie danych bije tę po stronie renderu

## Open Questions

1. **Czy `router.refresh()` w `useMediaUpload` jest redundantny?** Lekcja EX-597 sugeruje tak,
   ale nie zweryfikowano tego na źródle zainstalowanego `next` ani pomiarem. Dotyczy wszystkich
   powierzchni, nie tylko tej — więc to osobna zmiana, nie część tej.
2. **Czy przycisk ma stać w prawej grupie toolbara, czy gdzieś indziej?** Prawa grupa ma już 6
   pozycji i zawija się na tablecie.
3. **EX-832** — czy trzeci pisarz wymaga serializacji po stronie serwera *teraz*, czy issue
   zostaje w backlogu z dopiskiem o nowej powierzchni.
4. **Odwrócenie decyzji o pustym stanie** siedzi w niezacommitowanym drzewie i nie ma własnego
   wpisu w `context/` ani w `manual-checks.md:493`, który wciąż opisuje stary stan.
