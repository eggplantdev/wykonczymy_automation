Dobra, zakomentuj dokumentację.# Znacznik „rzut", dwa profile kompresji i wysyłka klient→Blob — plan

> Zmiana: `context/changes/2026-09-22-kategorie-assetow-i-kompresja/change.md`
> Research: `research.md` (git_commit `7e59637`)

## Teza

Trzy rzeczy, jedna zmiana, bo wszystkie trzy siedzą na tej samej rurze wgrywania pliku i każda
z osobna jest bez sensu:

1. **Transport** — wysyłka klient→Blob, bo inaczej większy plik po prostu nie wejdzie (413).
2. **Kompresja** — dwa profile, bo po zniesieniu ściany kompresja przestaje być obejściem limitu
   i staje się decyzją o jakości.
3. **Znacznik** — `media.kind = 'projekt'` na plikach, które AI ma czytać; reszta zostaje `NULL`.

Znacznik i profil zapadają w tej samej chwili, w tym samym dialogu, na tej samej partii plików.

## Stan wyjścia

```
InvoiceUploadDialog ──► useMediaUpload ──► ingestPickedFiles ──► processUploadFile
  (jeden dla wszystkich          │              │                    │
   powierzchni medialnych)       │              │                    ├─ compressImage  1920×1080 / q 0.6
                                 │              │                    ├─ HEIC decode    q 0.92
                                 │              │                    └─ guardSize      MAX_UPLOAD_BYTES 4 MB
                                 ▼
                        submitWithInvoicePages ──► resolveInvoiceMediaIds ──► uploadFileClient
                                                        (param `upload`,          │  POST multipart
                                                         wstrzykiwalny)           ▼
                                                                    /api/upload-file  (Route Handler)
                                                                          requireAuth(MANAGEMENT_ROLES)
                                                                          uploadFile → payload.create
```

Jedno miejsce woła bramę: `src/lib/invoices/invoice-page-uploads.ts:28`.

## Stan docelowy

- `vercelBlobStorage({ clientUploads: true })` — bajty idą z przeglądarki prosto do Bloba.
- `compressImage` przyjmuje profil; `INVOICE` = dzisiejsze `1920×1080` / `q 0.6`,
  `PLAN` = landingowe `MAX_EDGE 2560` / `q 0.8`.
- Pole wyboru „To jest rzut / projekt" w `InvoiceUploadDialog`, włączane propem. Zaznaczone →
  profil `PLAN` **i** `kind: 'projekt'`. Niezaznaczone → profil `INVOICE` i `kind` nietknięty.
- W galerii asetów akcja oznaczająca istniejący plik jako rzut.
- Bramka `MAX_UPLOAD_BYTES` i jej toast znikają.

## Fazy

### Faza 1 — Transport: klient → Blob

**Dowozi:** plik większy niż 4,5 MB wchodzi do aplikacji.

- `clientUploads: true` w `vercelBlobStorage` (`src/payload.config.ts:113`).
- `uploadFileClient` (`src/lib/invoices/invoice-page-uploads.ts:21-32`) przepisany z `POST`
  multipart na ścieżkę client-upload Payloada. To jedyny wołający — reszta łańcucha nie wie
  o transporcie i nie rusza się.
- `/api/upload-file` + `src/lib/utils/upload-file.ts`: zostają albo znikają zależnie od tego, co
  faza ustali o autoryzacji. **Nie kasować, dopóki nowa ścieżka nie działa** — to jedyna brama
  do `media`, a kasowanie jej w ciemno wywala faktury.
- Bramka `MAX_UPLOAD_BYTES` i `reportBlockedFiles` — usunięcie zostawione do fazy 2, razem
  z resztą roboty w `processUploadFile`; tu tylko przestaje być egzekwowana ściana platformy.

**Do zweryfikowania, nie do założenia:**

- **Autoryzacja.** Dziś `requireAuth(MANAGEMENT_ROLES)` w Route Handlerze. Po zmianie broni
  `media.access.create = isAdminOrOwnerOrManager` (`src/collections/media.ts:61`). Te same role,
  inny egzekutor — sprawdzić, że EMPLOYEE faktycznie dostaje odmowę, a nie token.
- **Miniatura.** `upload.imageSizes.thumbnail` powstaje serwerowo z bufora, którego serwer już nie
  zobaczy. Zasięg: żaden kod aplikacji nie czyta `sizes.thumbnail`, tylko `adminThumbnail`
  w panelu. Jeśli miniatura przestanie powstawać — to regresja kosmetyczna w `/admin`, do
  odnotowania, nie do blokowania fazy.
- **`beforeChange` sanityzujące nazwę** (`media.ts:24-33`) czyta `req.file?.name`. Przy client
  upload `req.file` może być puste — sprawdzić, czy `data.filename` dalej przechodzi przez
  `sanitizeFileName`.
- **Lokalny dev.** Wysyłka klient→Blob wymaga tokenu z serwera; token wskazuje na **preview**
  store (`BLOB_READ_WRITE_TOKEN`, patrz AGENTS.md) — potwierdzić, że localhost dalej wgrywa tam,
  gdzie dziś, a nie do produkcji.

**Testy:** `test: test-driven-debugging · integration` — spec na odmowie dla EMPLOYEE, bo to
jedyna rzecz w tej fazie, której zepsucie jest ciche i kosztowne.

### Faza 2 — Dwa profile kompresji

**Dowozi:** rzut zapisany w rozdzielczości, w której da się przeczytać wymiary.

- `src/lib/utils/compress-image.ts`: `MAX_WIDTH`/`MAX_HEIGHT` → jedno `MAX_EDGE` na obie osie
  (powód w landingu: prostokąt `1920×1080` wymiaruje stronę pionową po wysokości, więc A4 ląduje
  przy ~93 DPI i opis wymiaru znika). Dwa profile jako `as const` mapa, nie dwa luźne stałe.
- `src/lib/utils/process-upload-file.ts`: `defaultDeps` jest dziś **stałą modułową** (`:74`), więc
  profil nie ma którędy wejść — zamiana na fabrykę przyjmującą profil. To jedyny nietrywialny
  refaktor w całej zmianie.
- Profil przepchnięty przez `ingestPickedFiles` → `useMediaUpload` / `useFilePickIngest`.
- Usunięcie `MAX_UPLOAD_BYTES`, `guardSize` i `blocked-files-message.tsx` wraz z toastem
  „przekracza 4 MB" — po fazie 1 ta ściana nie istnieje.

**Testy:** `test: TDD · unit` — spec na `compressImage`, że strona pionowa nie jest wymiarowana po
wysokości. Dziś **żaden test nie pilnuje 1920/1080/0.6**, więc te gałki są bez osłony w obie strony.

### Faza 3 — Znacznik „to jest rzut"

**Dowozi:** AI dostaje po czym filtrować.

- `InvoiceUploadDialog`: prop włączający pole wyboru + samo pole. Powierzchnie fakturowe propu nie
  podają i zachowują się jak dziś.
- Znacznik wybiera **jedno i drugie naraz**: profil kompresji z fazy 2 i `kind: 'projekt'`.
- Przepchnięcie `kind` do tworzenia wiersza `media`. Tani szew: `resolveInvoiceMediaIds`
  (`invoice-page-uploads.ts:45-48`) ma już wstrzykiwalny parametr `upload` — domknięcie niesie
  `kind` bez dokładania parametru trzem warstwom.
- Obie powierzchnie inwestycyjne (karta + pole w „Edytuj inwestycję") dostają je z jednego miejsca,
  bo obie montują ten sam dialog. Edytor kosztorysu dostaje je gratis przez zmianę
  `kosztorys-editor-assets`.

**Testy:** `dom` — spec, że pole wyboru nie renderuje się na powierzchni fakturowej, i że
zaznaczone prowadzi do `kind: 'projekt'` (akcja zamockowana).

### Faza 4 — Oznaczanie po fakcie w galerii

**Dowozi:** rzut przyniesiony przez promocję leada — nieskompresowany oryginał z landingu, czyli
najlepszy materiał dla AI — daje się wskazać.

- Akcja w `src/lib/actions/` (mutacja, więc nie `queries`), przez `protectedAction()`.
- `media.access.update` jest dziś `isAdminOrOwner` (`media.ts:61-66`) — MANAGER by nie oznaczył.
  Poluzowanie do `isAdminOrOwnerOrManager` **zmienia to, co użytkownik MOŻE zrobić**, więc idzie do
  planu jawnie, a nie jako efekt uboczny innej fazy.
- Akcja w galerii asetów, przy pliku.

**To nie jest backfill** — dotyczy plików, które ktoś świadomie wskazuje. Masowe uzupełnianie
historii jest odrzucone na stałe (`change.md`, „Rozstrzygnięcie stałe").

**Testy:** `test: TDD · integration` — że akcja zapisuje `kind` i że EMPLOYEE dostaje odmowę.

### Faza 5 — Domknięcie

- `manual-checks.md:468` mówi dziś o ręcznym ustawianiu `kind` w panelu — po tej zmianie to już nie
  jedyna droga.
- Wpis do `context/foundation/lessons.md`: dzisiejszy wpis „The 'original' in Blob is only original
  for files the LANDING uploaded" staje się częściowo nieprawdziwy — aplikacja też zaczyna wgrywać
  duże pliki. Poprawić, nie dopisywać obok.
- `next.config.ts:10-17` — komentarz przy `serverActions.bodySizeLimit` twierdzi rzeczy o limicie
  4,5 MB; sprawdzić, czy po zmianie dalej opisuje prawdę (`bodySizeLimit` dotyczy **tylko** Server
  Actions i nigdy nie ograniczał ścieżki media).

## Poza zakresem

- Jakiekolwiek ruszanie istniejących plików — `kind`, rekompresja, odzyskiwanie oryginałów.
- Samo AI czytające rzut i wypełniające kosztorys. Ta zmiana tylko daje mu po czym filtrować.
- Miniatury w aplikacji (dziś nikt ich nie czyta).
- Pozostałe wartości enumu (`zdjecie`, `inne`) — zostają wyłącznie panelowe.

## Ryzyka

- **Transport dotyka faktur, o które nikt nie prosił.** Regresja przy fakturze boli bardziej niż
  przy zdjęciu z budowy. Decyzja świadoma: jedna brama, jedno zachowanie.
- **Autoryzacja zmienia egzekutora.** Role te same, ale egzekwuje je co innego — to jedyne miejsce
  w planie, gdzie pomyłka jest cicha.
- **Zależność od zmiany `kosztorys-editor-assets`** jest jednokierunkowa i słaba: tamta reużywa
  komponent karty, więc dostaje pole wyboru niezależnie od kolejności.

## Kryteria sukcesu

- Rzut A4 wchodzi w rozdzielczości, w której da się odczytać opisy wymiarów.
- Plik >4,5 MB nie odbija się błędem.
- Zaznaczenie „to jest rzut" daje wiersz `media` z `kind = 'projekt'`; niezaznaczenie zostawia `NULL`.
- Faktura transferu zachowuje się dokładnie jak przed zmianą, łącznie z jakością kompresji.
