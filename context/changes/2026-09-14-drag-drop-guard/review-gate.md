# Review-gate ledger — drag-drop-guard · 2026-09-14

Zakres: `68a01772`, `7f38282b`, `4de2666e` — `src/hooks/use-window-file-drag.ts`,
`src/components/ui/file-input.tsx`, `src/components/forms/form-fields/line-items-field.tsx`.

Fan-out świadomie zawężony (diff: 3 pliki, ~120 linii) — jeden agent code-review + przegląd
w wątku głównym zamiast pełnej siódemki audytów; nakład proporcjonalny do wielkości diffu.

## Findings

- [x] 🔴 CRITICAL · fixed · code-review · `src/hooks/use-window-file-drag.ts:62` · listenery na `window`
      wisiały w fazie bąbelkowej, więc `FileInput.handleDrop` (`file-input.tsx:73`, `stopPropagation`)
      ucinał `drop` zanim doszedł do `window` — licznik zagnieżdżeń nigdy nie wracał do 0 i słaby ring
      świecił się już zawsze. `dragend` nie ratuje: dla pliku ciągniętego z systemu nie ma go w ogóle.
      Dowód: Next hydratuje `document` (`next/dist/client/app-index.js:31`), a drag/drop nie są
      w `nonDelegatedEvents`, więc listener Reacta siedzi na `document`. Fix: `{ capture: true }` na
      wszystkich pięciu listenerach — `window` jest pierwszy w fazie przechwytywania, więc nikt
      poniżej go nie ucisza; `preventDefault` w przechwytywaniu nie psuje własnego dropu dropzone
      (nie czyści `dataTransfer.files`).
      test: no automated test · — E2E anulowane decyzją właściciela (EX-774 Canceled): niewarte
      ~1 h przebiegu suity. Guardem zostaje check manualny „słabe podświetlenie gaśnie po trafionym dropie".
- [x] 🔴 CRITICAL · fixed · code-review · `src/components/ui/file-input.tsx:57` · ten sam
      `stopPropagation` zjadał **każdy** `dragleave` z wnętrza `FileInput` (ikona, `span`), a `dragenter`
      docierał do `window` — licznik rósł o +2/+3 na każde przejechanie nad polem i nie wracał do zera
      nawet po wyjeździe poza okno. Zamknięte tym samym fixem (faza przechwytywania liczy symetrycznie).
      test: no automated test · — jw. (EX-774 anulowane); guardem check manualny „przejedź nad polem
      i wyjedź poza okno — podświetlenie gaśnie".
- [x] 🟡 WARNING · fixed · code-review · `src/components/forms/form-fields/line-items-field.tsx:247` ·
      `onDragLeave` przycisku „Wygeneruj z paragonów" czyścił `dragOverMode` bezwarunkowo, więc mocny
      stan migotał przy przejeżdżaniu nad ikoną i etykietą — dokładnie ten bug, który faza 1 naprawiła
      w `FileInput` i zostawiła tu. Fix: ten sam guard `currentTarget.contains(relatedTarget)`.
      test: no automated test · — czysto wizualne migotanie, tańsze do zobaczenia niż do zasertowania;
      pokryte checkiem manualnym „nie miga".
- [x] 🔵 OBSERVATION · dropped · code-review · `file-input.tsx:49` / `line-items-field.tsx:243` ·
      mocny stan zapala się też na przeciąganiu zaznaczonego tekstu (brak testu `types.includes('Files')`
      na `dragOver`). Drop i tak jest no-opem (`dataTransfer.files` puste), a słaby stan jest już
      poprawnie odfiltrowany. Kosmetyka nie warta osobnego warunku w dwóch miejscach.
- [x] fixed · gate · `eslint.config.mjs:113`, `.gitignore:70` · `pnpm lint` wywracał się na `ENOENT`
      w `.next-qa/` (katalog builda QA nie był ignorowany ani przez eslint, ani przez git). Noga lint
      bramki nie dawała się w ogóle uruchomić — dopisane do obu list ignorów.
- [x] dropped · reuse-scan · `line-items-field.tsx:50` · `isReceiptFile` powiela pojęcie z `matchesAccept`
      (`file-input.tsx:173`), a string `image/*,application/pdf` żyje w trzech miejscach. Przeniesienie
      `matchesAccept` do wspólnego utila dałoby `matchesAccept(file, RECEIPT_ACCEPT)` — parametry równe
      kodowi, realnym zyskiem jest tylko jedna stała. Za mało, żeby ruszać kod spoza tej zmiany.
- [x] skipped · gate · `src/app/(legal)/{privacy,terms,usuwanie-danych}/page.tsx`, `test.js` ·
      4 błędy lintu **sprzed** tej zmiany (3× `<a>` zamiast `<Link>` na stronach prawnych, `no-undef`
      w `test.js` — zabłąkany plik-śmieć w korzeniu repo). Nie tykam: inny obszar, zero związku
      z drag&drop. Zgłoszone właścicielowi w podsumowaniu bramki.
- [x] dismissed · code-review · `use-window-file-drag.ts` · N+1 instancji hooka w formularzu wydatku —
      zweryfikowane jako nie-bug: instancje widzą ten sam strumień zdarzeń i chodzą w zgodzie,
      `preventDefault` jest idempotentne, a `setState` na niezmienionym booleanie nie rerenderuje.
- [x] dismissed · impl-review · `plan.md` faza 1 · słaby stan to `ring-1` przy 40% krycia, a plan pisał
      o „przerywanej ramce + ledwie widocznym tle". Kontrakt planu zostawiał kształt implementerowi
      („rozstrzyga implementer po zobaczeniu obu renderów"), a ring jest tu właściwszy: nie rusza
      geometrii, czego plan wymagał wprost. Ocena wizualna należy do checków manualnych.
- [x] dropped · impl-review · `4de2666e` · commit z epilogiem zmiany skasował przy okazji
      `src/scripts/fix-work-catalogue-texts.ts` + `work-catalogue-fixes.tsv` (1186 linii) należące do
      katalogu prac. Same kasowania są zgodne z cyklem życia skryptów jednorazowych, tylko etykieta
      commita kłamie. Historii nie przepisuję.

## Simplify pass

Przebieg wykonany w wątku głównym (diff 3 plików) zamiast pełnego `/simplify` — 0 zastosowanych
uproszczeń poza fixami wyżej, 1 dedup zbadany i porzucony (`isReceiptFile`, wpis wyżej). Brak
reinwencji prymitywów: `grep` po `dragover|DataTransfer|onDrop` w `src/` zwraca wyłącznie te trzy
pliki, więc hook nie duplikuje niczego istniejącego.

## Tests & suite

- `pnpm typecheck` — zielony.
- `pnpm lint` — zielony dla tej zmiany po naprawie ignorów; zostają 4 błędy sprzed zmiany (wpis wyżej).
- `pnpm test` — zielony: 244 plików, 3298 testów (64 pliki / 268 testów skipped, wymagają bazy).
- `pnpm test:e2e` — nieuruchamiane (przebieg ~1 h, wymaga zgody właściciela).
- `pnpm build` — nieuruchamiany.
- E2E należne tej zmianie: **anulowane decyzją właściciela** — EX-774 w stanie Canceled. Ryzyko
  browser-level przenosi się w całości na checki manualne sekcji `drag-drop-guard`.
