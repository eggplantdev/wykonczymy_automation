nie li# Review-gate ledger — kategorie-assetow-i-kompresja (EX-829) · 2026-09-22

Zakres: `staging...HEAD` z pominięciem `context/changes/2026-09-22-kosz-plikow/**` (dokumenty innej
zmiany, które jadą na tej samej gałęzi).

Krok 0.5 (przebieg weryfikacyjny w przeglądarce) **pominięty świadomie**: sprawdzenia ręczne tej
zmiany robione są na stagingu przez człowieka, a rejestr `manual-checks.md` ma już sekcję EX-829.

## Findings

_Przycięte przy archiwizacji (2026-09-23): wypadło 21 pozycji `fixed`. Trwałym zapisem naprawy jest jej commit; tu zostaje negatyw, którego git nie trzyma — to, czego świadomie **nie** zrobiono i dlaczego. Bilans sprzed przycięcia: 21 fixed, 9 dismissed, 7 dropped, 2 skipped · 0 otwartych._

Źródła: `impl-review` (F1–F10), `code-review`, `tailwind-v4-audit` (0 findingów),
`file-organization` (feature-first / module-cohesion / structure-scatter), `comment-noise`.

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
