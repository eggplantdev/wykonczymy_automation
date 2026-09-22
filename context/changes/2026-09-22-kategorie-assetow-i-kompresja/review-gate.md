nie li# Review-gate ledger — kategorie-assetow-i-kompresja (EX-829) · 2026-09-22

Zakres: `staging...HEAD` z pominięciem `context/changes/2026-09-22-kosz-plikow/**` (dokumenty innej
zmiany, które jadą na tej samej gałęzi).

Krok 0.5 (przebieg weryfikacyjny w przeglądarce) **pominięty świadomie**: sprawdzenia ręczne tej
zmiany robione są na stagingu przez człowieka, a rejestr `manual-checks.md` ma już sekcję EX-829.

## Findings

Źródła: `impl-review` (F1–F10), `code-review`, `tailwind-v4-audit` (0 findingów),
`file-organization` (feature-first / module-cohesion / structure-scatter), `comment-noise`.

- [x] 🟡 WARNING · fixed · `src/collections/media.ts:69` · Poluzowanie `media.access.update`
      (`isAdminOrOwner` → `isAdminOrOwnerOrManager`) było dla samej funkcji **bezczynne** — akcja i tak
      woła `payload.update({ overrideAccess: true })`, a EMPLOYEE odbija się od
      `requireAuth(MANAGEMENT_ROLES)` w `protectedAction`. Kupowało za to jedno: MANAGER mógł z
      `/admin` **podmienić plik** dowolnego wiersza `media`, a podmiana kasuje poprzednie bajty
      w Blobie (`plugin-cloud-storage` `afterChange` → `handleDelete`) — czyli fakturę trzymaną na
      potrzeby podatkowe, której Blob nie odzyska. `delete` celowo nie został poluzowany z dokładnie
      tego powodu, więc `update` był sprzecznością wewnątrz jednej kolekcji. Cofnięte do
      `isAdminOrOwner` (wariant B). Oznaczanie rzutu przez MANAGERA działa bez zmian — chodzi przez
      `overrideAccess`. Wariant A (zdjęcie `overrideAccess` z akcji) odrzucony: przepisuje bramkowanie
      całej akcji, żeby odtworzyć uprawnienie, którego nikt nie zamawiał.
      test: `src/__tests__/collections/media-access.test.ts` · unit — `update` i `delete` trzymane
      na jednym `canWriteRow`, więc rozejście się tych dwóch reguł znów wywali spec

- [x] 🔴 CRITICAL · fixed · `src/lib/utils/scan-receipt-client.ts` · Skasowanie `guardSize` /
      `MAX_UPLOAD_BYTES` (plan 2.3) opierało się na „ściany 4,5 MB już nie ma" — ale ingest karmi
      **dwóch** konsumentów, a tylko jeden przeszedł na Blob. `scanReceiptClient` dalej POST-uje do
      Route Handlera `/api/extract-receipt`, więc 9 MB PDF (passthrough, nie kompresuje się) był
      ubijany przez platformę 413 zanim handler ruszył, a wiersz cicho zostawał niewypełniony.
      Bramka wróciła tam, gdzie granica faktycznie jest — sumarycznie na stronach jednego skanu.
      test: test-driven-debugging · unit — `src/__tests__/lib/utils/scan-receipt-client.test.ts`
      (>cap → odmowa przed siecią, sumowanie stron, przepuszczenie małego batcha)

- [x] 🟡 WARNING · fixed · `src/lib/utils/validate-upload-file.ts` · Bajty trafiają do Blobu **przed**
      utworzeniem wiersza, więc typ, który kolekcja odrzuca (`.docx` upuszczony na pole — `accept` to
      podpowiedź, nie bramka), zostawał zbankowanym blobem bez wiersza `media`; sprzątanie chodzi po
      wierszach, więc nic by go nie znalazło. Walidacja lustrzy `media.upload.mimeTypes`.
      test: test-driven-debugging · unit — `src/__tests__/lib/utils/validate-upload-file.test.ts`

- [x] 🟡 WARNING · fixed · `src/hooks/use-plan-marker.ts:26` · `void mark(file)` połykał odrzucenie
      transportowe (wygasłe ciasteczko, deploy skew, offline) jako unhandled rejection — żadnego
      toastu, przycisk dalej mówi „Oznacz", klik czyta się jak nieudany.
      test: test-driven-debugging · dom — `src/__tests__/hooks/use-plan-marker.test.tsx`

- [x] 🔵 OBSERVATION · fixed · `src/components/dialogs/invoice-upload-dialog.tsx:33` · Ptaszek
      „To jest rzut" przeżywał anulowany dialog (komponent zostaje zamontowany, gdy Radix odmontowuje
      treść), więc znaczył NASTĘPNY upload. Reset na `onOpenChange(false)`.
      test: test-driven-debugging · dom — nowy case w `invoice-upload-dialog.test.tsx`

- [x] 🔵 OBSERVATION · fixed · `src/lib/media/client-upload.ts:57` · `body.doc.id` na odpowiedzi `ok`
      z nieparsowalnym ciałem rzucało gołym TypeError, który caller wkłada wprost do toastu.
      test: no automated test — jednolinijkowy guard na ścieżce, której nie da się wywołać bez
      podstawienia fetcha; ryzyko niższe niż koszt harnessu

- [x] 🔵 OBSERVATION · fixed · `src/hooks/use-plan-marker.ts:37` · `router.refresh()`
      dublował rerender, który `EXPIRE_NOW` w Server Action już wymusza (EX-597) — dwa round-tripy
      za jeden efekt. Zdjęte.

- [x] 🔵 OBSERVATION · fixed · `src/app/(frontend)/api/upload-file/route.ts`, `src/lib/utils/upload-file.ts` ·
      Martwe po przejściu na transport klient→Blob (plan 1: „nie kasować, dopóki nowa ścieżka nie
      działa" — działa). Zostawał uwierzytelniony endpoint POST piszący `media` starą, 4,5 MB-ową
      ścieżką. Skasowane, nieaktualne wzmianki w `src/lib/cache/tags.ts`, `src/payload.config.ts`
      i `src/lib/utils/receipt-filename.ts` poprawione; brama: `pnpm typecheck` ✅.
      **To zamyka też finding `structure-scatter`** — `lib/media/client-upload.ts` i
      `lib/utils/upload-file.ts` były bliźniakami w konkurencyjnych domach; został jeden.

- [x] 🔵 OBSERVATION · fixed · `src/components/forms/hooks/use-file-pick-ingest.ts:29` · Parametr
      `profile` bez żadnego callera (trzy call-site'y wołają bez argumentu i żaden nie umie oznaczyć
      rzutu) — martwy seam. Zdjęty; `ingestPickedFiles` i tak domyśla `'INVOICE'`.

- [x] 🔵 OBSERVATION · fixed · `src/lib/utils/compress-image.ts:9` · Docstring twierdził, że `INVOICE`
      „keeps what faktury have always had". Nieprawda: prostokąt `1920×1080` ścinał zdjęcie poziome
      do 1440×1080, jeden `maxEdge` 1920 daje 1920×1440 — ~1,8× pikseli przy tej samej jakości. To
      cena naprawy pionowego A4 i teraz jest napisana wprost.

- [x] 🔵 OBSERVATION · fixed · `context/foundation/manual-checks.md` (EX-829) · Sprawdzenie ryzyka
      utraty miniatury celowało w `/admin`, a `MediaStrip` czyta `thumbnailUrl` i bez niego rysuje
      ikonę uszkodzonego pliku **w galerii asetów** — czyli na powierzchni, dla której ta zmiana
      powstała. Przecelowane; dołożone dwa checki pod powyższe poprawki (skan >4 MB, odrzucony typ).

- [x] fixed · `comment-noise` · 3 skasowane / 2 przycięte: `process-upload-file.ts:3` (zdanie
      restytuujące kod) i `:67` (uzasadnienie „fabryka, nie stała"), `invoice-page-uploads.ts:76`
      (domknięcie-zamiast-czwartego-parametru), `payload.config.ts:121` (narracja frameworkowa),
      `invoice-preview-dialog.tsx:44` (JSDoc `planMarker` — rationale dubluje `use-plan-marker.ts:13`,
      przycięty do niedublującego zdania). Trzy oflagowane zostawione: niosą realne „dlaczego".

- [x] dropped · `code-review` · `src/lib/media/client-upload.ts` + `src/lib/utils/validate-upload-file.ts` ·
      Sufit rozmiaru pliku (sanity ceiling zamiast skasowanego `MAX_UPLOAD_BYTES`). Guard MIME zamyka
      realny wyciek (zbankowany blob bez wiersza); sam sufit rozmiaru to **wrócenie liczby, którą plan
      świadomie skasował** — to decyzja produktowa, nie sprzątanie po review. Ryzyko, które zostaje,
      to pamięć/czas funkcji przy re-downloadzie bloba, nie osierocony plik.

- [x] dropped · `code-review` · `src/lib/media/client-upload.ts` · `del()` bloba po nieudanym
      `POST /api/media`. Token z `clientUploads` jest write-scoped na jeden klucz — kasowanie
      z przeglądarki nie jest nim autoryzowane, a sweeper to zakres siostrzanej zmiany `kosz-plikow`.

- [x] dismissed · `code-review` · `src/lib/actions/media-kind.ts:27` · Brak runtime whitelist na `kind`.
      Walidator pola `select` Payloada odrzuca wartość spoza `KIND_OPTIONS`, a `mediaId` trafia tylko
      w wiersze, które każda rola MANAGEMENT i tak czyta. Ryzyko domknięte przez framework.

- [x] dismissed · `code-review` · `src/lib/media/client-upload.ts` docstring · „bajty nie przechodzą
      przez funkcję Vercela" jest połowiczne (Payload i tak pobiera bloba do Buffera po stronie
      serwera). Zdanie mówi jednak o **request body**, i to jest prawda — limit, który zniknął, to
      limit ciała żądania. Bez zmiany.

- [x] dropped · `file-organization` · `src/__tests__/process-upload-file.test.ts` vs
      `src/__tests__/lib/utils/process-upload-file-decoders.test.ts` · Rozjazd N+1 (stary spec w
      korzeniu, nowy w mirrorze). Zastany, nie wprowadzony przez tę zmianę; przeniesienie korzeniowego
      to czysty ruch plików bez zysku dla tej zmiany.

- [x] dropped · `file-organization` · `src/hooks/use-plan-marker.ts:17` · Hook bierze `MediaFileT[]`,
      a `isMarked`/`onMark` są typowane `InvoiceFileT`, stąd `file.id as number`. Realne, ale
      uszczelnienie tego szwu to refaktor dwóch typów assetów — własny review, nie ta zmiana.

- [x] dismissed · `impl-review` F8 · `src/__tests__/collections/media-*-access.test.ts` · Plan 1.4 prosił
      o spec integracyjny, wszedł node unit. Tańsza warstwa i pokrywa to, czego integracja by nie
      dosięgła — bramkę trasy tokenowej, która nie ma własnej powierzchni HTTP. Spec fazy 4
      (`media-kind.db.test.ts`) jest realną integracją i łapie go `test-integration.sh`.

- [x] dismissed · `impl-review` F9 · `src/lib/invoices/blocked-files-message.tsx` · Plan kazał skasować,
      został zredukowany do gałęzi HEIC. Słusznie — nieodczytywalny HEIC dalej rzuca `BlockedFileError`,
      więc kasując reporter uciszyłoby się tę porażkę. Błędna była linijka planu, nie implementacja.

- [x] dismissed · `impl-review` F10 · `context/foundation/manual-checks.md` · Sekcja `kosz-plikow`
      (11 boxów) jedzie na tej gałęzi bo plik leży poza wykluczonym folderem. Nie praca tej zmiany —
      odnotowane, żeby przy archiwizacji nie policzyć jej jako zaległe QA EX-829.

- [x] dismissed · `tailwind-v4-audit` · 0 findingów w diffie. Stała (niediffowa) luka: repo nie ma
      pluginu ESLint świadomego Tailwinda — nie jest to defekt tej zmiany.
- [x] fixed · `simplify` (reuse) · `src/lib/utils/validate-upload-file.ts:5` · `isAcceptedMime` był
      bajt w bajt ciałem `isPreviewableMime` (`src/lib/media/mime.ts:14`) — trzecia kopia tego samego
      testu w repo. Zamienione na wywołanie istniejącego predykatu.

- [x] fixed · `simplify` (reuse) · `src/__tests__/collections/media-access.test.ts` · Dwa 27-linijkowe
      speki (`media-upload-access` / `media-update-access`) lustrzyły **ten sam** plik źródłowy
      i dwa razy przepisywały ten sam helper `asRequest` + `describe.each(ROLES)`. Zlane w jeden
      spec create/update/delete + token.

- [x] fixed · `simplify` (efficiency) · `src/lib/media/client-upload.ts:1` · `@vercel/blob/client`
      był importem statycznym na module, który pięć formularzy ciągnie zawsze (`inspection-form`,
      `expense-form`, `investment-form`, `edit-transfer-form`, `use-media-upload`) — ~30 KB SDK
      w bundlu nawet gdy użytkownik nigdy nie wybierze pliku. Leniwy `await import(…)` w środku
      funkcji, ta sama dyscyplina co `compress-image` / `heic-to` w `process-upload-file.ts`.

- [x] fixed · `simplify` (altitude) · `src/components/dialogs/invoice-preview-dialog.tsx:235` ·
      „Oznacz jako rzut" / „Oznaczony jako rzut" były zaszyte w **współdzielonym** dialogu, który
      pokazuje też faktury transferów — a docstring `PreviewLabelsT` mówi wprost, że każda
      powierzchnia nazywa rzeczy po swojemu. Napisy przeniesione na prop `planMarker`
      (`label` / `markedLabel`), które oddaje `usePlanMarker` przy feature'rze.

- [x] fixed · `simplify` (altitude) · `src/collections/media.ts:10` · `KIND_OPTIONS` przepisywało
      ręcznie wszystkie cztery wartości `MEDIA_KINDS`, a komentarz twierdził, że „nie mogą się
      rozjechać" — typowanie łapie wartość **błędną**, nie **brakującą**. Teraz `KIND_LABELS`
      (`Record<MediaKindT, …>`) + `map` po `MEDIA_KINDS`: piąty kind nie kompiluje się bez etykiety.
      **To zamyka też finding `simplify` o `MEDIA_KINDS` bez konsumenta** — konsument właśnie powstał.

- [x] fixed · `simplify` (altitude) · `src/lib/invoices/ingest-files.ts:22`,
      `ingest-picked-files.ts:19`, `src/lib/utils/process-upload-file.ts:95` · Domyślny `'INVOICE'`
      był powtórzony na czterech warstwach przelotowych, a wybiera go dokładnie jedno miejsce
      (`use-media-upload.ts:34`). Warstwy pośrednie mają teraz `profile?: CompressionProfileT`
      i podają `undefined` dalej; jeden dom domyślnej wartości — `compress-image.ts`, tam gdzie
      profil jest konsumowany. Spec `process-upload-file-decoders` asertował warstwę, nie
      zachowanie — przecelowany na „wybrany profil dojeżdża do kompresora".

- [x] fixed · `simplify` · `src/lib/media/client-upload.ts:24` · `data: Record<string, unknown>`
      było szersze niż jedyny caller (`{ kind }`), więc `{ knid: 'projekt' }` się kompilowało.
      Zawężone do `{ kind?: MediaKindT }`.

- [x] fixed · `simplify` · `src/components/dialogs/invoice-upload-dialog.tsx:40` · `setAsPlan(false)`
      w `handlePicked` dublował reset z nowego wrappera `onOpenChange` (bo `handlePicked` wołał
      surowy prop). Wyciągnięte do nazwanego `handleOpenChange`, jeden reset.

- [x] fixed · `simplify` · `src/hooks/use-plan-marker.ts:41` · `file.id as number` po `await`
      powtarzał guard z linii wyżej. `const id = file.id` przed guardem — zero asercji.

- [x] skipped · `simplify` (efficiency) · `src/lib/actions/media-kind.ts:30` · Jedno kliknięcie
      „Oznacz jako rzut" wygasza firmowe tagi `investments` i `leads`, a jedyny czytelnik, który się
      zmienił, to `fetchInvestmentAssets(investmentId)` (ma własny `entityTag`). Zawężenie zakresu
      rewalidacji to jednak decyzja korektowa, nie sprzątanie: nadmiarowa inwalidacja jest
      bezpieczna, niedomiar nie, a akcja jest generyczna wobec właściciela pliku. Warte zrobienia
      razem z przeglądem tagów, nie tutaj.

- [x] skipped · `simplify` (altitude) · `src/lib/invoices/invoice-page-uploads.ts:75` · `kind`
      jedzie jako domknięcie na szwie testowym `upload`, zamiast być własnym parametrem
      `resolveInvoiceMediaIds`. Realne, ale to przebudowa szwu, z którego korzysta też formularz
      wydatków — własny review. Typowanie payloadu (powyżej) zdejmuje ostrzejszą połowę ryzyka.

- [x] dropped · `simplify` (altitude) · `src/hooks/use-media-upload.ts:33` · `asPlan: boolean`
      rozwidla się na `CompressionProfileT` i `MediaKindT` w dwóch ternary obok siebie. Tabela
      `Record` byłaby dokładnie tej samej długości co dwie ternary trzy linijki od siebie — dedup
      bez zysku.

- [x] dropped · `simplify` (altitude) · jeden wspólny `MEDIA_MIME_TYPES` karmiący
      `upload.mimeTypes`, walidator i `accept`. Po powyższym dedupie zostały **dwa** domy
      (`image/*` w kolekcji i `isPreviewableMime`) i dziś mówią to samo; przeciąganie stałej przez
      graf Payloada to więcej instalacji niż zysku.

- [x] dropped · `simplify` (altitude) · `invoice-preview-dialog.tsx:234` · Ikona `DraftingCompass`
      została w dialogu. Przeniesienie jej na prop zamieniłoby hook `.ts` w `.tsx` dla jednego
      glifu.

- [x] dismissed · `simplify` (reuse) · `src/lib/media/client-upload.ts:49` · Ręczne `FormData`
      zamiast `postFormData`. `postFormData` czyta `body.error`, a REST Payloada odpowiada
      `{ errors: [{ message }] }` — reuse po cichu zdusiłby komunikat do stringa zapasowego.

- [x] dismissed · `simplify` (reuse) · `src/hooks/use-plan-marker.ts:17` · `markedIds` zamiast
      `useOptimistic` / `useMediaRemoval`. `useOptimistic` cofa się po zakończeniu tranzycji,
      a nic tu nie odświeża wiersza serwerowego — ptaszek by odskoczył.

- [x] dismissed · `simplify` (efficiency) · `src/lib/media/client-upload.ts:31,51` · Dwie
      inwokacje funkcji na plik (token + `/api/media`) zamiast jednej. Nieodłączna cena zdjęcia
      ściany 4,5 MB; `UPLOAD_CONCURRENCY = 4` dalej je ogranicza.

## Simplify pass

`/simplify` — 4 agenty (reuse / simplification / efficiency / altitude), 17 findingów: **9 fixed,
2 skipped, 3 dropped, 3 dismissed**. Wszystkie wpięte wyżej w `## Findings` z tagiem `simplify`;
osobnego raportu nie ma — ten plik jest raportem.

## Tests & suite

- Bramka całodrzewiowa przed bramką review: `pnpm typecheck` ✅ · `pnpm lint` ✅ (0 błędów, 84 ostrzeżenia zastane) · `pnpm test` ✅ 3848 passed · `pnpm build` ✅
- Po poprawkach review + `/simplify` (przebieg wiążący): `pnpm typecheck` ✅ · `pnpm lint` ✅
  (0 błędów, 84 ostrzeżenia zastane) · `pnpm test` ✅ **3862 passed** / 331 skipped · `pnpm build` ✅
- E2E **nie uruchamiane** (~1h; poza zakresem bramki).

## Stan bramki

**In review, nie Done.** Wszystkie boxy zamknięte (0 otwartych `[ ]`); zostaje jedno zobowiązanie:
sprawdzenia ręczne EX-829 w `context/foundation/manual-checks.md` są nieodhaczone — robione na
stagingu przez człowieka. Manual checks są **twardym blokerem** dla `Done` i dla archiwizacji, więc
`/10x-archive` nie jest uruchamiane.

Finding `media.access.update` domknięty wariantem B (`isAdminOrOwner`). Konsekwencja, świadomie
przyjęta: MANAGER nie edytuje wiersza `media` z `/admin` ani po REST — a wstęp tam ma
(`src/collections/users.ts:103`), więc podmiana pliku nie była ryzykiem teoretycznym. Zachowuje
upload (`create`) i przycisk „Oznacz jako rzut", bo ten idzie przez `protectedAction`. Pozostała
rozbieżność (reguła kolekcji nie opisuje tego, co pozwala aplikacja) jest systemowa, nie lokalna:
`overrideAccess: true` występuje 33× w `src/lib/actions` — reguły kolekcji bramkują `/admin` i REST,
server actions bramkują się same. Komentarz przy `overrideAccess` w `src/lib/actions/media-kind.ts`
mówi to wprost.
