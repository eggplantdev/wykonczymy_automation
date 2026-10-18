# Kosz plików — odroczone kasowanie z Bloba

**Change:** `kosz-plikow` · **Research:** `research.md` (z 2026-09-22 — sprzed strony Kosz i plików
pracowników; tam, gdzie się rozjeżdża, wygrywa ten plan) · **Decyzje właściciela:** `change.md`

## Cel

Odpięcie pliku przestaje go kasować. Zamiast tego powstaje wpis w koszu; plik ginie z Bloba dopiero
po **7 dniach**, zmieciony nocnym cronem. Przy okazji nocne zamiatanie zabiera pliki, które dziś
zostają w Blobie na zawsze po kaskadach i po „Usuń na zawsze" z Kosza. Przywracanie: sekcja „Pliki"
na stronie Kosz.

## Stan wyjściowy (zweryfikowany 2026-10-18)

- `setUploadField` (`src/lib/media/set-upload-field.ts:18`) kończy każde odpięcie
  `reclaimUnreferencedMedia` → `deleteUnreferencedMedia` w `after()`, czyli `payload.delete({
collection: 'media' })` + bajty w Blobie. Blob nie ma undelete. Osiem miejsc wywołania
  (`transfers.ts` ×3, `lead-assets.ts` ×2, `investment-assets.ts` ×3), wszystkie w `protectedAction`.
- Plik trzyma **siedem** miejsc, nie pięć: pięć relacji z `MEDIA_RELATIONS` (tabele `*_rels`) plus dwie
  surowe tabele pracowników — `worker_expense_draft_media` i `worker_report_media`.
  `findReferencedMedia` i `preventReferencedMediaDelete` liczą już wszystkie siedem.
- EX-833 jest Done: sprawdzanie referencji jest zbiorcze (5 zapytań `in` + 2 surowe) i chodzi w
  `after()`.
- Kaskady nadal wyciekają: `*_rels` mają `media_id … ON DELETE cascade` i nikt nie sprząta po
  skasowanym rodzicu. Od strony Kosz dochodzi do tego „Usuń na zawsze" i nocny purge inwestycji, floty
  i sprzętu (`payload.delete` rodzica) — archiwum `kosz-inwestycji` wprost zostawia te pliki temu
  change'owi. Zgłoszenia sprzątają po sobie same (`erase-lead.ts`), wydatki też
  (`deleteInvoiceMediaAfterDelete`).
- `/api/cron/cleanup` ma już dziewięć kroków w `runStep` (`try/catch`, marker EX-958,
  `maxDuration = 300`). Godziny: cleanup `0 3` (`vercel.json`), kopia na FTP `30 3`
  (`.github/workflows/blob-backup.yml:34`) — sprzątanie pracuje na sklepie, którego ostatnie ~23 godziny
  nie są nigdzie skopiowane.
- „Usuń wszystkie" w galerii inwestycji jest schowane (EX-862); akcja `removeAllInvestmentAssetsAction`
  istnieje.

## Decyzje projektowe (moje, nie do pytania)

- **Osobna surowa tabela `media_detachments`, nie kolumny na `media` i nie nowa kolekcja Payloada.**
  Jeden plik może legalnie wisieć na dwóch rodzicach (`promoteLeadAction` przepina te same id), więc
  „skąd zszedł" nie jest funkcją pliku. Kolekcja Payloada dokłada kolumnę w
  `payload_locked_documents_rels`, której pominięcie raz już położyło `/admin`. Wzorzec
  `notification_reads` / `kosztorys_snapshots`: surowa tabela + jeden moduł w `src/lib/db/`.
- **Najpierw prowenancja, potem zdjęcie referencji.** Rozerwany zapis zostawia wpis-widmo przy wciąż
  przypiętym pliku, a nie odpięty plik bez wpisu. Zamiatacz przelicza referencje, więc widmo leczy się
  samo i transakcja jest niepotrzebna.
- **Zamiatacz pyta o referencje we wszystkich siedmiu miejscach**, nie o kosz. Lista miejsc ma jedno
  źródło w `src/lib/media/relating-collections.ts`: `MEDIA_RELATIONS` dostaje `relsTable`, a obok staje
  `RAW_MEDIA_HOLDER_TABLES` z dwiema tabelami pracowników. Pominięcie surowej tabeli to nie utrata
  danych (`preventReferencedMediaDelete` odmówi), ale wieczny `failed` co noc i paragon pracownika
  liczony jako sierota. `payload_locked_documents_rels` do listy **nie** należy — blokada edycji w
  panelu nie jest referencją.
- **Bez kolumny „kto odpiął".** Kont jest ~40, ale odpinają wyłącznie konta zarządu (`protectedAction`),
  a `setUploadField` dostaje tylko `payload` — „kto" to przewleczenie użytkownika przez osiem wywołań
  dla pytania, którego nikt nie zadaje.
- **Unikalny indeks częściowy na `media_id WHERE restored_at IS NULL`** — jeden otwarty wpis na plik;
  wstawka zamiatacza jest idempotentna (`ON CONFLICT DO NOTHING`) i nie przestawia zegara.
- **Kasowanie w zamiataczu szeregowo, nigdy `Promise.all`.** Na Neonie równoległe zapisy Payloada
  dzielą sesję: każdy `delete` melduje sukces, commituje się jeden.
- **`FILE_TRASH_RETENTION_DAYS = 7` w `src/lib/constants/trash.ts`**, obok
  `ENTITY_TRASH_RETENTION_DAYS = 30`. Jedyne miejsce tej liczby.
- **Pliki w Blobie bez wiersza `media` — poza zakresem.** Archiwum `kategorie-assetow-i-kompresja`
  odsyła je tutaj (upload klient → Blob udany, `POST /api/media` nie). Zamiatacz pracuje na wierszach
  `media`; wyłapanie takich plików wymaga porównania listingu całego sklepu z tabelą. Zdarza się rzadko
  i nie ma prowenancji — jeśli wróci jako problem, to osobny krok crona.

---

## Faza 1 — Zapis odpięcia zamiast kasowania

**Intent:** odpięcie przestaje dotykać Bloba i zostawia ślad „media N zeszło z
`<kolekcja>/<id>/<pole>` o T". Po tej fazie żaden plik nie ginie — ale nic go też nie zamiata, więc
`media` puchnie do fazy 2.

**Kontrakt:**

- Migracja `src/migrations/<data pisania>_N_media_detachments.ts`, pisana ręcznie — nazwa **musi**
  sortować się po najnowszej (dziś `20261016_1_investment_billing_data.ts`). Plus dwie edycje w
  `src/migrations/index.ts`. Tabela `media_detachments`:
  - `id serial PRIMARY KEY`
  - `media_id integer NOT NULL REFERENCES media(id) ON DELETE cascade` — zmiecenie pliku zabiera wpis.
    Tabela **nie** wchodzi ani do `MEDIA_RELATIONS`, ani do `RAW_MEDIA_HOLDER_TABLES` — inaczej
    `preventReferencedMediaDelete` zablokowałby własny zamiatacz.
  - `from_collection varchar`, `from_field varchar`, `from_id integer` — NULL-owalne; `NULL` =
    „znaleziony osierocony, źródło nieznane".
  - `detached_at timestamptz NOT NULL DEFAULT now()`, `restored_at timestamptz` (NULL = w koszu)
  - `UNIQUE INDEX … (media_id) WHERE restored_at IS NULL`
  - `INDEX … (detached_at) WHERE restored_at IS NULL`
- `src/lib/db/media-detachments.ts` — jedyny czytelnik/pisarz tabeli, surowy SQL przez `DbExecutorT`,
  `import 'server-only'`. Eksportuje `recordDetachments(db, target, mediaIds)`,
  `closeDetachments(db, mediaIds)`.
- `setUploadField` przestaje wołać `reclaimUnreferencedMedia`. Na tym samym `payload` przez
  `getDb(payload)`:
  - `dropped` / `added` z różnicy `currentIds` ↔ `next` **przed** zapisem
  - `recordDetachments` dla `dropped` — **przed** `payload.update`
  - `closeDetachments` dla `added` — po zapisie; zamyka wpis przy ponownym przypięciu
  - `reclaimUnreferencedMedia` zostaje w repo — dalej woła go `deleteOrphanedMediaAction` i
    `deleteExpenseDraftAction`.
- Potwierdzenia przestają kłamać. `description` w trzech źródłach (`use-invoice-removal.ts:14`,
  `use-investment-assets-removal.ts:10`, `lead-asset-labels.ts:8`) mówi, że plik trafia do Kosza na
  7 dni (z `FILE_TRASH_RETENTION_DAYS`). Słowo „bezpowrotnie" w `delete-forever-dialog.tsx` dotyczy
  kosza rekordów i zostaje.
- **„Usuń wszystkie" wraca do galerii inwestycji** (EX-862): w `use-investment-assets-removal.ts`
  wracają `removeAll: () => removeAllInvestmentAssetsAction(investmentId)` i `confirmAll`, a komentarz
  `:16` uzasadniający schowanie znika; w `investment-assets-control.tsx` prop
  `onRemoveAll={!isBusy && visibleFiles.length > 1 ? handleRemoveAll : undefined}`. Spec `offers no bulk
removal, even with several files` (`investment-assets-control.test.tsx`) się odwraca.
- **Bez zmian, świadomie:** `deleteInvoiceMediaAfterDelete`, `deleteOrphanedMediaAction`, rollback
  webhooka landingu, `deleteExpenseDraftAction`, `erase-lead.ts` (cały dokument znika albo plik nigdy
  nie był przypięty), `preventReferencedMediaDelete` (panel nie dostaje blokady).

**Testy** (przypadki szukać po nazwie — numery linii sprzed EX-783 są nieaktualne):

- `src/__tests__/lib/db/media-detachments.test.ts` (nowy, DB-owy, `describe.skipIf(!ENV_READY)` —
  dokładnie ten ciąg grepuje `scripts/test-integration.sh:28`): zapis prowenancji; jeden otwarty wpis
  na plik; `closeDetachments` zamyka otwarty i nie rusza zamkniętego.
- `src/__tests__/lib/actions/investment-assets.db.test.ts` — odwrócenie: wiersz `media` przeżywa
  odpięcie, a wpis w koszu wskazuje `investments` / `assets` / to id.
- `src/__tests__/transfer-actions.test.ts` — przypadki, w których odpięcie faktury woła `mockDelete`,
  przenoszą asercję na zapis odpięcia; przypadki „not called" zostają.
- `invoice-cell.test.tsx` i `investment-assets-control.test.tsx` — `/bezpowrotnie/` ustępuje nowemu
  zdaniu.

---

## Faza 2 — Nocne zamiatanie

**Intent:** kosz zaczyna się opróżniać i znikają wycieki kaskadowe. Po tej fazie odzysk jest możliwy
przez panel Payloada (przypięcie w polu rodzica).

**Kontrakt:**

- `src/lib/media/gc-media.ts` — jedno `gcMedia(payload, db)` (w `src/lib/media/`, bo krok 3 potrzebuje
  `payload.delete`). Trzy kroki, każdy osobnym zdaniem SQL, wzorem `gcSnapshots`
  (`src/lib/db/snapshots.ts`) — stateless i idempotentny:
  1. **Zapisz sieroty.** `INSERT … SELECT id FROM media m WHERE NOT EXISTS (…)` po siedmiu tabelach
     (pięć `relsTable` + `RAW_MEDIA_HOLDER_TABLES`), prowenancja `NULL`, `ON CONFLICT DO NOTHING`.
  2. **Zalecz.** `UPDATE … SET restored_at = now()` dla otwartych wpisów, których plik **jest** wskazany
     — to samo zapytanie, odwrócone. Łata widmo i ręczne przypięcie w panelu.
  3. **Skasuj.** Otwarte wpisy starsze niż `FILE_TRASH_RETENTION_DAYS`, `payload.delete` po jednym id,
     najwyżej `MAX_DELETES_PER_RUN` na przebieg. Zwraca `{ recorded, healed, deleted, failed }`.
     Porażki są liczone, nie połykane.
- `/api/cron/cleanup/route.ts` dokłada **jeden** krok, **ostatni**: `media: await runStep('media', () =>
gcMedia(payload, db))`. Ostatni, bo purge'e rekordów z tej samej nocy zostawiają sieroty, które
  wtedy trafiają do kosza od razu, a nie dobę później. Reszta trasy (`try/catch`, marker,
  `maxDuration`) już jest.
- **Zamiana godzin.** `vercel.json`: `/api/cron/cleanup` `0 3` → `30 3`. `blob-backup.yml:34`:
  `30 3` → `0 3`. Kopia leci pół godziny **przed** sprzątaniem. Obie linijki w jednym commicie.

**Testy:**

- `src/__tests__/lib/media/gc-media.test.ts` (nowy, DB-owy): sierota kaskadowa zostaje zapisana;
  plik trzymany tylko przez `worker_expense_draft_media` / `worker_report_media` **nie** jest sierotą;
  wpis na pliku wciąż przypiętym zostaje zaleczony; wpis starszy niż 7 dni kasuje plik; świeży
  przeżywa; drugi przebieg zostawia ten sam zbiór ocalałych. Postarzanie `UPDATE`-em do stałej
  kotwicy, nigdy sztucznym zegarem i nigdy na krawędzi pasma (`snapshots.test.ts`).

---

## Faza 3 — Sekcja „Pliki" na stronie Kosz

**Intent:** przywrócenie pliku przestaje wymagać panelu Payloada. Wchodzi jako ósmy rodzaj w
istniejącej maszynerii `/kosz` — bez nowego komponentu i bez montaży przy galeriach.

**Kontrakt:**

- `TrashKindT` (`src/types/trash.ts`) dostaje `'file'`. `TRASH_KINDS.file`: `sectionTitle: 'Pliki'`,
  `restore`, `restored: 'Plik przywrócony.'` — **bez** usuwania na zawsze (decyzja właściciela). Pola
  usuwania (`deleteForever`, `nameLabel`, `deleted`, `lost`) stają się jedną opcjonalną grupą w
  `TrashKindConfigT`; `TrashedRowActions` renderuje „Usuń na zawsze" i `DeleteForeverDialog` tylko gdy
  grupa jest.
- `TrashRowT` dostaje `restoreBlockedReason?: string`. Gdy jest — „Przywróć" wyłączone, powód pod
  wierszem. Dla pliku z inwestycji w koszu: „Najpierw przywróć inwestycję z Kosza."
- `fetchDetachedFiles(db)` w `src/lib/db/media-detachments.ts`: otwarte wpisy z **niepustą**
  prowenancją, których rodzic **wciąż istnieje** (pliki bez źródła albo po rodzicu skasowanym na
  zawsze nie pokazują się — decyzja właściciela). Zwraca nazwę pliku, nazwę rodzica, `detached_at`,
  `trashed_at` rodzica i — dla faktury — typ kasy transakcji.
- `shapeTrashRows` (`src/lib/queries/trash.ts`): `daysLeft` bierze retencję per rodzaj (7 dla plików).
  Wiersz: `id` = id wpisu w `media_detachments`, `name` = nazwa pliku, `detail` = skąd („Inwestycja
  Mareks · zdjęcia", „Wydatek z 12.10.2026 · faktura", „Zgłoszenie … · pliki"). Faktury z kasy, której
  widz nie widzi, odpadają tym samym `canViewRegister`, co kasy. `getTrashContents` zostaje
  niecache'owane.
- `src/lib/actions/media-trash.ts` — `restoreDetachedFileAction(detachmentId)` w `protectedAction`:
  czyta otwarty wpis; rodzic w koszu albo nie istnieje → błąd (to samo zdanie co w wierszu — wyścig
  między odczytem strony a kliknięciem); inaczej `setUploadField(payload, target,
appendUploadIds([mediaId]))`, co samo zamyka wpis `closeDetachments` z fazy 1. Tagi rewalidacji: te
  same, co akcja przypinająca pliki do danego rodzaju (`investmentEntityOpts` dla inwestycji i
  zgłoszeń, zestaw akcji faktury dla transakcji) — policz każdego pisarza.

**Testy:**

- `src/__tests__/lib/queries/trash.test.ts` (rozszerzenie istniejącego): `shapeTrashRows` liczy
  `daysLeft` plików z 7 dni; plik z inwestycji w koszu ma `restoreBlockedReason`; faktura z
  niewidocznej kasy odpada.
- `src/__tests__/lib/db/media-detachments.test.ts` — `fetchDetachedFiles` pomija wpis bez prowenancji
  i wpis, którego rodzic zniknął.
- `src/__tests__/components/trash/trashed-row-actions.test.tsx` (`dom`): wiersz pliku nie ma „Usuń na
  zawsze"; zablokowany wiersz ma wyłączone „Przywróć".

---

## Whole-tree Gate

Raz, po fazie 3: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm test:integration` (pierwszy
przebieg wymusza re-import bazy testowej — doszła migracja) · `pnpm build`.

## Otwarte ryzyka i założenia

- **Fazy 1 i 2 wychodzą na produkcję razem.** Faza 1 sama przestaje kasować, a nic nie zamiata.
- **Migracja addytywna** — `pnpm db:migrate:prod` (człowiek) idzie **przed** pushem. Bramka
  wdrożeniowa, nie fazowa.
- **Pierwszy produkcyjny przebieg zobaczy całą zaległość sierot** — wycieki kaskadowe od 2026-08 plus
  pliki po każdym „Usuń na zawsze" i purge'u z Kosza od 2026-09-28. Wszystkie wejdą do kosza jednej
  nocy i zaczną znikać siedem nocy później, po `MAX_DELETES_PER_RUN` na noc. Warto wtedy zajrzeć w log
  funkcji. W tym 104 stare wiersze (głównie faktury z 2026-04…08), które
  `context/reference/blob-recovery-runbook.md` wstrzymywał „do decyzji właściciela" — rozstrzyga je
  decyzja 2b (plik bez znanego źródła wygasa po 7 dniach). Faza 2 przepisuje ten akapit runbooka.
- **E2E jest należne i nieautorowane.** „Usuń z galerii → Kosz/Pliki → Przywróć → plik wraca do
  galerii" przechodzi klient → server action → DB → rewalidacja. Autorujemy przy bramce przeglądu albo
  zgłaszamy do Lineara z etykietą `e2e-backlog`.

## Progress

#### Automated

- [x] Faza 1 — migracja `<data>_N_media_detachments.ts` + rejestracja w `src/migrations/index.ts`
- [x] Faza 1 — `src/lib/db/media-detachments.ts` (`recordDetachments`, `closeDetachments`) + `FILE_TRASH_RETENTION_DAYS` w `lib/constants/trash.ts`
- [x] Faza 1 — `setUploadField` zapisuje odpięcie zamiast kasować; zamyka wpis przy przypięciu
- [x] Faza 1 — trzy zestawy etykiet przestają mówić „bezpowrotnie"
- [x] Faza 1 — `src/__tests__/lib/db/media-detachments.test.ts` (nowy, DB-owy)
- [x] Faza 1 — `investment-assets.db.test.ts` odwrócony: plik przeżywa, wpis w koszu istnieje
- [x] Faza 1 — `transfer-actions.test.ts` przenosi asercję z `mockDelete` na zapis odpięcia
- [x] Faza 1 — `invoice-cell.test.tsx` + `investment-assets-control.test.tsx` na nowe zdanie
- [x] Faza 1 — „Usuń wszystkie" z powrotem w galerii inwestycji (EX-862) + odwrócony spec
- [ ] Faza 2 — `MEDIA_RELATIONS` dostaje `relsTable`, obok `RAW_MEDIA_HOLDER_TABLES`
- [ ] Faza 2 — `src/lib/media/gc-media.ts` (zapisz sieroty → zalecz → skasuj szeregowo)
- [ ] Faza 2 — `/api/cron/cleanup` dokłada krok `media` jako ostatni
- [ ] Faza 2 — zamiana godzin: `vercel.json` na `30 3`, `blob-backup.yml` na `0 3`
- [ ] Faza 2 — `src/__tests__/lib/media/gc-media.test.ts` (nowy, DB-owy)
- [ ] Faza 3 — `TrashKindT` + `TRASH_KINDS.file`; grupa usuwania opcjonalna; `restoreBlockedReason`
- [ ] Faza 3 — `fetchDetachedFiles` + wiersze plików w `shapeTrashRows` / `getTrashContents`
- [ ] Faza 3 — `src/lib/actions/media-trash.ts` (`restoreDetachedFileAction`)
- [ ] Faza 3 — testy: `shapeTrashRows`, `fetchDetachedFiles`, `trashed-row-actions` (`dom`)
- [ ] Whole-tree Gate: typecheck · lint · test · test:integration · build
