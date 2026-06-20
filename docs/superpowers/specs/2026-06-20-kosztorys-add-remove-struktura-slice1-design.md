# Kosztorys v2 — edytowalność strukturalna, Slice 1 (dodawanie/usuwanie pozycji + sekcji)

**Status:** zaakceptowany (brainstorm 2026-06-20) · **Change:** `context/changes/kosztorys-poc-in-app`

Pierwszy slice zdejmowania `lockRows`: dodawanie/usuwanie pozycji i sekcji w głównej
(płaskiej) siatce edytora v2, z panelem „Sekcje" jako pulpitem sterowania. Reorder,
drag-drop i etapy są poza tym slice'em (patrz „Poza zakresem").

## Kontekst

- Edytor v2 (`src/components/kosztorys/kosztorys-editor-v2.tsx`) renderuje **płaską**
  siatkę `react-datasheet-grid`: każdy wiersz = pozycja, sekcja to zdenormalizowana
  kolumna (brak wierszy-nagłówków sekcji). `rows` żyje w `useState` (seed z `treeToRows`);
  `onChange` scala edycje **po id przy stałym zbiorze** — dlatego dotąd `lockRows`.
- Panel boczny **„Sekcje"** (`kosztorys-section-summary.tsx`) już istnieje: składany,
  wypisuje sekcje z subtotalami (read-only). Slice 1 czyni go **pulpitem** (dodaj/nazwa/
  usuń/filtruj), reużywając go zamiast budować osobny „widok sekcji".
- **Backend gotowy:** `addItemAction(investmentId, sectionId)`, `removeItemAction(itemId)`,
  `addSectionAction(investmentId)`, `removeSectionAction(sectionId)`,
  `updateSectionFieldAction` — wszystkie w `src/lib/actions/kosztorys.ts`; add\* zwracają
  `{ id, displayOrder }`. Brak `reorderAction` (to Slice 2).

## Zakres (Slice 1)

Dodawanie/usuwanie **pozycji** i **sekcji**, zmiana **nazwy sekcji**, filtr „pokaż tylko
tę sekcję". „Widok pojedynczej sekcji" = **tryb filtra**, nie osobna powierzchnia (filtr to
dosłownie ten sam zbiór `rows` zawężony → sync 1:1 za darmo).

## UX — panel „Sekcje" jako pulpit

- **Dodaj sekcję:** „＋ Nowa sekcja" w panelu. Nowa sekcja **od razu dostaje jedną pustą
  pozycję** (inaczej pusta sekcja = 0 wierszy = niewidoczna w płaskiej siatce). Klient:
  `await addSectionAction` → `await addItemAction(sectionId)` (transakcyjność pomijamy — POC).
- **Zmień nazwę sekcji:** ołówek w panelu → edycja inline → `updateSectionFieldAction`;
  aktualizuje zdenormalizowaną `sectionName` we **wszystkich** wierszach tej sekcji.
  **Kolumna „Sekcja" w siatce → read-only** (dziś edytowalna, ale edycja per-wiersz zmienia
  tylko kopię tego wiersza, nie sekcję — ukryty bug; nazwę zmienia się wyłącznie w panelu).
- **Usuń sekcję:** kosz w panelu → potwierdzenie („usunie też N pozycji" — FK kasuje
  kaskadowo). Jeśli usuwasz sekcję aktualnie zafiltrowaną → wyczyść `activeSectionId`.
- **Filtruj do sekcji:** klik nazwy sekcji w panelu → `activeSectionId`; siatka pokazuje
  tylko jej wiersze (AND z szukajką i sortem). „Pokaż wszystkie" czyści.
- **Dodaj pozycję:** „＋ pozycja" przy sekcji w panelu (cel jednoznaczny). Gdy siatka jest
  zafiltrowana do sekcji — także przycisk „＋ pozycja" na górnym pasku.
- **Usuń pozycję:** ikonka kosza w **wierszu** (własna kolumna akcji) → `removeItemAction`.

## Model stanu — optymistyczny splice

`lockRows` **zostaje włączone** — nie dotykamy mechaniki wierszy dsg (to był cały problem,
którego unikał lock). Strukturę zmieniamy **własnymi przyciskami + `setRows`**; dsg dalej
tylko renderuje `value` (które JEST reaktywne, w przeciwieństwie do sizing kolumn).

- **Dodanie pozycji:** `await addItemAction` zwraca `{ id, displayOrder }` → `buildBlankRow`
  buduje wiersz (zdenormalizowane pola znanej sekcji + `stage_*`=0 + zwrócone id/order) →
  dopięcie do `rows`; `prevById.set(id, row)`. W tle `router.refresh()` po sumy.
- **Usunięcie pozycji:** od razu wyrzuć po id z `rows`, `prevById.delete(id)`, odpal akcję;
  w tle refresh.
- **Sekcje:** po add/remove sekcji `router.refresh()` (rzadkie, świadome) — nowa sekcja
  wpada z pustą pozycją, usunięta znika z `rows` przez reseed na refreshu.

## Inwarianty i edge-case'y

- **Sekcja ma ≥1 pozycję.** Wynika z „nowa sekcja dostaje pustą pozycję". Stąd: **usunięcie
  ostatniej pozycji sekcji jest zablokowane** (kosz nieaktywny / proponuje „usuń sekcję").
  Po co: panel liczy sekcje z `rows`; sekcja bez wierszy zniknęłaby z panelu i nie dałoby się
  do niej wrócić. Inwariant trzyma spójność panel↔grid bez przebudowy źródła panelu.
- **`prevById`** w rytm splice'u (add → set, remove → delete) — diff zostaje spójny.
- **Filtr + sort + szukajka** komponują się na `viewRows`; `onChange` scala po id do pełnego
  zbioru, więc ukryte/odfiltrowane wiersze są bezpieczne.

## Pliki (orientacyjnie)

- `kosztorys-editor-v2.tsx` — `activeSectionId`, handlery add/remove, splice w `setRows`,
  przekazanie akcji do panelu + kolumny akcji.
- `kosztorys-section-summary.tsx` — panel z read-only staje się pulpitem (＋sekcja, nazwa,
  kosz, klik=filtr, ＋pozycja). _(Plik aktualnie rozwijany — koordynować przy implementacji.)_
- `kosztorys-v2-columns.tsx` — kolumna akcji (kosz), `sectionName` read-only.
- `v2-rows.ts` — `buildBlankRow`, `applyAddItem`, `applyRemoveItem` (czyste helpery).
- `lib/actions/kosztorys.ts` — ewentualnie cienkie `addSectionWithItemAction` (albo sekwencja
  po stronie klienta).

## Poza zakresem (kolejne slice'y)

- **Slice 2 — reorder:** strzałki ▲▼ + „Zapisz kolejność" / „Przywróć kolejność". Model:
  sort/strzałki układają ulotnie; `display_order` zapisywany **jawnym przyciskiem** (nie
  autosave); trzeci klik w nagłówek / przycisk „Przywróć" wraca do zapisanej kolejności.
  Wymaga `reorderAction` (jeszcze nie istnieje).
- **Później:** drag-drop (zamiast strzałek), dodawanie/usuwanie **etapów** (operacje na
  kolumnach — inny UX).

## Testy

Odłożone na życzenie właściciela (2026-06-20). Gdy wrócą: ryzyko siedzi w modelu stanu, więc
jednostkowo czyste helpery (`buildBlankRow`/`applyAddItem`/`applyRemoveItem`, inwariant
„≥1 pozycja"), nie cienkie akcje serwerowe.
