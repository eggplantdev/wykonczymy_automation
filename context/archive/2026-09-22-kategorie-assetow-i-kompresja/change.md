---
change_id: kategorie-assetow-i-kompresja
title: Kategorie assetów inwestycji i luźniejsza kompresja dla plików roboczych
status: archived
created: 2026-09-22
updated: 2026-09-23
archived_at: 2026-09-23T08:36:36Z
branch: kategorie-assetow-i-kompresja
worktree: null
---

## Notes

Dwie sprawy, jedna zmiana, bo dotykają tej samej ścieżki wgrywania pliku.

**1. Kategorie.** Do inwestycji można dziś dorzucić asety, ale wszystkie lądują w jednym worku.
Docelowo do inwestycji ma zostać podpięte AI, które czyta rzut albo plan i na tej podstawie robi
wstępną wycenę — wypełnia tabelki w kosztorysie. Żeby to było wykonalne, plan musi być przypisany
do kategorii „plan", a nie leżeć wśród losowych zdjęć, których trzeba by przeszukiwać wszystkie.

**2. Kompresja.** Kompresor jest teraz zbyt agresywny. Miał sens przy transferach (faktury),
ale przy assetach inwestycji trzeba go poluzować — drogą landingu (`workspace/yolo/landing_26`),
bo większość tych plików i tak przechodzi przez formularz z landingu. Dodając asety, czy to
z pozycji arkusza, czy z pozycji inwestycji, musimy stosować kompresję, która pozwoli nam
z tymi plikami pracować.

## Rozstrzygnięcia z rozmowy (2026-09-22)

- **Model kategorii: „czym plik jest", nie „kiedy powstał".** Kolumna `media.kind` z enumem
  `faktura` / `projekt` / `zdjecie` / `inne` już istnieje (`src/collections/media.ts`, migracja
  `20260921_0_media_kind.ts`, EX-802) — jest tylko nieużywana przez aplikację, ustawia się ją
  wyłącznie ręcznie w panelu. Ta zmiana ma ją zacząć zapisywać ze ścieżki uploadu.
- **`projekt` jako wartość jest OK** — nie koliduje z glosariuszem domeny; w `context/` występuje
  tylko w `manual-checks.md:468`, czyli w sprawdzeniu tego samego pola w panelu.
- **Użytkownik ustawia `kind` przy wgrywaniu, ale nie wszędzie.** Powierzchnia, która wie, co
  wgrywa, nie pyta — faktura dorzucana do transferu jest fakturą, nie rzutem. Pytanie pojawia się
  tam, gdzie plik może być czymkolwiek.
- **Istniejące wiersze zostają `NULL`.** Bez backfillu i bez zgadywania z prowenancji.
- **Profil kompresji jest per powierzchnia.** Faktury zostają przy dzisiejszym `1920×1080` / `q 0.6`;
  asety idą w stronę landingowego `MAX_EDGE 2560` / `q 0.8`. Dziś `compressImage` nie ma parametru
  rozmiaru — profil trzeba przepchnąć przez `useMediaUpload` → `ingestPickedFiles` →
  `processUploadFile`.
- **Do zmierzenia, nie do założenia:** luźniejsza kompresja pcha pliki w stronę bramki
  `MAX_UPLOAD_BYTES = 4 MB` (limit ciała żądania Vercela), którą historycznie przekraczały tylko PDF-y.

## Odwrócenie modelu: znacznik, nie klasyfikacja (2026-09-22)

Właściciel odwrócił kategoryzację i to unieważnia część punktów powyżej:

> „Jedyna istotna informacja to, które zdjęcia mają być odsiewane w momencie, kiedy będziemy
> chcieli je wrzucić AI do analizy. Będzie analizować tylko zdjęcia konkretnego typu, czyli cała
> reszta może być `NULL` i to też jest informacja."

- **`kind` to znacznik, nie klasyfikacja.** Aplikacja zapisuje jedną wartość — `projekt` — i nic
  więcej. `NULL` przestaje znaczyć „nie wiemy" i zaczyna znaczyć „nie do analizy". Enum z EX-802
  zostaje w schemacie nietknięty; pozostałe wartości ustawia się dalej wyłącznie ręcznie w panelu.
- **Powierzchnie fakturowe nie ustawiają niczego** — anuluje to wcześniejsze „faktura dorzucana do
  transferu jest fakturą" oraz decyzję „załączniki floty → `faktura`". To, czym plik jest, mówi
  relacja (`transactions.invoice`), a znacznik by ją tylko powtórzył. Nic nigdy nie filtruje po
  `faktura`.
- **UI: jedno pole wyboru na partię** — „to jest rzut/projekt" w dialogu dodawania plików.
  Zaznaczone → `projekt`, niezaznaczone → `NULL`. Bez selecta z czterema wartościami.
- **Profil kompresji idzie za znacznikiem.** Luźniejsze `MAX_EDGE 2560` / `q 0.8` dostają wyłącznie
  pliki oznaczone jako rzut; reszta asetów zostaje przy dzisiejszym `1920×1080` / `q 0.6`. Znacznik
  pada przed wysłaniem, więc obie decyzje zapadają w tym samym miejscu i w tym samym momencie.
  Skutek uboczny: presja na bramkę `MAX_UPLOAD_BYTES = 4 MB` dotyczy garstki plików, a nie serii
  dwudziestu zdjęć z budowy.
- **Oznaczyć da się też po fakcie, w galerii asetów.** Domyka to jedyną ścieżkę bez dialogu
  wgrywania — promocję leada, która przynosi nieskompresowane oryginały z landingu, czyli najlepszy
  materiał dla AI. Wymaga akcji zapisu i poluzowania `media.access.update` (dziś `isAdminOrOwner`,
  więc MANAGER by nie oznaczył). **To nie jest backfill** — dotyczy plików, które ktoś świadomie
  wskazuje, nie masowego uzupełniania historii.

## Rozstrzygnięcie stałe: stare assety zostają jak są (2026-09-22)

**Nie naprawiamy żadnych istniejących plików.** Ani backfillu `kind`, ani ponownego przetwarzania
plików zduszonych starą kompresją, ani odzyskiwania oryginałów. To nowy, dopiero testowany ficzer —
stare skompresowane assety nie są problemem, który ta zmiana ma rozwiązywać.

Zapisane tutaj, bo **temat będzie wracał**: research pokazuje, że pliki wgrane przez aplikację są
nieodwracalnie zduszone do 763×1080 w portrecie, a najcenniejsze rzuty z landingu mają dziś
`kind = NULL` — i jedno, i drugie wygląda jak „luka do domknięcia". Nie jest. Nie otwierać tego
ponownie jako findingu, migracji ani zadania w backlogu; nowe pliki wchodzą nowym profilem
i z kategorią, reszta zostaje.

## Które powierzchnie pytają o znacznik (2026-09-22)

Właściciel: znacznik musi być dostępny **przy dodawaniu załączników do inwestycji — tak samo
z poziomu edycji inwestycji, jak i z galerii asetów przy inwestycji**.

Obie te ścieżki montują ten sam komponent — `InvoiceUploadDialog`
(`src/components/investments/investment-assets.tsx:91`,
`src/components/forms/investment-form/investment-assets-field.tsx:30`). Pole wyboru dokłada się
więc raz, w tym dialogu, i włącza propem. Powierzchnie fakturowe (transfer, wydatek, flota) tego
propu nie podają i zachowują się dokładnie jak dziś. Galeria w edytorze kosztorysu (zmiana
`kosztorys-editor-assets`) dostaje pole bez dodatkowej pracy, bo reużywa komponent z karty.

## Transport uploadu: klient → Blob (2026-09-22)

Właściciel: „musimy móc tutaj dodać większe pliki" — i pytanie, czy nie przejść całkowicie na
system landingu, z rozróżnieniem kompresji fakturowej i rzutowej.

**Limit 4,5 MB potwierdzony ponownie** (`vercel.com/docs/functions/limitations`, sekcja „Request
body size", `last_updated: 2026-08-24`): to maksymalny rozmiar ciała żądania **i** odpowiedzi
funkcji, przekroczenie daje 413 `FUNCTION_PAYLOAD_TOO_LARGE`. Ta sama strona linkuje poradnik
„how to bypass the 4.5MB body size limit". Twierdzenie wtyczki Vercela o 100 MB jest nieprawdziwe —
nie planować na nim niczego.

Czyli: **większych plików nie da się wpuścić inaczej niż drogą landingu.** Retry na niższej jakości
tylko dusi rzut, a bramka `MAX_UPLOAD_BYTES` nie jest naszą decyzją.

- **Nie budujemy równoległego pipeline'u.** `@payloadcms/storage-vercel-blob` (mamy 3.73.0) ma
  opcję `clientUploads` dokładnie do tego: _„When deploying to Vercel, server uploads are limited
  to 4.5MB. Set `clientUploads` to `true` to use upload instructions and send files directly to
  Vercel Blob."_ Wiersz `media` powstaje normalnie, przez Payloada.
- **Przechodzą wszystkie powierzchnie**, nie tylko asety. `/api/upload-file` jest jedną bramą dla
  faktur transferów, wydatków i floty; zostawienie połowy z nich na starym transporcie to rozjazd,
  którego potem nikt nie scala. Jedyne miejsce wołające tę bramę to
  `src/lib/invoices/invoice-page-uploads.ts:28`, więc podmiana transportu to jedna funkcja.
- **Kompresja zostaje i przestaje być obejściem limitu.** Po zniesieniu ściany jest tym, czym
  powinna być — decyzją o jakości: faktura duszona ostro, rzut łagodnie.
- **Ryzyko do domknięcia: miniatura.** `media.upload.imageSizes` generuje `thumbnail` serwerowo,
  a przy wysyłce klient→Blob plik nie przechodzi przez serwer. Zasięg sprawdzony: **żaden kod
  aplikacji nie czyta `sizes.thumbnail`** — używa jej wyłącznie panel admina jako `adminThumbnail`.
  W najgorszym razie regresja kosmetyczna w `/admin`.
- **Autoryzacja przenosi się z `requireAuth(MANAGEMENT_ROLES)` na `media.access.create`**
  (`isAdminOrOwnerOrManager`) — te same role, inny egzekutor. Do zweryfikowania w fazie 1, nie do
  założenia.
