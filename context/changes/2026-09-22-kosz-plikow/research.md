---
date: 2026-09-22T12:26:41+02:00
researcher: ex-Plant
git_commit: 26cfff899f5829b9422aeff26bda3893b91f4be7
branch: kategorie-assetow-i-kompresja
repository: wykonczymy
topic: 'Kosz plików — odroczone kasowanie z Bloba zamiast natychmiastowego'
tags: [research, codebase, media, blob, retention, cron, migrations, ex-833]
status: complete
last_updated: 2026-09-22
last_updated_by: ex-Plant
---

# Research: Kosz plików — odroczone kasowanie z Bloba

**Date**: 2026-09-22T12:26:41+02:00
**Researcher**: ex-Plant
**Git Commit**: `26cfff899f5829b9422aeff26bda3893b91f4be7`
**Branch**: `kategorie-assetow-i-kompresja`
**Repository**: wykonczymy

## Research Question

Odpięcie pliku (`setUploadField`) kasuje dziś wiersz `media` i bajty w Blobie natychmiast, a Blob
nie ma undelete. Czy da się to odroczyć — okno łaski, nocne zamiatanie, przywracanie — i jakim
kosztem? Gdzie fizycznie żyje zapis „skąd i kiedy plik zszedł", która ścieżka kasowania wymyka
się szwowi, i co się przy okazji zamyka (EX-833).

## Summary

Zmiana jest wykonalna i tańsza niż wyglądała, ale research przestawił trzy rzeczy w projekcie
naszkicowanym w rozmowie.

1. **Zamiatacz musi skanować referencje, nie tabelę kosza.** Cztery z pięciu rodziców kasują swoje
   `*_rels` kaskadą FK — poniżej Payloada, więc żaden hook tego nie widzi. Te pliki wyciekają do
   Bloba **już dziś** i nic ich nie sprząta. Zamiatacz oparty na pytaniu „które `media` nie mają
   żadnej referencji" łapie je za darmo; oparty na wpisach w koszu — nie łapie wcale.
2. **Kolejność zapisu musi się odwrócić, ale transakcja nie jest potrzebna.** Dziś referencja
   znika, a sprzątanie leci po commicie — przerwanie między nimi zostawia odpięty plik bez śladu
   (niewidoczny, niezamiatany, nieprzywracalny). Zapis prowenancji przed zdjęciem referencji
   odwraca to na wpis-widmo przy wciąż przypiętym pliku, a to samo się leczy, **pod warunkiem że
   zamiatacz sprawdza referencje** — czyli dokładnie przy projekcie z punktu 1. To znosi potrzebę
   opakowywania `setUploadField` w `withPayloadTransaction`.
3. **Nośnik: surowa tabela poza Payloadem**, nie kolumny na `media` i nie nowa kolekcja. Kolumny na
   `media` odpadają na **poprawności**, nie na guście — jeden plik może wisieć w kilku miejscach
   naraz, więc pojedynczy komplet `detachedFrom*` gubi pierwszy cel przywrócenia. Nowa kolekcja
   odpada na cenie: sześć z dziewięciu ukrytych kosztów migracji, w tym kolumna w
   `payload_locked_documents_rels`, której pominięcie już raz położyło panel.

Do tego dwie twarde granice, których nie da się wynegocjować: **okno łaski ma podłogę jednej pełnej
doby** (mirror Bloba leci 30 minut _po_ sprzątaniu), i **nigdy `Promise.all` na kasowaniu** (odtworzony
na Neonie bug gubiący commity przy zielonym raporcie).

## Detailed Findings

### 1. Szew: gdzie pliki znikają

`setUploadField` (`src/lib/media/set-upload-field.ts:22`) jest jedynym miejscem, przez które
przechodzi każde świadome odpięcie. Osiem wywołań, wszystkie `await`owane, wszystkie w
`protectedAction`:

| plik                                            | pole                   | kierunek             |
| ----------------------------------------------- | ---------------------- | -------------------- |
| `src/lib/actions/transfers.ts:342,354,368`      | `transactions.invoice` | +1 / −1 / −wszystkie |
| `src/lib/actions/investment-assets.ts:29,40,51` | `investments.assets`   | +N / −wszystkie / −1 |
| `src/lib/actions/lead-assets.ts:27`             | `leads.assets`         | −1                   |
| `src/lib/actions/lead-assets.ts:65`             | `investments.assets`   | +N (ze zgłoszenia)   |

Czyli **pięć miejsc odpinających**, nie cztery — `removeLeadAssetAction` nie było wymienione
w `change.md` i dostaje kosz za darmo, z tego samego szwu.

`payload.delete({ collection: 'media' })` występuje w repo **dokładnie raz**:
`src/lib/media/delete-unreferenced-media.ts:44`. Ale samo `deleteUnreferencedMedia` ma trzech
wołających **poza** `setUploadField`:

- `src/hooks/transfers/delete-invoice-media.ts:15` — `afterDelete` na `transactions`. Celowo **nie**
  przekazuje `req` (`:9-13`), żeby nie móc wywrócić transakcji kasującej wydatek.
- `src/lib/actions/delete-orphaned-media.ts:19` — sprzątanie po **nieudanym** zapisie formularza,
  wołane fire-and-forget z klienta (`src/lib/invoices/discard-orphaned-uploads.ts:12`).
- `src/app/(frontend)/api/webhooks/landing/route.ts:125` — rollback webhooka landingu.

Dwie ostatnie dotyczą plików, które **nigdy nie były do niczego przypięte** — nie mają prowenancji
do zapisania i nie mają czego przywracać.

**Martwy komentarz do skasowania:** `src/collections/media.ts:34-37` twierdzi, że
`setTransferInvoice` porzuca podmieniony plik fire-and-forget. Ta funkcja nie istnieje od
`4cd98d0c` (EX-659, 2026-08-10). Komentarz jest jednocześnie uzasadnieniem, dlaczego rewalidacja
siedzi na hooku kolekcji, a nie w akcji — więc jego skasowanie wymaga drugiego spojrzenia na
`src/collections/media.ts:38`.

### 2. Kaskady: cztery ścieżki wyciekają dziś, bez żadnego kosza

Każda tabela `*_rels` ma `media_id … ON DELETE cascade`
(`20260810_0_invoice_has_many.ts:19`, `20260818_1_add_fleet.ts:80`,
`20260903_0_add_equipment.ts:97`, `20260921_1_investments_assets.ts:14`,
`20260921_2_leads_landing.ts:24`). Skasowanie rodzica zdejmuje referencję **w bazie, poniżej
Payloada** — żaden hook tego nie widzi. Odzyskuje tylko jedna kolekcja:

- `transactions` — **tak**, `deleteInvoiceMediaAfterDelete` (`src/collections/transfers.ts:80`)
- `investments`, `leads`, `vehicle-inspections`, `equipment-events` — **nie**. Pliki zostają
  w Blobie na zawsze, bez wiersza wskazującego na nie i bez czegokolwiek, co je sprząta.

To jest argument, który sam z siebie uzasadnia zamiatacz skanujący referencje: zamiatacz oparty na
tabeli kosza zostawia te cztery ścieżki dokładnie tam, gdzie są.

### 3. Transakcyjność i kolejność zapisu

`setUploadField` nie przyjmuje `req` (`:22-26`) i nie przekazuje go dalej, a `protectedAction`
daje handlerowi gołe `payload` (`src/lib/actions/run-action.ts:49`). Bez `req.transactionID` Payload
otwiera **własną transakcję na operację** — czyli `findByID`, `update` i każde `delete` to osobne
commity.

Prymityw istnieje (`src/lib/db/with-payload-transaction.ts:23`, używany w
`src/lib/actions/transfers.ts:114`), ale wymagałby przewleczenia `req` przez cały szew plus
`context: { skipRevalidation: true }` na każdym zapisie w środku.

**Nie jest potrzebny.** Rozstrzyga kierunek rozdarcia:

- _dzisiejsza kolejność_ (referencja znika → sprzątanie) rwie się w stronę **odpiętego pliku bez
  śladu** — nic go nie widzi, nic nie zamiecie, nic nie przywróci;
- _odwrócona_ (prowenancja → referencja znika) rwie się w stronę **wpisu-widma na wciąż przypiętym
  pliku** — a zamiatacz i tak przed kasowaniem sprawdza referencje, więc widmo samo umiera.

Ten sam argument, którym `src/lib/actions/delete-orphaned-media.ts:11-13` uzasadnia zaufanie do
identyfikatorów podanych przez klienta.

Jedna ścieżka nie może być transakcyjna z definicji: `delete-invoice-media.ts:9-13` odmawia `req`
świadomie. Zapis kosza dokładany tam musi zostać poza transakcją i nie może rzucać.

### 4. Nośnik zapisu — surowa tabela, nie kolumny i nie kolekcja

**Kolumny na `media` (wariant A) — odpada na poprawności.**
`src/lib/media/delete-unreferenced-media.ts:10-15` mówi wprost, że nic nie wymusza „jeden plik =
jedno przypięcie" — panel potrafi przypiąć ten sam plik dwa razy, a `promoteLeadAction`
(`src/lib/actions/promote-lead.ts:47`) celowo **re-pointuje te same identyfikatory**, więc po awansie
zgłoszenia plik wisi na dwóch rodzicach naraz. Pojedynczy komplet `detached_from_*` nie umie tego
zapisać: drugie odpięcie nadpisuje pierwszy cel przywrócenia, a plik odpięty od inwestycji, ale
wciąż trzymany przez zgłoszenie, dostaje `detached_at` kłamiący o stanie wiersza.
Koszt dodatkowy: każde odpięcie staje się `payload.update` na `media`, co odpala
`makeRevalidateAfterChange('media')` (`src/collections/media.ts:38`) i **wygasza globalny tag
`collection:media` per plik** — a ten tag stoi na `fetchAllMedia`, pełnym skanie 988 wierszy. Przy
„Usuń wszystkie" na 12 plikach to 12 zbędnych wygaszeń pełnego skanu. Dokładne odwrotność tego, co
kupuje EX-833.

**Nowa kolekcja Payloada (wariant B) — odpada na cenie.**
Sześć z dziewięciu kosztów z `context/foundation/lessons.md:1685` stosuje się wprost, w tym kolumna

- indeks w `payload_locked_documents_rels` (panel SELECT-uje ją przy **każdym** create/update/delete
  dowolnej kolekcji — pominięcie to bug z `20260310_fix_locked_docs_expense_categories.ts`), obowiązkowe
  `created_at` dublujące `detached_at`, i klucz naturalny
  `(from_collection, from_id, from_field, media_id)`, którego Payload nie umie wyrazić — więc indeks
  i tak jest ręcznym SQL-em niewidocznym dla configu. ~40 linii migracji zamiast ~14. Wzorzec istnieje
  (`src/collections/amount-edits.ts:10-20`, kolekcja czysto audytowa), więc promocja C→B później to
  migracja na istniejących danych, nie przepisanie.

**Surowa tabela (wariant C) — rekomendacja.**
Wzorzec ma tu nazwę własną („the `notification_reads` pattern") i **trzy żywe instancje**:
`notification_reads` (`src/migrations/20260708_add_notification_reads.ts`, `src/lib/db/notifications.ts`),
`kosztorys_snapshots` (`20260710_1`, `src/lib/db/snapshots.ts`), `kosztorys_presets`
(`20260711_0`, `src/lib/db/presets.ts`) — każda z migracją, modułem, specem, a `kosztorys_presets`
nawet z własnym tagiem cache (`src/lib/cache/tags.ts:15`). `lessons.md:1628` zdejmuje jedyny zarzut:
tabela spoza Payloada **nie generuje niczego** przy `migrate:create`, bo drizzle porównuje snapshot
ze snapshotem i nigdy nie czyta bazy — czyli nie dokłada dryfu do łańcucha, który i tak jest zepsuty.
Zapis odpięcia to `INSERT` na tym samym uchwycie, który `setUploadField` już ma: zero hooków, zero
wygaszeń cache na ścieżce użytkownika.
Cena przyjęta świadomie: **zero powierzchni w `/admin`**. Odzysk w fazie 1 idzie przez listę `media`
(plik tam wciąż jest — zniknęła tylko referencja) i pole „Zdjęcia i pliki" na inwestycji, co
`change.md` już zakłada.

**Pułapka FK:** `media_detachments.media_id` musi być `ON DELETE cascade`, żeby zamiecenie pliku
zabierało wpis. `RESTRICT` (albo dopisanie tabeli do `MEDIA_RELATIONS`) sprawiłby, że
`preventReferencedMediaDelete` (`src/hooks/media/prevent-referenced-delete.ts:14`) **zablokuje własny
zamiatacz** — jego docstring twierdzi, że „nigdy nie odpala się na ścieżce `deleteUnreferencedMedia`",
a wpis kosza po cichu czyni to zdanie nieprawdziwym.

### 5. Kotwica wieku — wpis kosza i skan referencji to jedno, nie dwa

Skan referencji znajduje sieroty, ale nie wie, **od kiedy** są sierotami — a plik, który wyciekł
kaskadą albo został wgrany i porzucony, nie ma wpisu w koszu. Jeśli kotwicą będzie `media.created_at`,
stary plik odpięty dziś zostanie skasowany natychmiast.

Rozwiązanie składa oba mechanizmy w jeden: **wpis w `media_detachments` JEST wpisem kosza, a nocny
skan referencji dopisuje go dla sierot, których nie zna** (z `from_*` = NULL, czyli „prowenancja
nieznana"). Kasowanie to trzeci krok: wpisy starsze niż N dni, **po ponownym sprawdzeniu referencji**.
Skutki uboczne, wszystkie pożądane:

- cztery wyciekające ścieżki kaskadowe wchodzą do kosza same, bez dotykania czterech kolekcji;
- każdy plik dostaje pełne okno łaski liczone od **pierwszej nocy, w której był sierotą**, nie od wgrania;
- wpis-widmo z punktu 3 znika przy pierwszym skanie, bo referencja wciąż stoi;
- przywracanie jest możliwe dla wpisów z prowenancją, a dla reszty zostaje ścieżka panelowa —
  co jest uczciwym odbiciem tego, że przy kaskadzie **nie ma dokąd przywracać**, rodzic nie istnieje.

### 6. Zamiatanie — wzorzec do skopiowania i to, czego nie wolno skopiować

Dom: **drugi krok w istniejącym `/api/cron/cleanup`**, nie piąty cron. Nagłówek handlera zaprasza
wprost (`src/app/(payload)/api/cron/cleanup/route.ts:8-10`), a reguła „własny handler"
(`equipment-reminders/route.ts:12-13`) dotyczy zadań z efektami wychodzącymi, nie sprzątania danych.
Naturalny kształt: `src/lib/media/gc-media.ts` eksportujące jedno `gcMedia(db)` →
`{ ok: true, snapshots, media }`.

Do skopiowania z `gcSnapshots` (`src/lib/db/snapshots.ts:118-170`):

- okno wyrażone **w SQL** przez `make_interval(days => ${N})` przeciwko `now()` bazy, nigdy datami JS
  (`:123`, `:140-141`, `:156`) — plus wyraźny zakaz „naprawiania" tego do konwencji JS (`:127-130`);
- **bezstanowość i idempotencja — stan to zbiór ocalałych** (`:114-117`); pominięta noc nic nie kosztuje,
  druga próba kasuje zero;
- rozbicie wyniku na człony, nie jedna suma (`:162-167`), przekazywane przez route **niespłaszczone**
  — pinuje to test (`src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts:53-63`) z uzasadnieniem,
  że rozbicie to jedyny odczyt mówiący, czy zmiana retencji zachowuje się poprawnie pierwszej nocy.

Czego **nie** kopiować: `gcSnapshots` nie ma `try/catch`, bo jego porażka nic nie kosztuje. Tu kosztuje
— `del()` jest nieodwracalne. Trzy pozostałe crony mają `try/catch` + `console.error('[cron/…]')` +
marker `// TODO(EX-449) SENTRY-REQUIRED:`, a `leads-reconcile/route.ts:45-51` daje wzorzec na częściową
porażkę: **`ok: false` @ 500 z prawdziwymi licznikami w ciele**, żeby log crona pokazał nieudany przebieg.
`deleteUnreferencedMedia` połyka dziś błędy per id (`:25-27,45-47`) — słusznie, bo chroni mutację
użytkownika. **W cronie ta polityka jest zła**: nie ma czego chronić, a połknięcie znaczy cichy no-op
powtarzany w nieskończoność.

Rewalidacja: cron jest Route Handlerem, więc `revalidateTag(tag, EXPIRE_NOW)` — nigdy `updateTag`
(rzuca), nigdy nazwany profil (`lessons.md:1935`). Jeśli zamiatacz ominie `payload.delete`, traci
`makeRevalidateAfterDelete` z `src/collections/media.ts:41` i musi rewalidować sam. Szerzej:
`lessons.md:245-250` — kaskada **przesuwa się w czasie**, więc unieważnienie tagów dzieje się teraz
dwa razy, a drugi raz z kontekstu, w którym żaden `afterDelete` nie pokrywa tego, co Postgres usunął
pod spodem.

### 7. Okno łaski ma twardą podłogę jednej doby

| zadanie                          | harmonogram   | źródło                                 |
| -------------------------------- | ------------- | -------------------------------------- |
| `/api/cron/cleanup` (zamiatanie) | **03:00 UTC** | `vercel.json:5`                        |
| mirror Blob → FTP                | **03:30 UTC** | `.github/workflows/blob-backup.yml:34` |

Mirror jest **wyłącznie dokładający** (`blob-backup.yml:12-15`, `scripts/blob-mirror.mjs:124-126`) i
łapie plik tylko wtedy, gdy ten **wciąż jest w Blobie w momencie `list()`** (`blob-mirror.mjs:51-64`).
Sprzątanie leci 30 minut **przed** mirrorem, więc:

- **N ≥ 1 pełna doba → kopia gwarantowana.** Każde 24h zawiera dokładnie jedno 03:30, a najwcześniejsze
  możliwe skasowanie to `detach + 24h`, czyli zawsze po nim.
- **N < 24h → plik ginie 30 minut przed pierwszą kopią.** To dokładnie dzisiejsza dziura opisana
  w `change.md:21` i w runbooku (`context/reference/blob-recovery-runbook.md:509`).
- **Jedna nieudana noc mirrora zjada cały zapas przy N = 1.** `blob-mirror.mjs` jest all-or-nothing:
  `process.exit(1)` przy dowolnym błędzie pobrania (`:154-155`), a upload na FTP to **późniejszy krok**
  workflow (`blob-backup.yml:107-134`) — nieudany przebieg nie wysyła **nic**, nawet tego, co już
  pobrał. Stąd realna reguła doboru N: _ile kolejnych porażek mirrora chcemy przeżyć_, a nie
  _ile użytkownik potrzebuje na zmianę zdania_.
- **Najtańsze utwardzenie: zamienić godziny** (mirror 03:00, sprzątanie 03:30) — pełna doba zapasu za darmo.
- **`MIN_BLOBS: '1500'`** (`blob-backup.yml:50`) wywala przebieg mirrora, jeśli `list()` zwróci mniej.
  Zamiatacz, który jednorazowo zejdzie poniżej tego progu, **zabija tej nocy siatkę bezpieczeństwa** —
  argument za limitem na przebieg.

**Uwaga: `lessons.md:262` jest nieaktualny** — mówi „50 najnowszych, zamiatane po 7 dniach". Prawdziwa
polityka snapshotów to 30/120/365 (`snapshots.ts:26-28`, zmiana z 2026-09-02 odnotowana w
`lessons.md:782`). Nie kotwiczyć okna łaski na tym wpisie; poprawić go przy okazji.

### 8. EX-833 — zamyka się, ale nie przez zrównoleglenie

Koszt jest realny: `MEDIA_RELATIONS` ma 5 pozycji, więc per sierota \*\*5 sekwencyjnych `payload.count`

- 1 `payload.delete`** (`delete-unreferenced-media.ts:28-49`), a `delete` odpala
  `preventReferencedMediaDelete`, który przelicza **te same 5\*\* jeszcze raz (`src/hooks/prevent-delete.ts:47-59`)
  — realnie ≈10 zapytań + transakcja + wywołanie API Bloba na plik. `setUploadField` dokłada 2
  (`:29`, `:34`). „Usuń wszystkie" na 12 plikach to dziś do 60 sekwencyjnych rundtripów na ścieżce
  użytkownika.

Zrównoleglenie jest **zabronione i nie jest lekarstwem**. `delete-unreferenced-media.ts:17-23` opisuje
odtworzony na wdrożonej bazie bug: przy `@payloadcms/db-vercel-postgres` na Neonie równoległe zapisy
Payloada dzielą sesję, **każdy raportuje sukces, a commituje się jeden** — stąd strony wielostronicowej
faktury zostawały w Blobie bez żadnego błędu. Pinuje to spec
`src/__tests__/lib/media/delete-unreferenced-media.test.ts:68-84` (`maxInFlight === 1`).

Lekarstwem jest **jedno zapytanie SQL wybierające sieroty zbiorczo** w `src/lib/db` (warstwa, którą
`AGENTS.md` rezerwuje dokładnie na to) — zasada „zdecyduj, co kasować, bez ściągania wszystkich wierszy
do aplikacji" z `gcSnapshots`. Pętla `payload.delete` chodzi wtedy tylko po potwierdzonych sierotach:
10N → `1 + ~2N`. **SQL musi być wyprowadzony z tablicy `MEDIA_RELATIONS`, nie przepisany ręcznie** —
`src/lib/media/relating-collections.ts:11-18` istnieje właśnie dlatego, że dwie ręcznie utrzymywane
listy rozjechały się i zgubiły `equipment-events.attachments`. Zamiatacz byłby **czwartym** czytelnikiem
tej listy (trzeci to `src/scripts/backfill-heic-media.ts:187-196`).

Sama lista jest **kompletna** — pięć pól `type: 'upload'` wskazujących na `media` w configu, pięć pozycji
w rejestrze, zero dryfu.

### 9. Dziura, której kosz sam nie zamyka: ręczne kasowanie z `/admin`

`preventReferencedMediaDelete` odmawia tylko wtedy, gdy któraś z pięciu relacji liczy > 0
(`src/hooks/prevent-delete.ts:44-63`). Plik w oknie łaski ma **z definicji zero referencji**, więc
strażnik go przepuszcza, a `access.delete: isAdminOrOwner` (`src/collections/media.ts:65`) i brak
`admin.hidden` znaczą, że kolekcja jest widoczna i **masowo kasowalna w panelu**. Czyli: kosz obiecuje
okno łaski, a panel pozwala je przerwać jednym kliknięciem, bez ostrzeżenia.

Do rozstrzygnięcia w planie: czy strażnik ma odmawiać na wierszu z żywym wpisem w koszu, czy tylko
ostrzegać. Odmowa jest spójna z obietnicą, ale odbiera adminowi ostatnią furtkę do ręcznego zwolnienia
miejsca.

### 10. Co się psuje w testach pierwszego dnia

**Twardy breaker — trzy asercje na prawdziwych wierszach.**
`src/__tests__/lib/actions/investment-assets.db.test.ts:108,109,119,120` czyta `SELECT id FROM media`
po odpięciu i wymaga `false`. Komentarz `:106-107` nazywa wprost odwracaną intencję („the whole reason
the action awaits `deleteUnreferencedMedia`"), a `:65` uzasadnia odbudowę fixture'ów tym, że „detaching
a file deletes it for real here". **To jedyne asercje w repo czytające trwały wiersz `media` po
odpięciu** — reszta stoi na mockach.

**Mocki:** `src/__tests__/transfer-actions.test.ts:1103-1112,1124-1138` (`mockDelete` wywołany dla
konkretnych id). Asercje „nie wywołany" (`:1018-1024`, `:1114-1121`, `:1140-1147`) przeżywają.

**Słownictwo:** `src/__tests__/components/transfers/invoice-cell.test.tsx:60` i
`src/__tests__/components/investments/investment-assets-control.test.tsx:146-147` wymagają
`/bezpowrotnie/`. Źródła: `src/hooks/use-invoice-removal.ts:14`,
`src/hooks/use-investment-assets-removal.ts:14`, `src/components/leads/lead-asset-labels.ts:12`, plus
kontrakt w docstringu `src/hooks/use-media-removal.ts:11-12`. **Wszystkie pięć rusza się razem**, inaczej
odwrócenie czyta się jak regresja. Warto pamiętać, skąd to „bezpowrotnie" się wzięło: bramka
`context/archive/2026-09-21-investment-assets-dialog/review-gate.md:18-19` **dodała** to słowo świadomie,
bo „Blob nie ma undelete". Kosz to odwraca — to jest zamierzone cofnięcie cudzej decyzji, nie przeoczenie.

**Zależne od rozstrzygnięcia zakresu:** `src/__tests__/hooks/transfers/delete-invoice-media.test.ts`
(6 przypadków) pęka tylko wtedy, gdy kasowanie całego wydatku też idzie do kosza;
`src/__tests__/app/(frontend)/api/webhooks/landing/route.test.ts:143-146` i
`transfer-actions.test.ts:1150-1180` — tylko jeśli sprzątanie po nieudanym zapisie idzie do kosza.

**Przeżywa bez zmian** i nie wymaga przepisywania: dwustronna bramka `isBusy`
(`investment-assets-control.test.tsx:124-134`), rozdział `disabled`/`isUploading` w `upload-button`,
strażnik `/admin` na **referencjonowanym** pliku (`investment-assets.db.test.ts:123-136`),
całe `e2e/invoice-ingest.spec.ts` (dotyczy wyłącznie wgrywania — **żaden E2E w repo nie sprawdza
kasowania mediów**).

Brak specu dla `use-media-removal.ts` i dla samego `set-upload-field.ts` (poza dedupem
`appendUploadIds` w `transfer-actions.test.ts:1054-1062`).

### 11. Jak testuje się zamiatanie po czasie

`src/__tests__/lib/db/snapshots.test.ts:56-75` — **prawdziwe wiersze cofane `UPDATE`-em w SQL**, nie
fałszowany zegar. Uzasadnienie z `:50-52` przenosi się 1:1: cofać do **stałego punktu na zegarze
ściennym**, nie o offset od `now()`, bo „ten sam dzień, trzy godziny różnicy" przestaje być prawdą przy
przebiegu przed 03:00. Dalej: żadnego fixture'u **na krawędzi pasma** (`:106-107` — cofające `UPDATE`
i `now()` zamiatacza to osobne transakcje, więc wiersz dokładnie na granicy się ściga); asercja na
**ocalałych, nie na liczniku** (`:168-172`), bo sąsiedni przebieg w współdzielonej bazie dokłada swoje;
w fixturze **dwóch rodziców** (`:27-29`), inaczej zgubione `PARTITION BY` jest niewidoczne.

Odkrycie specu: `scripts/test-integration.sh:56-58` **grepuje `skipIf(!ENV_READY)`** — ten dokładny
ciąg jest mechanizmem znajdowania pliku, a `:59` wywala całą nogę, gdy grep nic nie zwróci. Spec musi
leżeć pod `src/__tests__/lib/media/…` (pełne odbicie ścieżki), nigdy obok źródła. Precedens dla połowy
route'owej już jest: `src/__tests__/app/(payload)/api/cron/cleanup/route.test.ts`.

**Nowa migracja wymusza pełny re-import bazy testowej** przy następnym `pnpm test:integration`
(odcisk migracji, `test-integration.sh:20-44`).

### 12. Kolizja z równoległą zmianą `kategorie-assetow-i-kompresja`

Ta zmiana (status `implementing`, **na bieżącej gałęzi**) dotyka ścieżki wgrywania, nie kasowania.
`set-upload-field.ts` i `delete-unreferenced-media.ts` należą wyłącznie do kosza. Dwa realne styki:

- **Faza 4** luzuje `media.access.update` z `isAdminOrOwner` do `isAdminOrOwnerOrManager`
  (`plan.md:116-125`). Przy kolumnach na `media` (wariant A) luzowałoby to również, kto może ustawiać
  i czyścić flagę kosza — rekomendowana surowa tabela to omija.
- **Faza 5** przepisuje wpis `lessons.md:2045` („oryginał w Blobie jest oryginałem tylko dla plików
  z landingu"). Ten sam wpis ogranicza copy przywracania: **przywracamy zapisane bajty, nigdy oryginał**
  — pliki z aplikacji są kompresowane w przeglądarce, zanim żądanie wyjdzie. Skoordynować edycję.
- Powierzchnia konfliktu w mergu: `src/lib/actions/investment-assets.ts` i komponenty dialogu wgrywania.

Twarde ograniczenie stamtąd (`change.md:74-84`, „Rozstrzygnięcie stałe… Nie otwierać tego ponownie"):
**żadnego backfillu na istniejących assetach.** Kosz zaczyna od zera — w przywróconym zrzucie prod jest
**zero** wierszy w koszu, więc strażnik na prawdziwych danych porównywałby nic z niczym
(`lessons.md:1076`, `:1433`).

### 13. Co kosz zdejmuje z runbooka odzyskiwania

`context/reference/blob-recovery-runbook.md`:

| część runbooka                                                                                    | zdjęta przez okno łaski?                                      |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `:509` „same-day blob uploads — do ~24h faktur ma wiersz i nie ma bajtów"                         | **tak, całkowicie** dla odpięć inicjowanych przez użytkownika |
| §5 kroki 2–3 (ręczny `lftp` + `blob-restore.mjs`) dla **jednego** pliku skasowanego przez pomyłkę | **tak** — zastąpione przyciskiem / przypięciem w panelu       |
| §5 jako całość (utrata sklepu, utrata konta, pułapka planu Hobby)                                 | **nie**, bez zmian, wciąż ręczne                              |
| `:391-395` — wtyczka kasuje poprzedni blob **przed** wgraniem podmiany, brak okna rollbacku       | **nie** — to ścieżka nadpisania, nie odpięcia                 |
| `:505-508` — FTP w jednej kopii, retencja zrzutów 30 dni                                          | **nie**                                                       |

## Code References

- `src/lib/media/set-upload-field.ts:22` — szew, przez który przechodzi każde odpięcie
- `src/lib/media/delete-unreferenced-media.ts:17-23` — zakaz `Promise.all` (odtworzony bug na Neonie)
- `src/lib/media/relating-collections.ts:19-25` — pięć relacji, jedyne źródło prawdy
- `src/hooks/media/prevent-referenced-delete.ts:14` — strażnik `/admin`, przepuszcza plik w oknie łaski
- `src/hooks/transfers/delete-invoice-media.ts:9-13` — świadomie poza transakcją, nie może rzucać
- `src/lib/db/snapshots.ts:114-130` — wzorzec retencji: bezstanowość, SQL-owe okno, rozbicie wyniku
- `src/app/(payload)/api/cron/cleanup/route.ts:8-10` — handler wprost zaprojektowany na kolejne kroki
- `src/migrations/20260708_add_notification_reads.ts:6-7` — wzorzec surowej tabeli poza Payloadem
- `src/migrations/20260922_0_preset_autosave.ts:13-25` — kształt minimalnej migracji ADD COLUMN
- `vercel.json:5` + `.github/workflows/blob-backup.yml:34` — 03:00 vs 03:30, podłoga okna łaski
- `src/__tests__/lib/actions/investment-assets.db.test.ts:106-120` — asercje, które pękają pierwszego dnia
- `src/__tests__/lib/db/snapshots.test.ts:50-75` — technika cofania czasu w specu

## Architecture Insights

- **Szew jest jeden i trzyma.** Pięć powierzchni odpinających dziedziczy zachowanie z jednego miejsca,
  więc „wszystkie pliki po równo" jest w tym projekcie **stanem domyślnym**, a nie czymś, co trzeba
  budować — rozstrzygnięcie właściciela zgadza się z kształtem kodu.
- **Rejestr relacji to wzorzec Registry i ma już trzech czytelników.** Każda nowa logika dotykająca
  mediów wyprowadza się z `MEDIA_RELATIONS` zamiast przepisywać listę — reguła powstała z konkretnego
  rozjazdu.
- **Retencja ma tu jedną władzę na plan danych.** `capture-auto-snapshot.ts:5-8` mówi wprost, że
  ścieżka zapisu nie przycina niczego, a `gcSnapshots` jest jedynym organem retencji. Kosz mediów
  powtarza ten podział: szew tylko oznacza, cron tylko kasuje.
- **Idempotencja przez stan, nie przez dziennik przebiegów.** Zbiór ocalałych wierszy JEST stanem —
  dlatego pominięta noc nic nie kosztuje i nie ma kursora do zgubienia.

## Historical Context (from prior changes)

- `context/archive/2026-09-21-investment-assets-dialog/` — „Usuń wszystkie" zatwierdzone przez
  właściciela; **tu dodano słowo „bezpowrotnie"** (`review-gate.md:18-19`) i **tu zgłoszono EX-833**
  (`:57`) oraz EX-832 (`:30`).
- `context/changes/2026-09-22-kosztorys-editor-assets/review-gate.md:13-22` — jedyny otwarty `[ ]`
  w repo; zamyka go rozstrzygnięcie właściciela zapisane w `change.md:25-29` tej zmiany. Tam też
  zgłoszono EX-849 (tag cache na całą kolekcję eksmituje galerie wszystkich 65 inwestycji) i EX-850
  (podwójny render trasy po mutacji assetu).
- `context/changes/2026-09-22-kategorie-assetow-i-kompresja/change.md:74-84` — „stare assety zostają
  jak są", rozstrzygnięcie stałe: żadnego backfillu.
- `context/foundation/lessons.md:259-264` — najbliższy precedens okna łaski: cofka destrukcyjnej
  podmiany jako snapshot `manual` brany **na uchwycie transakcji, przed** zniszczeniem.

## Open Questions

1. **N — ile dni?** Podłoga to jedna doba (§7), ale realną regułą doboru jest „ile kolejnych porażek
   mirrora przeżywamy". Osobno: czy zamienić godziny crona i mirrora, co daje dobę zapasu za darmo.
2. **Czy `/admin` ma odmawiać kasowania wiersza w oknie łaski** (§9), czy tylko ostrzegać.
3. **Trzy ścieżki wołające `deleteUnreferencedMedia` bezpośrednio** (§1) — sprzątanie po nieudanym
   zapisie formularza, rollback webhooka landingu, kasowanie całego wydatku. Pierwsze dwa dotyczą
   plików nigdy nie przypiętych (brak prowenancji, nie ma czego przywracać) — rekomendacja: zostają
   natychmiastowe. Trzecie to prawdziwa utrata widoczna dla użytkownika — rekomendacja: do kosza,
   kosztem sześciu przypadków w `delete-invoice-media.test.ts`.
4. **Czy faza 1 w ogóle dopisuje prowenancję**, skoro odzysk idzie wtedy przez panel. Za dopisaniem:
   to ta sama migracja, a bez niej faza 2 zaczyna od backfillu, którego nie da się zrobić.
5. **`test-plan.md` nie ma ryzyka dotykającego mediów, Bloba ani retencji** — potrzebny nowy wpis
   (Impact High / Likelihood Medium), nie dopasowanie do istniejącego. §5 Quality Gates też nie ma
   wiersza pokrywającego zapisy/kasowania w magazynie obiektów.
6. **Dwa nieaktualne wpisy do poprawienia przy okazji:** `lessons.md:262` (retencja snapshotów 50/7dni
   — faktycznie 30/120/365) i martwy komentarz `src/collections/media.ts:34-37` o nieistniejącym
   `setTransferInvoice`.
