# Kosz plików — odroczone kasowanie z Bloba

**Change:** `kosz-plikow` · **Research:** `research.md` · **Decyzje właściciela:** `change.md`

## Cel

Odpięcie pliku przestaje go kasować. Zamiast tego powstaje wpis w koszu; plik ginie z Bloba dopiero
po **7 dniach**, zmieciony nocnym cronem. Przy okazji nocne zamiatanie zabiera cztery ścieżki
kaskadowe, które dziś zostawiają bajty w Blobie na zawsze, a pętla licząca referencje (EX-833)
wypada ze ścieżki użytkownika.

## Stan wyjściowy

- `setUploadField` (`src/lib/media/set-upload-field.ts:39`) kończy każde odpięcie
  `deleteUnreferencedMedia`, czyli `payload.delete({ collection: 'media' })` + bajty w Blobie. Blob nie
  ma undelete. Osiem miejsc wywołania, wszystkie w `protectedAction`.
- `deleteUnreferencedMedia` liczy referencje po pięciu kolekcjach z `MEDIA_RELATIONS`, jedna kolekcja
  na zapytanie, i to samo powtarza potem `preventReferencedMediaDelete` — ~10 zapytań na plik. To jest
  EX-833.
- Cztery z pięciu relacji (`investments`, `leads`, `vehicle-inspections`, `equipment-events`) mają
  `media_id … ON DELETE cascade` i **nikt** po nich nie sprząta: skasowanie rodzica zabiera wiersz
  w `*_rels` poniżej Payloada, a plik zostaje w Blobie bez właściciela. Tylko `transactions` odzyskuje
  (`deleteInvoiceMediaAfterDelete`).
- Jedyna siatka to nocny mirror na FTP (`.github/workflows/blob-backup.yml`, `30 3 * * *`, nigdy nie
  kasuje) — czyli sprzątanie o `0 3` pracuje na sklepie, którego ostatnie ~23 godziny nie są nigdzie
  skopiowane.

## Decyzje projektowe (moje, nie do pytania)

- **Osobna surowa tabela `media_detachments`, nie kolumny na `media` i nie nowa kolekcja Payloada.**
  Kolumny na `media` są złe kardynalnościowo — jeden plik może legalnie wisieć na dwóch rodzicach
  (`promoteLeadAction` przepina te same id), więc „skąd zszedł" nie jest funkcją pliku. Kolekcja
  Payloada dokłada dziewięć ukrytych kosztów migracyjnych, w tym kolumnę w
  `payload_locked_documents_rels`, której pominięcie raz już położyło `/admin`. Zostaje wzorzec
  `notification_reads` / `kosztorys_snapshots`: surowa tabela + jeden moduł w `src/lib/db/`.
- **Kolejność zapisu odwrócona: najpierw prowenancja, potem zdjęcie referencji.** Rozerwany zapis
  zostawia wtedy wpis-widmo przy wciąż przypiętym pliku, a nie odpięty plik bez wpisu. Zamiatacz i tak
  przelicza referencje, więc widmo leczy się samo i **transakcja jest niepotrzebna**.
- **Zamiatacz pyta o referencje, nie o kosz.** Zapytanie zbiorowe („które `media` nie są wskazane
  przez żadną z pięciu tabel `*_rels`") jest jednocześnie naprawą wycieku kaskadowego, leczeniem widma
  i wyrzuceniem pętli EX-833 ze ścieżki użytkownika. `payload_locked_documents_rels` też ma `media_id`
  i **nie wchodzi** do zapytania — blokada edycji w panelu nie jest referencją.
- **Bez kolumny „kto odpiął".** `setUploadField` dostaje tylko `payload`, więc „kto" oznaczałoby
  przewleczenie użytkownika przez osiem miejsc wywołania. `change.md` rozstrzyga „skąd", nie „kto";
  przy pięciu osobach w firmie autor odpięcia nie jest pytaniem, na które ktoś odpowiada.
- **Unikalny indeks częściowy na `media_id WHERE restored_at IS NULL`** — jeden otwarty wpis na plik.
  To on czyni wstawkę zamiatacza idempotentną (`ON CONFLICT DO NOTHING`), więc kolejna noc nie
  przestawia zegara pliku, który już leży w koszu.
- **Kasowanie w zamiataczu idzie szeregowo, nigdy `Promise.all`.** Na Neonie równoległe zapisy Payloada
  dzielą sesję: każdy `delete` melduje sukces, commituje się jeden. Odtworzone; lokalny Postgres tego
  nie pokazuje.
- **Powierzchnia kosza jest jedna, parametryzowana celem** (`{ collection, field, id }`), montowana
  w trzech miejscach, w których dziś w ogóle da się odpiąć plik: galeria inwestycji, komórka faktury,
  pliki zgłoszenia. `vehicle-inspections` i `equipment-events` nie dostają jej wcale — tam nic
  w aplikacji nie odpina plików, więc kosz per rodzic byłby zawsze pusty.

---

## Faza 1 — Zapis odpięcia zamiast kasowania

**Intent:** odpięcie przestaje dotykać Bloba i zostawia po sobie ślad „media N zeszło z
`<kolekcja>/<id>/<pole>` o T". Po tej fazie żaden plik nie ginie — ale też nic go jeszcze nie zamiata,
więc `media` puchnie do czasu fazy 2.

**Kontrakt:**

- Migracja `src/migrations/20260922_2_media_detachments.ts`, pisana ręcznie (wzorzec nagłówka jak
  `20260921_1_investments_assets.ts`), plus dwie edycje w `src/migrations/index.ts` (import + wpis).
  Tabela `media_detachments`:
  - `id serial PRIMARY KEY`
  - `media_id integer NOT NULL REFERENCES media(id) ON DELETE cascade` — kaskada, nie `restrict`:
    zmiecenie pliku ma zabrać jego wpis. Relacji **nie** dopisujemy do `MEDIA_RELATIONS`, bo wtedy
    `preventReferencedMediaDelete` zablokowałby własny zamiatacz.
  - `from_collection varchar`, `from_field varchar`, `from_id integer` — **wszystkie NULL-owalne**;
    `NULL` znaczy „znaleziony osierocony, źródło nieznane" i to jest jedyny stan, jaki zna zamiatacz
    dla wycieków kaskadowych.
  - `detached_at timestamptz NOT NULL DEFAULT now()`, `restored_at timestamptz` (NULL = leży w koszu)
  - `UNIQUE INDEX … (media_id) WHERE restored_at IS NULL`
  - `INDEX … (detached_at) WHERE restored_at IS NULL` — czyta go zamiatacz
  - `INDEX … (from_collection, from_id, detached_at DESC)` — czyta go lista kosza w fazie 3
- `src/lib/db/media-detachments.ts` — jedyny czytelnik/pisarz tej tabeli, surowy SQL przez
  `DbExecutorT`, `import 'server-only'`, nagłówek nazywający wzorzec (jak `snapshots.ts:11-13`).
  Eksportuje: `recordDetachments(db, target, mediaIds)`, `closeDetachments(db, mediaIds)`.
  Stała `TRASH_RETENTION_DAYS = 7` mieszka tu i jest jedynym miejscem, w którym ta liczba istnieje.
- `setUploadField` przestaje wołać `deleteUnreferencedMedia`. Zamiast tego, na tym samym `payload`
  przez `getDb(payload)`:
  - liczy `dropped` i `added` z różnicy `currentIds` ↔ `next` **przed** zapisem
  - `recordDetachments` dla `dropped` — **przed** `payload.update`
  - `closeDetachments` dla `added` — po zapisie; to zamyka wpis, gdy ktoś przypina plik z powrotem
  - komentarz „awaited, not fire-and-forget" znika razem z wywołaniem, które uzasadniał
- Potwierdzenia przestają kłamać. `MediaRemovalLabelsT.description` w trzech źródłach
  (`use-invoice-removal.ts`, `use-investment-assets-removal.ts`, `lead-asset-labels.ts`) mówi, że plik
  trafia do kosza na 7 dni; kontraktowy docstring w `use-media-removal.ts:12` („każde usunięcie
  odzyskuje plik z Bloba, który nie ma undelete") opisuje stan sprzed zmiany i idzie razem z nimi.
  Docstring nad `LEAD_ASSET_REMOVAL_LABELS` też — jego pierwsze zdanie stoi na słowie „bezpowrotnie".
- **Bez zmian, świadomie:** `deleteInvoiceMediaAfterDelete` (kasowanie wydatku kasuje fakturę od razu),
  `deleteOrphanedMediaAction` i rollback webhooka landingu (pliki nigdy nieprzypięte),
  `preventReferencedMediaDelete` (panel nie dostaje blokady).

**Testy:**

- `src/__tests__/lib/db/media-detachments.test.ts` (nowy, DB-owy — `ENV_READY` + `describe.skipIf`
  dokładnie tym ciągiem, którego szuka `scripts/test-integration.sh:56-58`): zapis prowenancji;
  unikalność otwartego wpisu na plik; `closeDetachments` zamyka otwarty i nie rusza zamkniętego.
- `src/__tests__/lib/actions/investment-assets.db.test.ts:106-120` — odwrócenie: wiersz `media`
  **przeżywa** odpięcie, a wpis w koszu wskazuje `investments` / `assets` / to id. Komentarz `:65-66`
  („detaching a file deletes it for real here") opisuje skasowaną regułę i znika.
- `src/__tests__/transfer-actions.test.ts:1103-1112` i `:1124-1138` — `mockDelete` przestaje być
  wołany; asercja przenosi się na zapis odpięcia. Trzy przypadki „not called" (`:1018`, `:1114`,
  `:1140`) zostają bez zmian.
- `src/__tests__/components/transfers/invoice-cell.test.tsx:60` i
  `src/__tests__/components/investments/investment-assets-control.test.tsx:146-147` — `/bezpowrotnie/`
  ustępuje nowemu zdaniu.

---

## Faza 2 — Nocne zamiatanie

**Intent:** kosz zaczyna się opróżniać, a przy okazji znikają cztery ciche wycieki kaskadowe. Po tej
fazie odzysk pliku jest już możliwy — przez panel Payloada, przypięciem w polu rodzica.

**Kontrakt:**

- `src/lib/media/gc-media.ts` — jedno `gcMedia(payload, db)`. Mieszka w `src/lib/media/`, nie
  w `src/lib/db/`, bo krok trzeci potrzebuje `payload.delete` (bajty w Blobie), a `src/lib/db` to
  surowy SQL i nic więcej. Trzy kroki, każdy osobnym zdaniem SQL, wzorem `gcSnapshots`
  (`src/lib/db/snapshots.ts:114-167`) — **stateless i idempotentny**, zbiór ocalałych JEST stanem:
  1. **Zapisz sieroty.** `INSERT … SELECT id FROM media m WHERE NOT EXISTS (…)` po pięciu tabelach
     `transactions_rels`, `vehicle_inspections_rels`, `equipment_events_rels`, `investments_rels`,
     `leads_rels`, z prowenancją `NULL`, `ON CONFLICT DO NOTHING`.
  2. **Zalecz.** `UPDATE … SET restored_at = now()` dla otwartych wpisów, których plik **jest** jeszcze
     wskazany — to samo zapytanie o referencje, odwrócone. Łata widmo po rozerwanym zapisie i plik
     przypięty z powrotem ręcznie w panelu.
  3. **Skasuj.** Otwarte wpisy starsze niż `TRASH_RETENTION_DAYS`, `payload.delete` **po jednym id**,
     najwyżej `MAX_DELETES_PER_RUN` na przebieg. Referencji nie liczymy per plik — krok 2 właśnie to
     rozstrzygnął dla całego zbioru. To jest wyjęcie pętli EX-833 ze ścieżki użytkownika.
     Zwraca rozbicie `{ recorded, healed, deleted, failed }`, nigdy jednej sumy — log funkcji jest
     jedynym miejscem, w którym czyta się zmianę retencji.
     Kasowanie **nie** jest best-effort po cichu jak `deleteUnreferencedMedia`: cron ma liczyć porażki.
- `MEDIA_RELATIONS` (`src/lib/media/relating-collections.ts:19`) dostaje szóste pole `relsTable`.
  Zapytanie o referencje buduje się z tej listy, żeby nowa relacja dalej była jedną linijką w jednym
  miejscu — to jest cała racja bytu tej stałej (`:11-18`).
  `payload_locked_documents_rels` do listy **nie** należy i nie należeć nie zacznie.
- `src/app/(payload)/api/cron/cleanup/route.ts` dokłada `gcMedia` jako drugi krok →
  `{ ok, snapshots, media }`. Nagłówek `:8-10` wprost zaprasza kolejne zamiatania, więc **nie** powstaje
  piąty cron. Przy okazji trasa dorabia to, czym różni się od trzech sióstr: całe ciało w `try/catch`,
  `console.error('[cron/cleanup] …')` z markerem `// TODO(EX-449) SENTRY-REQUIRED:`, częściowa porażka
  jako `ok: false` @ 500 **z prawdziwymi licznikami w ciele** (wzorzec `leads-reconcile/route.ts:45-51`),
  oraz `export const maxDuration`.
- **Zamiana godzin.** `vercel.json`: `/api/cron/cleanup` z `0 3` na `30 3`.
  `.github/workflows/blob-backup.yml:34`: `30 3` na `0 3`. Kopia leci wtedy pół godziny **przed**
  sprzątaniem, a nie po nim — pełna doba zapasu za darmo. Obie linijki zmieniają się razem; rozjazd
  cofa gwarancję po cichu.

**Testy:**

- `src/__tests__/lib/media/gc-media.test.ts` (nowy, DB-owy): sierota kaskadowa zostaje zapisana;
  wpis na pliku wciąż przypiętym zostaje zaleczony, nie skasowany; wpis starszy niż 7 dni kasuje plik;
  świeży przeżywa; drugi przebieg kasuje zero i zostawia ten sam zbiór ocalałych.
  Postarzanie wpisu **`UPDATE`-em w SQL do stałej kotwicy zegarowej**, nigdy sztucznym zegarem
  (`snapshots.test.ts:56-75`), i nigdy na krawędzi pasma (`:106-107`).
  Asercja na ocalałych i na stabilności, nie na `deleted === 0` (`:168-172`).

---

## Faza 3 — Kosz w interfejsie

**Intent:** przywrócenie pliku przestaje wymagać panelu Payloada.

**Kontrakt:**

- `src/lib/queries/media-trash.ts` — `'use server'` read na żądanie (otwarcie dialogu), nie
  `src/lib/actions`, bo tam mieszkają wyłącznie mutacje. Zwraca otwarte wpisy dla jednego celu
  `{ collection, field, id }` wraz z miniaturą i nazwą pliku, plus datę, do której plik da się jeszcze
  odzyskać.
- `src/lib/actions/media-trash.ts` — `restoreDetachedMediaAction(target, mediaId)` w `protectedAction`,
  przypina przez `setUploadField` + `appendUploadIds` (co samo zamyka wpis krokiem `closeDetachments`
  z fazy 1 — przywracanie nie dostaje własnej ścieżki zapisu). Tagi rewalidacji zależą od celu.
- `src/components/media/media-trash-control.tsx` — **jeden** komponent, parametryzowany celem
  i etykietami, wzorem `PreviewLabelsT` (`src/types/media.ts`), gdzie każde pole jest wymagane właśnie
  po to, żeby nowy wołający musiał nazwać swoje słowa, a nie odziedziczyć „fakturę" na zdjęciu z budowy.
  Przy pustym koszu **nie renderuje się wcale** — „Kosz (0)" to martwy przycisk.
- Trzy montaże, po jednej linijce: `investment-assets-control.tsx` (obok „Dokumentacja (N)"), komórka
  faktury w transferach, strip plików zgłoszenia.
- Blokada współbieżności: przywracanie wchodzi do tego samego `isBusy`, którym galeria rozbraja
  wgrywanie i usuwanie (`investment-assets-control.tsx:30-33`) — `setUploadField` to
  read-modify-write, więc przywrócenie równoległe do wgrywania zjadłoby jedno z dwóch.

**Testy:**

- `src/__tests__/components/media/media-trash-control.test.tsx` (nowy, `dom`): pusty kosz nie renderuje
  przycisku; kosz z plikami pokazuje liczbę; klik w „Przywróć" woła akcję z właściwym celem (akcja
  `'use server'` jest podmieniana na atrapę przez `stubServerActions`, więc `vi.mock` jawnie).

---

## Whole-tree Gate

Raz, po fazie 3 — nie po każdej fazie.

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (oba projekty vitest)
- `pnpm test:integration` — **pierwszy przebieg po tej zmianie wymusza pełny re-import bazy testowej**,
  bo doszła migracja (`scripts/test-integration.sh:20-44`)
- `pnpm build`

## Otwarte ryzyka i założenia

- **`media` puchnie między fazą 1 a 2.** Faza 1 sama przestaje kasować, a nic jeszcze nie zamiata.
  Jeśli fazy 2 nie da się dowieźć tego samego dnia, faza 1 nie wychodzi na produkcję sama.
- **Kolejność migracji przy wdrożeniu jest addytywna** — kod potrzebuje kolumny, której jeszcze nie ma,
  więc `pnpm db:migrate:prod` (uruchamiane **przez człowieka**) idzie **przed** pushem. To bramka
  wdrożeniowa, nie fazowa: implementacja lokalna nie czeka na nic.
- **Pierwszy produkcyjny przebieg zamiatacza zobaczy całą historyczną zaległość sierot kaskadowych**
  — pliki, które wyciekły od 2026-08. Wszystkie wejdą do kosza w jednej nocy i skasują się dopiero
  siedem nocy później, po `MAX_DELETES_PER_RUN` na noc. To jest zamierzone i jest to jedyny moment,
  w którym warto zajrzeć w log funkcji przed upływem tygodnia.
- **E2E jest należne i nieautorowane.** Ryzyko „usuń → Kosz (1) → Przywróć → plik wraca do galerii"
  przechodzi klient → server action → DB → rewalidacja, czyli jest browser-level. Autorujemy przy
  bramce przeglądu albo zgłaszamy do Lineara z etykietą `e2e-backlog`; wzmianka w commicie tego nie
  zamyka.

## Progress

#### Automated

- [ ] Faza 1 — migracja `20260922_2_media_detachments.ts` + rejestracja w `src/migrations/index.ts`
- [ ] Faza 1 — `src/lib/db/media-detachments.ts` (`recordDetachments`, `closeDetachments`, `TRASH_RETENTION_DAYS`)
- [ ] Faza 1 — `setUploadField` zapisuje odpięcie zamiast kasować; zamyka wpis przy przypięciu
- [ ] Faza 1 — trzy zestawy etykiet + dwa docstringi przestają mówić „bezpowrotnie"
- [ ] Faza 1 — `src/__tests__/lib/db/media-detachments.test.ts` (nowy, DB-owy)
- [ ] Faza 1 — `investment-assets.db.test.ts` odwrócony: plik przeżywa, wpis w koszu istnieje
- [ ] Faza 1 — `transfer-actions.test.ts` (2 przypadki) przenosi asercję z `mockDelete` na zapis odpięcia
- [ ] Faza 1 — `invoice-cell.test.tsx` + `investment-assets-control.test.tsx` na nowe zdanie
- [ ] Faza 2 — `MEDIA_RELATIONS` dostaje `relsTable`
- [ ] Faza 2 — `src/lib/media/gc-media.ts` (zapisz sieroty → zalecz → skasuj szeregowo)
- [ ] Faza 2 — `/api/cron/cleanup` dokłada krok `media`, `try/catch`, `maxDuration`
- [ ] Faza 2 — zamiana godzin: `vercel.json` na `30 3`, `blob-backup.yml` na `0 3`
- [ ] Faza 2 — `src/__tests__/lib/media/gc-media.test.ts` (nowy, DB-owy)
- [ ] Faza 3 — `src/lib/queries/media-trash.ts` (lista kosza dla jednego celu)
- [ ] Faza 3 — `src/lib/actions/media-trash.ts` (`restoreDetachedMediaAction`)
- [ ] Faza 3 — `src/components/media/media-trash-control.tsx` + trzy montaże
- [ ] Faza 3 — `src/__tests__/components/media/media-trash-control.test.tsx` (nowy, `dom`)
- [ ] Whole-tree Gate: typecheck · lint · test · test:integration · build
