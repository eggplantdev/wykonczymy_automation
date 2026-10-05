---
date: 2026-10-05T11:45:00+02:00
researcher: Claude (Opus 5.5)
git_commit: db7485d3d7254608f3b26d3e743c2233446f6ed1
branch: staging
repository: wykonczymy
topic: 'worker-account (EX-985) — pracownik na własnej stronie /pracownicy/[id]: dostęp, zakres transferów, tryb tylko-do-odczytu, lista kosztorysów z automatycznym linkiem /z/'
tags:
  [research, codebase, auth, employee, transfers, where-to-sql, worker-report-shares, stage-workers]
status: complete
last_updated: 2026-10-05
last_updated_by: Claude (Opus 5.5)
---

# Research: worker-account (EX-985)

**Date**: 2026-10-05T11:45+02:00
**Git Commit**: db7485d3
**Branch**: staging

## Research Question

Co trzeba ruszyć, żeby `EMPLOYEE` po zalogowaniu lądował na własnej `/pracownicy/[id]` (tylko do odczytu:
jego kasy z saldem, transfery `worker = id OR kasa ∈ jego kasy`, sprzęt bez linków, lista kosztorysów
z linkiem `/z/`), z linkiem zgłoszeń mintowanym automatycznie przy przypisaniu do etapu — decyzje
właściciela w `change.md`.

## Summary

Kierunek z `change.md` jest wykonalny, ale research obala dwa założenia i dokłada trzy rzeczy:

1. **`and: [zakres, urlFilters]` wywala stronę.** Kafel sumy przepuszcza ten sam `Where` przez
   `where-to-sql`, który ma gałąź `or`, ale **nie ma `and`** → `unmapped field "and"`
   (`src/lib/db/where-to-sql.ts:57-71`). Do tego czterech czytelników patrzy tylko na klucze
   najwyższego poziomu (`stripCancelledFilters`, `listsCancelled`, `resolveAmountSearch`,
   `isNoResultsSentinel`) — owinięcie URL-filtrów w `and` psuje je po cichu. **Kształt, który działa:
   `{ ...urlFilters, and: [{ or: [worker, sourceRegister in, targetRegister in] }] }`** —
   `buildTransferFilters` nigdy nie emituje `and`, więc nic nie koliduje, a URL-filtry zostają na górze.
   Wymaga dodania gałęzi `and` w `where-to-sql` (nawiasowany AND pod-warunków). Lekcja „translator
   fails OPEN" (`lessons.md:723`) jest nieaktualna — od EX-574 translator rzuca na wszystko nieznane.
2. **Pusta lista kas → `IN ()` = błąd składni Postgresa** (`renderList`). Pracownik bez kasy
   (28/49) musi dostać zakres bez gałęzi kasowych, nie `in: []`.
3. **Strona padnie dla EMPLOYEE na sprzęcie:** `fetchEquipmentAtLocation` rzuca przy roli spoza
   `MANAGEMENT_ROLES` (`src/lib/queries/equipment.ts:97-98`) → `error.tsx`. Id przychodzi z serwera,
   więc poluzowanie bramki (lub osobny odczyt „sprzęt u siebie") jest bezpieczne.
4. **„Faktury" i „Drukuj" w tabeli wołają `fetchFilteredTransfers` z `Where` od klienta**, bramka
   `requireAuth(MANAGEMENT_ROLES)` (`src/lib/queries/fetch-transfers-for-invoices.ts:22-29`). Dla
   EMPLOYEE: toast „Brak uprawnień". **Poluzowanie = cała tabela transakcji** (lekcja
   `lessons.md:569`). Albo ukryć oba przyciski pracownikowi, albo akcja przyjmuje id pracownika
   i sama dokłada zakres po stronie serwera.
5. **„Anuluj transakcję" pokazuje się na każdym wierszu, bez bramki `canEdit`**
   (`src/components/tables/transfers.tsx:241`); akcja i tak odmówi, ale UI kłamie. Zdjąć kolumnę
   `actions` przez `excludeColumns`. **Nie** wyłączać kolumny `invoice` (`skipMedia` chowa faktury) —
   `MediaPreviewButton` bez `onAdd`/`onRemove` daje podgląd tylko do odczytu.

Auto-mint linku: wszystkie wstawienia do `kosztorys_stage_workers` idą przez **jedną funkcję
`insertStageMembers`** (`src/lib/db/stage-split.ts:35-49`), zawsze w transakcji. To jest punkt na
`INSERT … ON CONFLICT (investment_id, worker_id) DO NOTHING` do `worker_report_shares`. Strona `/z/`
już obsługuje zablokowany zakres komunikatem — nie wymaga zmian.

## Detailed Findings

### 1. Bramki dostępu — stan dziś

Prymitywy:

- `getCurrentUserJwt` (`src/lib/auth/get-current-user-jwt.ts:31-57`) — weryfikuje JWT, nie czyta bazy.
- `requireAuth(roles)` (`src/lib/auth/require-auth.ts:15-27`) — nie rzuca, zwraca `success:false`.
- `requireManagementPage` (`src/lib/auth/require-management-page.ts:13-17`) — redirect `/zaloguj`.
- `protectedAction` (`src/lib/actions/run-action.ts:84-85`) — `MANAGEMENT_ROLES`.

| Trasa                                                            | Bramka                                         | EMPLOYEE dziś                                |
| ---------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------- |
| `(frontend)/layout.tsx:53-54`                                    | sam JWT                                        | wpuszczony                                   |
| `(dashboard)/page.tsx:9-25`                                      | `ROLES`                                        | redirect na jego kasę `WORKER`, bez niej 404 |
| `kasa/[id]/page.tsx:24-59`                                       | `ROLES` + `canViewRegister` + owner (`:58-59`) | tylko własna kasa                            |
| `pracownicy/[id]/page.tsx:23-24` i inne listy                    | `requireAuth(…)`                               | redirect `/`                                 |
| `inwestycje/[id]:34`, kosztorys, szablony, kosz, zgłoszenia-prac | `requireManagementPage`                        | `/zaloguj` → `(auth)/layout.tsx:11` → `/`    |

- Nawigacja: `navigation.tsx:21` nie ładuje refData dla nie-managera; `useNavLinks` daje tylko
  „Transakcje" → `/` (`src/lib/constants/sections.ts:49-52`). Admin/Kosz ukryte. `refreshDataAction`
  bez bramki (tylko `revalidatePath`). `(dashboard)/loading.tsx:5` mignie „Transakcje" przed redirectem.
- `@investmentCrumb/pracownicy/[id]/page.tsx:4` — przycisk „Wróć" z fallbackiem `/pracownicy`
  (strona, z której pracownik zostanie odbity). Do ukrycia/zmiany dla EMPLOYEE.
- Klik w inwestycję w tabeli (`transfers.tsx:84`) → `/zaloguj` → `/` → (po zmianie) jego strona —
  trzy skoki, zgodnie z decyzją 3. Kolumny kas (`transfers.tsx:139,153`) linkują do `/kasa/[id]`:
  po zmianie bramki na `MANAGEMENT_ROLES` wynik zależy od formy — `redirect('/')` wraca na jego stronę,
  `notFound()` daje 404.
- Historia: widok kasy dla pracownika to commit **a955b204** (2026-03-10, „remove employee pages,
  redirect to WORKER register") — bez dokumentu decyzji. Pracownicy przez 180 dni nie zaksięgowali
  żadnej z ~3 980 transakcji; jedna sesja pracownika w historii
  (`context/archive/2026-10-01-worker-report-translations-ua/change.md:43`).

### 2. Drzewo strony pracownika — co pęknie / co by wyciekło

Serwer (RSC, nie do wywołania z klienta): `fetchReferenceData`, `fetchRegisterBalances`,
`findTransfersRaw`, `fetchFilteredByType` — bez wewnętrznej bramki, OK. Wyjątek:
**`fetchEquipmentAtLocation` rzuca** (pkt 3 Summary).

Wywoływane z klienta:

| Wywołanie                                                                   | Bramka                                  | Wejście                                  | EMPLOYEE                                       |
| --------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------- | ---------------------------------------------- |
| `fetchFilteredTransfers` (Faktury, Drukuj; `transfer-data-table.tsx:96-99`) | `requireAuth(MANAGEMENT)`               | **`Where` od klienta**, `overrideAccess` | odmowa; poluzowanie = wyciek całej tabeli      |
| `cancelTransferAction` (`actions/transfers.ts:202`)                         | `protectedAction` + `canMutateTransfer` | id                                       | odmowa — ale przycisk widoczny                 |
| `updateTransferAction` (`:250`)                                             | jw.                                     | id                                       | przycisk wyłączony (`canMutateTransfer` false) |
| `add/remove…InvoiceAction` (`:339/358/372`)                                 | `protectedAction`                       | id                                       | odmowa — „+" w komórce faktury widoczny        |
| `updateWorkerAction` przez `EditWorkerDialog`                               | `protectedAction`                       | id                                       | odmowa — przycisk widoczny                     |

Filtry, paginacja, sortowanie, kolumny — tylko URL.

Tryb tylko-do-odczytu, wzorce w sąsiednich stronach: `kasa/[id]/page.tsx:72`
(`{isManager && <EditCashRegisterDialog/>}`), prop `canEdit` (`sprzet/page.tsx:51`,
`flota/page.tsx:39`). `OwnedRegistersSection` (`users/owned-registers-section.tsx:44`),
`HeldEquipmentSection` (`equipment/held-equipment-section.tsx:36`) i `EditWorkerDialog` mają
**jednego konsumenta** — tę stronę — więc prop `linkable` / warunkowy render wystarczy, bez forka.

Wiersz tabeli: `useCurrentUser()` z JWT (`transfer-data-table.tsx:35`); `canMutateTransfer`
(`src/lib/auth/roles.ts:52-62`) — `createdBy === self` dla EMPLOYEE. Dziś martwe (pracownik nic nie
tworzy), istotne dopiero w EX-971.

### 3. Zakres transferów

`buildTransferFilters` (`src/lib/queries/transfer-filters.ts:58-177`) emituje wyłącznie klucze
najwyższego poziomu, nigdy `and`. Jedyne `or` to filtr kasy (`:105-112`). `onlyOwnTransfers` nie ma
żadnego konsumenta poza testami.

Kompozycja dziś — wszędzie spread, nigdzie `and`:

- `kasa/[id]/page.tsx:35-43` — wycina `sourceRegister` z URL (komentarz o kolizji `or`), potem spread.
- `inwestycje/[id]/page.tsx:44-47`, `pracownicy/[id]/page.tsx:33-34` — spread.

Dwa plany danych z tego samego `Where` (`transfer-table-server.tsx:35-41`):

- lista: `payload.find({ overrideAccess: true, depth: 0 })` (`queries/transfers.ts:36-44`) — `Where`
  jest jedyną granicą; Payload przyjmuje `and`/`or` na dowolnej głębokości;
- kafel sumy: `stripCancelledFilters` → `sumFilteredByType` → `buildSqlConditions`
  (`db/sum-transfers.ts:251-283`) → `where-to-sql`.

`where-to-sql.ts`: `or` obsługiwane rekurencyjnie (`:57-68`), `and` — brak (`:70-71` rzuca). `in` na
`sourceRegister`/`targetRegister`/`worker` mapuje się na kolumny `_id` (`:12-18`). Wszystkie trzy to
pojedyncze relacje (`src/collections/transfers.ts:167,178,207`), nie `hasMany`.

Czytelnicy patrzący tylko na górę `Where` (stąd: URL-filtry zostają na górze, zakres idzie w `and`):

- `stripCancelledFilters` (`transfer-filters.ts:280-284`),
- `listsCancelled = !('cancelled' in where)` (`transfer-table-server.tsx:72`),
- `resolveAmountSearch` (`queries/transfers.ts:74-95`) — zagnieżdżone `amount.like` poszłoby do
  Payloada, który na kolumnie liczbowej zwraca wszystko,
- `isNoResultsSentinel` (`where-to-sql.ts:4-7`).

Pomocnicze funkcje trybu audytu (`scopeAuditThroughOriginal`, `scopeNarrowsByOriginalOnlyField`,
`:187-215`) już rekurencyjnie schodzą w `and`.

Monotoniczność: każdy klucz z `buildTransferFilters` jest koniunktem, więc przy
`{ ...urlFilters, and: [zakres] }` filtr inwestycji / `?worker=` / `?sourceRegister=` może tylko
zawęzić — obca inwestycja = 0 wierszy (decyzja 3 potwierdzona). Dziś spread po cichu nadpisuje
`?worker=`; po zmianie zawęża.

„Jego kasy": `ownedRegisters(refData.cashRegisters, userId).filter(canViewRegister(...))`
(`pracownicy/[id]/page.tsx:50-52`, `src/lib/workers/owned-registers.ts:4-6`). `owner` to pojedyncza
relacja (`cash-registers.ts:48-52`). Nieaktywne kasy są w zestawie, skasowane (`trashed`) nie — ale
kosz przyjmuje tylko kasę bez historii, więc nic nie ginie.

Cache: lista `['transfers-raw', JSON.stringify(where), …]`, suma `['filtered-by-type', JSON.stringify(where)]`,
tag `collection:transactions`. Id kas siedzą w `Where`, więc klucz śledzi własność; zmiana właściciela
kasy rewaliduje refData (`actions/cash-registers.ts:30-60`). Klucz nie zna widza — poprawne, dopóki
cały zakres jest w `Where`.

Filtr kasy: `buildFilterConfig` (`src/lib/utils/build-filter-config.ts:14-32`) bierze wszystkie żywe
kasy (MAIN też — bez `canViewRegister`). Zawężenie bez zmiany sygnatury:
`{ ...buildFilterConfig(refData, [...]), cashRegisters: registers.map(({ id, name }) => ({ id, name })) }`.

### 4. Link zgłoszeń — schemat, akcje, `/z/`

- Tabela `worker_report_shares` (`src/migrations/20260930_2_add_worker_reports.ts:68-92`): UNIQUE
  `token`, UNIQUE `(investment_id, worker_id)` (cel `ON CONFLICT`), FK `ON DELETE CASCADE` na obie
  strony; brak `revoked_at` — cofnięcie = DELETE wiersza. Kolekcja Payloada
  (`src/collections/worker-report-shares.ts`), bez hooków, dostęp management.
- Akcje (`src/lib/actions/kosztorys-worker-share.ts`): `writeWorkerLink` (`:21-32`) odmawia przy
  zablokowanym `resolveWorkerScope` (`:27`); ensure (`:35`) / generate (`:41`, rotacja w miejscu) /
  revoke (`:49`, delete). Token: `randomBytes(24).toString('base64url')` (`src/lib/kosztorys/share-token.ts:46`).
  `writeShareToken` łapie wyścig create przez catch-and-re-read — **nie da się go użyć wewnątrz
  transakcji Postgresa** (naruszenie unikalności abortuje całą transakcję).
- `/z/` (`src/app/(share)/z/[investment]/[name]/[token]/page.tsx:23-29` →
  `src/lib/queries/worker-report-page.ts:37-59`, bez cache): nieznany token → 404; zakończona /
  skasowana inwestycja → `closed`; szablon → `template`; nieaktywny pracownik → `inactiveWorker`;
  zablokowany zakres (w tym `no-stages` po odpięciu) → komunikat (`:89-96`). **Bez zmian** pod nową regułę.
- URL: `workerReportShareUrl(origin, investmentName, workerName, token)`
  (`src/lib/kosztorys/worker-view/worker-links.ts:29-36`); segmenty nazw to ozdoba, rozwiązuje token.

### 5. Wszystkie zapisy do `kosztorys_stage_workers`

Jedyny `INSERT` poza migracją: `insertStageMembers` (`src/lib/db/stage-split.ts:35-49`). Wołające:

| Ścieżka                               | Miejsce                                                                       | Transakcja   |
| ------------------------------------- | ----------------------------------------------------------------------------- | ------------ |
| „Dodaj etap"                          | `addStageAction`, `src/lib/actions/kosztorys.ts:704`                          | tak (`:676`) |
| Zmiana składu / podziału etapu        | `replaceStageSplit` (`stage-split.ts:29`, DELETE+INSERT) ← `kosztorys.ts:795` | tak (`:775`) |
| Akceptacja zgłoszenia jako nowy etap  | `insertWorkerStage` (`stage-split.ts:68`) ← `accept-worker-report.ts:241`     | tak (`:101`) |
| Import z arkusza, przywrócenie wersji | `insertKosztorysTree` (`src/lib/kosztorys/insert-kosztorys-tree.ts:118`)      | tak          |
| Szablon: wczytaj / nadpisz / wyczyść  | `replaceTreeWithSnapshot` — drzewo szablonu ma `stages: []`, więc tylko usuwa | tak          |
| Usuń etap                             | `kosztorys.ts:819` → kaskada FK                                               | —            |

Wszystkie wołające znają `investmentId`, ale `insertStageMembers` dostaje dziś tylko `stageId` —
potrzebny parametr albo JOIN na `kosztorys_stages`. Mint w tej funkcji obejmuje też import i
przywrócenie wersji (zgodne z „przy każdym przypisaniu"). Szablon nie ma etapów: edytor chowa
„Etap" w menu dodawania (`kosztorys-add-menu.tsx:93`, `!isTemplate`), a drzewo szablonu jest
serializowane z `stages: []` — więc mint dla szablonu nie zachodzi. (`addStageAction` sam nie sprawdza
szablonu — blokada jest tylko w UI; poza zakresem tego change'u.)

Alternatywa — trigger SQL `AFTER INSERT`: łapie przyszłych pisarzy, ale chowa logikę w bazie, a jedyne
źródło losowości to `gen_random_uuid()` (brak `pgcrypto` w dumpie).

Unieważnienie cache: listy pracownika nie obejmuje dziś żaden tag specyficzny — pisarze bumpują
`collection:kosztorys-stages` / `KOSZTORYS_TREE_TAGS` (`src/lib/cache/tags.ts:55`). Odczyt tokenu jest
niecache'owany.

### 6. Menu „Pracownicy" — usunięcie „Wyłącz link"

- `worker-actions.tsx:112` „Link do zgłoszeń" → `ensureWorkerLinkAction`; `:110` zablokowany →
  `readWorkerShareToken`; `:123-142` `requestLinkHolders` / `dropLinkHolder`.
- `kosztorys-workers-menu.tsx:78` — link wyłączony, gdy zablokowany i bez linku.
- `kosztorys-worker-share-dialog.tsx:39-47` podaje `generate` + `revoke` do **współdzielonego**
  `ShareLinkPanel` (`share-link-panel.tsx:104-109` „Wygeneruj nowy" + „Wyłącz link"; gałąź
  zablokowana `:86-90` pokazuje tylko powód + „Wyłącz link"). Panel używa też dialog inwestora —
  `revoke` musi stać się opcjonalny, nie zniknąć.
- `assigned-workers.ts:24` dokłada pracowników „z linkiem, bez etapu" tylko po to, by dało się link
  wyłączyć — po zmianie do zastanowienia (`readWorkerShareHolders`,
  `worker-share-link-endpoint.ts:20`).
- Etykieta w UI to „Wyłącz link", nie „Cofnij link".

### 7. Lista kosztorysów pracownika

Nic gotowego (`countStageMemberships`, `src/lib/db/stage-memberships.ts:6`, tylko liczy). Szkic
zapytania do tego pliku:

```sql
SELECT DISTINCT i.id, i.name, i.status, i.trashed_at, s.token
FROM kosztorys_stage_workers ksw
JOIN kosztorys_stages ks ON ks.id = ksw.stage_id
JOIN investments i ON i.id = ks.investment_id
LEFT JOIN worker_report_shares s ON s.investment_id = i.id AND s.worker_id = ksw.worker_id
WHERE ksw.worker_id = $1
```

Statusy inwestycji: `quote | planowana | active | completed | szablon`
(`src/lib/constants/investment-status.ts`) + `trashed_at`.

### 8. Backfill

Precedensy: SQL w migracji (`20260930_1_add_kosztorys_stage_workers.ts:42-44`,
`INSERT … SELECT … ON CONFLICT DO NOTHING`) albo skrypt Local API (`src/scripts/backfill-heic-media.ts`,
`--dry-run`, `--allow-prod`). Żadna migracja nie generuje tokenów. Format tokenu nie jest nigdzie
walidowany (równość + prefiks `/z/` w `proxy.ts:19`), więc token z SQL
(`replace(gen_random_uuid()::text,'-','') || …`) zadziała, choć w innym formacie niż aplikacyjny.

### 9. Telefon

Nie ma mobilnego układu kart dla tabel transakcji — `DataTable` to przewijany poziomo `<table>`
(`tables/data-table/data-table.tsx:203`); toolbar zawija się w `ControlGrid`, filtry domyślnie zwinięte
(`transfer-data-table.tsx:62-66`), `SummaryTable` z `overflow-x-auto max-sm:text-xs`
(`ui/summary-grid.tsx:10,33`). To samo, co manager dostaje dziś na `/` — mieści się w „pokazywanie
transakcji" z zakresu telefonu (AGENTS.md). Pracownik będzie wchodził z telefonu, więc strona dostaje
wyjątek telefoniczny jak `/z/` (do dopisania w AGENTS.md przy implementacji).

## Code References

- `src/lib/db/where-to-sql.ts:57-71` — `or` tak, `and` nie (rzuca)
- `src/lib/queries/transfer-filters.ts:105-112` — `or` filtra kasy; `:280-284` `stripCancelledFilters`
- `src/components/tables/transfer-table-server.tsx:35-41,72` — dwa plany z jednego `Where`; `listsCancelled`
- `src/lib/queries/transfers.ts:28-56,74-95` — lista + cache key; `resolveAmountSearch`
- `src/app/(frontend)/pracownicy/[id]/page.tsx:23,33-34,50-52,67-77` — bramka, spread, kasy, sekcje, filtry
- `src/app/(frontend)/kasa/[id]/page.tsx:35-43,58-59,72` — wzorzec kolizji `or`, owner check, `isManager`
- `src/app/(frontend)/(dashboard)/page.tsx:9-25` — redirect EMPLOYEE na kasę WORKER
- `src/lib/queries/equipment.ts:97-98` — rzuca dla EMPLOYEE
- `src/lib/queries/fetch-transfers-for-invoices.ts:22-29` — `Where` od klienta, bramka management
- `src/components/tables/transfers.tsx:84,139,153,222,241,255-258` — linki, `canMutateTransfer`, przycisk anulowania, `excludeColumns`
- `src/lib/db/stage-split.ts:29,35-49,68` — jedyny insert członków etapu
- `src/lib/kosztorys/insert-kosztorys-tree.ts:118`, `src/lib/actions/kosztorys.ts:704,795` — wołające
- `src/lib/actions/kosztorys-worker-share.ts:21-49` — ensure/generate/revoke, odmowa przy blokadzie
- `src/lib/kosztorys/share-token.ts:39-68` — generacja tokenu, catch-and-re-read
- `src/migrations/20260930_2_add_worker_reports.ts:68-92` — schemat `worker_report_shares`
- `src/lib/queries/worker-report-page.ts:37-59,89-96` — `/z/` i komunikaty
- `src/lib/kosztorys/worker-view/worker-links.ts:29-36` — budowa URL `/z/`
- `src/components/kosztorys/editor/dialogs/share/share-link-panel.tsx:86-90,104-109` — współdzielony panel linku

## Architecture Insights

- **`Where` jest jedyną granicą** na obu planach (`overrideAccess: true` na liście, surowy SQL na
  sumie) — bezpieczeństwo strony pracownika = poprawność kompozycji `Where` po stronie serwera.
  Każda akcja przyjmująca `Where` od klienta zostaje management-only.
- **Dwie implementacje jednej semantyki `Where`** (Payload vs `where-to-sql`) — każdy nowy kształt
  (tu `and`) musi wejść do obu, a spec mostu (builder → strip → translator → emitowany SQL,
  `src/__tests__/lib/queries/transfer-filters.test.ts`) jest miejscem na asercję.
- **Jeden chokepoint zapisu** (`insertStageMembers`) — mint linku jako efekt uboczny w tej samej
  transakcji, idempotentny przez `ON CONFLICT DO NOTHING`; brak potrzeby hooków Payloada (zgodne
  z memory: efekty uboczne w akcji / warstwie db, nie w nowym afterChange).

## Historical Context (from prior changes)

- `context/archive/2026-09-30-worker-work-reports/change.md` — EX-947: #13 sam token wystarczy;
  #21 link mintowany pod tą samą odmową co rozpiska („pracownik bez etapu nigdy go nie trzyma") —
  **EX-985 to odwraca**; #7 wyjątek telefoniczny; zgłoszenia kluczowane inwestycja × pracownik,
  nie wierszem linku — rotacja nie rusza zgłoszeń.
- `context/changes/2026-10-05-worker-single-view/` (EX-966, implemented) — jeden link na pracownika;
  jego `plan.md:274,336,355` wciąż opisuje generate/revoke/ensure.
- `context/changes/2026-10-05-worker-view-dogfooding/` (implemented, niezarchiwizowany) — przenosi
  link na `/z/`, stare ścieżki „link nieaktywny" (cfa69709).
- `context/archive/2026-10-05-worker-kasy-visibility/change.md`, commit d6e8c1ea (EX-960) —
  „Przypisane kasy" z saldem i „Razem"; kasa MAIN ukryta przed MANAGER.
- `lessons.md:2480` (EX-918) — odcięcie przy logowaniu + kasowanie `users_sessions`; otwarta sesja
  ≤ 7 dni akceptowana.
- `manual-checks.md:2732` — `forgot-password` poza produkcją daje 500 (poczta); hasło na stagingu
  ustawiane w `/admin`. Reset hasła pracownika da się więc sprawdzić tylko na produkcji.

**Równoległa praca:** `context/changes/2026-10-05-view-as/` (status `new`) — ADMIN/OWNER podgląda
aplikację jako MANAGER lub EMPLOYEE przez podpisane ciasteczko rozwiązywane w `getCurrentUserJwt`,
zapisy odrzucane. Strona pracownika będzie jego głównym celem — bramka „tylko własne id" musi czytać
efektywnego użytkownika, a `protectedAction` w trybie view-as i tak odmawia.

## Test anchors (`context/foundation/test-plan.md`)

- #6 (mutacje bez bramki — EMPLOYEE pisze) — dotyczy, jeśli ruszamy `fetchFilteredTransfers`.
- #19 (link publiczny pisze, gdzie nie powinien — w tym zablokowany zakres) — **do rewizji**: linki
  będą mintowane mimo blokady; `token-action.test.ts` dalej pilnuje odmowy wysyłki.
- #20 (wyłączone konto wciąż wchodzi).
- **Brak ryzyka** na dostęp EMPLOYEE do stron i na kompozycję zakresu transferów — do dopisania
  `/10x-test-plan` przed testami.

Istniejące specy do rozszerzenia: `src/__tests__/lib/db/where-to-sql.test.ts` (gałąź `and`),
`src/__tests__/lib/queries/transfer-filters.test.ts` (most → SQL), `src/__tests__/build-transfer-filters.test.ts`,
`src/__tests__/lib/actions/worker-share-token.test.ts` (`:143-170` revoke),
`src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.test.tsx`
(`:59-63,144-175,259-267`), `src/__tests__/lib/queries/worker-report-page.test.ts`,
`src/__tests__/lib/actions/kosztorys-stages.test.ts`.

## Decisions on open questions (właściciel, 2026-10-05)

1. **Faktury / Drukuj — dostępne, ograniczone.** Akcja nie przyjmuje gotowego `Where` od pracownika:
   bierze id pracownika + parametry URL, po stronie serwera sprawdza `id === sesja` (EMPLOYEE) i sama
   składa `{ ...buildTransferFilters(sp), and: [zakres] }` — ta sama funkcja zakresu co strona
   (lekcja `lessons.md:569`). Management bez zmian.
2. **Lista kosztorysów = statusy `active` (Aktywna), `planowana` (Planowana), `quote` (Wycena)** —
   bez zakończonych, skasowanych i szablonów.
3. **Szablony — bez osobnej obsługi.** Do szablonu nie przypisuje się pracowników do etapów (UI nie
   pozwala dodać etapu, drzewo szablonu ma `stages: []`), więc mint w `insertStageMembers` zostaje
   bezwarunkowy.
4. **Backfill = migracja SQL** (`INSERT … SELECT … ON CONFLICT DO NOTHING`, token z `gen_random_uuid()`).
5. **`/kasa/[id]` dla EMPLOYEE → `notFound()`.**
6. **Pracownicy „z linkiem, bez etapu" zostają w menu** — żeby dało się zrotować ich link.
