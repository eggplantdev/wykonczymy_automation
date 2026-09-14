# Drag&drop plików — guard na chybiony drop + widoczne dropzone

## Overview

Chybiony drop pliku (obok dropzone, ale wewnątrz okna) uruchamia domyślną akcję dokumentu i
przeglądarka otwiera plik zamiast formularza — praca użytkownika w dialogu przepada. Dodajemy
window-owy guard, ale montowany **przez samą dropzone**, nie w layoucie. Ten sam listener daje
drugą rzecz: stan „plik jest nad oknem", którym podświetlamy wszystkie dostępne cele, zanim
użytkownik w któryś trafi.

## Current State Analysis

- `src/components/ui/file-input.tsx:43-111` — współdzielona dropzone. `preventDefault` +
  `stopPropagation` tylko **wewnątrz** własnego elementu, więc trafiony drop działa, a chybiony nie
  jest niczyj.
- `src/components/forms/form-fields/line-items-field.tsx:235-248` — druga, niezależna dropzone
  (przycisk „Wygeneruj z paragonów", `:406`) z ręcznie powtórzonymi `onDragOver` / `onDragLeave` /
  `onDrop`. Bez `stopPropagation`.
- Podświetlenie dziś: `file-input.tsx:115` → `border-primary` (`--color-primary` = `oklch(0.205 0 0)`,
  praktycznie czerń, nieodróżnialne od `border-input`) vs `line-items-field.tsx:246` →
  `ring-neon-cyan ring-2`. Dwa różne języki.
- Sześć miejsc montowania, **wszystkie wewnątrz `Dialog`a** — pełny inwentarz w `research.md`.
- `LineItemInvoiceField` renderuje `FileInput` **per wiersz** (`line-item-invoice-field.tsx:60`), więc
  formularz wydatku z N pozycjami bez faktur ma N+1 dropzone'ów naraz.
- W `src/` nie ma żadnego natywnego HTML5 drag&drop poza plikami ani żadnego globalnego listenera
  `drag*`/`drop`. Guard będzie pierwszy i nie ma z czym kolidować.
- Panel Payloada (`/admin/**`) ma własną dropzone, której nie wolno tknąć — montaż per-dropzone
  omija go z definicji.

## Desired End State

1. Plik upuszczony gdziekolwiek w oknie, przy otwartej dropzone, **nigdy** nie otwiera się
   w przeglądarce — po prostu nic się nie dzieje.
2. Od momentu, gdy plik jest przeciągany nad oknem, **każda** widoczna dropzone pokazuje słaby stan
   „uzbrojona"; ta pod kursorem — mocny stan „upuść tutaj".
3. Oba stany mają jeden, wspólny kolor: `neon-cyan`.
4. Rozmiary i layout nie zmieniają się w trakcie przeciągania.

### Key Discoveries

- Wszystkie dropzone siedzą w dialogach — guard montowany razem z dropzone nie traci nic względem
  guarda w layoucie, bo przy zamkniętym dialogu nie ma w co celować.
- `line-items-field` nie robi `stopPropagation`, więc jego drop dociera też do window-owego
  listenera — guard musi być idempotentny (samo `preventDefault`, zero logiki na pliku).
- Licznik `dragenter`/`dragleave` jest odporniejszy od testu `relatedTarget === null`: `dragover`
  odpala się co ~350 ms, więc watchdog czasowy dawałby fałszywe wygaszenia przy nieruchomym kursorze.

## What We're NOT Doing

- Żadnego guarda w `(frontend)/layout.tsx` ani w jakimkolwiek providerze.
- Żadnego montażu w `(payload)` — dropzone Payloada zostaje nietknięta.
- Bez powiększania dropzone (ani `scale`, ani realnej zmiany wysokości) — decyzja właściciela.
- Bez wklejania plików ze schowka (`onPaste`) — dziś nie istnieje, nie dokładamy.
- Bez zmiany ścieżek ingestu, walidacji `accept`, kompresji HEIC i obsługi oversize.
- Bez pełnoekranowej nakładki „upuść plik gdziekolwiek".

## Implementation Approach

Jeden hook `useWindowFileDrag()` w `src/hooks/` robi obie rzeczy naraz, bo obie potrzebują tych
samych listenerów: anuluje domyślną akcję **i** zwraca `isFileDragActive`. Montują go obie dropzone,
więc listenery żyją dokładnie tyle, co dropzone. Hook zwraca **stan**, nigdy klasy — kolor zostaje
u konsumenta (choć po decyzji właściciela obaj używają tego samego).

Przy okazji `line-items-field` przechodzi na wspólny hook zamiast własnej kopii handlerów — dedup
jest tu w zasięgu, bo bez niego druga dropzone nie dostałaby stanu „uzbrojona".

## Critical Implementation Details

**Kilka instancji hooka naraz.** W formularzu wydatku hook zamontuje się N+1 razy, więc na `window`
wyląduje N+1 kompletów listenerów. To jest poprawne (każdy komponent ma własny stan) i tanie, ale
`preventDefault` wykona się wielokrotnie na tym samym zdarzeniu — dlatego guard nie może robić nic
poza `preventDefault`, w szczególności nie może czytać ani konsumować pliku.

**Wygaszanie stanu.** `dragenter` inkrementuje licznik, `dragleave` dekrementuje, `drop` i `dragend`
zerują. Licznik jest konieczny, bo `dragenter`/`dragleave` odpalają się przy każdym przejściu granicy
elementu wewnątrz strony — pojedynczy boolean migotałby.

## Phase 1: Hook `useWindowFileDrag` + `FileInput` na wspólnym stanie

### Overview

Powstaje hook i pierwszy konsument. Po tej fazie chybiony drop jest już zablokowany wszędzie tam,
gdzie widać `FileInput`.

### Changes Required

#### 1. Nowy hook

**File**: `src/hooks/use-window-file-drag.ts`

**Intent**: Jeden hook, który na czas życia komponentu anuluje domyślną akcję przeglądarki dla
przeciąganych plików i raportuje, czy plik jest właśnie nad oknem. Dom w `src/hooks/`, bo konsumenci
siedzą w dwóch różnych katalogach i jeden z nich nie jest formularzem (reguła z AGENTS.md o domu hooka).

**Contract**: `useWindowFileDrag(): boolean` — zwraca `isFileDragActive`. Listenery na `window`:
`dragover` (tylko `preventDefault`), `dragenter` (+1), `dragleave` (−1), `drop` (`preventDefault`,
licznik → 0), `dragend` (licznik → 0). Każdy listener wychodzi natychmiast, gdy
`e.dataTransfer?.types.includes('Files')` jest fałszywe — dziś w aplikacji nie ma innego HTML5 drag,
ale ten warunek jest tym, co pozwoli go kiedyś dodać. Licznik trzymany w `useRef`, stan w `useState`.
Sprzątanie listenerów w cleanupie `useEffect`.

#### 2. `FileInput` na nowym stanie i nowym kolorze

**File**: `src/components/ui/file-input.tsx`

**Intent**: Podpiąć hook i rozdzielić podświetlenie na dwa stopnie: „uzbrojona" (plik nad oknem)
i „pod kursorem" (dzisiejsze `isDragOver`). Zastąpić nieczytelny `border-primary` wspólnym
`neon-cyan`.

**Contract**: Bez zmian w API komponentu — `FileInputPropsT` zostaje. Zmienia się wyłącznie blok
`className` w `:112-118`: stan słaby (przerywana ramka + ledwie widoczne tło) gdy
`isFileDragActive && !isDragOver`, stan mocny gdy `isDragOver`. Stan „uzbrojona" nie może pojawiać
się przy `disabled` — ta dropzone i tak nie przyjmie pliku (`:68`).

#### 3. Naprawa migotania `isDragOver`

**File**: `src/components/ui/file-input.tsx`

**Intent**: `handleDragLeave` (`:49`) odpala się również, gdy kursor wjeżdża na dziecko (ikonę,
`span`), więc mocny stan miga w trakcie przeciągania nad własną dropzone.

**Contract**: `handleDragLeave` ignoruje zdarzenie, gdy `e.currentTarget.contains(e.relatedTarget)`.

### Success Criteria

#### Automated Verification

- Brak weryfikacji automatycznej **zawężonej do tej fazy**: cała zmiana to zachowanie DOM-owe
  w hooku, a repo świadomie nie ma renderera hooków (`context/foundation/lessons.md:389`) — nie ma
  tu logiki, którą dałoby się wyciągnąć poza hook bez tworzenia atrapy. Weryfikacja deterministyczna
  spada na bramkę całego drzewa poniżej, zachowanie — na checki manualne.

#### Manual Verification

- Przeciągnij plik nad otwarty dialog faktury i upuść go **obok** pola — nic się nie dzieje,
  przeglądarka nie otwiera pliku, dialog stoi otwarty.
- W trakcie przeciągania pole jest podświetlone, zanim kursor nad nie wjedzie.
- Po wjechaniu kursorem na pole podświetlenie wzmacnia się i **nie miga** przy ruchu nad ikoną
  i tekstem.
- Upuszczenie pliku na pole nadal dodaje plik (regresja ścieżki trafionej).
- Po zamknięciu dialogu i ponownym przeciągnięciu pliku poza aplikację (np. na pasek zakładek)
  przeglądarka zachowuje się normalnie — guard zniknął razem z dialogiem.
- Upuszczenie pliku w panelu Payloada (`/admin`) nadal działa jak wcześniej.

---

## Phase 2: Druga dropzone na tym samym hooku

### Overview

Przycisk „Wygeneruj z paragonów" przestaje mieć własną kopię handlerów i dostaje ten sam stan
„uzbrojona". To jedyne miejsce, gdzie dropzone jest małym przyciskiem w rzędzie kontrolek — czyli
najczęstsze źródło chybienia.

### Changes Required

#### 1. `line-items-field` przechodzi na wspólny hook

**File**: `src/components/forms/form-fields/line-items-field.tsx`

**Intent**: Podpiąć `useWindowFileDrag` i rozszerzyć `dropZoneProps` o stan „uzbrojona", zachowując
istniejące zachowanie dropu: filtr `isReceiptFile`, ciche wyjście przy pustym wyniku, no-op podczas
`isGenerating || isIngesting`.

**Contract**: `dropZoneProps(lineItemsField, mode)` (`:235`) zostaje z tą samą sygnaturą; zmienia się
tylko jego `className` — słaby stan gdy `isFileDragActive && dragOverMode !== mode`, dzisiejszy
`ring-neon-cyan ring-2` jako stan mocny. `handleDropReceipts` (`:220`) bez zmian. Stan „uzbrojona”
nie pojawia się, gdy przycisk jest `disabled` (trwa generowanie lub ingest).

#### 2. Jeden wspólny język stanu dropu

**File**: `src/components/ui/file-input.tsx`, `src/components/forms/form-fields/line-items-field.tsx`

**Intent**: Oba miejsca mają po decyzji właściciela ten sam kolor (`neon-cyan`) i tę samą geometrię
stopni (słaby = przerywana ramka, mocny = ring). Wyciągnąć wspólne klasy w jedno miejsce, żeby trzecia
dropzone nie musiała ich zgadywać.

**Contract**: Wspólne klasy eksportowane z `src/hooks/use-window-file-drag.ts` jako stałe
(`FILE_DRAG_ARMED_CLASS`, `FILE_DRAG_OVER_CLASS`) albo — jeśli okaże się, że różnice w kształcie
elementów (pole vs przycisk) są zbyt duże — jako dwa warianty w `cn`-owym helperze obok hooka.
Rozstrzyga implementer po zobaczeniu obu renderów; hook **nie** narzuca klas, tylko je udostępnia.

### Success Criteria

#### Automated Verification

- Brak weryfikacji zawężonej do tej fazy — jak w fazie 1, zmiana jest czysto wizualna i DOM-owa.

#### Manual Verification

- W dialogu wydatku, w trakcie przeciągania pliku, podświetlają się jednocześnie przycisk
  „Wygeneruj z paragonów" **i** wszystkie pola „FV" bez faktury — słabo, nie krzykliwie.
- Upuszczenie paragonu na przycisk nadal uruchamia generowanie pozycji (regresja ścieżki trafionej).
- Upuszczenie pliku spoza `accept` (np. `.txt`) na przycisk nie robi nic i **nie** otwiera pliku.
- Drugi drop w trakcie trwającego ingestu nadal jest no-opem
  (`context/foundation/manual-checks.md:3303` — istniejący check nie może się zepsuć).
- Przy 8 pozycjach formularz nie wygląda jak choinka — słaby stan jest czytelny, ale nie dominuje.

---

## Testing Strategy

### Unit Tests

Brak. Jedyna „logika" hooka to warunek `types.includes('Files')` i licznik zagnieżdżeń — test tego
byłby tautologią na atrapie `DataTransfer`, a nie sprawdzeniem zachowania. Repo świadomie nie ma
renderera hooków (`context/foundation/lessons.md:389`).

### E2E

Ryzyko jest browser-level (domyślna akcja dokumentu), więc właściwą warstwą jest Playwright:
`dataTransfer` konstruowany w `page.evaluate`, drop poza dropzone, asercja że URL się nie zmienił
i dialog stoi. Zgodnie z AGENTS.md ta zmiana **odkłada** E2E do backlogu — issue w Linearze
z etykietą `e2e-backlog`, założone na bramce przeglądu jako **EX-774** — i tego samego dnia
**anulowane decyzją właściciela**: jeden przebieg suity ~1 h nie jest wart pokrycia, które i tak
dublują checki manualne. Ryzyko browser-level zostaje na nich. Powód:
jeden przebieg suity to ~1 h, a tu nie ma logiki serwerowej ani danych do zepsucia.

### Manual Testing Steps

1. `/inwestycje/[id]` → tabela transferów → „Dodaj fakturę" → przeciągnij plik i upuść obok pola.
2. To samo w dialogu wydatku, na pustym miejscu formularza między wierszami.
3. To samo przy zamkniętych dialogach — przeciągnięcie pliku na samą stronę **ma** otworzyć plik
   (guard nie jest zamontowany, i tak ma być).
4. `/admin` → dowolna kolekcja z uploadem → drop w dropzone Payloada działa jak wcześniej.

## Whole-tree Gate

- Typecheck przechodzi: `pnpm typecheck`
- Lint przechodzi: `pnpm lint`
- Suita jednostkowa przechodzi: `pnpm test`
- Build przechodzi: `pnpm build`

## References

- Research: `context/changes/2026-09-14-drag-drop-guard/research.md`
- Decyzje właściciela: `context/changes/2026-09-14-drag-drop-guard/change.md`
- Istniejący check ingestu: `context/foundation/manual-checks.md:3303`
- Dom hooka wg liczby konsumentów: `AGENTS.md` → „Important Directories"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Hook `useWindowFileDrag` + `FileInput` na wspólnym stanie

#### Automated

- [x] 1.1 Brak kroku automatycznego zawężonego do fazy (uzasadnienie w treści fazy) — 68a01772

### Phase 2: Druga dropzone na tym samym hooku

#### Automated

- [x] 2.1 Brak kroku automatycznego zawężonego do fazy (uzasadnienie w treści fazy) — 7f38282b

## Epilog bramki przeglądu

Bramka (`review-gate.md`) złapała dwa krytyczne bugi w fazie zdarzeń: listenery hooka wisiały
w fazie bąbelkowej, a `FileInput` woła `stopPropagation`, więc `window` nigdy nie widział ani
`drop`, ani `dragleave` z wnętrza pola — licznik zagnieżdżeń rósł i nie wracał do zera, czyli słaby
ring zostawał zapalony na zawsze. Naprawione przejściem na `{ capture: true }`. Przy okazji ten sam
guard przed migotaniem, który faza 1 dodała do `FileInput`, trafił na przycisk skanu paragonów.
