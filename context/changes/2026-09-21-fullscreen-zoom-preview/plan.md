# Pełnoekranowy podgląd z zoomem w InvoicePreviewDialog — plan wdrożenia

## Overview

`InvoicePreviewDialog` dostaje pełny ekran (od `sm` w górę) i zoom na obrazku — jako własność samego
okna, więc naraz dla wszystkich trzech konsumentów: faktur przy transferach, galerii inwestycji
i załączników zgłoszeń. Powodem są załączniki zgłoszeń: to często rzuty i plany, których dziś nie da
się obejrzeć w powiększeniu.

## Current State Analysis

`src/components/dialogs/invoice-preview-dialog.tsx` — jedno okno, trzy wejścia
(`invoice-preview-button.tsx`, `media-strip.tsx`, a przez `MediaStrip` wszystko, co go osadza).

- Kontener: `<DialogContent className="sm:h-full sm:max-w-4xl">` — sufit 896 px. Na 1440-tce rzut
  dostaje ~60% mniej pikseli, niż mógłby.
- Obrazek: `<Image fill sizes="(max-width: 767.98px) calc(100vw - 2rem), 848px">` — rendition ~848 px.
- `pageIndex` + pager „1/5" + chevrony są własnością tego komponentu; na `activeIndex` wiszą
  `handlePrint`, `handleDownloadAll` i `onRemove`.
- PDF-y to `<iframe>` z natywną przeglądarką — zoom, dopasowanie i nawigacja stron są tam z pudełka.
- Poniżej `sm` (768 px) `DialogContent` jest już pełnoekranową płachtą (`h-dvh w-full max-w-none`
  w `src/components/ui/dialog.tsx`), więc **pełny ekran jest problemem wyłącznie desktopowym**.

### Key Discoveries

- **Blokadą jest źródło, nie widżet.** Żaden widżet nie zrobi czytelnych linii wymiarowych
  z renditionu 848 px. Warstwa zoomu musi w pewnym momencie sięgnąć po oryginał.
- **Zoom opłaca się dokładnie na załącznikach zgłoszeń.** `fetchLandingAsset` strumieniuje plik
  z Bloba landingu bez kompresji i bez skalowania, więc oryginał jest cały. Pliki wgrywane z apki
  przechodzą przez `compressImage` (`q = 0.6`, pudełko `1920×1080`) — portretowy skan A4 ląduje na
  dysku jako 763×1080, bezpowrotnie, przed wysyłką. Tam zoom nie ma czego odzyskać.
- **Swiper odrzucony.** Moduł `Zoom` by działał, ale Swiper przynosi własny indeks slajdu i przepięcie
  na niego wydruku, zipa i kasowania to przepisanie okna pod funkcję dotykającą jednego `<Image>`.
- **`react-zoom-pan-pinch@4.2.0`** ma `peerDependencies: { react: "*" }`, więc React 19 nie jest
  problemem; ~1,2 MB rozpakowane, drzewo zależności puste.

## Desired End State

Okno otwiera się na pełnym ekranie. Obrazek ma kółko, pinch, dwuklik i trzy przyciski (`+`, `−`,
„Dopasuj"). Przy pierwszym powiększeniu podmienia się źródło na nieoptymalizowany oryginał, więc
powiększenie odsłania piksele, a nie artefakty. Przejście chevronem na następny plik resetuje
przybliżenie do 1×. PDF zyskuje pełny ekran i nic poza tym.

## What We're NOT Doing

- **Nie ruszamy kompresji na wejściu** (`compress-image.ts`: `q = 0.6`, `1920×1080`). To osobna
  zmiana — `MAX_UPLOAD_BYTES = 4 MB` opiera się na limicie ciała requestu Vercela, który trzeba
  najpierw zweryfikować na żywo, a ta zmiana dowozi wartość tam, gdzie oryginały są całe.
- **Nie renderujemy PDF-ów u siebie** (pdf.js). Natywna przeglądarka w `<iframe>` już to potrafi.
- **Nie ruszamy paginacji.** `pageIndex` zostaje własnością okna, chevrony i pager bez zmian.
- **Nie dodajemy gestu przesuwania między stronami.** Panning zjadłby poziome przeciągnięcie.
- Bez E2E — patrz „Testy".

## Implementation Approach

Zoom wchodzi jako opakowanie na samym `<Image>`, które o paginacji nie wie nic. Reset przy zmianie
strony realizuje `key` na tym opakowaniu — remount kasuje skalę, przesunięcie i flagę „już
powiększono" jednym mechanizmem, zamiast trzema `useEffect`-ami.

## Critical Implementation Details

- **Dwie warstwy, jeden `<Image>`.** Przy skali 1 leci zoptymalizowany rendition (`quality` globalnie
  90, patrz `next.config.ts`). Po pierwszym powiększeniu komponent ustawia `unoptimized`, co zmienia
  `src` na oryginał z Bloba. Prop `unoptimized` z góry (lokalny `blob:` URL pliku jeszcze
  niewysłanego) musi nadal wygrywać: `unoptimized={unoptimized || hasZoomed}`.
- **`sizes` idzie w tej samej edycji co sufit szerokości.** Samo zdjęcie `max-w-4xl` bez `sizes` każe
  przeglądarce skalować w górę rendition 848 px; samo `sizes` bez zdjęcia sufitu przepłaca transfer.
- **Pełny ekran musi pokonać bazę `DialogContent`**, która od `sm` ustawia `top-1/2 h-fit
max-h-[90vh] -translate-y-1/2 rounded-lg`. Samo `sm:max-w-none` nie wystarczy.

## Phase 1: Pełny ekran

### Overview

Najtańsza wygrana, samodzielnie widoczna: okno zajmuje ekran, obrazek dostaje tyle pikseli, ile ma
monitor. Pomaga też PDF-om.

### Changes Required

#### 1. Kontener okna

`src/components/dialogs/invoice-preview-dialog.tsx`

`className="sm:h-full sm:max-w-4xl"` → `sm:top-0 sm:h-dvh sm:max-h-none sm:max-w-none
sm:translate-y-0 sm:rounded-none`.

#### 2. Obszar mediów

Sztywne `h-[70vh]` zostaje zastąpione przez `flex-1` w kolumnie o wysokości ekranu — inaczej przy
`h-dvh` zostaje pas pustki pod obrazkiem.

#### 3. `sizes`

`"(max-width: 767.98px) calc(100vw - 2rem), 848px"` →
`"(max-width: 767.98px) calc(100vw - 2rem), calc(100vw - 3rem)"` (`sm:p-6` = 3rem w poziomie).

### Success Criteria

#### Automated Verification

- [ ] `pnpm lint`

#### Manual Verification

- [ ] Okno zajmuje cały ekran na 1440-tce; obrazek dopasowany, bez pasa pustki pod spodem.
- [ ] Poniżej 768 px nic się nie zmieniło — płachta jak dotąd.
- [ ] PDF w `<iframe>` wypełnia okno.

---

## Phase 2: Zoom na obrazku

### Overview

`react-zoom-pan-pinch` jako opakowanie na `<Image>`, z trzema przyciskami i resetem przy zmianie
strony.

### Changes Required

#### 1. Zależność

Ręczna edycja `package.json` (`"react-zoom-pan-pinch": "^4.2.0"` w `dependencies`), potem
`pnpm install --force` i `rm -rf .next` — na tej maszynie zwykłe `pnpm install` potrafi podmienić
natywny `lightningcss` na x64 (AGENTS.md → Dependencies).

#### 2. Nowy komponent

`src/components/dialogs/zoomable-preview-image.tsx` — jeden konsument (to okno), więc siedzi obok
niego, nie w `components/media/`.

- `<TransformWrapper minScale={1} maxScale={8} doubleClick={{ mode: 'toggle' }} wheel={{ step: 0.2 }}>`
- `<TransformComponent>` opakowuje `<Image fill className="object-contain">`.
- Render-prop daje `zoomIn` / `zoomOut` / `resetTransform` dla przycisków — bez `ref` i bez
  `useControls` w osobnym poddrzewie.
- `PropsT`: `src`, `alt`, `sizes`, `unoptimized`, `onLoad`, `onError`.

#### 3. Sterowanie

`+`, `−`, „Dopasuj" — `Button variant="outline" size="icon"` w rzędzie przy pagerze. Widoczne zawsze
(nie tylko po powiększeniu), bo inaczej nic nie sygnalizuje, że zoom w ogóle istnieje.

#### 4. Reset przy zmianie strony

`<ZoomablePreviewImage key={active.url} …>` w oknie. Remount zeruje skalę i przesunięcie razem.
Gałąź PDF-u bez zmian — żadnych przycisków zoomu.

### Success Criteria

#### Automated Verification

- [ ] `pnpm lint`
- [ ] `pnpm exec vitest run --project dom src/__tests__/components/dialogs/invoice-preview-dialog.test.tsx`

#### Manual Verification

- [ ] Kółko, pinch i dwuklik przybliżają; przeciąganie przesuwa kadr.
- [ ] „Dopasuj" wraca do 1× z dowolnego kadru.
- [ ] Chevron na następny plik otwiera go w 1×, wycentrowany.
- [ ] Przy PDF-ie nie ma przycisków zoomu.
- [ ] Wydruk, „Pobierz wszystkie" i „Usuń plik" dalej dotyczą właściwej strony.

---

## Phase 3: Oryginał przy powiększeniu

### Overview

Bez tego zoom powiększa artefakty renditionu.

### Changes Required

#### 1. Flaga w komponencie zoomu

`hasZoomed` ustawiane w `onTransformed` (albo w handlerach przycisków), gdy `scale > 1`. Raz
ustawione zostaje do końca życia komponentu — a to jest strona, bo `key` remontuje przy zmianie.

#### 2. Podmiana źródła

`unoptimized={unoptimized || hasZoomed}` na `<Image>`.

### Success Criteria

#### Automated Verification

- [ ] `pnpm exec vitest run --project dom src/__tests__/components/dialogs/invoice-preview-dialog.test.tsx`

#### Manual Verification

- [ ] W Network po pierwszym powiększeniu leci żądanie na URL Bloba, nie na `/_next/image`.
- [ ] Rzut ze zgłoszenia jest w powiększeniu czytelny (linie wymiarowe), nie rozmyty.
- [ ] Przy `unoptimized` z góry (podgląd niewysłanego jeszcze pliku) nic się nie psuje.

---

## Testy

Spec DOM: `src/__tests__/components/dialogs/invoice-preview-dialog.test.tsx` (nowy — dla tego okna
nie ma dziś żadnego). Ryzyka warte asercji:

| Ryzyko                                   | Asercja                                                             |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Zoom wycieka na PDF-y                    | Przy `application/pdf` brak przycisków `+` / `−` / „Dopasuj"        |
| Przybliżenie przechodzi na następny plik | Po `+` i chevronie skala z powrotem 1× (obraz bez `scale(` w stylu) |
| Podmiana na oryginał nie zachodzi        | Po `+` `src` obrazka przestaje być `/_next/image`                   |
| `unoptimized` z góry zostaje zadeptane   | Z `unoptimized` w propsach `src` to URL wprost, także przy skali 1  |

jsdom nie ma layoutu, więc sam gest pinch i klamrowanie panningu pozostają niesprawdzone — to świadoma
dziura, nie przeoczenie. Bez długu E2E (decyzja właściciela, 2026-09-21): ryzyko jest wizualne
i weryfikowalne ręcznie w kilka sekund, a przebieg E2E kosztuje ~godzinę.

## Open Risks & Assumptions

- **`react-zoom-pan-pinch` a `<Image fill>`.** `fill` to `position: absolute` względem rodzica —
  `TransformComponent` musi dostać wymiary, inaczej obrazek zniknie. Jeśli to zaboli, alternatywą
  jest `<Image width/height>` z `style={{ maxHeight: '100%' }}`, ale wtedy trzeba znać wymiary pliku,
  których `InvoiceFileT` nie niesie. **Do rozstrzygnięcia w fazie 2, nie na papierze.**
- **Pełny ekran zabiera kontekst.** Okno na cały ekran przestaje pokazywać, z czego zostało otwarte.
  Akceptowalne: to okno i tak jest modalne, a `Esc` wraca.
- **`wheel` kontra przewijanie okna.** `DialogContent` ma `overflow-y-auto`. Jeśli kółko nad obrazkiem
  zacznie przewijać okno zamiast przybliżać, trzeba `wheel={{ activationKeys: [] }}` i `touch-action`
  na kontenerze zoomu.

## Whole-tree Gate

Uruchamiane RAZ, po ostatniej fazie:

- `pnpm lint`
- `pnpm vitest run --project dom`

## Progress

### Phase 1: Pełny ekran

- [x] 1.1 Kontener okna pokonuje bazę `DialogContent` i zajmuje ekran od `sm`
- [x] 1.2 Obszar mediów rośnie z oknem zamiast sztywnego `h-[70vh]`
- [x] 1.3 `sizes` przestawione na nową szerokość renderowania

### Phase 2: Zoom na obrazku

- [ ] 2.1 `react-zoom-pan-pinch` w `package.json`
- [ ] 2.2 Komponent `zoomable-preview-image.tsx`
- [ ] 2.3 Przyciski `+` / `−` / „Dopasuj"
- [ ] 2.4 Reset przy zmianie strony przez `key`
- [ ] 2.5 Spec DOM: brak zoomu na PDF, reset przy zmianie strony

### Phase 3: Oryginał przy powiększeniu

- [ ] 3.1 Flaga `hasZoomed`
- [ ] 3.2 `unoptimized={unoptimized || hasZoomed}`
- [ ] 3.3 Spec DOM: podmiana źródła, `unoptimized` z góry nie zadeptane
