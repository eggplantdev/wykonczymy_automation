# Szablon jest inwestycją — Implementation Plan

## Overview

Szablon przestaje być wierszem jsonb w `kosztorys_presets` edytowanym przez jeden wspólny warsztat
(#151) przełączany wskaźnikiem `investments.template_preset_id`. **Szablon staje się inwestycją ze
statusem `szablon`, a jego drzewo kosztorysu jest treścią szablonu.** Biblioteka jsonb, lustro,
„Otwórz" i wskaźnik znikają. Zastępuje EX-893 (zapis ze starej karty ląduje w szablonie otwartym
teraz), który nie jest łatany osobno: jego przyczyną jest identyfikator zmieniający znaczenie w czasie,
a po tej zmianie id inwestycji oznacza zawsze ten sam szablon.

Decyzje: `change.md` („Decyzje", „Rozstrzygnięcia po researchu"). Mapa kodu: `research.md`.
Obowiązuje sekcja „Follow-up Research" (F1–F8). Sekcje 1–7 opisują porzucony wariant z lustrem.

## Current State Analysis

- Treść szablonu żyje w `kosztorys_presets.payload` (jsonb, tabela tylko SQL:
  `20260711_0_add_kosztorys_presets.ts`). Jedyny DAL to `src/lib/db/presets.ts`.
- Edycja odbywa się na jednej inwestycji-warsztacie (#151, „Warsztat szablonów").
  - „Otwórz" podmienia jej drzewo i przesuwa wskaźnik (`open-preset-in-workshop.ts`).
  - Każdy udany zapis przez `investmentAction` odpala lustro do jsonb (`investment-action.ts`,
    `mirror-workshop-preset.ts`), dławione `claimPresetMirror`.
  - Klient dopycha ostatnią zmianę (`use-workshop-mirror-flush.ts`).
- Czytelnicy jsonb:
  - zasiew (`seed-from-preset.ts`), „Wczytaj szablon…" (`reload-from-preset.ts`), „Dodaj sekcje
    z szablonu" (`appendPresetSectionsAction`);
  - pickery i lista `/szablony` (`queries/presets.ts`, `listPresetSections`);
  - skrypt `fix-kosztorys-descriptions.ts` (gałąź `PRESETS=1`).
- Historia wersji rozróżnia szablony na wspólnym warsztacie przez `HELD_PRESET` / filtry
  `template_preset_id` (`src/lib/db/snapshots.ts:51-56,73,78,129,145,186,211`).
- Brak serwerowej blokady statusu `szablon` (formularz go przyjmuje: `investment-schema.ts:14`).
  Przed drugim szablonem chronił tylko indeks `investments_single_szablon_idx`, który znika.
- `investments.updated_at` jest tokenem remountu edytora (`types.ts:138-141`), więc nie może
  służyć do sortowania „ostatnio edytowany".
- Dane (lokalnie i w dumpie prod z 28.09):
  - 5 szablonów: id 4 / 5 / 6 / 7 / 8, odpowiednio 202 / 311 / 176 / 310 / 310 pozycji;
  - #151 trzyma szablon 8, drzewo identyczne z jsonb;
  - na #151 leży 72 przypisanych punktów przywracania i 59 nieprzypisanych „Przed wczytaniem".
- Prod jest kilka migracji za stagingiem (`20260928_0…_4`, plus `20260929_0` innego agenta w drzewie
  roboczym).

## Desired End State

- `/szablony` listuje inwestycje `status = 'szablon'`, sortując po `content_edited_at`.
  `/szablony/[id]` (id = id inwestycji) to zwykły render serwerowy drzewa tej inwestycji w edytorze
  w trybie szablonu. Nie ma kroku „Otwórz", flagi URL ani ekranu `OpenWorkshopPrompt`.
- Tworzenie, zapis jako nowy, nadpisanie (po id, z punktem ochronnym), zmiana nazwy, usunięcie
  i „Wczytaj szablon…" działają na inwestycjach-szablonach.
  - Nazwy są unikalne bez rozróżniania wielkości liter i spacji na brzegach.
  - Odmowa przychodzi polskim zdaniem.
- Zasiew nowej inwestycji, „Wczytaj szablon…" i „Dodaj sekcje z szablonu" czytają żywe drzewo
  szablonu przez `serializeKosztorysAsPreset`. Przedmiar, rabat, etapy i postęp odcinane są przy odczycie.
- Żadna ścieżka nie zmieni zwykłej inwestycji w szablon ani odwrotnie.
- W kodzie nie istnieją: `kosztorys_presets`, lustro, dopchnięcie, „Otwórz", `getWorkshop`,
  `HELD_PRESET`, `templatePresetId`.
- Po migracji B w bazie nie ma tabeli `kosztorys_presets`, obu kolumn `template_preset_id` ani #151.

Weryfikacja: whole-tree gate zielony, testy z sekcji „Testing Strategy" zielone, a ręczne sprawdzenie
z manual-checks przechodzi na lokalnej bazie po migracjach A i B.

### Key Discoveries:

- Wzór stworzenia inwestycji-szablonu przez local API: `provision-workshop.ts:18-28`. Wymagane są
  tylko `name`, `status` i `settlementMode`; hooki inwestycji nie mają efektów wychodzących.
- `replaceTreeWithSnapshot` (`replace-tree-with-snapshot.ts:46-102`) robi punkt ochronny i zachowuje
  ustawienia celu. To właściwy prymityw dla nadpisania i „Wczytaj szablon…".
- `applyPreset` (`apply-preset.ts:14`) tylko wstawia drzewo, bez ustawień. To prymityw dla zapisu
  jako nowy i zasiewu.
- `serializeKosztorysAsPreset` (`serialize-preset.ts`) woła `getKosztorysTree` → `requireAuth`.
  Wolno go użyć tylko w kontekście akcji, nigdy w `unstable_cache`.
- `investmentAction` (`investment-action.ts`) ma ogon po `handler` — tam dziś siedzi lustro.
  Bramka już czyta `status` (`investment-gate.ts`), więc `isTemplate` nie kosztuje zapytania.
- Kosz odmawia szablonowi (`actions/investment-trash.ts:47`), a
  `deleteInvestmentForeverAction` wymaga kosza. Usunięcie szablonu dostaje własną akcję owner-only.
- Kaskada `investments` → sekcje, pozycje, etapy, postęp, snapshoty, share'y,
  `kosztorys_client_view` i tabele rels Payloada jest czysta; nic nie jest RESTRICT (research F2).
- Migracje nie importują kodu aplikacji. `insert-rows.ts:1` i `insert-kosztorys-tree.ts:1` mają
  `server-only`, a import żywego kodu zmieniałby zachowanie historycznej migracji.
- Podział addytywna/destrukcyjna ma precedens: `20260928_2_client_view_single_set.ts:8-9`
  → `20260929_0_drop_client_view_variants.ts`. Migracja destrukcyjna jest osobną migracją,
  stosowaną po wdrożeniu.
- Tag cache `presets` (`CACHE_TAGS.presets = 'collection:kosztorys-presets'`) zostaje pod tą nazwą.

## What We're NOT Doing

- Łatka EX-893 („zapis niesie oczekiwany szablon"). Znika razem ze wskaźnikiem.
- Przenoszenie ustawień (VAT, współczynniki) szablonu na inwestycję przy zasiewie. Zostają obojętne,
  jak dziś.
- Kosz i wersjonowanie usunięcia szablonu. Usunięcie jest twarde, jak dziś.
- Zmiana nazwy tagu `presets` i nazw modułów `presets` / `kosztorys-presets` w kodzie. Pliki
  zmieniają treść, nie adres (poza modułami, które giną).
- Uruchamianie E2E (`pnpm test:e2e`). Spec jest poprawiany, ale nie odpalany; uruchomienie tylko na
  wyraźne polecenie.
- Stosowanie migracji na Neonie. Robi to człowiek (`pnpm db:migrate:prod`, `pnpm db:migrate:preview`).
- Zmiana `DATASET_FLOOR.kosztorysItems` w golden masterze. Podłoga tylko rośnie, więc nie pęknie.

## Implementation Approach

Kolejność wynika z dwóch płaszczyzn: schematu i kodu.

1. **Migracja A** jest addytywna i musi być pierwsza.
   - Zakłada 5 inwestycji-szablonów z jsonb.
   - Przepina przypisane punkty przywracania i kasuje 59 nieprzypisanych.
   - Zdejmuje indeks singletonu.
   - Dodaje unikalność nazw i `content_edited_at`.
   - Stary kod (dzisiejszy `main`) po A dalej działa: `getWorkshop` trafia w #151, bo nowe id są
     większe, a nowe szablony ukrywa `reference-data.ts:73`.
2. **Kod** przechodzi na inwestycje w trzech krokach:
   - warstwa danych i czytelnicy;
   - cykl życia i dialogi;
   - strona szablonu i edytor, razem ze skasowaniem martwych modułów.

   Po tych krokach żaden kod nie czyta `template_preset_id` ani `kosztorys_presets`, a pole znika
   z kolekcji Payloada.
3. **Migracja B** jest destrukcyjna i ostatnia. Kasuje #151 (kaskada zabiera jego drzewo i resztę
   punktów), oba FK, obie kolumny i tabelę. Idzie w osobnym commicie, wypychanym dopiero po tym, jak
   wdrożenie kodu jest na żywo (patrz „Migration Notes").

Testy jadą z kodem, który zmieniają, w tej samej fazie. Na końcu nie ma osobnej fazy „dopisz testy".

## Critical Implementation Details

**State sequencing — pole kolekcji przed kolumną.** `templatePresetId` jest zadeklarowane w kolekcji
(`collections/investments.ts:161-169`), więc każdy `payload.find` na inwestycjach wybiera tę kolumnę.
Pole musi zniknąć z kodu (faza 4) w wdrożeniu, które poprzedza migrację B. Inaczej każde zapytanie
Payloada o inwestycję dostanie 42703. To samo dotyczy `snapshots.ts`: nowy kod nie może już
zapisywać `kosztorys_snapshots.template_preset_id`.

**Timing — `content_edited_at` nie dotyka `updated_at`.** Podbicie idzie surowym SQL w ogonie
`investmentAction`, nie przez `payload.update`. Payload podbiłby `updated_at`, czyli token remountu
edytora, i każda edycja szablonu resetowałaby właścicielowi sortowanie i filtry. Z tego samego
powodu zmiana nazwy szablonu idzie surowym SQL.

**Timing — wygaszenie tagu po odpowiedzi.** Tag `presets` w ogonie `investmentAction` wygasa przez
`expireCollectionsAfterResponse`, tak jak dziś robi to lustro. Wygaszenie w trakcie akcji
przerenderowałoby trasę przy każdym autozapisie komórki (lessons.md, EX-597).

## Phase 1: Migracja A (addytywna) + golden master

### Overview

Baza zna szablony jako inwestycje, zanim jakikolwiek kod ich użyje. Stary kod działa dalej.
Golden master przestaje traktować inwestycje-szablony jako kosztorysy do porównania.

### Changes Required:

#### 1. Migracja A

**File**: `src/migrations/20260929_1_szablon_as_investment.ts` (+ wpis w `src/migrations/index.ts`)

**Intent**: Założyć inwestycję-szablon dla każdego wiersza `kosztorys_presets` z drzewem z jsonb,
przepiąć na nią jego punkty przywracania i przygotować schemat pod N szablonów. Migracja jest
ręcznie pisana i samowystarczalna: nie importuje kodu aplikacji.

**Contract**:

- Dla każdego wiersza `kosztorys_presets` (po `id`):
  - `INSERT INTO investments` z polami:
    - `name` = nazwa szablonu;
    - `status = 'szablon'`;
    - `settlement_mode` = domyślny z kolekcji;
    - VAT i współczynniki z `payload->'settings'`, a przy braku klucza z domyślnych
      (`DEFAULT_VAT` / `DEFAULT_COEFFS` przepisane jako literały, nie importowane);
    - `created_at` = `kosztorys_presets.created_at`;
    - `content_edited_at` = `kosztorys_presets.updated_at`, żeby lista zachowała dzisiejszą kolejność.
  - `RETURNING id`.
- Sekcje z `payload->'sections'`, każda z `RETURNING id`. Mapa starych id sekcji w payloadzie na
  nowe id w bazie jest trzymana w TS.
- Pozycje z `payload->'items'`:
  - lista kolumn zgodna z `ITEM_INSERT_COLUMNS` (`insert-rows.ts:21-37`), przepisana;
  - brakujące klucze dostają wartości domyślne jak w `itemWithColumnDefaults`, w tym `NULL` dla
    `…_override_coeff` w szablonach 4 i 5 sprzed EX-865;
  - pozycja bez sekcji-rodzica jest pomijana (tolerancja `insertKosztorysTree`).
- `UPDATE kosztorys_snapshots SET investment_id = <nowe id> WHERE investment_id = <id warsztatu> AND
  template_preset_id = <id szablonu>`. Id warsztatu to inwestycja `status='szablon'`, która istniała
  przed migracją.
- `DELETE FROM kosztorys_snapshots WHERE investment_id = <id warsztatu> AND template_preset_id IS NULL`.
  To 59 punktów „Przed wczytaniem", których treść nie odpowiada etykiecie.
- `DROP INDEX investments_single_szablon_idx`.
- `ALTER TABLE investments ADD COLUMN content_edited_at timestamptz` (nullable, bez domyślnej).
- `CREATE UNIQUE INDEX investments_szablon_name_idx ON investments (lower(trim(name))) WHERE status = 'szablon'`.
  Tworzony po wstawieniu. #151 „Warsztat szablonów" nie koliduje z żadną nazwą szablonu.
- #151, `kosztorys_presets`, obie kolumny `template_preset_id` i oba FK zostają.
- `down`: skasować inwestycje założone przez `up` (kaskada), odtworzyć indeks singletonu, zdjąć
  indeks nazw i kolumnę. Skasowanych 59 punktów `down` nie odtwarza — napisać to w komentarzu.
- Całość w transakcji `up({ db, payload, req })`. Wzór `.rows`: `20260310_workers_as_registers.ts:85`.

#### 2. Golden master

**File**: `src/__tests__/financial-golden-master-db.test.ts`

**Intent**: Zwolnić z osi kosztorysu **każdą** inwestycję `status = 'szablon'`, a nie tylko
`getWorkshop()?.id`. Po migracji A w bazie testowej jest sześć szablonów z treścią.

**Contract**: miejsca `:12, :403, :476-480, :563-573`. Zbiór zwolnionych id pochodzi z zapytania po
statusie. Import `getWorkshop` znika.

### Success Criteria:

#### Automated Verification:

- Migracja wchodzi na lokalną bazę 5433: `pnpm payload migrate`. Wcześniej przez
  `docker exec wykonczymy pg_dump` zrobić kopię do `dumps/` jako punkt powrotu.
- Weryfikacja danych na 5433 (psql):
  - dla każdego wiersza `kosztorys_presets` istnieje inwestycja `szablon` o tej samej nazwie;
  - jej liczba sekcji i pozycji równa się `jsonb_array_length` z payloadu;
  - na #151 nie ma punktów przywracania z `template_preset_id IS NULL`.
- `down` → `up` przechodzi na 5433 bez błędu.
- `pnpm test:parity` zielony (golden master z sześcioma szablonami w bazie).

#### Manual Verification:

- Stary UI (kod sprzed fazy 2) po migracji A otwiera szablony z listy tak jak przed migracją.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Warstwa danych, czytelnicy i bramka

### Overview

Wszystko, co czyta szablony, czyta inwestycje `szablon`. Bramka zna `isTemplate`, podbija
`content_edited_at`, wygasza `presets` i nie odpala już lustra. Status `szablon` jest nie do wejścia
i nie do opuszczenia.

### Changes Required:

#### 1. DAL szablonów

**File**: `src/lib/db/presets.ts` (przepisany na `investments`)

**Intent**: Jedyny czytelnik i pisarz metadanych szablonu jako inwestycji. Treść drzewa czyta się
przez ścieżkę kosztorysu, nie tutaj.

**Contract**:

- `PresetMetaT = { id, name, createdAt, updatedAt: string | null }`:
  - `id` to id inwestycji;
  - `updatedAt` pochodzi z `content_edited_at`;
  - `createdBy` znika, bo żadna kolumna UI go nie pokazuje.
- `listPresets`: `WHERE status='szablon' ORDER BY content_edited_at DESC NULLS LAST, created_at DESC, id DESC`.
- `listPresetSections` → `PresetSectionMetaT`:
  - `sectionId` to **żywe** id sekcji, globalnie unikalne;
  - jedno `kosztorys_sections LEFT JOIN kosztorys_items GROUP BY` po inwestycjach `szablon`,
    porządek jak dziś (szablony wg `created_at DESC`, sekcje wg `display_order, id`).
- `getPresetName(db, id)`: `WHERE id AND status='szablon'`.
- `isTemplateInvestment(db, id): Promise<boolean>`.
- `renamePreset(db, id, name)`:
  - `UPDATE investments SET name WHERE id AND status='szablon' AND NOT EXISTS (… lower(trim(name)) = lower(trim($name)) AND id <> $id)`;
  - bez dotykania `updated_at`.
- `isPresetNameTaken(db, name, exceptId?)` dla ścieżek tworzenia, z tym samym porównaniem.
- Znikają: `insertPreset`, `upsertPresetByName`, `updatePresetPayload`, `claimPresetMirror`,
  `getPreset`, `deletePreset` (usunięcie idzie przez Payload, faza 3) oraz `assertReadableSchemaVersion('preset')`.

#### 2. Zapytania cache'owane

**File**: `src/lib/queries/presets.ts`, `src/lib/queries/preset-pickers.ts`

**Intent**: `getPresets` / `getPresetSections` / `getPresetRows` zostają na tagu `presets` i czytają
nowy DAL. Nie tagować `kosztorysSections` / `kosztorysItems` (EX-849).

**Contract**:

- `getWorkshopView` → `getTemplateView(id): { name } | null`.
- `getPresetNameForCrumb` czyta `getPresetName`.

#### 3. Zasiew, „Wczytaj", „Dodaj sekcje"

**File**: `src/lib/kosztorys/seed-from-preset.ts`, `src/lib/kosztorys/reload-from-preset.ts`,
`src/lib/actions/kosztorys-presets.ts` (`appendPresetSectionsAction`, `reloadFromPresetAction`),
`src/components/kosztorys/editor/dialogs/preset/preset-picker-groups.ts`,
`src/components/kosztorys/editor/dialogs/preset/add-sections-from-preset-dialog.tsx`,
`src/components/kosztorys/editor/dialogs/preset/use-preset-sections.ts`

**Intent**: Treść szablonu to `serializeKosztorysAsPreset(szablonId, req)`. Odcina przedmiar, rabat,
etapy i postęp, a żywe drzewo szablonu może je trzymać, więc żaden czytelnik nie sięga po surowe
`getKosztorysTree`.

**Contract**:

- Zasiew:
  - sprawdza `isTemplateInvestment(source)` (inaczej `'not-found'`);
  - serializuje na `req` transakcji;
  - reszta bez zmian.
- `reloadInvestmentFromPreset({ investmentId, presetId })`:
  - źródło musi być szablonem i różne od celu;
  - etykieta „Przed wczytaniem: <nazwa>".
- `appendPresetSectionsAction(investmentId, sectionIds: number[])`:
  - serwer rozwiązuje, do jakiej inwestycji należy każda sekcja, i odmawia („Nie znaleziono
    sekcji w szablonie"), gdy nie jest to szablon;
  - każdy szablon serializuje się raz;
  - wyciąga sekcje w kolejności klienta;
  - dalej `appendPresetSections` bez zmian.
- `presetId` przestaje być potrzebny w wyborze. `metaKey` w `preset-picker-groups.ts` upraszcza się
  do id sekcji.

#### 4. Bramka i ogon `investmentAction`

**File**: `src/lib/db/investment-gate.ts`, `src/lib/actions/investment-action.ts`

**Intent**: Bramka odpowiada „czy to szablon" z tego samego SELECT-a. Ogon, zamiast lustra, podbija
`content_edited_at` i wygasza pickery.

**Contract**:

- `InvestmentGateT = { lockMessage, isTemplate: boolean }`:
  - `isTemplate = status === TEMPLATE_INVESTMENT_STATUS`;
  - `template_preset_id` znika z obu SELECT-ów.
- Ogon przy `result.success && gate.isTemplate`:
  - `UPDATE investments SET content_edited_at = now() WHERE id = $1` (surowy SQL);
  - potem `expireCollectionsAfterResponse(['presets'])`.

#### 5. Blokada statusu `szablon`

**File**: `src/components/forms/investment-form/investment-schema.ts`,
`src/hooks/investments/guard-template-status.ts` (nowy), `src/collections/investments.ts`

**Intent**: Z formularza nie da się ustawić statusu `szablon`. Update Payloada (akcje i `/admin`)
odrzuca przejście do i ze statusu `szablon`.

**Contract**:

- `'szablon'` znika z enumu statusu w `investmentFormSchema`.
- Hook `beforeChange`:
  - przy `operation === 'update'` i `data.status !== undefined` rzuca, gdy
    `(originalDoc.status === 'szablon') !== (data.status === 'szablon')`;
  - `create` przepuszcza, bo tworzenie szablonu idzie tylko przez akcje z fazy 3, a formularz
    statusu `szablon` nie zna;
  - komunikat po polsku;
  - rejestrowany obok `guardInvestmentStatusUnlock`.

#### 6. Snapshoty

**File**: `src/lib/db/snapshots.ts`

**Intent**: Historia wersji partycjonuje się po `investment_id`, a to po tej zmianie jest poprawne
z konstrukcji.

**Contract**:

- Znika `HELD_PRESET` i każda klauzula `template_preset_id IS NOT DISTINCT FROM`.
- `INSERT` nie wpisuje już `template_preset_id`.
- Dzienny cron dalej pomija `szablon`.

#### 7. Testy fazy 2

**File**: `src/__tests__/lib/db/presets.test.ts`, `src/__tests__/lib/kosztorys/append-preset-sections.test.ts`,
`src/__tests__/lib/kosztorys/serialize-apply-preset.test.ts`, `src/__tests__/lib/db/investment-gate.test.ts`,
`src/__tests__/lib/actions/investment-action.test.ts`, `src/__tests__/lib/db/snapshots.test.ts`,
`src/__tests__/lib/actions/create-investment-preset.test.ts`, `src/__tests__/lib/actions/promote-lead.db.test.ts`,
`src/__tests__/components/kosztorys/editor/dialogs/preset/preset-picker-groups.test.ts`,
`src/__tests__/helpers/workshop.ts` → `src/__tests__/helpers/template.ts`

**Intent**: Helper `acquireTestWorkshop` (pożyczał jedyny warsztat z dumpa) zastępuje
`createTestTemplate`: każdy spec zakłada własną inwestycję-szablon i sprząta ją usunięciem.

**Contract**:

- Nowe przypadki (ryzyka tej zmiany):
  1. zasiew, „Wczytaj" i „Dodaj sekcje" ze szablonu, którego żywe drzewo ma przedmiar i rabat,
     wstawiają pozycje z `planned_qty = 0` i bez rabatu;
  2. źródło niebędące szablonem jest odrzucane (zasiew, „Wczytaj", „Dodaj sekcje");
  3. udana edycja szablonu przez `investmentAction` podbija `content_edited_at` i **nie** zmienia
     `updated_at`, a edycja zwykłej inwestycji nie dotyka `content_edited_at`;
  4. hook odrzuca update inwestycji do `szablon` i ze `szablon`, a przepuszcza update szablonu bez
     pola statusu;
  5. `listPresetSections` liczy pozycje per żywa sekcja.
- Znikają: przypadki lustra w `investment-action.test.ts`, przypadek wskaźnika
  w `investment-gate.test.ts`, `snapshots.test.ts:230-301` (`HELD_PRESET`).

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/db/presets.test.ts src/__tests__/lib/kosztorys/append-preset-sections.test.ts src/__tests__/lib/kosztorys/serialize-apply-preset.test.ts src/__tests__/lib/db/investment-gate.test.ts src/__tests__/lib/actions/investment-action.test.ts src/__tests__/lib/db/snapshots.test.ts src/__tests__/lib/actions/create-investment-preset.test.ts src/__tests__/lib/actions/promote-lead.db.test.ts src/__tests__/components/kosztorys/editor/dialogs/preset/preset-picker-groups.test.ts`
- Spec hooka statusu (nowy, pod `src/__tests__/hooks/investments/`) zielony.

#### Manual Verification:

- Nowa inwestycja założona „z szablonu" dostaje jego sekcje i pozycje, bez przedmiaru.
- „Dodaj sekcje z szablonu" pokazuje sekcje wszystkich pięciu szablonów z poprawnymi licznikami.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Cykl życia szablonu i dialogi

### Overview

Tworzenie, zapis jako nowy, nadpisanie, zmiana nazwy, usunięcie i „Wczytaj szablon…" wewnątrz
szablonu działają na inwestycjach.

### Changes Required:

#### 1. Akcje

**File**: `src/lib/actions/kosztorys-presets.ts`, `src/lib/kosztorys/create-template.ts` (nowy, funkcja domenowa)

**Intent**: Jedna funkcja domenowa zakłada szablon w `withPayloadTransaction`. Robi sprawdzenie nazwy
→ `payload.create` z `status: 'szablon'` → opcjonalnie wstawienie drzewa. Obie ścieżki tworzenia
z niej korzystają.

**Contract**:

- `createTemplate(payload, req, { name, tree?: SnapshotPayloadT }): Promise<{ id } | 'name-taken'>`:
  - wstawianie drzewa przez `applyPreset`;
  - `context` tłumiący rewalidację hooków.
- `createEmptyPresetAction(name)`:
  - `createTemplate` bez drzewa;
  - zwraca `{ id }` (id inwestycji);
  - `expireCollectionsAfterResponse(['presets'])` jak dziś.
- `savePresetAction(investmentId, input: { mode: 'new'; name } | { mode: 'overwrite'; targetId })`:
  - **new**: `serializeKosztorysAsPreset(investmentId, req)` → `createTemplate` z drzewem;
  - **overwrite**:
    - cel musi być szablonem różnym od źródła;
    - `replaceTreeWithSnapshot(target, tree, label: „Przed nadpisaniem: <nazwa źródła>", clearGlobalDiscount: true)`,
      a następnie podbicie `content_edited_at` celu;
  - gate `protectedAction` jak dziś;
  - tagi: `presets`.
- `renamePresetAction(id, name)`: owner-only, `renamePreset` z fazy 2, odmowa `NAME_TAKEN_MESSAGE`.
- `deletePresetAction(id)`:
  - owner-only;
  - `isTemplateInvestment`, inaczej „Nie znaleziono szablonu";
  - `payload.delete({ collection: 'investments', id, overrideAccess, context: SKIP_HOOK_REVALIDATION })`;
  - `revalidateCollections(['presets'])`.
- Znikają `openPresetInWorkshopAction` i `flushWorkshopPresetAction`.
- Komunikat kosza dla szablonu (`investment-trash.ts:47`) zmienia się z „Warsztatu szablonów nie
  można usunąć." na zdanie o szablonie, np. „Szablonu nie przenosi się do kosza — usuń go z listy
  szablonów.".

#### 2. Dialogi

**File**: `src/components/kosztorys/editor/dialogs/preset/save-preset-dialog.tsx`,
`src/components/kosztorys/editor/actions/save-preset-action.tsx`,
`src/components/kosztorys/editor/dialogs/preset/reload-from-preset-dialog.tsx`,
`src/components/presets/create-empty-preset-dialog.tsx`, `src/components/presets/preset-row-actions.tsx`,
`src/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.tsx`

**Intent**: Dialogi posługują się id, nie nazwą. W szablonie „Przełącz na inny szablon…" wraca jako
„Wczytaj szablon…", czyli zastępuje treść bieżącego szablonu cudzą.

**Contract**:

- „Nadpisz istniejący":
  - select po `id`;
  - w szablonie bez niego samego na liście;
  - ostrzeżenie mówi, że poprzednią zawartość da się przywrócić z Wersji nadpisanego szablonu,
    zamiast „nie można cofnąć".
- „Wczytaj szablon…" w szablonie:
  - bieżący szablon wypada z listy;
  - kopia `COPY.szablon` mówi o zastąpieniu treści tego szablonu, z punktem ochronnym;
  - gałąź nawigacji do innego szablonu (`presetOpenHref`) znika.
- Etykieta w `kosztorys-actions-menu.tsx` zmienia się z „Przełącz na inny szablon…" na
  „Wczytaj szablon…".
- Opis w `save-preset-dialog.tsx` dla szablonu nie mówi o „bibliotece" ani „warsztacie".
- Po utworzeniu `create-empty-preset-dialog.tsx` nawiguje na gołe `/szablony/${id}`.

#### 3. Testy fazy 3

**File**: `src/__tests__/lib/actions/kosztorys-presets.test.ts`,
`src/__tests__/lib/kosztorys/serialize-apply-preset.test.ts:270-320`,
`src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.test.tsx`,
`src/__tests__/components/presets/create-empty-preset-dialog.test.tsx`,
`src/__tests__/lib/actions/investment-trash.db.test.ts`

**Contract**:

- Nowe przypadki:
  1. pusty szablon i zapis jako nowy tworzą inwestycję `szablon` z oczekiwanym drzewem;
  2. nazwa zajęta w innej wielkości liter lub ze spacjami na brzegach jest odrzucana polskim zdaniem
     przy tworzeniu, zapisie jako nowy i zmianie nazwy;
  3. nadpisanie po id zastępuje drzewo celu, zostawia na celu punkt „Przed nadpisaniem" i nie rusza
     źródła;
  4. usunięcie szablonu zabiera jego sekcje, pozycje i punkty przywracania, a zwykłą inwestycję
     odrzuca;
  5. menu w szablonie pokazuje „Wczytaj szablon…".
- Znikają bloki flush (`:342-437`) i open (`:439-686`) w `kosztorys-presets.test.ts`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-presets.test.ts src/__tests__/lib/kosztorys/serialize-apply-preset.test.ts src/__tests__/lib/actions/investment-trash.db.test.ts src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.test.tsx src/__tests__/components/presets/create-empty-preset-dialog.test.tsx`

#### Manual Verification:

- Na `/szablony`: „Nowy szablon" → pusty szablon się otwiera. Zmiana nazwy na nazwę istniejącą
  w innej wielkości liter kończy się polskim komunikatem. Usunięcie znika z listy.
- Z inwestycji „Zapisz jako nowy szablon…" i „Nadpisz istniejący" dają szablon z tą rozpiską, bez
  przedmiaru i rabatu. W Wersjach nadpisanego szablonu jest punkt „Przed nadpisaniem".
- W szablonie „Wczytaj szablon…" zastępuje treść bieżącego szablonu, a punkt „Przed wczytaniem"
  pozwala ją przywrócić.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Strona szablonu, edytor i sprzątanie martwego kodu

### Overview

`/szablony/[id]` renderuje drzewo swojej inwestycji wprost. Edytor zna `isTemplate`. Maszyneria
„Otwórz" i lustra znika razem z polem kolekcji `templatePresetId`.

### Changes Required:

#### 1. Strona i okruszek

**File**: `src/app/(frontend)/szablony/[id]/page.tsx`, `src/components/nav/template-crumb.tsx`

**Intent**: Render ma trzy kroki: `getTemplateView(id)` (`notFound` dla nie-szablonu) →
`getKosztorysTree(id)` + `getWorkCatalogue()` → `KosztorysEditorV2` z `isTemplate`. Strona nic nie
zapisuje, więc prefetch na hoverze zostaje bezpieczny.

**Contract**:

- `searchParams` i `OPEN_FLAG` znikają ze strony.
- Nazwa szablonu w pasku narzędzi tak jak dziś.
- `loading.tsx` bez zmian, chyba że czyta coś z usuwanych modułów.

#### 2. Tożsamość edytora

**File**: `src/lib/kosztorys/types.ts:183`, `src/components/kosztorys/editor/kosztorys-editor-body.tsx`,
`src/components/kosztorys/editor/use-kosztorys-editor-context.tsx`, `src/lib/kosztorys/editor-noun.ts`,
`src/components/kosztorys/editor/kosztorys-editor-v2.tsx`, `src/components/kosztorys/editor/actions/kosztorys-actions-context.tsx`

**Intent**: `templatePresetId?: number` zamienia się na `isTemplate?: boolean`. Konsumenci
`isWorkshop` z kontekstu zostają bez zmian. `KosztorysEditorV2` traci `useWorkshopMirrorFlush`.

**Contract**: `editorNoun(isTemplate: boolean | undefined)`.

#### 3. Martwe moduły i pole kolekcji

**File** (kasowane):

- `src/lib/kosztorys/open-preset-in-workshop.ts`
- `src/lib/kosztorys/mirror-workshop-preset.ts`
- `src/lib/kosztorys/provision-workshop.ts` (rozwiązuje EX-845)
- `src/lib/kosztorys/preset-content.ts`
- `src/lib/db/workshop-investment.ts`
- `src/lib/constants/preset-mirror.ts`
- `src/components/kosztorys/editor/hooks/use-workshop-mirror-flush.ts`
- `src/components/presets/template-workshop.tsx`
- `src/components/presets/open-workshop-prompt.tsx`
- `src/components/presets/preset-open-href.ts` (`presetOpenHref` → gołe `/szablony/${id}` inline
  u wołających albo zostaje jako jedna funkcja bez flagi; decyduje liczba wołających)

**File** (zmieniane): `src/collections/investments.ts`, `src/scripts/fix-kosztorys-descriptions.ts`

**Intent**: Nic w kodzie nie zna wskaźnika ani biblioteki jsonb.

**Contract**:

- Pole `templatePresetId` i komentarze o warsztacie znikają z kolekcji; potem `pnpm generate:types`
  (typy są w gitignore).
- Gałąź `PRESETS=1` skryptu opisów znika. Jeśli gałąź inwestycji pomija `szablon`, przestaje
  pomijać, bo szablony są teraz inwestycjami.
- Kasowanie martwego kodu weryfikuje typecheck, nie grep.

#### 4. Testy fazy 4

**File** (kasowane):

- `src/__tests__/components/presets/template-workshop.test.tsx`
- `src/__tests__/components/kosztorys/editor/hooks/use-workshop-mirror-flush.test.tsx`
- `src/__tests__/lib/kosztorys/mirror-workshop-preset.test.ts`
- `src/__tests__/lib/db/workshop-investment.test.ts`

**File** (przepięcie na `createTestTemplate`): `src/__tests__/lib/kosztorys/capture-daily-snapshots.test.ts`,
`src/__tests__/lib/actions/investment-unlock.test.ts`, `src/__tests__/lib/actions/kosztorys-lock.test.ts`

**Intent**: Żaden spec nie pożycza #151 ani nie zna wskaźnika.

### Success Criteria:

#### Automated Verification:

- `grep -rnE "templatePresetId|template_preset_id|kosztorys_presets|getWorkshop|OPEN_FLAG|HELD_PRESET" src e2e scripts`
  zwraca trafienia wyłącznie w `src/migrations/`.
- `pnpm generate:types` przechodzi.
- `pnpm exec vitest run src/__tests__/lib/kosztorys/capture-daily-snapshots.test.ts src/__tests__/lib/actions/investment-unlock.test.ts src/__tests__/lib/actions/kosztorys-lock.test.ts`

#### Manual Verification:

- Klik w wiersz na `/szablony` otwiera szablon natychmiast, bez ekranu „Otwórz".
- Dwie karty z dwoma różnymi szablonami: edycja w każdej zapisuje się tylko do swojego szablonu,
  czyli scenariusz EX-893 nie da się odtworzyć.
- Edycja szablonu przesuwa go na górę listy („Zmieniono") i nie resetuje sortowania ani filtrów
  w otwartym edytorze.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 5: Migracja B (destrukcyjna), E2E spec i dokumentacja

### Overview

Baza traci stary model. Spec E2E i żywe dokumenty mówią o nowym.

### Changes Required:

#### 1. Migracja B

**File**: `src/migrations/20260929_2_drop_kosztorys_presets.ts` (+ `index.ts`)

**Intent**: Usunąć stary warsztat i wszystko, co istniało dla wskaźnika.

**Contract**:

- `DELETE FROM investments WHERE status='szablon' AND template_preset_id IS NOT NULL`, czyli #151.
  Kaskada zabiera jego drzewo i pozostałe punkty.
  - Warunek po wskaźniku, nie po id, żeby migracja była poprawna także na bazach testowych, gdzie
    warsztat może mieć inne id.
- Drop FK `investments_template_preset_id_fk` i `kosztorys_snapshots_template_preset_id_fk`, obu
  kolumn `template_preset_id` oraz tabeli `kosztorys_presets`.
- `down`: odtworzyć tabelę, kolumny i FK, bez danych. Napisać wprost, że dane nie wracają.
- Commitowana **osobno** od faz 1–4 (patrz „Migration Notes").

#### 2. E2E spec (bez uruchamiania)

**File**: `e2e/kosztorys-presets.spec.ts`, `e2e/kosztorys-structure.spec.ts` (tylko jeśli dotyka `presetId` / warsztatu)

**Intent**: Krok „Nadpisz istniejący" wybiera szablon po nowej opcji selecta. Sprzątanie usuwa
szablony-inwestycje (kaskada) zamiast wierszy `kosztorys_presets`.

#### 3. Dokumenty

**File**:

- `context/foundation/lessons.md:1679-1683`
- `context/reference/kosztorys-editor-domain-notes.md:1440-1525`
- `context/foundation/manual-checks.md` (wpisy „Warsztat jest JEDEN", „Przed wczytaniem niewidoczny
  w Wersjach", „~90 s przełączania")
- `context/foundation/test-plan.md`

**Intent**:

- Domain-notes: szablon = inwestycja `szablon`; treść = jej drzewo; odcięcie pól per budowa przy
  odczycie.
- Lessons: wpis o statusie `szablon` poprawiony (nieaktualny punkt `kosztorys-subcontractor-due`),
  plus lekcja „identyfikator zmieniający znaczenie w czasie wymusza strażnika w każdym czytelniku".
- Manual-checks: nieaktualne wpisy zamknięte.
- Test-plan: nowe ryzyka (blokada statusu, unikalność nazw, odcięcie przy odczycie,
  `content_edited_at`).

### Success Criteria:

#### Automated Verification:

- Migracja B wchodzi na 5433: `pnpm payload migrate`. Potem na 5433 nie ma tabeli
  `kosztorys_presets` ani kolumn `template_preset_id`, a `/szablony` listuje pięć szablonów, bez
  „Warsztat szablonów".
- `pnpm test:integration` przechodzi (re-import 5435 z A + B).
- `pnpm test:parity` zielony po B.

#### Manual Verification:

- Na lokalnej bazie po A + B pięć szablonów otwiera się z pełną treścią (202 / 311 / 176 / 310 / 310
  pozycji), a Wersje każdego pokazują jego przepięte punkty.

**Implementation Note**: Ostatnia faza — manual-checks zbiera `/10x-implement`.

---

## Testing Strategy

### Unit / DB integration:

Wszystkie przypadki nowe dla tej zmiany, zebrane z faz 2–3:

- blokada wejścia i wyjścia ze statusu `szablon`;
- unikalność nazw bez rozróżniania wielkości liter i spacji na brzegach (tworzenie, zapis jako nowy,
  zmiana nazwy);
- odcięcie przedmiaru i rabatu przy zasiewie, „Wczytaj" i „Dodaj sekcje" z żywego drzewa szablonu;
- źródło niebędące szablonem odrzucone;
- nadpisanie po id z punktem ochronnym;
- usunięcie szablonu kaskaduje, a zwykła inwestycja jest odrzucana;
- `content_edited_at` rośnie tylko dla szablonu i nie rusza `updated_at`;
- `listPresetSections` liczy po żywych sekcjach.

Każdy spec zakłada własny szablon przez `createTestTemplate` i sprząta. Wspólna baza testowa nie może
zależeć od #151, bo B go kasuje.

### Integration:

- Golden master zwalnia każdy `status='szablon'` (faza 1). `pnpm test:parity` po A i po B.

### E2E:

- `e2e/kosztorys-presets.spec.ts` poprawiony, nieuruchamiany (uruchomienie tylko na polecenie).
  EX-847 (E2E przełączania) staje się bezprzedmiotowe.

### Manual Testing Steps:

1. Po A + B na 5433: `/szablony` ma pięć szablonów w dzisiejszej kolejności; każdy otwiera się od
   razu z pełną treścią.
2. Dwie karty, dwa szablony, naprzemienne edycje: każda trafia tylko do swojego szablonu.
3. Nowa inwestycja z szablonu: sekcje i pozycje są, przedmiaru nie ma.
4. „Wczytaj szablon…" w szablonie, potem Wersje → „Przed wczytaniem" przywraca poprzednią treść.

## Performance Considerations

- Odczyt treści szablonu to `getKosztorysTree` (~4–6 ms lokalnie wobec ~1,7 ms jsonb). Dotyczy tylko
  zasiewu, „Wczytaj" i „Dodaj sekcje", nie list.
- Pickery liczą w SQL po `kosztorys_sections` / `kosztorys_items` z indeksem `investment_id`, dla 5
  szablonów. Zostają za `unstable_cache` na tagu `presets`.
- Ogon `investmentAction` dla szablonu to jeden `UPDATE` zamiast serializacji całego drzewa
  z dławikiem, więc jest taniej niż dziś.

## Migration Notes

Kolejność wdrożenia (prod i preview identycznie). Migracje na Neonie stosuje **człowiek**:

1. **Przed pushem kodu (faz 1–4):**
   - `pnpm db:migrate:prod` stosuje zaległe `20260928_0…_4`, `20260929_0` (inny agent) i **A**;
   - analogicznie `pnpm db:migrate:preview` przed wdrożeniem stagingu.
   - Od A do chwili, gdy nowe wdrożenie jest na żywo, **nie edytujemy szablonów**. Zapisy starego
     kodu trafiają do jsonb, którego nowy kod nie czyta. Nowe szablony założone w tym oknie przepadną.
2. **Push faz 1–4 → wdrożenie.**
   - Nowy kod widzi sześć szablonów: pięć nowych i „Warsztat szablonów" (#151, szablon-duch,
     akceptowany do czasu B).
3. **Po wdrożeniu na żywo:**
   - `pnpm db:migrate:prod` stosuje **B**, potem push commitu z B.
   - B w repo przed wdrożeniem kodu byłby błędem: `db:migrate:prod` zastosowałby go w kroku 1,
     a stary kod dostałby 42703 w każdym `payload.find` na inwestycjach.

Lokalnie:

- `db:import` nie migruje, więc 5433 wymaga `pnpm payload migrate`.
- 5435 re-importuje i migruje sam (`test-integration.sh`) przy zmianie migracji.
- Backup no-shrink (`db-backup.yml`) nie zadziała, bo liczba inwestycji rośnie o 5, a spada o 1.

`src/migrations/index.ts` jest w drzewie roboczym zmodyfikowany przez innego agenta (`20260929_0`).
Dopisać wpisy A i B po jego wpisie i commitować wyłącznie własne pliki po ścieżce
(`git commit -- <ścieżki>`). Hunk z `20260929_0` w `index.ts` nie jest nasz: jeśli nadal jest
niezacommitowany, przed commitem zapytać.

## Whole-tree Gate

Uruchamiane **raz**, po ostatniej fazie:

- `pnpm typecheck` (lub `pnpm tsc --noEmit`, zgodnie z `package.json`)
- `pnpm lint`
- `pnpm test`
- `pnpm test:integration`
- `pnpm build`

## References

- Decyzje: `context/changes/2026-09-29-warsztat-per-szablon/change.md`
- Research: `context/changes/2026-09-29-warsztat-per-szablon/research.md` (Follow-up F1–F8)
- Wzór tworzenia inwestycji-szablonu: `src/lib/kosztorys/provision-workshop.ts:18-28`
- Podmiana drzewa z punktem ochronnym: `src/lib/kosztorys/replace-tree-with-snapshot.ts:46-102`
- Precedens migracji A/B: `src/migrations/20260928_2_client_view_single_set.ts:8-9`
- Linear: EX-893 (zastąpione), EX-845 (rozwiązane przez skasowanie `provision-workshop.ts`),
  EX-847 (bezprzedmiotowe)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migracja A (addytywna) + golden master

#### Automated

- [x] 1.1 Migracja wchodzi na lokalną bazę 5433 (po zrzucie punktu powrotu) — 5e26b9d1
- [x] 1.2 Weryfikacja danych na 5433: szablony, liczby sekcji/pozycji, brak nieprzypisanych punktów na #151 — 5e26b9d1
- [x] 1.3 `down` → `up` przechodzi na 5433 — 5e26b9d1
- [x] 1.4 `pnpm test:parity` zielony — 5e26b9d1

### Phase 2: Warstwa danych, czytelnicy i bramka

#### Automated

- [x] 2.1 Specy fazy 2 zielone (`pnpm exec vitest run …`)
- [x] 2.2 Spec hooka statusu zielony

### Phase 3: Cykl życia szablonu i dialogi

#### Automated

- [ ] 3.1 Specy fazy 3 zielone (`pnpm exec vitest run …`)

### Phase 4: Strona szablonu, edytor i sprzątanie martwego kodu

#### Automated

- [ ] 4.1 Grep starego modelu trafia wyłącznie w `src/migrations/`
- [ ] 4.2 `pnpm generate:types` przechodzi
- [ ] 4.3 Specy przepięte na `createTestTemplate` zielone

### Phase 5: Migracja B (destrukcyjna), E2E spec i dokumentacja

#### Automated

- [ ] 5.1 Migracja B wchodzi na 5433; brak tabeli i kolumn, lista bez „Warsztat szablonów"
- [ ] 5.2 `pnpm test:integration` przechodzi
- [ ] 5.3 `pnpm test:parity` zielony po B
