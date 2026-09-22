---
date: 2026-09-22T09:11:11+0200
researcher: ex-Plant
git_commit: 7e59637739c5d2085d16ba4a38b35250d53846e2
branch: empty-preset-create
repository: wykonczymy
topic: 'Kategorie assetów inwestycji (media.kind) i profil kompresji per powierzchnia'
tags: [research, codebase, media, upload, compression, leads, investments]
status: complete
last_updated: 2026-09-22
last_updated_by: ex-Plant
---

# Research: kategorie assetów i kompresja

**Data**: 2026-09-22T09:11:11+0200
**Badacz**: ex-Plant
**Commit**: `7e59637739c5d2085d16ba4a38b35250d53846e2`
**Gałąź**: `empty-preset-create`

## Pytanie badawcze

Jak zapisywać `media.kind` ze ścieżki uploadu (tak, żeby AI mogło znaleźć rzut zamiast przeszukiwać
wszystkie zdjęcia) i gdzie jest pokrętło kompresji, żeby asety inwestycji przestały być duszone
profilem zaprojektowanym dla faktur.

## Podsumowanie

Trzy rzeczy, z których dwie zmieniają kształt planu:

1. **Informacja o kategorii już istnieje w każdym miejscu wgrywania — jest wyrzucana.** Dziewięć
   powierzchni dzieli się czysto: trzy są jednoznacznie fakturowe, cztery są genuinely mieszane.
   Żadna nie przekazuje tego dalej: `uploadFile` woła `payload.create` z `data: {}`.
2. **Kategoria i profil kompresji przechodzą przez DOKŁADNIE tę samą rurę.** Obie potrzebują wartości
   „per powierzchnia" przepchniętej przez te same cztery warstwy klienckie. To jest techniczne
   uzasadnienie trzymania ich w jednej zmianie — nie tylko tematyczne.
3. **Najcenniejsze rzuty wchodzą ścieżką, która NIE MA uploadu.** Plan z landingu przyjeżdża
   webhookiem, bez kompresji (jedyne nieskompresowane oryginały w systemie), z `kind` świadomie
   pustym — a do inwestycji trafia przez **promocję leada**, czyli przepięcie istniejącego wiersza,
   bez żadnego dialogu, który mógłby o cokolwiek zapytać. Projekt oparty wyłącznie na „użytkownik
   wybiera przy wgrywaniu" nie obejmie tych plików.

## Szczegółowe ustalenia

### A. Inwentarz powierzchni wgrywania

Dziewięć wejść, trzy potoki klienckie zbiegające się w jednym Route Handlerze.

| #   | Powierzchnia                              | Wejście                                                                                       | Czym plik JEST                         | Jednoznaczna?                  |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------ |
| 1   | Faktura transferu — komórka tabeli        | `src/components/transfers/invoice-cell.tsx:18`                                                | faktura / paragon                      | **tak**                        |
| 2   | Faktura transferu — dialog edycji         | `src/components/forms/edit-transfer-form/…:215`                                               | faktura                                | **tak**                        |
| 3   | Wydatek — FV przy pozycji + skan zbiorczy | `src/components/forms/form-fields/line-item-invoice-field.tsx:60`, `line-items-field.tsx:390` | paragon / faktura zakupowa             | **tak**                        |
| 4   | Asety inwestycji — karta inwestycji       | `src/components/investments/investment-assets.tsx:82`                                         | cokolwiek                              | **nie**                        |
| 5   | Asety inwestycji — dialog edycji          | `src/components/forms/investment-form/investment-assets-field.tsx:24`                         | cokolwiek                              | **nie**                        |
| 6   | Asety inwestycji — dialog dodawania       | `src/components/forms/investment-form/investment-form.tsx:161`                                | cokolwiek                              | **nie**                        |
| 7   | Załączniki przeglądu floty                | `src/components/forms/inspection-form/inspection-form.tsx:234`                                | zwykle faktura/polisa, pole generyczne | **wąsko mieszana**             |
| 8   | Zdarzenia sprzętowe                       | —                                                                                             | protokół przekazania                   | brak UI, tylko panel           |
| 9   | Asety leada — webhook landingu            | `src/app/(frontend)/api/webhooks/landing/route.ts`                                            | cokolwiek                              | **nie**, i nie ma kogo zapytać |

Do tego **#11 — promocja leada na inwestycję**: `promote-lead-dialog.tsx:112`,
`src/lib/actions/lead-assets.ts:65`. Nie tworzy mediów — ten sam wiersz zaczyna być wskazywany
i przez `leads.assets`, i przez `investments.assets`.

Potwierdzone negatywnie: webhook Facebook Leads **nie jest ścieżką medialną** (Meta dostarcza same
pola formularza), tak samo `wpforms` i wszystkie crony. `POST /api/extract-receipt` (skan AI) wysyła
bajty i **nic nie zapisuje**.

### B. Ścieżka zapisu — gdzie wpiąć `kind`

Upload **nie jest** ani Payloadowym RESTem, ani server action. To własny Route Handler:

```
uploadFileClient          src/lib/invoices/invoice-page-uploads.ts:23   ← FormData budowane TU
  POST /api/upload-file   src/app/(frontend)/api/upload-file/route.ts:18
    uploadFile            src/lib/utils/upload-file.ts:21
      payload.create({ collection: 'media', file: {…}, data: {} })      ← `data: {}` to cała strata
```

Konsekwencja: **nie ma części `_payload`** — ta konwencja należy do endpointu `POST /api/media`,
którego ta aplikacja nie używa. `kind` jedzie jako zwykłe pole FormData.

Trzy edycje są mechaniczne (`formData.set('kind', …)`, odczyt + walidacja whitelisty w handlerze,
`data: kind ? { kind } : {}`). Koszt jest w **przepchnięciu wartości od powierzchni w dół** — każda
warstwa po drodze jest dziś bezmetadanowa:

```
useMediaUpload({ attach, successMessage })      src/hooks/use-media-upload.ts:30
  submitWithInvoicePages(files, attach)         src/lib/invoices/submit-with-invoice-pages.ts:46
    resolveInvoicePageIds(files)
      resolveInvoiceMediaIds(count, map, upload) src/lib/invoices/invoice-page-uploads.ts:45
        uploadFileClient(file)
```

Tańszy szew: `resolveInvoiceMediaIds` **już ma wstrzykiwalny parametr `upload`** (linia 48, dziś
używany wyłącznie przez testy). Domknięcie po `kind` wchodzi tamtędy bez dokładania parametru do
trzech warstw. Potok C (formularz wydatku, `submitWithInvoicePageRows`) przechodzi przez tę samą
funkcję, więc szew obsługuje wszystkie trzy potoki.

**Kontrola dostępu — asymetria do rozstrzygnięcia.** `uploadFile` woła Local API **bez `user` i bez
`req`**, czyli z domyślnym `overrideAccess: true` — dostęp kolekcji w ogóle nie strzela. Realną
bramką jest `requireAuth(MANAGEMENT_ROLES)` w handlerze. Ale `media.access.update` to
`isAdminOrOwner` (`src/collections/media.ts:61-66`), więc **MANAGER ustawi `kind` przy tworzeniu,
a potem nie poprawi go w panelu.** Walidacja whitelisty czterech wartości musi stać w handlerze,
bo pod `overrideAccess` nic innego jej nie zrobi.

### C. Kompresja — łańcuch, pokrętła, promień rażenia

```
processUploadFile(file, deps)            src/lib/utils/process-upload-file.ts:105
  ├─ deps.compressImage(file)            → compress-image.ts:9
  ├─ deps.convertHeicToJpeg(file)        → compressToJpeg / heicTo(HEIC_DECODE_QUALITY = 0.92)
  └─ guardSize(file)                     → process-upload-file.ts:98
```

Stałe (`src/lib/utils/compress-image.ts:4-6`): `MAX_WIDTH = 1920`, `MAX_HEIGHT = 1080`,
`QUALITY = 0.6`. `quality` jest już parametrem z domyślną wartością — ale `defaultDeps` woła
`m.compressImage(file)` **na goło** (`:75`), więc 0.6 jest efektywnie zaszyte. `MAX_WIDTH`/
`MAX_HEIGHT` nie mają parametru w ogóle.

`defaultDeps` (`:74`) to **stała obiektowa na poziomie modułu** — profil nie ma którędy wejść, więc
musi się stać fabryką. To jest jedyny nietrywialny kawałek przepięcia.

Podział pod schemat „domyślnie 1920/0.6, asety wybierają 2560/0.8":

| Wołający                    | Plik                                                        | Profil       |
| --------------------------- | ----------------------------------------------------------- | ------------ |
| `useInvoiceUpload`          | `src/hooks/use-invoice-upload.ts:7`                         | domyślny     |
| `useInvestmentAssetsUpload` | `src/hooks/use-investment-assets-upload.ts:10`              | **2560/0.8** |
| `useFilePickIngest`         | `src/components/forms/hooks/use-file-pick-ingest.ts:43`     | domyślny     |
| `useInvoiceFiles`           | `src/components/forms/expense-form/use-invoice-files.ts:70` | domyślny     |

**Tylko jeden hook wybiera nowy profil, i obsługuje obie powierzchnie asetów** (#4 i #5 to jedno
`useInvestmentAssetsUpload` zamontowane dwa razy). Koszt siedzi w rurze, nie w wołających.

Uwaga: bajty z formularza wydatku czyta też ekstrakcja skanu (`process-upload-file.ts:1-4, 33-35`),
więc ruszanie tam jakości byłoby decyzją o OCR, nie kosmetyką. Pod tym schematem zostaje domyślne.
`HEIC_DECODE_QUALITY = 0.92` to pokrętło **dekodowania** i zostaje nieruszone — istnieje właśnie po
to, żeby prawdziwą jakość ustawiał dopiero przebieg `compressImage`.

### D. Bramka 4 MB — sprawdzona, nie założona

`MAX_UPLOAD_BYTES = 4 * 1024 * 1024` (`process-upload-file.ts:8`), strzela w `guardSize` **zawsze po
kompresji**, w trzech wyjściach `processUploadFile` (`:109`, `:119`, `:122`). Surowe 12 MB zdjęcie,
które skompresuje się do 1 MB, przechodzi; PDF (nigdy nie kompresowany) mierzy się w surowej postaci.

Użytkownik widzi jeden 8-sekundowy toast z linią na plik: „Plik „X" przekracza 4 MB — zmniejsz go
i spróbuj ponownie" (`src/lib/invoices/blocked-files-message.tsx:28`). **Nie ma drugiego przebiegu
z niższą jakością** — odbicie jest ostateczne.

**Premisa zweryfikowana w dokumentacji Vercela** (`/docs/functions/limitations`, aktualizacja
2026-08-24): limit ciała żądania i odpowiedzi funkcji to **nadal 4,5 MB**, błąd 413
`FUNCTION_PAYLOAD_TOO_LARGE`. Komentarze w repo są prawdziwe. (Wiedza o „100 MB" wstrzyknięta do
sesji przez plugin Vercela **nie znajduje potwierdzenia** — nie planować na niej.)

`serverActions.bodySizeLimit: '4.5mb'` (`next.config.ts:15`) dotyczy **wyłącznie server actions**
(potwierdzone w docsach Next), a upload idzie Route Handlerem — więc tej ścieżki nie ogranicza
i jego podniesienie niczego nie zmieni.

**Dlaczego landing ma 8 MB, a my nie możemy.** Landing wysyła plik **z przeglądarki prosto do Bloba**
przez token (`landing_26/app/api/blob/upload-token/route.ts:29`) — ciało żądania nigdy nie przechodzi
przez funkcję. My przepychamy każdy bajt przez `/api/upload-file`, więc 4,5 MB jest ścianą. „Pójście
drogą landingu" to zatem **dwie różne decyzje**: same stałe kompresji, albo stałe **plus** tryb
wysyłki.

### E. Model z landingu — co warto podkraść poza liczbami

`landing_26/src/lib/contact/compress-image.ts` (48 linii wobec naszych 70):

- **`MAX_EDGE = 2560` jako jedno ograniczenie na obie osie**, z komentarzem, który na to zarabia:
  pudełko 1920×1080 wymiaruje stronę **portretową** po wysokości, więc rzut A4 spada do ~93 DPI
  i gubi opisy wymiarów. To jest argument przeciw naszemu 1920×1080 **niezależny od kwestii jakości**.
- **`run(file, options)`** — jeden prywatny helper zamiast dwóch bliźniaczych bloków `new Compressor`.
  Sprowadza „dodaj parametr profilu" do jednej edycji zamiast dwóch.
- `isRasterImageType` wyciągnięty do wspólnego domu zamiast inline'owego testu MIME (`compress-image.ts:10` u nas).
- **Brak pętli schodzącej po jakości** — jedno przejście, a bramka stoi osobno i później. Tak samo u nas.
- HEIC: ta sama konstrukcja co nasza (Safari canvas, fallback `heic-to` WASM, `0.92`).

Czego **nie** kopiować: ich sufit 8 MB (patrz §D), ich bramka zwracająca klucz zamiast rzucanego
`BlockedFileError`, ich inline'owy `mapWithConcurrency` (u nas to współdzielony util).

### F. Pokrycie testami

| Plik                                                              | Co pilnuje                                                                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/__tests__/lib/utils/compress-image.test.ts`                  | nazwy plików, błąd enkodera, pominięcie PDF. **Nie sprawdza 1920/1080/0.6** — obiekt opcji jest przechwytywany i nigdy nie asertowany |
| `src/__tests__/process-upload-file.test.ts:67,79`                 | bramka rozmiaru, granica włącznie                                                                                                     |
| `src/__tests__/lib/utils/process-upload-file-decoders.test.ts:51` | asertuje argument jakości dekodowania HEIC                                                                                            |
| `e2e/invoice-ingest.spec.ts:120`                                  | EX-460 — HEIC i plik >4 MB nie wchodzą do formularza                                                                                  |

**Same wartości pokręteł są niestrzeżone** — zmiana stałych nie wywróci dziś żadnego testu. To jest
luka do domknięcia przy okazji, nie po niej.

## Wnioski architektoniczne

**Obie zmiany to ten sam problem: powierzchnia wie coś, czego rura nie przenosi.** `kind` i profil
kompresji potrzebują wartości „per powierzchnia" przepchniętej przez `useMediaUpload` →
`submitWithInvoicePages` → `resolveInvoicePageIds` → `resolveInvoiceMediaIds`. Robienie tego dwa razy
osobno to dwa razy ta sama operacja na tych samych czterech plikach. Trzymanie ich razem jest
uzasadnione technicznie, nie tylko tematycznie.

**Jednoznaczność powierzchni jest własnością powierzchni, nie użytkownika.** Trzy powierzchnie
fakturowe mogą ustawiać `kind: 'faktura'` **bez pytania** — i powinny, bo pytanie tam byłoby szumem.
Pytanie ma sens wyłącznie na #4/#5/#6. To jest dokładnie to, co właściciel rozstrzygnął.

**Ale sama ścieżka uploadu nie wystarczy do celu z AI.** `context/foundation/lessons.md` (wpis
z 2026-09-21) ustala, że pliki wgrane **przez aplikację** są nieodwracalnie zduszone do 763×1080
w portrecie, a tylko te z **landingu** zachowują piksele. Czyli najlepsze możliwe wejście dla AI —
nieskompresowany rzut z formularza landingowego — trafia do inwestycji ścieżką #11 (promocja leada),
która **nie tworzy mediów i nie ma dialogu wgrywania**. Bez sposobu na ustawienie `kind` na
istniejącym wierszu ten plik zostanie `NULL` na zawsze, a AI go nie znajdzie.

## Referencje w kodzie

- `src/lib/utils/upload-file.ts:41` — `data: {}`, miejsce, w którym ginie kategoria
- `src/lib/invoices/invoice-page-uploads.ts:23-32,45-48` — budowa FormData + wstrzykiwalny szew `upload`
- `src/app/(frontend)/api/upload-file/route.ts:18-38` — jedyna uwierzytelniona brama do `media`
- `src/lib/utils/compress-image.ts:4-6` — trzy stałe do sparametryzowania
- `src/lib/utils/process-upload-file.ts:74-95,98-103,105` — `defaultDeps` do zamiany na fabrykę, bramka
- `src/collections/media.ts:9-14,61-66,68-73` — enum `kind`, dostęp kolekcji, pole bez `access`
- `src/lib/media/relating-collections.ts:19-24` — mapa pole→kolekcja (5 relacji)
- `src/lib/leads/fetch-landing-asset.ts:79,103-113` — świadome `data: {}`, `MAX_ASSET_BYTES = 8MB`
- `src/lib/actions/lead-assets.ts:65`, `src/components/leads/promote-lead-dialog.tsx:112` — przepięcie bez tworzenia mediów
- `next.config.ts:15` — `bodySizeLimit`, nie dotyczy tej ścieżki

## Kontekst historyczny

- `context/foundation/lessons.md` — „The »original« in Blob is only original for files the LANDING
  uploaded": zapisuje zniszczenie portretowego A4 i mówi wprost, że **poluzowanie kompresji to osobna
  zmiana, nie pokrętło**. Ta zmiana jest wykonaniem tamtego zdania.
- Commit `8c5885f0` „feat(lead-delivery): media.kind + delete safety (p1)" (EX-802) — dodał nullowalny
  enum `kind`, `MEDIA_RELATIONS` i `preventReferencedMediaDelete`. Pole istnieje od 2026-09-21
  i **nigdy nie było zapisywane przez aplikację**.
- `context/foundation/manual-checks.md:468` — jedyne miejsce w `context/`, gdzie „Projekt" występuje
  jako wartość tego pola; to sprawdzenie panelu admina. Zero kolizji z glosariuszem domeny.

## Pytania otwarte

1. **Czy `kind` da się ustawić na wierszu, który nie powstał przez dialog wgrywania?** Dotyczy
   **przyszłych** promocji leada, nie starych plików — backfill jest odrzucony na stałe
   (`change.md`, „Rozstrzygnięcie stałe"). Lead promowany jutro przyniesie wiersz media utworzony
   jutro, z `kind = NULL`, ścieżką bez żadnego dialogu. Dodatkowo blokuje to
   `media.access.update = isAdminOrOwner` — MANAGER nie poprawi kategorii po fakcie.
2. **Czy „droga landingu" to same stałe, czy też tryb wysyłki?** 2560/0.8 pcha pliki w stronę ściany
   4,5 MB, a odbicie jest ciche i ostateczne. Klient-do-Bloba usuwa ścianę, ale to wyraźnie większa
   zmiana.
3. **Czy #7 (przeglądy floty) dostaje kategorię?** Pole jest generyczne („Załączniki"), ale formularz
   ma `cost` / `insurer` / `policyNumber`, więc w praktyce to najczęściej faktura.
4. Ile realnie ważą typowe rzuty po `2560/0.8` — do zmierzenia na prawdziwych plikach, nie do
   oszacowania.
