---
date: 2026-09-29T07:18:56+0200
researcher: Claude (Opus 5.5)
git_commit: 52fcdf29
branch: staging
repository: wykonczymy
topic: "Warsztat per szablon — co zmienia przejście z jednego wspólnego warsztatu na warsztat zakładany razem z każdym szablonem"
tags: [research, kosztorys, szablony, warsztat, presets, migrations, golden-master]
status: complete
last_updated: 2026-09-29
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Follow-up: zmiana kierunku — szablon JEST inwestycją, biblioteka kosztorys_presets i lustro znikają"
---

# Research: warsztat per szablon

> **Kierunek zmieniony 2026-09-29 — obowiązuje „Follow-up Research" na końcu.** Szablon JEST
> inwestycją ze statusem `szablon`; `kosztorys_presets` i lustro znikają. Sekcje 1–7 opisują wariant
> „warsztat per szablon + lustro do biblioteki" i zostają jako mapa kodu; gdzie są sprzeczne
> z follow-upem, wygrywa follow-up.

**Date**: 2026-09-29T07:18:56+0200
**Git Commit**: 52fcdf29 · **Branch**: staging · **Repository**: wykonczymy

## Research Question

Każdy szablon (`kosztorys_presets`) ma dostać własną inwestycję-warsztat, zakładaną **w tej samej
transakcji co szablon** i związaną z nim na stałe (1:1), zamiast jednego wspólnego warsztatu
przełączanego wskaźnikiem `investments.template_preset_id`. Co w kodzie istnieje tylko dlatego, że
warsztat jest jeden, co musi zmienić kształt, co psuje się przy N warsztatach, jak zakładać i usuwać
warsztat razem z szablonem i jak zmigrować dane. Motywacja i decyzje: `change.md`.

## Summary

- **Projekt jest wykonalny bez blokera, a w bilansie głównie kasuje kod.** Całe „Otwórz" (eksmisja,
  podmiana drzewa, przesunięcie wskaźnika, repeatable read + retry), jednoinstancyjne
  wyszukiwanie warsztatu, strażnicy wskaźnika w lustrze, kliencki krok otwierania z `OPEN_FLAG`
  i ekran `OpenWorkshopPrompt` przestają mieć rację bytu. `/szablony/[id]` staje się zwykłym
  renderem serwerowym drzewa własnego warsztatu.
- **Lustro do biblioteki zostaje** (dławik `mirrored_at`, dopchnięcie przy bezczynności /
  ukryciu karty / wyjściu) — biblioteczny jsonb ma sześciu czytelników (zasiew inwestycji z szablonu,
  „Wczytaj szablon…", „Dodaj sekcje z szablonu", liczniki listy, sortowanie po `updated_at`, skrypt
  poprawiania opisów). Traci tylko strażników wskaźnika.
- **Przy N warsztatach bez zmian kodu psują się cztery rzeczy, trzy po cichu:**
  1. unikalny indeks `investments_single_szablon_idx` odrzuca drugi warsztat (23505) — głośno;
  2. `getWorkshop` (`ORDER BY id LIMIT 1`) zwraca zawsze ten sam warsztat, więc strażnik lustra
     `workshop.id !== investmentId` **wyłącza autozapis do biblioteki dla każdego warsztatu poza
     jednym** — najgroźniejsza cicha awaria;
  3. usunięcie szablonu przy FK `ON DELETE SET NULL` zostawia osierocony warsztat z ~300 pozycjami,
     którego nie da się wrzucić do kosza (odmowa po statusie);
  4. oś kosztorysu w golden-masterze zwalnia tylko `getWorkshop()?.id` — każdy kolejny warsztat
     z treścią wywala pre-push (powtórka 48bb1625 N−1 razy).
- **Nadpisanie szablonu omija warsztat.** `savePresetAction('overwrite')` (`upsertPresetByName`)
  i `scripts/fix-kosztorys-descriptions.ts` piszą tylko do biblioteki; przy trwałym warsztacie
  następne lustro zserializuje stare drzewo i po cichu cofnie nadpisanie. Dziś ta sama wada istnieje,
  ale tylko dla szablonu akurat trzymanego.
- **Finanse są bezpieczne.** Listing, dashboard, pickery księgowania, linki `/k/…`, arkusze, leady,
  crony i powiadomienia albo filtrują `status <> 'szablon'` u źródła (`reference-data.ts:73`), albo
  startują od transakcji / etapów, których warsztat nie ma.
- **Zakładanie warsztatu w transakcji szablonu jest proste**: lokalne API Payloada z `req`
  transakcji, wymagane tylko `name`/`status`/`settlementMode`, hooki inwestycji nie mają efektów
  wychodzących. Migracja danych w TS jest wykonalna po zdjęciu `server-only` z dwóch plików
  wstawiania drzewa.

## Detailed Findings

### 1. Kod istniejący tylko dlatego, że warsztat jest jeden — do usunięcia

Serwer:

- `src/lib/kosztorys/open-preset-in-workshop.ts` (cały plik) — eksmisja + podmiana + wskaźnik
  w jednej transakcji repeatable read z retry; typy `WorkshopTreeT` / `OpenedWorkshopT`.
- `src/lib/actions/kosztorys-presets.ts:156-172` — `openPresetInWorkshopAction`.
- `src/lib/db/workshop-investment.ts:9-23` `getWorkshop` (status + `ORDER BY id LIMIT 1`),
  `:25-34` `setWorkshopPreset` (wskaźnik ustawiany raz, przy zakładaniu).
- `src/lib/kosztorys/provision-workshop.ts` — `resolveWorkshopInvestment`, leniwe zakładanie singletonu
  (przy okazji zamyka EX-845: provisioning pisał z warstwy DAL).
- `src/lib/kosztorys/mirror-workshop-preset.ts:75-82` — strażnicy wyścigu wskaźnika.
  `mirrorWorkshopPresetInTransaction` (`:60-92`) był wydzielony tylko po to, żeby „Otwórz" mogło go
  wołać z propagacją błędu — może wrócić do `mirrorWorkshopPreset`. Blokada
  `lockInvestmentForReplace` (`:72-73`) serializowała względem podmiany w „Otwórz"; jej zdjęcie jest
  opcjonalne.
- `src/lib/db/snapshots.ts:51-56` `HELD_PRESET` i klauzule `IS NOT DISTINCT FROM` (`:78, :129, :145,
  :186, :211`) — przy stałym powiązaniu redundantne; kasować dopiero po przepięciu starych punktów
  przywracania (§5).
- `src/migrations/20260914_1_szablon_workshop_constraints.ts:16-17` — indeks
  `investments_single_szablon_idx` **musi** zniknąć.

Klient:

- `src/components/presets/template-workshop.tsx` — całość (`ServerWorkshopT`, `stripOpenFlag`,
  zatrzask auto-otwarcia, uzgadnianie `seenServer`, fallback do promptu).
- `src/components/presets/open-workshop-prompt.tsx` — całość.
- `src/components/presets/preset-open-href.ts` — `OPEN_FLAG`; `presetOpenHref` staje się gołym
  `/szablony/${id}` (wołający: `presets-data-table.tsx:20`, `create-empty-preset-dialog.tsx:32`,
  `reload-from-preset-dialog.tsx:92`).
- `src/app/(frontend)/szablony/[id]/page.tsx:7,39` — odczyt `autoOpen` / `searchParams`.

### 2. Co musi zmienić kształt

- **Wyszukiwanie warsztatu** → `getWorkshopForPreset(db, presetId)` (`WHERE template_preset_id = $1`).
  Wołający: `getWorkshopView` (`src/lib/queries/presets.ts:74-81`, `investmentId` przestaje być
  nullable), `flushWorkshopPresetAction` (`kosztorys-presets.ts:180-195`).
- **`/szablony/[id]/page.tsx`** — nazwa + id warsztatu → `getKosztorysTree(workshopId)` →
  `KosztorysEditorV2` z `templatePresetId`. Bez zapisu na renderze, więc prefetch na hoverze zostaje
  bezpieczny. Brak warsztatu = `notFound()`, nie provisioning w renderze.
- **Tworzenie szablonu** — trzy ścieżki, żadna dziś w transakcji:
  - `createEmptyPresetAction` (`kosztorys-presets.ts:91-113`) — pusty szablon;
  - `savePresetAction('new')` (`:45-80`) — „Zapisz jako nowy szablon…", serializacja drzewa
    inwestycji (`serialize-preset.ts:15-37`, bez przedmiaru / rabatu / etapów);
  - `savePresetAction('overwrite')` → `upsertPresetByName` (`presets.ts:60-78`) — **też tworzy**, gdy
    nazwa jest nowa.
  Rekomendacja: jedna funkcja domenowa (np. `createPresetWithWorkshop`) w `withPayloadTransaction`:
  `insertPreset` → `payload.create({ collection: 'investments', data: { name, status: 'szablon',
  settlementMode, templatePresetId }, req })` → `applyPreset(payload, req, id, payload)`
  (`apply-preset.ts:14-26`, tylko wstawia, bez ustawień). `insertPreset` zostaje prymitywem dla
  testów. „Zapisz jako…" jest dostępne także wewnątrz warsztatu (`kosztorys-actions-menu.tsx:127`).
- **Nadpisanie** — gałąź overwrite musi w tej samej transakcji odtworzyć drzewo warsztatu tego
  szablonu (`restoreKosztorys`), inaczej lustro cofnie nadpisanie.
- **Usunięcie** (`deletePresetAction`, `kosztorys-presets.ts:122-136`; `presets.ts:179-187`) — musi
  zabrać warsztat. Rekomendacja: FK `investments_template_preset_id_fk` na **`ON DELETE CASCADE`**;
  od inwestycji kaskadują już sekcje, pozycje, etapy, snapshoty, share'y, `kosztorys_client_view`,
  `investments_rels`, `payload_locked_documents_rels`. Bezpieczne tylko razem z CHECK-iem z §4 (żadna
  prawdziwa inwestycja nie niesie wskaźnika). Dołożyć wygaszenie `KOSZTORYS_TREE_TAGS`.
- **„Przełącz na inny szablon…"** w warsztacie (`reload-from-preset-dialog.tsx:39-95`,
  `reload-preset-action.tsx:17-21`, `COPY.szablon`) — przełączanie znika; do decyzji: skasować
  (nawigacja przez `/szablony`) albo przywrócić prawdziwe „Wczytaj szablon" (zastąp treść tego
  szablonu cudzą — bezpieczne, bo nie ma już wskaźnika do zepsucia).
- **`src/scripts/fix-kosztorys-descriptions.ts:60,74`** — pisze wprost do `kosztorys_presets.payload`;
  musi pisać do warsztatu albo zostać wycofany.
- **Nieaktualne komentarze**: `collections/investments.ts:18-19, 161-168`; `db/presets.ts:80-81,
  179-181`; `save-preset-dialog.tsx:56-58`; `template-crumb.tsx:10-11`; `page.tsx:10-15`;
  uzasadnienie zdejmowania id w `preset-content.ts:4-7`.

### 3. Co zostaje bez zmian

- `investment-action.ts:84-92` — lustro po udanym zapisie z `templatePresetId` bramki; działa per
  inwestycja już dziś. `investment-gate.ts` w całości.
- Tożsamość edytora: `isWorkshop` / `editorNoun` wyprowadzane z `templatePresetId`
  (`kosztorys-editor-body.tsx:132-133`, `use-kosztorys-editor-context.tsx:22-28`), wszystkie bramki UI
  warsztatu, `WORKSHOP_VISIBLE_COLUMNS`.
- Ustawienia warsztatu (współczynniki, VAT, tryb) stają się per szablon, ale pozostają obojętne:
  `isSamePresetContent` ignoruje `settings` (`preset-content.ts:6-10`), nowe warsztaty startują na
  domyślnych.
- localStorage `kosztorys-filters:<investmentId>` (`use-engaged-conditions.ts:21`) — dziś ptaszki
  z szablonu A przeciekają do B (domain-notes:1480); per-szablon id naprawia to gratis.

### 4. Integralność 1:1

- Zdjąć `investments_single_szablon_idx`.
- `CREATE UNIQUE INDEX … ON investments (template_preset_id)` — NULL-e są różne, więc indeks
  częściowy niepotrzebny.
- `CHECK ((status = 'szablon') = (template_preset_id IS NOT NULL))` — warsztat zawsze ma szablon,
  prawdziwa inwestycja nigdy; zabezpiecza kaskadę z §2 i przypadkowy wybór statusu z formularza
  (`investment-schema.ts:14` przyjmuje `'szablon'`). Wymaga, żeby wskaźnik szedł w tym samym
  `INSERT` co status.
- Kierunek odwrotny („każdy szablon ma warsztat") wymagałby FK cyklicznego / deferred — przy 5
  wierszach nie warto; pilnuje go jedna funkcja zakładająca + test DB. Alternatywa rozważona:
  odwrócony wskaźnik `kosztorys_presets.workshop_investment_id NOT NULL` — silniejszy, ale więcej
  zmian w istniejącym kodzie opartym o `template_preset_id`.

### 5. Migracja danych

Stan lokalny (5433): warsztat #151 trzyma szablon 8 (11 sekcji, 310 pozycji, 0 etapów, 0 transakcji,
147 punktów przywracania: szablon 4→19, 5→31, 6→2, 7→6, 8→14, bez szablonu→75). Szablony 4–7 nie
mają warsztatu. Rozmiary: 202 / 311 / 176 / 310 / 310 pozycji (~1300 wierszy `kosztorys_items`
więcej, wobec ~4130 w dumpie prod). `db-test` (5435): #151 z 0 pozycji, wskaźnik 8, te same 5
szablonów.

- `payload migrate` podaje `{ db, payload, req }`; **żadna migracja w repo nie importuje kodu
  aplikacji**. Blokerem jest `import 'server-only'` w `insert-kosztorys-tree.ts:1` i
  `insert-rows.ts:1` — oba importują tylko `sql` i typy; ten sam zabieg zrobiono już w `presets.ts:1-2`
  i `workshop-investment.ts:1`.
- Czysty SQL jest możliwy (szablony nie niosą etapów ani postępu), ale powielałby listę kolumn
  `ITEM_INSERT_COLUMNS` i `itemWithColumnDefaults` — ryzyko dryfu.
- Rekomendacja: migracja TS, dla każdego szablonu bez warsztatu: `INSERT` inwestycji (status,
  `settlement_mode`, VAT, współczynniki, `template_preset_id`) → `insertKosztorysTree(db, id,
  preset.payload)` → przepięcie jego punktów przywracania
  (`UPDATE kosztorys_snapshots SET investment_id = <nowy> WHERE investment_id = <stary> AND
  template_preset_id = <szablon>`). #151 zostaje warsztatem szablonu, który trzyma; jeśli na prod ma
  wskaźnik NULL — do rozstrzygnięcia (skasować albo przypisać). W tej samej migracji: zdjęcie indeksu
  singletonu, unikalność, CHECK, FK → CASCADE.
- **Kolejność wdrożenia**: migracja jest addytywna, ale stary kod w oknie między migracją a deployem
  wybierze #151 (`LIMIT 1`), a jego „Otwórz" innego szablonu zderzy się z nowym unikalnym indeksem
  (odmowa, nie korupcja). Okno krótkie; migrować tuż przed pushem.

### 6. Skutki N inwestycji „szablon" poza kodem szablonów

Bezpieczne (filtr u źródła `reference-data.ts:73` albo brak transakcji / etapów): listing inwestycji,
dashboard, pickery księgowania, `/inwestycje/[id]` (404 dla szablonu), cron dziennych snapshotów
(`snapshots.ts:88-93`), sumy rejestrów i pracowników (`sum-transfers.ts`), `kosztorys-subcontractor-due`
(start od etapów), linki `/k/…` i `/p/…`, arkusze Google, leady, kosz, sprzęt, powiadomienia.

Do zmiany / uwagi:

| Miejsce | Skutek N | Werdykt |
|---|---|---|
| `financial-golden-master-db.test.ts:403, 476-480, 563-573` | zwalnia z osi kosztorysu tylko `getWorkshop()?.id`; każdy inny warsztat z treścią wywala pre-push | **zmienić**: zwolnić każdy `status = 'szablon'` |
| `DATASET_FLOOR.kosztorysItems > 20` (`:215-218, 361-375`) | ~1300 pozycji szablonów samo przebija próg; podłoga przestaje wykrywać dump bez kosztorysów | zmienić (tanio): liczyć bez szablonów |
| `kosztorys-client-totals.ts:40-76` | N wierszy zer zamiast 1, mapa czytana po id | bezpieczne (filtr opcjonalny) |
| `.github/workflows/db-backup.yml:55,154-160` | twarde usunięcie warsztatu zmniejsza licznik inwestycji → jednorazowy fail „no-shrink" | kosmetyka (znane z purge kosza) |
| `investment-render-parity-db.test.ts:62` | N porównań zero-do-zera | bezpieczne |

### 7. Testy

- **Do skasowania**: `__tests__/components/presets/template-workshop.test.tsx` (7);
  `lib/actions/kosztorys-presets.test.ts:555-673` blok `openPresetInWorkshop` (9) i `:428`;
  `lib/kosztorys/mirror-workshop-preset.test.ts:195`; `lib/db/workshop-investment.test.ts:55, :62`
  (drugi da się odwrócić w „drugi warsztat dla tego samego szablonu odrzucony");
  `lib/db/snapshots.test.ts:289, :296` (jeśli znika `HELD_PRESET`).
- **Do przepisania**: helper `__tests__/helpers/workshop.ts` `acquireTestWorkshop` (pożycza jedyny
  warsztat z dumpa) → każdy spec zakłada własny szablon + warsztat i sprząta; jego użytkownicy:
  `kosztorys-presets.test.ts`, `investment-trash.db.test.ts:93`, `workshop-investment.test.ts`,
  `snapshots.test.ts`, `mirror-workshop-preset.test.ts:146-182`, `capture-daily-snapshots.test.ts:94`.
  Golden master (wyżej), `create-empty-preset-dialog.test.tsx:49` (href z flagą),
  `kosztorys-actions-menu.test.tsx:87-92` („Przełącz na inny szablon…").
- **Nowe (ryzyka tej zmiany)**: szablon zawsze powstaje z warsztatem (obie ścieżki + upsert);
  odmowa tworzenia nie zostawia warsztatu; usunięcie szablonu usuwa warsztat i jego drzewo;
  nadpisanie aktualizuje warsztat i lustro go nie cofa; autozapis działa dla **każdego** warsztatu
  (regresja cichej awarii z Summary pkt 2); CHECK odrzuca inwestycję `szablon` bez wskaźnika.
- **E2E**: żaden spec nie otwiera warsztatu. `e2e/kosztorys-presets.spec.ts` tworzy szablony przez
  „Zapisz jako nowy szablon" — przy zakładaniu warsztatu każde uruchomienie zostawi inwestycję
  w 5435; sprzątanie musi to objąć (usunięcie szablonu z CASCADE wystarczy).

## Code References

- `src/lib/db/workshop-investment.ts:9-34` — `getWorkshop` / `setWorkshopPreset`, singleton po statusie
- `src/lib/kosztorys/provision-workshop.ts:14-30` — leniwe zakładanie singletonu (wzór `payload.create`)
- `src/lib/kosztorys/open-preset-in-workshop.ts:33-80` — „Otwórz" jako transakcja podmiany
- `src/lib/kosztorys/mirror-workshop-preset.ts:23-92` — lustro, dławik, strażnicy wskaźnika
- `src/lib/actions/kosztorys-presets.ts:45-195` — tworzenie / nadpisanie / usunięcie / otwarcie / dopchnięcie
- `src/lib/db/presets.ts:41-187` — `insertPreset`, `upsertPresetByName`, `claimPresetMirror`, delete
- `src/lib/actions/investment-action.ts:84-92` — autozapis przy każdym zapisie drzewa
- `src/lib/db/snapshots.ts:51-56` — `HELD_PRESET`
- `src/lib/queries/presets.ts:74-81` — `getWorkshopView`
- `src/app/(frontend)/szablony/[id]/page.tsx` — host warsztatu
- `src/components/presets/template-workshop.tsx`, `open-workshop-prompt.tsx`, `preset-open-href.ts`
- `src/lib/kosztorys/apply-preset.ts:14-26`, `restore-kosztorys.ts:14-67`, `insert-kosztorys-tree.ts:58`
- `src/migrations/20260914_1_szablon_workshop_constraints.ts:10-21` — indeks singletonu + FK SET NULL
- `src/lib/queries/reference-data.ts:73` — ukrycie `szablon` u źródła
- `src/__tests__/helpers/workshop.ts`, `src/__tests__/financial-golden-master-db.test.ts:403, 476-480`

## Architecture Insights

- Obecny model to **multipleksowanie jednego zasobu przez wskaźnik** — ten sam identyfikator
  (inwestycja warsztatu) zmienia znaczenie w czasie, więc każdy zapis, lustro, historia wersji
  i test musiały dostać własnego strażnika „czy to wciąż ten szablon". Warsztat per szablon
  przywraca niezmiennik „id inwestycji = stała tożsamość treści", na którym stoi cały edytor
  kosztorysu — strażnicy stają się zbędni zamiast poprawiani.
- Gwarancje przenoszą się z kodu do bazy: unikalność + CHECK + CASCADE zamiast `LIMIT 1`,
  porównań wskaźnika i transakcji repeatable read.
- Biblioteka pozostaje **read modelem** zasilanym lustrem (CQRS-owy podział: warsztat = model zapisu,
  jsonb = model odczytu dla zasiewu i pickerów). Opcja radykalna — czytelnicy czytają żywe drzewo
  warsztatu (`serializeKosztorysAsPreset(warsztatId)`), co kasuje lustro, dławik, `mirrored_at`,
  hook dopchnięcia i `flushWorkshopPresetAction` — odwraca ruling „źródło prawdy to
  `kosztorys_presets`" i wymaga nowego źródła sortowania „ostatnio edytowany".

## Historical Context (from prior changes)

- `context/archive/2026-09-14-szablony-crud/change.md:18` — ruling: źródło prawdy to
  `kosztorys_presets`, inwestycja nigdy drugim magazynem.
- `context/archive/2026-09-14-szablony-crud/change.md:20` — „Jeden warsztat na całą instalację …
  Per-szablon warsztaty to osobna funkcja" — ta zmiana jest tą funkcją.
- e93977f3 — zapis po id, indeks singletonu, `kosztorys_snapshots.template_preset_id` (historia
  mieszała punkty różnych szablonów), brak zapisu na renderze `/szablony/[id]` + `OpenWorkshopPrompt`,
  ukrycie warsztatu u źródła SQL.
- `context/archive/2026-09-22-szablon-autosave/change.md:56-79` — lustro z dławikiem, eksmisja,
  „Wczytaj szablon…" → „Przełącz na inny szablon…" (stare znaczenie było pułapką pod autozapisem).
  Review gate: EX-843/844/846 zamknięte, EX-845 (provisioning z DAL) otwarte, EX-847 (E2E
  przełączania, `e2e-backlog`) otwarte.
- 48bb1625 — `acquireTestWorkshop` i wyłączenie warsztatu z osi golden mastera.
- `context/archive/2026-09-28-szablon-open-speed/change.md` + review-gate:12-15 — EX-876, atomowe
  „Otwórz"; EX-893 zgłoszone jako skutek wspólnego warsztatu.
- `context/foundation/manual-checks.md:660, :664-669, :1687-1699` — „Warsztat jest JEDEN
  i współdzielony"; punkt „Przed wczytaniem" niewidoczny w Wersjach; otwarte „Needs human":
  przełączenie między dwoma szablonami ~200 pozycji zawisało ~90 s na `openPresetInWorkshopAction`.
- `context/foundation/lessons.md:1679-1683` — status `szablon` jako etykieta, nie bramka. **Częściowo
  nieaktualne**: `kosztorys-subcontractor-due` startuje dziś od etapów
  (`kosztorys-subcontractor-due.ts:57-62`), więc warsztat nie produkuje tam wiersza — do poprawienia
  przy tej zmianie.

## Related Research

- Brak osobnych `research.md` — archiwa szablonów zachowały tylko `change.md` i `review-gate.md`;
  destylat w `context/reference/kosztorys-editor-domain-notes.md:1440-1525`.

## Open Questions

1. **Ruling „nigdy drugi magazyn"** — do potwierdzenia z właścicielem (change.md). Od tego zależy też,
   czy rozważać opcję radykalną (czytelnicy czytają żywe drzewo, lustro znika). Rekomendacja:
   zostawić lustro — mniejsza zmiana, ruling nietknięty w praktyce.
2. **Kierunek wskaźnika** — istniejący `investments.template_preset_id` + UNIQUE + CHECK + CASCADE
   (rekomendacja) czy odwrócony `kosztorys_presets.workshop_investment_id NOT NULL`.
3. **„Przełącz na inny szablon…" w warsztacie** — skasować czy przywrócić jako prawdziwe „Wczytaj
   szablon" (zastąp treść tego szablonu).
4. **#151 na produkcji** — jaki ma wskaźnik; jeśli NULL, skasować czy przypisać. Sprawdzić przed
   napisaniem migracji (odczyt z dumpa, nie z Neona).
5. **Stare punkty przywracania** — przepiąć do nowych warsztatów w migracji (rekomendacja, jeden
   `UPDATE` na szablon) czy porzucić; 75 punktów bez szablonu już dziś jest niewidocznych.
6. **Linear**: EX-893 zamknąć jako zastąpione; EX-847 i znalezisko „~90 s przełączania" stają się
   bezprzedmiotowe; EX-845 rozwiązuje się przez skasowanie `provision-workshop.ts`.

## Follow-up Research 2026-09-29: szablon jest inwestycją

**Pytanie:** co się zmienia, jeśli szablon to po prostu inwestycja ze statusem `szablon` (jedna na
szablon, jej drzewo = treść), a tabela `kosztorys_presets` z jsonb i całe lustro znikają.

### F-Summary

- **Wykonalne, bez utraty danych.** Drzewo → serializacja → wstawienie jest bezstratne dla
  wszystkiego, co szablon niesie (w tym przypięte kolory sekcji). Każdy z 5 szablonów w dumpie prod
  (28.09) i lokalnie odtworzy się dokładnie; szablon 8 jest identyczny z drzewem #151.
- **Semantyka się nie zmienia.** Biblioteka już dziś jest stanem w trakcie edycji, opóźnionym
  o ≤10–15 s (dławik serwera + dopchnięcie klienta). Czytanie żywego drzewa usuwa tylko opóźnienie.
  Koszt odczytu: jedno zapytanie (~4–6 ms lokalnie wobec ~1,7 ms jsonb).
- **Kasuje więcej niż wariant z lustrem:** lustro, dławik, `mirrored_at`, dopchnięcie
  (`use-workshop-mirror-flush.ts`), `flushWorkshopPresetAction`, `isSamePresetContent`,
  `assertReadableSchemaVersion('preset')`, oba `template_preset_id`, `HELD_PRESET`, cały
  `presets.ts` w obecnym kształcie, gałąź `PRESETS=1` skryptu opisów.
- **Trzy rzeczy, których research nie przewidział:**
  1. **Brak serwerowej blokady statusu `szablon`.** Formularz inwestycji przyjmuje `'szablon'`
     (`investment-schema.ts:14`); przed drugim szablonem chronił tylko indeks singletonu, który
     znika. Każda rola zarządcza mogłaby spreparowanym wywołaniem zrobić z inwestycji szablon albo
     odwrotnie.
  2. **„Ostatnio edytowany" nie może jechać po `investments.updated_at`** — to token remountu
     edytora (`tree.revision`, `types.ts:138-141`); podbicie przy każdej edycji resetuje sortowanie
     i filtry właściciela (`kosztorys-catalogue-apply.ts:60-62` świadomie tego unika).
  3. **Migracja musi być dwuetapowa**, a pomocników drzewa nie da się z niej importować.

### F1. Tożsamość i schemat

- `kosztorys_presets` to tabela **tylko SQL** — nie kolekcja Payloada
  (`20260711_0_add_kosztorys_presets.ts:8`). Tworzenie `:12-20` (w tym `UNIQUE(name)` `:19`),
  `mirrored_at`/`updated_at` z `20260922_0_preset_autosave.ts:15-16`, wskaźniki
  z `20260914_0:12-13`, `20260914_1:16-21`, `20260914_2:16-20`. Tabele wewnętrzne Payloada jej nie
  referują — nic tam nie trzeba czyścić.
- Payload deklaruje `templatePresetId` w kolekcji (`collections/investments.ts:161-169`), więc każdy
  `payload.find` na inwestycjach go wybiera — **pole musi zniknąć z kodu, zanim kolumna zniknie
  z bazy**.
- Id szablonu → id inwestycji wszędzie: URL `/szablony/[id]` (+ crumb, `preset-open-href.ts`),
  argumenty akcji (usuń / zmień nazwę / dodaj sekcje / wczytaj / `presetId` w formularzu inwestycji
  i awansie leada), stan pickerów. Brak kluczy localStorage i kluczy cache zależnych od id.
- Format transferu zostaje: `SnapshotPayloadT` z `serializeKosztorysAsPreset(investmentId)` — już
  nie utrwalany, tylko w pamięci (zasiew, wczytanie, zapis jako nowy, nadpisanie).
- **Odcięcie pól per budowa musi się dziać przy odczycie.** Żywe drzewo szablonu może trzymać
  przedmiar / rabat (warsztat tylko chowa kolumny), więc każdy czytelnik — także „Dodaj sekcje" —
  idzie przez `serializeKosztorysAsPreset` (`serialize-preset.ts:20-36`), nie przez surowe
  `getKosztorysTree`.

### F2. Cykl życia szablonu na inwestycji

| Operacja | Dziś | Po zmianie |
|---|---|---|
| Pusty szablon | `createEmptyPresetAction` (`kosztorys-presets.ts:91-113`) | `payload.create({ name, status: 'szablon', settlementMode })` — reszta z domyślnych kolekcji; wzór: `provision-workshop.ts:18-28` |
| Zapisz jako nowy | `savePresetAction('new')` (`:45-80`) | `withPayloadTransaction`: create → `serializeKosztorysAsPreset(src)` → `applyPreset` (`apply-preset.ts:14`) |
| Nadpisz | `upsertPresetByName` po **nazwie** | `replaceTreeWithSnapshot` na szablonie docelowym **po id** — już robi punkt ochronny, zachowuje ustawienia celu (`replace-tree-with-snapshot.ts:46-102`; to samo co `reloadInvestmentFromPreset`) |
| Zmiana nazwy | `renamePresetAction`, owner-only | **Własna** akcja owner-only, jedno pole, `WHERE id=$1 AND status='szablon'`; nie `updateInvestmentAction` (rola zarządcza, cały formularz, pole statusu) |
| Usunięcie | `deletePresetAction`, owner-only, twarde | **Własna** akcja owner-only z `payload.delete` + strażnik statusu; kosz odmawia szablonowi (`actions/investment-trash.ts:47`), a `deleteInvestmentForeverAction` wymaga kosza |
| Otwórz / dopchnij | `openPresetInWorkshopAction`, `flushWorkshopPresetAction` | znikają |

- Tworzenie inwestycji nie ma efektów wychodzących (hooki: `guardInvestmentStatusUnlock` no-op na
  create, `stampCompletedAt`, rewalidacja tłumiona `skipRevalidation`).
- **Kaskada przy usunięciu jest czysta** (z `pg_constraint`): CASCADE — sekcje, pozycje, etapy,
  `stage_progress`, snapshoty, share'y (oba), `kosztorys_client_view`, `investments_rels`,
  `payload_locked_documents_rels`; SET NULL — transakcje, arkusze, leady, sprzęt (szablon ich nie
  ma). Nic RESTRICT.
- **Blokada statusu (nowe):** zdjąć `'szablon'` z `investmentFormSchema` (formularz nigdy nie edytuje
  szablonu — `reference-data.ts:73` i tak go ukrywa) + `beforeChange` w kolekcji odrzucający
  wejście i wyjście z `szablon` przy update (łapie akcje i `/admin`). Tworzenie szablonu tylko przez
  nowe akcje.
- **Unikalność nazw:** inwestycje nie mają żadnej (lokalnie „Potrzebna 55" ×2). Częściowy
  `UNIQUE (name) WHERE status = 'szablon'` + strażnik `NOT EXISTS` jak w `renamePreset`
  (`db/presets.ts:192-203`), żeby odmowa wracała polskim zdaniem, nie 23505.

### F3. Czytelnicy biblioteki

| Czytelnik | Potrzebuje | Po zmianie |
|---|---|---|
| Zasiew inwestycji (`seed-from-preset.ts:22`, z `create-investment.ts:39`, `promote-lead.ts:47`) | pełne, odcięte drzewo | `serializeKosztorysAsPreset(szablonId)` na `req` transakcji |
| „Wczytaj szablon…" (`reload-from-preset.ts:22`) | pełne, odcięte drzewo | j.w. + nazwa inwestycji w etykiecie punktu |
| „Dodaj sekcje z szablonu" (`kosztorys-presets.ts:222-233`) | wybrane sekcje | celowane zapytanie `WHERE section_id IN (…)` + sprawdzenie statusu źródła + odcięcie; id sekcji stają się żywe i globalnie unikalne (upraszcza `metaKey` w `preset-picker-groups.ts`) |
| Pickery sekcji, liczniki `/szablony` (`presets.ts:151-177`, `queries/presets.ts:48-67`) | nazwy + liczby | jeden `sections LEFT JOIN items GROUP BY` po inwestycjach `szablon` |
| `getPresetOptions` | nazwy | `SELECT id, name FROM investments WHERE status='szablon'` |

- `getKosztorysTree` woła `requireAuth` (`queries/kosztorys.ts:20`) — nie może siedzieć w
  `unstable_cache`; pickery idą przez dedykowane SQL.
- **Cache:** dziś tag `presets` wygasa tylko przy zmianie treści lustra
  (`mirror-workshop-preset.ts:53`). Nowy punkt wygaszania = ogon `investmentAction`
  (`investment-action.ts:87-92`), gdy bramka mówi „szablon". Nie tagować pickerów
  `kosztorysSections`/`kosztorysItems` — wygasałyby przy każdej edycji dowolnego kosztorysu
  (EX-849).

### F4. „Ostatnio edytowany"

- Pozycje/sekcje mają `updated_at`, ale usunięcia nie zostawiają śladu → `MAX(items.updated_at)`
  jest niepoprawny.
- `investments.updated_at` odpada (token remountu, patrz F-Summary).
- **Propozycja:** kolumna `investments.content_edited_at`, podbijana w ogonie `investmentAction` przy
  `result.success && isTemplate` — dokładnie tam, gdzie dziś siedzi lustro. Bramka już czyta
  `status` (`investment-gate.ts:42,77`), więc `templatePresetId` w `InvestmentGateT` zamienia się na
  `isTemplate` bez dodatkowego odczytu. Lista: `ORDER BY content_edited_at DESC NULLS LAST,
  created_at DESC`. Snapshot też przechodzi przez `investmentAction` i podbije datę — lustro robi
  to samo dziś; akceptowalne.

### F5. Tożsamość edytora

`templatePresetId` → `isTemplate: boolean` (prop ze strony albo `inv.status` dodany do SELECT drzewa,
`kosztorys-tree.ts:95`): `types.ts:183`, `kosztorys-editor-body.tsx:117,132-133,407`,
`use-kosztorys-editor-context.tsx:22-28`, `editor-noun.ts:30-31`,
`reload-from-preset-dialog.tsx:58,70,90` (porównanie z własnym `investmentId`; gałąź „przełącz"
→ nawigacja albo prawdziwe „Wczytaj"). `kosztorys-editor-v2.tsx:20,42` traci hook dopchnięcia.
Konsumenci `isWorkshop` z kontekstu (menu, toolbar, view-state, dialogi) bez zmian.

### F6. Snapshoty

- Znika `HELD_PRESET` i filtry `template_preset_id` (`snapshots.ts:51-56,73,78,129,145,186,211`).
- Pasma GC (`:257-282`) partycjonują po `investment_id` — dziś mieszają szablony na wspólnym
  warsztacie, po zmianie są poprawne z konstrukcji.
- Dzienny cron dalej pomija `szablon` (`:87-95`) — `daily`/`named` to historia inwestora.
- **Stare punkty na #151 (prod, dump 28.09):** przypisane 4→19, 5→31, 6→2, 7→6, 8→14; **59 bez
  szablonu, wszystkie „Przed wczytaniem: …"** — etykieta nazywa szablon wczytywany, a treść to
  szablon trzymany wcześniej, więc **nie da się ich przypisać**. Po zdjęciu filtra pokazałyby się
  wszystkie pod szablonem 8 z cudzą treścią. Rekomendacja: przypisane przepiąć, nieprzypisane
  skasować w migracji.

### F7. Migracja i kolejność wdrożenia

- **Prod (dump 28.09 20:15):** te same 5 szablonów (202 / 311 / 176 / 310 / 310 pozycji), #151
  → 8, drzewo identyczne z jsonb. Szablony 4 i 5 bez kluczy `…OverrideCoeff` (sprzed EX-865) —
  wstawiać NULL. **Prod jest 5 migracji za staging** (`20260928_0…_4` niezastosowane) — „stary kod"
  w oknie wdrożenia to dzisiejszy `main`, a te migracje idą pierwsze.
- **Bez importu kodu aplikacji.** Żadna ze 101 migracji tego nie robi; `insert-rows.ts:1`
  i `insert-kosztorys-tree.ts:1` mają `server-only`, a import żywego kodu zmieniałby zachowanie
  historycznej migracji. Samowystarczalny SQL/TS w migracji: `INSERT … RETURNING id` z mapą
  starych→nowych id sekcji (precedens `.rows`: `20260310_workers_as_registers.ts:85`). Precedensy
  migracji danych: `20260902_0_collapse_kosztorys_tool_overrides.ts:32-51`,
  `20260528_move_sheet_id_to_kosztoryses.ts:50`, podział addytywny/destrukcyjny
  `20260928_2_client_view_single_set.ts:8-9`.
- **Migracja A (addytywna, przed pushem):** zdjąć `investments_single_szablon_idx` (musi tu — A sama
  wstawia szablony); inwestycje dla szablonów 4–7 z drzewem z jsonb, VAT/współczynniki z
  `payload.settings`; przepiąć przypisane snapshoty; skasować nieprzypisane; #151 → nazwa
  „Kosztorys 2026 kolory" (żywe drzewo wygrywa — jsonb może tylko się spóźniać); unikalność nazw
  szablonów; kolumna `content_edited_at`. Tabela, kolumny i FK zostają.
- **Stary kod po A** działa (`getWorkshop` z `LIMIT 1` trafia w #151, nowe szablony ukryte przez
  `reference-data.ts:73`). **Ryzyko okna:** „Otwórz" innego szablonu w starym UI nadpisze drzewo
  #151, który jest już domem szablonu 8; zapisy w starym kodzie trafiają do jsonb, którego A nie
  czyta. → Okno A→push krótkie, szablonów w nim nie edytujemy. Alternatywa bez tego ryzyka: A
  zakłada wszystkie 5 od nowa, #151 zostaje starym warsztatem, B go kasuje (kaskada zabiera drzewo
  i punkty) — kosztem dodatkowego szablonu widocznego do czasu B.
- **Migracja B (destrukcyjna, po deployu):** FK `investments_template_preset_id_fk`,
  `kosztorys_snapshots_template_preset_id_fk`, obie kolumny `template_preset_id`, `kosztorys_presets`.
  Przed deployem stary kod dostałby 42703 w `payload.find` na inwestycjach, `workshop-investment.ts`,
  `investment-gate.ts`, `snapshots.ts`, `presets.ts`.
- **Bazy testowe:** `db:import:test` kończy się `db:migrate:test` (`package.json:44`),
  `scripts/test-integration.sh:18-37` re-importuje przy zmianie migracji — A i B dojdą same. Lokalny
  `db:import` (`package.json:43`) **nie** migruje — 5433 wymaga ręcznego `payload migrate`.
- **Backup no-shrink** (`db-backup.yml:55,153-165`) sprawdza tylko transakcje / inwestycje / rejestry
  / użytkowników — nie zadziała.

### F8. Testy

- **Umierają:** `workshop-investment.test.ts`, `mirror-workshop-preset.test.ts`,
  `use-workshop-mirror-flush.test.tsx`, `template-workshop.test.tsx`,
  `kosztorys-presets.test.ts` (flush `:342-437`, open `:439-686`), `snapshots.test.ts:230-301`,
  przypadki lustra w `investment-action.test.ts` i wskaźnika w `investment-gate.test.ts`, helper
  `acquireTestWorkshop` (7 użytkowników — każdy zakłada własną inwestycję-szablon).
- **Przepisywane:** `presets.test.ts` (CRUD na inwestycjach), `kosztorys-presets.test.ts` (reload,
  createEmpty), `serialize-apply-preset.test.ts:270-320` (nadpisanie po id, nie nazwie),
  `append-preset-sections.test.ts`, `kosztorys-actions-menu.test.tsx`,
  `preset-picker-groups.test.ts`, `revalidate.test.ts:99,108` (jeśli tag `presets` znika), golden
  master (`:12,403,476-480` → zwolnić każdy `status='szablon'`; podłoga `kosztorysItems` tylko
  rośnie, więc nie pęknie).
- **E2E:** `kosztorys-presets.spec.ts` przez UI przeżywa; zmienia się krok nadpisania (po id).
  `kosztorys-structure.spec.ts:306-371` przeżywa.
- **Nowe ryzyka do pokrycia:** blokada wejścia/wyjścia ze statusu `szablon`; unikalność nazwy przy
  tworzeniu i zmianie nazwy; usunięcie szablonu zabiera drzewo i punkty; zasiew / „Dodaj sekcje"
  nie przenoszą przedmiaru ani rabatu z żywego drzewa szablonu; `content_edited_at` rośnie przy
  edycji szablonu i nie przy edycji zwykłej inwestycji; pickery widzą edycję szablonu (wygaszenie
  tagu).

### F-Open Questions (zastępują listę wyżej)

> Pytania 1–5 rozstrzygnięte 2026-09-29 — patrz `change.md`, „Rozstrzygnięcia po researchu".

1. **„Przełącz na inny szablon…" w szablonie** — skasować (nawigacja przez `/szablony`) czy
   przywrócić prawdziwe „Wczytaj szablon" (zastąp treść tego szablonu cudzą, z punktem ochronnym —
   teraz bezpieczne).
2. **Strategia okna migracji** — #151 zostaje domem szablonu 8 (mniej ruchu, ryzyko „Otwórz"
   w starym UI) czy wszystkie 5 od nowa + skasowanie #151 w B (bez ryzyka, szablon-duch do B).
3. **59 nieprzypisanych punktów „Przed wczytaniem"** — skasować (rekomendacja) czy zostawić pod
   szablonem 8.
4. **Unikalność nazw** — dokładne dopasowanie (jak dziś) czy `lower(trim())`.
5. **Tag cache** — zostawić nazwę `presets` (wygaszany w `investmentAction` dla szablonu) czy
   przemianować.
6. **Linear:** EX-893 zastąpione; EX-847 i „~90 s przełączania" bezprzedmiotowe; EX-845 rozwiązane
   przez skasowanie `provision-workshop.ts`.
7. **`lessons.md:1679-1683`** — nieaktualne w punkcie `kosztorys-subcontractor-due`; do poprawy
   przy tej zmianie.
