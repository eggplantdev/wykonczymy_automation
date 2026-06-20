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
  - **TODO MVP — wskaźnik aktywnej sekcji.** Obecnie jedyna oznaka filtra to subtelne
    podświetlenie pozycji w panelu (`bg-accent/40`) — a panel bywa **zamknięty**, więc
    wtedy nie widać, że siatka jest zawężona do jednej sekcji. Dodać **zawsze widoczny
    wskaźnik na górnym pasku** (badge „Sekcja: <nazwa>" z ✕ czyszczącym filtr), niezależny
    od stanu panelu. Nazwę brać z `subtotals` po `activeSectionId`. Mały dodatek UX —
    osobny krok, nie blokuje Slice 1.
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
  - **Stan implementacji (2026-06-20):** strażnik egzekwowany jest w `handleRemoveItem`
    (count z `prevById`, event-time) przez `window.alert` + `return` — kosz jest klikalny
    zawsze, dopiero kliknięcie na ostatniej pozycji pokazuje komunikat zamiast usuwać.
    Powód odejścia od wyszarzenia: dsg zamraża `columns` na montażu (live-count w komórce
    widziałby stan z mountu), a reguła `react-hooks/refs` blokuje render-time odczyt refa.
  - **TODO MVP:** zamienić `window.alert` na **wyszarzony (disabled) kosz z tooltipem**
    („Sekcja musi mieć co najmniej jedną pozycję — użyj kosza sekcji"). Realizacja: nieść
    flagę „ostatnia pozycja w sekcji" **na wartości grida** (reaktywnej, omija zamrożenie
    kolumn), nie przez render-time ref. Osobny, mały slice — nie poprawka.
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
- **Podsumowania netto/brutto (TODO).** Panel „Sekcje" (subtotale per sekcja + stopka
  „Suma") oraz licznik w górnym pasku pokazują **tylko netto**. Mają respektować **wybór
  netto/brutto** — przełącznik (osobny od przełącznika 3 widoków cen), który zmienia, czy
  kwoty w podsumowaniach są netto czy brutto. Brutto liczy się już per wiersz
  (`rowNetForView × (1 + effectiveVat)`); subtotale muszą sumować odpowiednią wartość wg
  trybu. Dotyczy `sectionSubtotalsForView`/`SectionSubtotalT` (panel zdefiniowany w specu
  `2026-06-20-kosztorys-section-subtotals-design.md`) — zmiana tam, tu tylko zaparkowane.
- **Wybór kolorów sekcji (pomysł, do oszacowania).** Pozwolić przypisać sekcji kolor —
  w **płaskiej** siatce sekcje nie mają wierszy-nagłówków, więc kolor (np. lewy pasek /
  tło komórki „Sekcja", kropka w panelu) byłby tanim, zawsze-widocznym sposobem na wzrokowe
  odróżnienie sekcji i wzmocnienie wskaźnika aktywnej sekcji. Zakres do doprecyzowania:
  paleta predefiniowana vs dowolny kolor, nowe pole `color` na `kosztorys-sections`
  (+ migracja) i zdenormalizowanie go na wierszu (jak `sectionName`/`sectionVatRate`).
  Wymaga osobnego brainstormu — tu tylko zaparkowane.

## Testy

Odłożone na życzenie właściciela (2026-06-20). Gdy wrócą: ryzyko siedzi w modelu stanu, więc
jednostkowo czyste helpery (`buildBlankRow`/`applyAddItem`/`applyRemoveItem`, inwariant
„≥1 pozycja"), nie cienkie akcje serwerowe.
