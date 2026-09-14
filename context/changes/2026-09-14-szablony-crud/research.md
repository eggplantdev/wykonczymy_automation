---
date: 2026-09-14T17:49:20Z
researcher: Claude (Opus 5)
git_commit: 134dff694b0e39673e6065e402c2874fc4b3fb3c
branch: staging
repository: wykonczymy
topic: 'Podstrona /szablony — lista, otwieranie w warsztacie, edycja i usuwanie szablonów'
tags: [research, codebase, kosztorys-presets, szablony, investments-status, data-table, delete-flow]
status: complete
last_updated: 2026-09-14
last_updated_by: Claude (Opus 5)
---

# Research: Podstrona /szablony — lista, otwieranie w warsztacie, edycja i usuwanie szablonów

**Date**: 2026-09-14T17:49:20Z
**Researcher**: Claude (Opus 5)
**Git Commit**: `134dff694b0e39673e6065e402c2874fc4b3fb3c`
**Branch**: `staging`
**Repository**: wykonczymy

## Research Question

Potrzebna jest podstrona z listą szablonów. Nie tylko dodawanie i edycja — także **usuwanie** szablonu.
Docelowy kształt uzgodniony z właścicielem (5 punktów):

1. czwarty status inwestycji `szablon` + jedna addytywna migracja,
2. jedna inwestycja „Warsztat szablonów",
3. strona `/szablony` z listą presetów,
4. „Otwórz" wczytuje szablon do warsztatu i przenosi do edytora z nazwą na belce,
5. „Zapisz" nadpisuje ten szablon.

Plus nowo dodane: usuwanie (i pośrednio zmiana nazwy szablonu).

Ruling właściciela, który wiąże cały research: **szablon jest źródłem prawdy** (`kosztorys_presets`), inwestycja jest tylko warsztatem. Szablon nie ma przedmiaru — `serialize-preset.ts` nie zmienia się.

## Summary

Pętla „wczytaj → edytuj → zapisz" **już istnieje w całości** (`reloadFromPresetAction` w jedną stronę, `savePresetAction` w drugą). Brakuje trzech rzeczy: ekranu listy, operacji **delete** i operacji **rename** w warstwie `src/lib/db/presets.ts` — tam dziś nie ma ani jednej, ani drugiej.

Cztery wnioski, które kształtują plan:

1. **Usunięcie szablonu jest referencyjnie bezpieczne.** Żaden FK nie wskazuje na `kosztorys_presets`; `presetId` żyje tylko w formularzu, nigdy jako kolumna `investments`; drzewa zrodzone z szablonu są zamrożonymi kopiami; `kosztorys_snapshots.label` trzyma wyłącznie historyczny tekst nazwy; żaden klucz localStorage nie trzyma id presetu. Migracja `20260902_0` już raz wykonała gołe `DELETE FROM "kosztorys_presets"`.
2. **Rename jest jedyną operacją z pułapką.** `UPDATE` nie ma furtki `ON CONFLICT`, więc surowy update na zajętą nazwę rzuca PG 23505, a `toActionFailure` wypuściłby angielskie zdanie ze sterownika. Wzorzec repo: `UPDATE … WHERE NOT EXISTS (…) RETURNING id` zwracające `number | null`, jak `insertPreset`.
3. **Czwarty status `szablon` kupuje mniej, niż się wydaje.** Ukrycie inwestycji-warsztatu na `/inwestycje` dostajemy za darmo (filtr kliencki), ale **`isBookableInvestment` nie ma żadnego nacisku typów** — warsztat zostaje bookowalnym celem, dopóki nie dopiszemy go ręcznie w `investment-lock.ts`. To jest największa cicha luka.
4. **Warsztat z pozycjami kosztorysu zanieczyszcza dwa zapytania SQL** (`kosztorys-client-totals`, `kosztorys-subcontractor-due`) i golden-mastera. Nie łamie ich, ale trzeba to zobaczyć świadomie.

## Detailed Findings

### 1. Powierzchnia danych szablonów (`src/lib/db/presets.ts`)

Cała warstwa to jeden plik, tabela jest **globalną tabelą raw-SQL bez kolekcji Payloada** (wzorzec `notification_reads`). Wiersz: `{id, name UNIQUE, schema_version, payload jsonb, created_at, created_by}`.

- `insertPreset` (`src/lib/db/presets.ts:40`) — `ON CONFLICT (name) DO NOTHING RETURNING id` → `number | null`. **To jest wzorzec, który powinien powtórzyć rename.**
- `upsertPresetByName` (`:60`) — `ON CONFLICT (name) DO UPDATE`; to jest nadpisanie z punktu 5.
- `getPreset` (`:81`), `listPresetSections` (`:107`, liczy pozycje w SQL po jsonb — EX-622), `listPresets` (`:135`).
- **Nie ma `deletePreset`, nie ma `renamePreset`, nie ma update samej nazwy.**

Akcje (`src/lib/actions/kosztorys-presets.ts`):

- `savePresetAction` (`:35`) — jedyny writer, **świadomie nieogrodzony rolą**, rewaliduje `['presets']`, mapuje `id == null` → `'Szablon o tej nazwie już istnieje'` (`:65`).
- `listPresetsAction` (`:74`), `listPresetSectionsAction` (`:83`), `appendPresetSectionsAction` (`:104`).
- `preReloadLabel` (`:149`) — `` `Przed wczytaniem: ${presetName}` ``, etykieta snapshotu ochronnego.
- `reloadFromPresetAction` (`:160`) — `replaceTreeWithSnapshot`, `clearGlobalDiscount: true`. **To jest gotowe „Otwórz" z punktu 4.**

Zapytania cache'owane: `src/lib/queries/presets.ts` — `getPresets`, `getPresetSections`, oba `unstable_cache` pod `CACHE_TAGS.presets` (`src/lib/cache/tags.ts:15` = `'collection:kosztorys-presets'`).

Serializacja: `src/lib/kosztorys/serialize-preset.ts` zeruje przedmiar, pomiar, rabat, notatkę; `stages: []`, `progress: []`. **Nie zmieniamy tego pliku.**

### 2. Gating destrukcyjnej akcji — `ownerOnlyAction` nie przyjmuje tagów

`protectedAction` przyjmuje tablicę tagów do rewalidacji; **`ownerOnlyAction` (ADMIN/OWNER) jej nie przyjmuje**. Jeśli delete ma być owner-only, rewalidacja musi być wywołana wewnątrz handlera: `revalidateCollections(['presets'])`. Precedens: `src/lib/actions/notification-recipients.ts`.

Otwarta decyzja dla planu: `savePresetAction` jest dziś celowo nieogrodzony. Delete ogrodzony owner-only, a save otwarty dla wszystkich, to niespójność — ale świadoma (skasowanie jest nieodwracalne, nadpisanie zostawia snapshot ochronny).

### 3. Bezpieczeństwo usunięcia (pełny audyt referencji)

- brak FK na `kosztorys_presets`,
- `presetId` istnieje wyłącznie w stanie formularza, nigdy jako kolumna `investments`,
- drzewo zrodzone z szablonu jest **zamrożoną kopią** — po wczytaniu nie ma już żadnego związku z presetem,
- `kosztorys_snapshots.label` trzyma tylko historyczny wolny tekst nazwy (`Przed wczytaniem: …`) — po usunięciu szablonu etykieta zostaje i to jest poprawne, to zapis historii,
- żaden klucz localStorage nie trzyma id presetu,
- precedens operacyjny: migracja `20260902_0` wykonała `DELETE FROM "kosztorys_presets"` bez żadnej kaskady.

Wniosek: `DELETE FROM kosztorys_presets WHERE id = $1 RETURNING id` wystarcza; `RETURNING` daje rozróżnienie „nie było takiego" od „usunięto".

### 4. Pułapka rename (PG 23505)

`name` ma UNIQUE. `UPDATE … SET name = $2 WHERE id = $1` na zajętą nazwę rzuca `23505`, a `toActionFailure` przepuściłby angielskie zdanie sterownika do polskiego UI. Konwencja repo (patrz `insertPreset`) każe napisać:

```sql
UPDATE kosztorys_presets SET name = $2
WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM kosztorys_presets WHERE name = $2)
RETURNING id
```

→ `number | null`, a `null` mapujemy na to samo zdanie co przy zapisie: `'Szablon o tej nazwie już istnieje'`.

Uwaga z `lessons.md`, która tu obowiązuje: **nie mapuj całej klasy błędów na jeden uprzejmy komunikat** — dlatego guard jest w SQL, a nie w `catch (e) { if (e.code === '23505') … }`.

### 5. Wzorzec ekranu listy — `/katalog-prac` jest kopią do odwzorowania

Pliki do odwzorowania jeden do jednego dla `/szablony`:

- `src/app/(frontend)/katalog-prac/page.tsx` — strony listy używają **inline'owego dwuwiersza** `requireAuth(…)` + `if (!session.success) redirect('/')`, a **nie** `requireManagementPage`,
- `loading.tsx` — jednolinijkowy, wysyłamy razem,
- kolumny w `src/components/tables/` — `DataTable` jest konwencją **nawet dla listy jednoelementowej** (lokalnie `kosztorys_presets` ma dokładnie jeden wiersz: id 4, „kosztorys wzór testy 2 września 26", 2026-09-02, 21872 B, 373 pozycje, 14 sekcji),
- wpis nawigacji: `src/components/nav/sidebar.tsx:44`, tablica `MANAGEMENT_LINKS`. **Uwaga: ten plik jest już brudny w drzewie roboczym** (niezacommitowana funkcja podświetlania aktywnego linku — commit `134dff69` ją wnosi, ale pracujemy na wierzchu).

Wzorzec usuwania do skopiowania — `src/components/work-catalogue/catalogue-row-actions.tsx`:

```tsx
const [confirming, setConfirming] = useState(false)
const [pending, startTransition] = useTransition()
const onDelete = () => {
  startTransition(async () => {
    const res = await deleteCatalogueItemAction(item.id)
    if (!res.success) return toastMessage(res.error ?? 'Nie udało się usunąć pozycji', 'error')
    toastMessage('Usunięto pozycję z katalogu.', 'success')
    setConfirming(false)
  })
}
```

`ConfirmDialog` + polskie copy („Usuń szablon", „Tej operacji nie można cofnąć") są konwencją.

### 6. Czwarty status inwestycji `szablon` — pełny promień rażenia

**Migracja to jedna linia.** Precedens: `src/migrations/20260718_0_add_planowana_investment_status.ts` — `ALTER TYPE "enum_investments_status" ADD VALUE IF NOT EXISTS 'planowana';`, `down` to udokumentowany no-op (Postgres nie ma `DROP VALUE`). PG12+ pozwala na `ADD VALUE` w transakcji Payloada **pod warunkiem, że nowa wartość nie jest użyta w tej samej transakcji**. Rejestracja wymaga **dwóch** edycji w `src/migrations/index.ts`: importu (`:53`) i wpisu w tablicy.

Typ nosi **dokładnie jedna kolumna** — `investments.status` (`20260211_212425.ts:24`). Żadnej innej tabeli, żadnego CHECK.

**Miejsca, które wywalą typecheck (dobre druty pułapkowe):**

- `src/components/investments/investment-status-badge.tsx:5` `STATUS_LABELS: Record<InvestmentStatusT, string>` — potrzebna polska etykieta,
- `:11` `STATUS_CLASSNAMES` — potrzebny kolor,
- `src/components/dialogs/edit-investment-dialog.tsx:41` — jedyne kompilacyjne spięcie typu z formularzem; jeśli `InvestmentStatusT` urośnie, a `investmentFormSchema` nie, to się wysypie.

**Miejsca, które NIE wywalą — cicho złe albo cicho dobre:**

- `src/types/reference-data.ts:15` — sama unia, jedyna edycja, która naprawdę coś znaczy,
- `src/collections/investments.ts:12-16` `STATUS_OPTIONS` — zwykła tablica `as const`; pominięcie oznacza, że `/admin` i `generate:types` nie wiedzą o `szablon`, a baza go przyjmuje,
- `src/components/forms/investment-schema.ts:12` `z.enum([...])` — **cichy bug behawioralny**: bez dopisania, `updateInvestmentAction` na inwestycji-warsztacie nie przejdzie walidacji (albo zapis po cichu przepisze status na fallback Selecta),
- `src/components/forms/investment-form/investment-form.tsx:124-126` — trzy zahardkodowane `<SelectItem>`; bez czwartego status jest **nieosiągalny z UI aplikacji**,
- `src/hooks/use-status-filter.ts:7-8` — `DEFAULT_STATUSES`/`VALID_STATUSES` typowane jako `InvestmentStatusT[]`, więc **zero nacisku**. Skutek: warsztat jest niewidoczny na `/inwestycje` domyślnie **i nie da się go pokazać** (nie ma checkboxa). To jest pożądane ukrycie, ale dzieje się po cichu,
- `src/lib/queries/reference-data.ts:105-106` — **najbardziej nośna cicha linia**: `active: row.status === 'active'`. To jest to, na czym filtruje każdy combobox, więc warsztat automatycznie dostaje `active: false`,
- **`src/lib/constants/investment-lock.ts:12`** — `isLockedStatus`/`isBookableInvestment` biorą `string`, nie unię. **Warsztat jest dziś `isBookableInvestment === true`.** Jeśli chcemy, żeby był odrzucany jako cel księgowania, trzeba to dopisać ręcznie — typecheck nie przypomni.

**Guard zmiany statusu** (`src/hooks/investments/guard-status-unlock.ts`, wpięty w `src/collections/investments.ts:45`): zawęża tylko **wyjście z `completed`** (wymaga ADMIN/OWNER). Wejście w `szablon` z `active`/`planowana` nie jest ruszane; wyjście z `szablon` dokądkolwiek też nie — warsztat może każdy manager zamienić w zwykłą inwestycję.

**Zapytania SQL po inwestycjach:** żadne zapytanie w `src/lib/db/**` ani `src/lib/queries/**` nie filtruje po statusie. Dwa zapytania realnie zobaczą warsztat, bo jedzie po pozycjach kosztorysu:

- `src/lib/db/kosztorys-client-totals.ts:76` — warsztat **z pozycjami produkuje wiersz**,
- `src/lib/db/kosztorys-subcontractor-due.ts:57` — to samo dla etapów.

Skutek w `shapeInvestments`: warsztat ma `hasKosztorys: true`, policzoną marżę v2 i bilans. Dziś nie ma sumy po wierszach listingu, więc nikt tego nie sumuje, ale figury są realne.

Dodatkowo, status-ślepe powierzchnie: `src/lib/utils/build-filter-config.ts:22` (warsztat w każdym dropdownie filtrów transferów/raportów), `src/app/(frontend)/kosztorysy/page.tsx:21-23` (warsztat w „Inwestycje bez kosztorysu"), `edit-transfer-form.tsx:152` (brak filtra `isBookableInvestment` w ogóle), pickery sprzętu. Wszystkie one są ratowane wyłącznie przez `activeOnly: true` w `EntityComboboxField` (`:68,73` → `src/lib/utils/is-active-ref.ts`) — czyli przez pochodną `active`, którą użytkownik może wyłączyć jednym przełącznikiem.

**Testy, które trzeba ruszyć razem z unią:**

- `src/__tests__/use-status-filter.test.ts:56-66` — asercje na **dokładną posortowaną tablicę** z `selectionFrom`; dopisanie `szablon` do `VALID_STATUSES` je łamie,
- `src/__tests__/lib/db/investment-lock.test.ts:31-34` — tabela `['completed', true] / ['active', false] / ['planowana', false]`; to jest właściwe miejsce na wiersz `szablon`,
- `src/__tests__/hooks/investments/guard-status-unlock.test.ts:39-42,62-63` — analogony `planowana`,
- `src/__tests__/investment-render-parity-db.test.ts:36,77-78` — warsztat w bazie testowej wchodzi do pętli parity i musi spełniać listing == detail,
- `src/__tests__/helpers/investment.ts:23` — `createTestInvestment` domyślnie `status: 'active'`, do nadpisania.

**Golden master** (`pnpm test:parity`): `buildSnapshot` iteruje **wszystkie** inwestycje bez filtra statusu, więc warsztat dodaje klucz do `snapshot.investments`. Samo to nie wywala porównania (pętla `:502` idzie po kluczach _oczekiwanych_), ale jeśli warsztat niesie pozycje kosztorysu, `readInputHashes` (`:213-243`) rusza globalny licznik `fingerprint.kosztorysItemCount`. Regeneracja: `pnpm test:golden:update`.

**E2E:** nic nie jest zawieszone na statusie inwestycji. Jedyne stałe odwołanie to `EXPENSE_INVESTMENT` po nazwie w `e2e/helpers.ts:129`, przez `EntityComboboxField` z `activeOnly: true` — więc warsztat i tak by tam nie wyskoczył.

### 7. Gdzie szukać testów dla delete/rename

- `src/__tests__/lib/db/presets.test.ts` — efekty na listowaniu (spec DB-backed, łapany przez `scripts/test-integration.sh`),
- `src/__tests__/lib/kosztorys/serialize-apply-preset.test.ts:265` — istniejąca asercja unikalności nazwy; rename dopisuje się obok,
- `src/__tests__/lib/actions/kosztorys-presets.test.ts` — poziom akcji, **asercja na stan utrwalony, nie na wynik akcji**.

## Code References

- `src/lib/db/presets.ts:40` — `insertPreset`, wzorzec `ON CONFLICT … RETURNING id` → `number | null`
- `src/lib/db/presets.ts:60` — `upsertPresetByName`, gotowe nadpisanie szablonu
- `src/lib/actions/kosztorys-presets.ts:65` — mapowanie `null` → `'Szablon o tej nazwie już istnieje'`
- `src/lib/actions/kosztorys-presets.ts:160` — `reloadFromPresetAction`, gotowe „Otwórz"
- `src/lib/cache/tags.ts:15` — `CACHE_TAGS.presets`
- `src/lib/constants/investment-lock.ts:12` — `isBookableInvestment` nad `string`, zero nacisku typów
- `src/lib/queries/reference-data.ts:106` — `active: row.status === 'active'`, cicha brama wszystkich comboboxów
- `src/types/reference-data.ts:15` — `InvestmentStatusT`
- `src/migrations/20260718_0_add_planowana_investment_status.ts` — jednolinijkowy precedens addytywny
- `src/components/nav/sidebar.tsx:44` — `MANAGEMENT_LINKS`
- `src/components/work-catalogue/catalogue-row-actions.tsx` — wzorzec delete + `ConfirmDialog`
- `src/app/(share)/podglad-inwestora/[id]/page.tsx` — precedens read-only renderu edytora

## Architecture Insights

- **Tabela raw-SQL bez kolekcji Payloada** to świadomy wzorzec (`notification_reads`, `kosztorys_presets`): brak `/admin`, brak hooków, brak FK — i dlatego delete jest tani, a brak Payloada oznacza, że rewalidacja cache jest ręczna (`revalidateCollections`).
- **Nazwa jest tożsamością szablonu.** Nie ma innego stabilnego identyfikatora w UI, dlatego rename jest operacją na tożsamości, a nie kosmetyką — i dlatego kolizja nazw musi mieć polski komunikat, a nie wyjątek sterownika.
- **Status inwestycji nie jest mechanizmem bezpieczeństwa, tylko etykietą.** Dwie realne bramy to `active` (pochodna w `reference-data.ts`) i `isBookableInvestment` (nad `string`). Dodanie czwartej wartości daje darmowe ukrycie w listingu i comboboxach, ale **nie** blokuje księgowania bez jawnej edycji.
- Cała nawigacja szablonu do warsztatu może jechać na parametrze URL — parametr zapytania przeżywa F5, więc „napis szablon" na belce nie potrzebuje żadnej kolumny ani maszyny stanów.

## Historical Context (from prior changes)

- **S-09 (EX-414, 2026-07-11)** — archiwalny plan (żyje tylko w gicie, `732d7a88^`) jawnie odroczył: _„No preset editing UI, no preset delete/rename UI in v1 … Renaming/deleting presets can be a follow-up if the owner asks"_. **Ta zmiana jest dokładnie tym follow-upem.**
- **EX-766 (2026-09-02)** — właściciel uznał bibliotekę szablonów za jednorazową i przepisał ją ręcznie; stąd `DELETE FROM kosztorys_presets` w migracji `20260902_0` i stąd brak GC (biblioteka jest kuratorowana, nie generowana).
- `context/reference/kosztorys-editor-domain-notes.md:1030-1040` — już zapowiada powierzchnię „szablon/wzorzec" i preselekcję domyślnego szablonu.
- `context/foundation/lessons.md` — trzy wiążące tu wpisy: (a) tabele raw-SQL wymagają ręcznej rewalidacji tagów, (b) destrukcyjne zastąpienie drzewa wymaga snapshotu z etykietą `manual`, (c) nie mapuj całej klasy błędów na jeden uprzejmy komunikat.

## Open Questions

1. **Czy delete ma być owner-only?** `savePresetAction` jest nieogrodzony; owner-only delete to świadoma asymetria, ale wymusza `revalidateCollections` wewnątrz handlera (`ownerOnlyAction` nie przyjmuje tagów).
2. **Czy rename wchodzi w ten sam zakres co delete?** Technicznie to ten sam plik i ta sama pułapka 23505; funkcjonalnie właściciel prosił dotąd tylko o usuwanie.
3. **Czy warsztat ma być odrzucany jako cel księgowania?** Jeśli tak, `isLockedStatus`/`isBookableInvestment` wymagają jawnej edycji plus wiersz w `src/__tests__/lib/db/investment-lock.test.ts:31-34`. Jeśli nie — warsztat zostaje bookowalny i liczy się do figur v2, gdy ma pozycje.
4. **Czy w ogóle potrzebny jest czwarty status?** Ukrycie w comboboxach daje już `active === 'active'` (czyli wystarczy `planowana`). Status `szablon` kupuje czytelną etykietę i ukrycie w listingu — ale kosztuje migrację, unię, schemat zod, Select, badge i trzy specy. Do rozstrzygnięcia w `/10x-plan`.
