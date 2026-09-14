# Podstrona /szablony — lista, otwieranie w warsztacie, edycja i usuwanie szablonów

## Overview

Biblioteka szablonów kosztorysu (`kosztorys_presets`) nie ma dziś żadnego ekranu. Szablon da się tylko zapisać z wnętrza edytora i wczytać z dialogu — nie da się go zobaczyć na liście, przemianować ani usunąć. Ta zmiana dokłada podstronę `/szablony`, operacje delete i rename, oraz „warsztat": jedną ukrytą inwestycję, w której szablon otwiera się w normalnym edytorze kosztorysu. Użytkownik nie widzi, że pod spodem jest inwestycja.

## Current State Analysis

Pętla edycji szablonu **już działa w całości** — brakuje wyłącznie wejścia do niej i operacji na tożsamości szablonu.

- `src/lib/db/presets.ts` to cała warstwa danych: `insertPreset` (`:40`), `upsertPresetByName` (`:60`), `getPreset` (`:81`), `listPresetSections` (`:107`), `listPresets` (`:135`). **Nie ma delete ani rename.**
- `reloadFromPresetAction` (`src/lib/actions/kosztorys-presets.ts:160`) zastępuje drzewo inwestycji zawartością szablonu, robiąc wcześniej snapshot ochronny o etykiecie `Przed wczytaniem: <nazwa>` (`:149`). To jest gotowe „Otwórz".
- `savePresetAction` (`:35`) z `mode: 'overwrite'` nadpisuje szablon w miejscu. To jest gotowe „Zapisz".
- `kosztorys_presets` jest **globalną tabelą raw-SQL bez kolekcji Payloada** — żaden FK na nią nie wskazuje, więc usunięcie jest referencyjnie bezpieczne (pełny audyt: `research.md` §3).
- Odczyty są cache'owane pod jednym tagiem `CACHE_TAGS.presets` (`src/lib/cache/tags.ts:15`); `getPresets` i `getPresetSections` (`src/lib/queries/presets.ts`) dzielą go, więc jedna rewalidacja odświeża oba.
- Status inwestycji ma dziś trzy wartości (`src/collections/investments.ts:12`), a typ nosi dokładnie jedna kolumna — `investments.status`.
- `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx` pokazuje, ile danych naprawdę potrzebuje edytor; szablon nie potrzebuje ani transakcji, ani figur finansowych.

### Key Discoveries:

- **Nazwa jest tożsamością szablonu** — `name` ma UNIQUE, nie ma innego stabilnego identyfikatora w UI. Dlatego rename to operacja na tożsamości, nie kosmetyka.
- **Rename ma pułapkę, delete nie.** `UPDATE` nie ma furtki `ON CONFLICT`, więc surowy update na zajętą nazwę rzuca PG 23505 i angielskie zdanie sterownika wyciekłoby przez `toActionFailure` do polskiego UI. Konwencja repo (`insertPreset:40`) każe zrobić guard w SQL i zwrócić `number | null`.
- **`ownerOnlyAction` nie przyjmuje tagów rewalidacji** (`src/lib/actions/owner-only-action.ts` — opakowuje `protectedAction` bez trzeciego argumentu). Akcja owner-only musi zawołać `revalidateCollections(['presets'])` wewnątrz handlera; precedens: `revalidateNotificationRecipients()` w `src/lib/actions/notification-recipients.ts:38`.
- **`isBookableInvestment` jedzie po `string`, nie po unii** (`src/lib/constants/investment-lock.ts:21`) — dodanie czwartej wartości do `InvestmentStatusT` **nie wywoła żadnego błędu typów** tam, gdzie decyduje się, czy inwestycja może być celem księgowania. To trzeba dopisać ręcznie.
- **`active: row.status === 'active'`** (`src/lib/queries/reference-data.ts:106`) jest cichą bramą wszystkich comboboxów — warsztat dostanie `active: false` za darmo i zniknie z każdego pickera inwestycji.
- **Migracja jest jednolinijkowa**, precedens `src/migrations/20260718_0_add_planowana_investment_status.ts`: PG12+ pozwala na `ADD VALUE` w transakcji Payloada, dopóki nowa wartość **nie jest użyta** w tej samej transakcji. Rejestracja to dwie edycje w `src/migrations/index.ts` (import + wpis w tablicy).
- `listPresetSections` liczy pozycje per sekcja w SQL i już jest cache'owane pod tym samym tagiem — lista szablonów dostanie liczbę sekcji i pozycji **bez nowego zapytania**, agregując ten sam odczyt.

## Desired End State

W sidebarze pojawia się „Szablony". Strona `/szablony` pokazuje tabelę szablonów (nazwa, sekcje, pozycje, data) z trzema akcjami w wierszu. „Otwórz" przenosi na `/szablony/<id>`, gdzie stoi normalny edytor kosztorysu z nazwą szablonu na belce — adres nie zdradza, że pod spodem pracuje inwestycja. „Zapisz" w edytorze nadpisuje ten szablon. „Zmień nazwę" i „Usuń" działają z listy, usunięcie za potwierdzeniem i tylko dla właściciela. Inwestycja-warsztat nie pokazuje się na `/inwestycje`, w żadnym pickerze inwestycji ani jako możliwy cel wpłaty/wydatku.

Weryfikacja: `/szablony` listuje jedyny lokalny szablon (id 4, 14 sekcji, 373 pozycje); „Otwórz" pokazuje te 373 pozycje w edytorze; zmiana + „Zapisz" + powrót + ponowne „Otwórz" pokazuje zmianę; „Usuń" usuwa wiersz z listy; `/inwestycje` nie zawiera warsztatu.

## What We're NOT Doing

- **Nie zmieniamy `src/lib/kosztorys/serialize-preset.ts`.** Szablon nadal nie ma przedmiaru, pomiaru, rabatu, etapów ani postępu. Ruling właściciela.
- **Nie przenosimy źródła prawdy do inwestycji.** `kosztorys_presets` zostaje jedynym magazynem szablonów; inwestycja-warsztat to tylko stół roboczy, a `template_preset_id` to wskaźnik, nie kopia.
- **Nie zmieniamy uprawnień do `savePresetAction`** — zapis zostaje otwarty dla ról zarządczych, jak dziś. Bramujemy tylko delete i rename (zob. „Open Risks").
- **Nie dodajemy `szablon` do `<SelectItem>` w formularzu inwestycji** — status ma powstawać wyłącznie przez auto-provisioning warsztatu, nie z ręki. (Do zod dopisujemy, bo tego wymaga typecheck.)
- Nie ruszamy dialogu „Wczytaj szablon" wewnątrz edytora ani „Dodaj sekcję z szablonu" — działają i zostają.
- Nie dodajemy wersjonowania, historii ani kosza szablonów. Usunięcie jest nieodwracalne.
- Nie piszemy E2E w tej zmianie (odroczenie do backlogu `e2e-backlog` przy bramce review).

## Implementation Approach

Cztery fazy w kolejności zależności: najpierw baza i sposób rozpoznania warsztatu, potem operacje na szablonach, potem ekran listy, na końcu warsztat z edytorem.

Kluczowa decyzja architektoniczna: **warsztat jest auto-provisionowany, nie zakładany ręcznie.** `resolveWorkshopInvestment()` szuka jedynej inwestycji o statusie `szablon`, a gdy jej nie ma — zakłada ją (nazwa „Warsztat szablonów"). Dzięki temu status nie musi być wybieralny w formularzu inwestycji, nie da się założyć drugiego warsztatu z ręki, a funkcja działa identycznie lokalnie i na produkcji, bez żadnego stałego id.

Druga decyzja: **`/szablony/[id]` renderuje edytor nad warsztatem, a nie nad `/inwestycje/<id>`.** Ta sama komponenta `KosztorysEditorV2`, ale strona podaje tylko te propsy, które szablon ma sens nieść: drzewo, nazwę szablonu jako `investmentName` (to jest „napis szablon" — bez żadnego parametru URL) i zera tam, gdzie edytor oczekuje figur finansowych.

## Critical Implementation Details

**Kolejność w migracji.** `ALTER TYPE … ADD VALUE` i `ALTER TABLE … ADD COLUMN` mogą stać w jednej migracji, bo dodawana kolumna nie używa nowej wartości enuma — gdyby użyła (np. jako `DEFAULT 'szablon'`), Postgres odmówiłby w tej samej transakcji. Migracja jest **addytywna**, więc wg `AGENTS.md` idzie na produkcję **przed** pushem kodu.

**`template_preset_id` musi być zadeklarowany w kolekcji Payloada**, nie tylko dodany surowym SQL-em. Kolumna nieznana kolekcji nie istnieje w schemacie drizzle Payloada, więc `payload.update` nie mógłby jej zapisać, a dev-mode push mógłby ją usunąć. Deklarujemy pole `number` ukryte w adminie i osobno piszemy migrację dodającą kolumnę.

**Wskaźnik ustawia „Otwórz", nie „Zapisz".** Warsztat ma zawsze wskazywać ten szablon, którego treść w nim siedzi. Gdyby wskaźnik ustawiał zapis, wejście na `/szablony/<inny>` bez „Otwórz" zostawiłoby pasek i treść rozjechane.

## Phase 1: Status `szablon` i rozpoznanie warsztatu

### Overview

Baza uczy się czwartej wartości statusu i wskaźnika na szablon; kod uczy się, że taka inwestycja jest warsztatem — niewidocznym na liście i nieksięgowalnym.

### Changes Required:

#### 1. Migracja

**File**: `src/migrations/20260914_0_add_szablon_investment_status.ts` (nowy)

**Intent**: Dołożyć czwartą wartość enuma statusu inwestycji i nullable wskaźnik na szablon, którego warsztat aktualnie trzyma.

**Contract**: `up` wykonuje `ALTER TYPE "enum_investments_status" ADD VALUE IF NOT EXISTS 'szablon';` oraz `ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "template_preset_id" integer;`. `down` to udokumentowany no-op dla enuma (Postgres nie ma `DROP VALUE`) — kolumnę wolno w nim zdjąć. Wzorzec i komentarz: `src/migrations/20260718_0_add_planowana_investment_status.ts`.

#### 2. Rejestracja migracji

**File**: `src/migrations/index.ts`

**Intent**: Wpiąć nową migrację w łańcuch.

**Contract**: Import `import * as migration_20260914_0_add_szablon_investment_status from './20260914_0_add_szablon_investment_status'` oraz wpis `{ up, down, name }` na **końcu** tablicy `migrations` — kolejność wykonania to kolejność tablicy.

#### 3. Kolekcja inwestycji

**File**: `src/collections/investments.ts`

**Intent**: Dodać `szablon` do `STATUS_OPTIONS` (żeby `/admin` i `generate:types` wiedziały o nim) oraz zadeklarować pole wskaźnika.

**Contract**: Nowa opcja `{ label: 'Szablon', value: 'szablon' }` w `STATUS_OPTIONS` (`:12`) i pole `templatePresetId` typu `number`, `admin: { hidden: true }` — jest to stan roboczy warsztatu, nie dana, którą ktokolwiek edytuje ręcznie.

#### 4. Unia typów i pochodne

**File**: `src/types/reference-data.ts`

**Intent**: Rozszerzyć `InvestmentStatusT` o `'szablon'`. To jest edycja, która odpala wszystkie druty pułapkowe w tej fazie.

**Contract**: `InvestmentStatusT` zyskuje czwarty wariant. Po tej zmianie typecheck wskaże trzy miejsca wymagające uzupełnienia: `investment-status-badge.tsx:5` i `:11` (dwa `Record<InvestmentStatusT, …>`) oraz `edit-investment-dialog.tsx:41` (przypisanie do wartości formularza).

#### 5. Etykieta i kolor statusu

**File**: `src/components/investments/investment-status-badge.tsx`

**Intent**: Dopisać polską etykietę „Szablon" i klasę koloru, odróżniającą go od trzech pozostałych.

**Contract**: Po jednym kluczu `szablon` w `STATUS_LABELS` (`:5`) i `STATUS_CLASSNAMES` (`:11`), w konwencji pozostałych wpisów (para `bg-*-100 text-*-800` + wariant `dark:`).

#### 6. Schemat formularza inwestycji

**File**: `src/components/forms/investment-form/investment-schema.ts`

**Intent**: Dopisać `'szablon'` do `z.enum` statusu — bez tego przypisanie w `edit-investment-dialog.tsx:41` nie przejdzie typechecku, a edycja warsztatu po cichu przepisałaby mu status.

**Contract**: `status: z.enum(['active', 'completed', 'planowana', 'szablon'])` (`:12`). **`investment-form.tsx` zostaje bez zmian** — brak `<SelectItem>` dla `szablon` jest celowy (warsztat powstaje wyłącznie przez auto-provisioning).

#### 7. Ukrycie na liście inwestycji

**File**: `src/hooks/use-status-filter.ts`

**Intent**: Nie dopuścić warsztatu na `/inwestycje` — ani domyślnie, ani po zaznaczeniu checkboxa.

**Contract**: `VALID_STATUSES` (`:8`) i `DEFAULT_STATUSES` (`:7`) **zostają trzyelementowe**. Zmiana jest zerowa w kodzie — ale trzeba to udokumentować komentarzem, bo dziś działa przez przypadek: `filterByStatuses` odrzuca każdy status spoza wybranego zbioru, a `szablon` nigdy do niego nie wejdzie. Komentarz ma powiedzieć, że to jest **zamierzone ukrycie**, żeby nikt nie „naprawił" listy przez dopisanie czwartej wartości. Analogicznie `src/components/investments/status-filter.tsx:17` `STATUS_ORDER` zostaje trzyelementowe.

#### 8. Nieksięgowalność warsztatu

**File**: `src/lib/constants/investment-lock.ts`

**Intent**: Sprawić, żeby warsztat nie był oferowany ani przyjmowany jako cel wpłaty/wydatku. Dziś `isBookableInvestment` zwróciłby dla niego `true`, bo porównuje tylko z `completed` i przyjmuje `string`.

**Contract**: `isBookableInvestment` (`:21`) rozszerza warunek o status warsztatu. Nowa stała `TEMPLATE_INVESTMENT_STATUS = 'szablon'` mieszka tutaj, bo ten moduł jest celowo wolny od `server-only` (wciągają go hooki kolekcji). `isLockedStatus` **zostaje niezmieniony** — warsztat ma być edytowalny, on tylko nie jest celem księgowania. Cztery call-site'y `isBookableInvestment` (`deposit-form.tsx:210`, `expense-form.tsx:305`, `use-investment-from-url.ts:23`, `tables/transfers.tsx:211`) dostają to za darmo.

#### 9. Rozpoznanie i auto-provisioning warsztatu

**File**: `src/lib/db/workshop-investment.ts` (nowy)

**Intent**: Jedno miejsce, które zwraca id inwestycji-warsztatu, zakładając ją przy pierwszym użyciu. Dzięki temu nigdzie nie ma zaszytego id ani nazwy.

**Contract**: `resolveWorkshopInvestment(payload): Promise<number>` — `SELECT id FROM investments WHERE status = 'szablon' ORDER BY id LIMIT 1`; przy braku wiersza zakłada inwestycję przez `payload.create` (nazwa „Warsztat szablonów", status `szablon`) i zwraca jej id. Plus `setWorkshopPreset(db, investmentId, presetId)` i odczyt `getWorkshopPresetId(db, investmentId)` na kolumnie `template_preset_id`. Moduł należy do warstwy `src/lib/db` (surowy SQL + jego mapper), zgodnie z regułą z `AGENTS.md`.

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się na lokalnej bazie: `pnpm payload migrate` (docker 5433)
- `pnpm generate:types` przechodzi i `src/payload-types.ts` niesie czwarty status (plik jest gitignored — nie commitować)
- Spec statusu blokady nadal przechodzi z nowym wierszem: `pnpm exec vitest run src/__tests__/lib/db/investment-lock.test.ts`
- Spec filtra statusów nadal przechodzi bez zmian: `pnpm exec vitest run src/__tests__/use-status-filter.test.ts`

#### Manual Verification:

- Warsztat nie pojawia się na `/inwestycje` przy żadnej kombinacji checkboxów filtra
- Warsztat nie jest wybieralny w formularzu wpłaty ani wydatku, także po wyłączeniu przełącznika „Aktywni"
- Formularz inwestycji nadal oferuje dokładnie trzy statusy

---

## Phase 2: Usuwanie i zmiana nazwy szablonu

### Overview

Warstwa danych i akcje dla dwóch brakujących operacji. Obie owner-only, obie rewalidują tag `presets` ręcznie.

### Changes Required:

#### 1. Operacje SQL

**File**: `src/lib/db/presets.ts`

**Intent**: Dołożyć `deletePreset` i `renamePreset`, obie zwracające informację, czy coś się stało — bez rzucania wyjątkami sterownika w górę.

**Contract**: `deletePreset(db, id): Promise<boolean>` — `DELETE … WHERE id = $1 RETURNING id`, `false` gdy nie było takiego wiersza. `renamePreset(db, id, name): Promise<number | null>` — `null` oznacza kolizję nazwy, dokładnie jak `insertPreset` (`:40`). Guard musi siedzieć w SQL, nie w `catch` po kodzie błędu:

```sql
UPDATE kosztorys_presets SET name = $2
WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM kosztorys_presets WHERE name = $2)
RETURNING id
```

Bez tego zajęta nazwa rzuca PG 23505, a angielskie zdanie sterownika trafia do polskiego UI.

#### 2. Akcje

**File**: `src/lib/actions/kosztorys-presets.ts`

**Intent**: Wystawić obie operacje jako akcje owner-only, z rewalidacją cache'u wewnątrz handlera.

**Contract**: `deletePresetAction(id): Promise<ActionResultT>` i `renamePresetAction(id, name): Promise<ActionResultT>`, obie przez `ownerOnlyAction` z komunikatem odmowy w stylu `FORBIDDEN` z `kosztorys-share.ts:30`. **`ownerOnlyAction` nie przyjmuje tablicy tagów**, więc każda z nich woła `revalidateCollections(['presets'])` przed zwróceniem sukcesu — precedens `notification-recipients.ts:38`. Rename waliduje nazwę tym samym kształtem, co `savePresetSchema` (`:26`), i mapuje `null` na to samo zdanie: `'Szablon o tej nazwie już istnieje'`. Delete na nieistniejącym id zwraca `'Nie znaleziono szablonu'`.

#### 3. Testy

**File**: `src/__tests__/lib/db/presets.test.ts`

**Intent**: Pokryć obie operacje na poziomie utrwalonego stanu, nie zwracanej wartości akcji.

**Contract**: Trzy przypadki: delete usuwa szablon z `listPresets`; rename zmienia nazwę i jest widoczny w `listPresets`; rename na nazwę zajętą przez inny szablon zwraca `null` i **nie zmienia żadnego z dwóch wierszy**. Spec jest DB-backed, więc musi tworzyć i sprzątać własne wiersze — sąsiedzi dzielą tę samą bazę (`scripts/test-integration.sh`).

### Success Criteria:

#### Automated Verification:

- Nowe specy przechodzą: `pnpm exec vitest run src/__tests__/lib/db/presets.test.ts`
- Istniejący spec unikalności nazwy nadal przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/serialize-apply-preset.test.ts`

#### Manual Verification:

- Konto MANAGER dostaje polską odmowę przy próbie usunięcia i przy zmianie nazwy
- Zmiana nazwy na już istniejącą pokazuje „Szablon o tej nazwie już istnieje", a nie komunikat sterownika

---

## Phase 3: Strona `/szablony`

### Overview

Ekran listy i wejście do niego z sidebara. Akcja „Otwórz" jest tu podpięta, ale jej cel powstaje w fazie 4 — do tego czasu wiersz ma dwie działające akcje.

### Changes Required:

#### 1. Strona

**File**: `src/app/(frontend)/szablony/page.tsx` (nowy)

**Intent**: Serwerowa strona listy, zbudowana dokładnie jak `/katalog-prac`.

**Contract**: `requireAuth(ADMIN_OR_OWNER_MANAGER_ROLES)` + `if (!session.success) redirect('/')` — dwuwiersz inline, **nie** `requireManagementPage` (to jest konwencja stron listowych, `katalog-prac/page.tsx:9-10`). Dane: `getPresets()` plus `getPresetSections()` zagregowane do liczby sekcji i pozycji per szablon — oba są już cache'owane pod tagiem `presets`, więc nie powstaje nowe zapytanie. Render w `PageWrapper title="Szablony"`.

#### 2. Stan ładowania

**File**: `src/app/(frontend)/szablony/loading.tsx` (nowy)

**Intent**: Jednolinijkowy loading, jak reszta stron listowych.

**Contract**: Domyślny eksport zwracający istniejący komponent szkieletu.

#### 3. Tabela

**File**: `src/components/tables/presets.tsx` (nowy)

**Intent**: Definicje kolumn dla `DataTable`. `DataTable` jest konwencją nawet przy jednym wierszu.

**Contract**: Kolumny: nazwa, liczba sekcji, liczba pozycji, data utworzenia (format jak w pozostałych tabelach), kolumna akcji. Typ wiersza (`PresetRowT`) kolokowany przy definicji kolumn.

#### 4. Akcje wiersza

**File**: `src/components/presets/preset-row-actions.tsx` (nowy)

**Intent**: Trzy akcje: „Otwórz", „Zmień nazwę", „Usuń" — dwie ostatnie za potwierdzeniem/dialogiem.

**Contract**: Wzorzec do odwzorowania jeden do jednego: `src/components/work-catalogue/catalogue-row-actions.tsx` — `useState` na potwierdzenie, `useTransition` na oczekiwanie, `toastMessage(…, 'error' | 'success')`, `ConfirmDialog` z polskim copy („Usuń szablon", ostrzeżenie że operacji nie można cofnąć). „Zmień nazwę" to dialog z jednym polem, wstępnie wypełnionym aktualną nazwą, zgłaszający błąd kolizji zwrócony przez akcję.

#### 5. Nawigacja

**File**: `src/components/nav/sidebar.tsx`

**Intent**: Wpis „Szablony" w menu zarządczym.

**Contract**: Jeden obiekt `{ href: '/szablony', label: 'Szablony', icon: … }` w `MANAGEMENT_LINKS` (`:37-43`), obok „Katalog prac". Podświetlanie aktywnego linku obsługuje istniejące `isActiveLink` (`:51`) — działa dla `/szablony/<id>`, bo dopasowuje też podstrony. **Uwaga: ten plik był ostatnio zmieniany (commit `134dff69`) — sprawdź stan drzewa przed edycją.**

### Success Criteria:

#### Automated Verification:

- Strona i jej `loading.tsx` istnieją pod `src/app/(frontend)/szablony/`
- Spec grupowania metadanych szablonów nadal przechodzi: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/dialogs/preset-picker-groups.test.ts`

#### Manual Verification:

- `/szablony` listuje szablon „kosztorys wzór testy 2 września 26" z 14 sekcjami i 373 pozycjami
- „Usuń" pyta o potwierdzenie, a po potwierdzeniu wiersz znika bez odświeżania strony ręką
- „Zmień nazwę" zmienia nazwę i nowa nazwa jest widoczna także w dialogu „Wczytaj szablon" wewnątrz edytora (wspólny tag cache'u)
- „Szablony" podświetla się w sidebarze także na `/szablony/<id>`

---

## Phase 4: Warsztat — `/szablony/[id]`

### Overview

Otwarcie szablonu w edytorze. Użytkownik nie widzi inwestycji: adres to `/szablony/<id>`, a na belce stoi nazwa szablonu.

### Changes Required:

#### 1. Akcja otwarcia

**File**: `src/lib/actions/kosztorys-presets.ts`

**Intent**: Jedno wejście, które przygotowuje warsztat i przenosi do edytora. Wczytanie jest mutacją, więc nie może być efektem ubocznym renderu strony.

**Contract**: `openPresetInWorkshopAction(presetId): Promise<ActionResultT<number>>` — ustala warsztat przez `resolveWorkshopInvestment`, wczytuje szablon istniejącą ścieżką `reloadFromPresetAction` (ona sama robi snapshot ochronny `Przed wczytaniem: <nazwa>`), zapisuje wskaźnik przez `setWorkshopPreset` i zwraca id warsztatu. Nawigacja zostaje po stronie klienta (`router.push('/szablony/<presetId>')`), żeby akcja miała jeden typ wyniku i dała się obsłużyć toastem przy błędzie.

#### 2. Strona warsztatu

**File**: `src/app/(frontend)/szablony/[id]/page.tsx` (nowy)

**Intent**: Render edytora nad drzewem warsztatu, z nazwą szablonu w miejscu nazwy inwestycji.

**Contract**: Odwzorowuje `inwestycje/[id]/kosztorys_v2/page.tsx`, ale **bez** żadnego z pięciu pobrań finansowych — szablon nie ma transakcji ani figur. `KosztorysEditorV2` dostaje: `investmentId` = id warsztatu, `tree` = `getKosztorysTree(warsztat)`, `investmentName` = nazwa szablonu (to jest cały „napis szablon" — żadnego parametru URL), zera we wszystkich polach kwotowych, `[]` w `depositTransactions` i `materialTransactions` (oba są wymagane w `KosztorysEditorDataT`), pominięte `financials`, `hasSheet`, `workers`, `locked`. Strona sprawdza, czy `template_preset_id` warsztatu zgadza się z `<id>` z adresu — przy rozjeździe nie renderuje cudzej treści pod cudzą nazwą, tylko kieruje z powrotem na `/szablony` z komunikatem, żeby otworzyć szablon przyciskiem.

#### 3. Zapis nadpisujący szablon

**File**: `src/components/kosztorys/editor/…` (pasek narzędzi edytora — dokładny plik do ustalenia przy implementacji)

**Intent**: W kontekście warsztatu „Zapisz" ma nadpisać otwarty szablon, bez pytania o nazwę i bez wyboru trybu.

**Contract**: Istniejąca ścieżka `savePresetAction(investmentId, name, 'overwrite')` wystarcza — nowy jest tylko wariant przycisku, który podaje nazwę otwartego szablonu i tryb `overwrite` bez dialogu. Rozpoznanie kontekstu przez nowy, opcjonalny prop edytora (np. `templateName`), a nie przez czytanie pathname wewnątrz komponentu.

### Success Criteria:

#### Automated Verification:

- Spec akcji szablonów nadal przechodzi i pokrywa nadpisanie: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-presets.test.ts`
- Spec zastąpienia drzewa snapshotem nadal przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/serialize-apply-preset.test.ts`

#### Manual Verification:

- „Otwórz" na `/szablony` pokazuje 373 pozycje szablonu w edytorze pod adresem `/szablony/4`
- Na belce stoi nazwa szablonu, nie nazwa inwestycji; F5 jej nie gubi
- Zmiana pozycji + „Zapisz" + powrót + ponowne „Otwórz" pokazuje zmianę
- W warsztacie nie ma przedmiaru, etapów ani postępu (szablon ich nie niesie)
- Wejście wprost na `/szablony/<inny-id>` bez „Otwórz" nie pokazuje cudzej treści pod cudzą nazwą
- Po zapisie w warsztacie inwestycja-warsztat nadal nie występuje na `/inwestycje`

---

## Testing Strategy

### Unit Tests:

- `deletePreset` / `renamePreset` na poziomie utrwalonego stanu (`src/__tests__/lib/db/presets.test.ts`) — w tym kolizja nazwy nie zmieniająca żadnego z wierszy.
- Rozszerzenie tabeli statusów w `src/__tests__/lib/db/investment-lock.test.ts` o wiersz `szablon` (nieblokowany, ale nieksięgowalny).

### Integration Tests:

- Specy DB-backed idą przez `scripts/test-integration.sh` (bramka pre-push, baza 5435). Tworzą i sprzątają własne wiersze — sąsiedzi dzielą bazę.

### Manual Testing Steps:

1. `pnpm payload migrate` na lokalnej bazie, potem `pnpm generate:types`.
2. `/szablony` — sprawdź nazwę, 14 sekcji, 373 pozycje.
3. „Otwórz" → `/szablony/4`, nazwa szablonu na belce, 373 pozycje w siatce.
4. Zmień cenę jednej pozycji → „Zapisz" → wróć → „Otwórz" ponownie → zmiana jest.
5. „Zmień nazwę" na nazwę istniejącą → polski komunikat o kolizji.
6. „Usuń" → potwierdzenie → wiersz znika; sprawdź, że dialog „Wczytaj szablon" w edytorze też go już nie ma.
7. `/inwestycje` przy każdej kombinacji filtra statusu — warsztatu nie ma.
8. Formularz wydatku → picker inwestycji, także z wyłączonym „Aktywni" — warsztatu nie ma.

## Migration Notes

Migracja jest **addytywna**: nowy kod czyta kolumnę i wartość enuma, których produkcja jeszcze nie ma. Wg `AGENTS.md` kolejność jest więc taka, że **migracja na produkcję idzie PRZED pushem kodu** (`pnpm db:migrate:prod`, uruchamiane przez człowieka — nigdy przez agenta). Do tego czasu implementacja i testy lokalne biegną normalnie; to bramka deploy-time, nie fazowa.

Auto-provisioning warsztatu oznacza, że na produkcji po pierwszym kliknięciu „Otwórz" powstaje jedna nowa inwestycja. Jest niewidoczna na liście i nieksięgowalna, ale **istnieje w bazie** — warto o tym wiedzieć przed pierwszym uruchomieniem i nie zdziwić się jej obecnością w surowych zapytaniach.

## Whole-tree Gate

Uruchomić **raz**, po ostatniej fazie:

- Typy: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy jednostkowe: `pnpm test`
- Specy DB-backed: `pnpm test:integration`
- Build: `pnpm build`
- Golden master (warsztat z pozycjami rusza globalny licznik `kosztorysItemCount`): `pnpm test:parity`, w razie potrzeby regeneracja `pnpm test:golden:update`

## References

- Research: `context/changes/2026-09-14-szablony-crud/research.md`
- Precedens migracji enuma: `src/migrations/20260718_0_add_planowana_investment_status.ts`
- Precedens strony listowej: `src/app/(frontend)/katalog-prac/page.tsx`
- Precedens akcji wiersza z usuwaniem: `src/components/work-catalogue/catalogue-row-actions.tsx`
- Precedens rewalidacji w akcji owner-only: `src/lib/actions/notification-recipients.ts:38`
- Kształt danych edytora: `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Status `szablon` i rozpoznanie warsztatu

#### Automated

- [x] 1.1 Migracja stosuje się na lokalnej bazie — 297ad5d1
- [x] 1.2 `pnpm generate:types` przechodzi i typy niosą czwarty status — 297ad5d1
- [x] 1.3 Spec statusu blokady przechodzi z nowym wierszem — 297ad5d1
- [x] 1.4 Spec filtra statusów przechodzi bez zmian — 297ad5d1

### Phase 2: Usuwanie i zmiana nazwy szablonu

#### Automated

- [x] 2.1 Nowe specy `presets.test.ts` przechodzą
- [x] 2.2 Spec unikalności nazwy nadal przechodzi

### Phase 3: Strona `/szablony`

#### Automated

- [ ] 3.1 Strona i `loading.tsx` istnieją pod `src/app/(frontend)/szablony/`
- [ ] 3.2 Spec grupowania metadanych szablonów przechodzi

### Phase 4: Warsztat — `/szablony/[id]`

#### Automated

- [ ] 4.1 Spec akcji szablonów przechodzi i pokrywa nadpisanie
- [ ] 4.2 Spec zastąpienia drzewa snapshotem przechodzi
