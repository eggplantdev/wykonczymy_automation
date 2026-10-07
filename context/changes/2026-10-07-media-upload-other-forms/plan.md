# Every Upload Form on the Size Router — Implementation Plan

## Overview

EX-1012 gave the worker expense-draft dialog a fast upload path: a file up to 4 MB goes to our own
Route Handler once, which sniffs it, inserts the `media` row with raw SQL and PUTs to Blob — no
Payload upload pipeline, one request per file, in parallel. Every other upload form in the app still
takes the slow client-upload path. This change routes **every** upload through the same size router
(Phase 1) and replaces the slow path's Payload registration for files above 4 MB with a
`head()`-based register route (Phase 2), so no path the app uses runs the serialized
`POST /api/media` queue any more. Phases 0 and 3 measure the same three scenarios before and after,
with the EX-1012 protocol.

## Current State Analysis

- `uploadMediaBySize` (`src/lib/media/upload-media.ts`) routes on `file.size <= ROUTE_BODY_MAX_BYTES`
  (4 MiB, `src/lib/constants/route-body.ts`): small → `uploadMediaToServer` → `POST /api/media-upload`;
  large → `uploadMediaFromClient` (`src/lib/media/client-upload.ts`).
- Only two call sites opt into it, by passing it explicitly as the uploader:
  `expense-draft-dialog.tsx:121-125` and `expense-draft-pages-cell.tsx:43-46`.
- Every other consumer resolves to the default uploader, `uploadMediaFromClient`, through
  `resolveUploadIdRows` / `resolveUploadIds` (`src/lib/media/upload-ids.ts:41,86`):
  - `submitWithUploadRows` → `expense-form.tsx:235` (bulk expense)
  - `submitWithUploads` → `edit-transfer-form.tsx:101`, `inspection-form.tsx:96`,
    `investment-form.tsx:92`, `scan-report-dialog.tsx:129` (kind `inne`)
  - `useMediaUpload` (`src/hooks/use-media-upload.ts:36`) → `useInvoiceUpload` (invoice-cell,
    telmak-check) and `useInvestmentAssetsUpload` (investment-assets-control,
    investment-assets-field); `asPlan` gives kind `projekt`
- The slow path: plugin token route → browser `upload()` → `createMediaRow`, which serializes every
  `POST /api/media` through `rowCreateQueue` (the EX-855 patch: parallel Payload writes on Neon lose
  rows). Each `POST /api/media` downloads the blob back, sniffs, builds a sharp thumbnail, re-PUTs
  original + thumbnail and runs a nested `payload.update` — ~1.6 s per file, one at a time
  (EX-1012 baseline).
- Client-side type check: `uploadFileProblem` (`src/lib/utils/validate-upload-file.ts:12`) accepts
  anything `isPreviewableMime` accepts — every `image/*`, SVG and BMP included. The fast path's server
  sniff (`sniffMime`, `src/lib/media/sniff-mime.ts:30`) refuses SVG/BMP, so today an SVG under 4 MB
  would be refused **after** upload while one over 4 MB would be stored.

## Desired End State

- Every upload form uses `uploadMediaBySize` with no per-call opt-in: ≤ 4 MB via
  `POST /api/media-upload`, > 4 MB via browser PUT + `POST /api/media-register`.
- No app path calls `POST /api/media`; `createMediaRow`, `rowCreateQueue` and `postMediaRow` are gone.
- A file outside the sniff allowlist (jpeg, png, webp, gif, heic, avif, tiff, pdf) is refused at pick
  time with the existing „nie zdjęcie ani PDF" message, and again by the server on both paths.
- `baseline.md` holds before/after medians for the three scenarios under both profiles.
- The manual-checks registry section for EX-1014 covers every upload surface.

### Key Discoveries:

- `insertMediaRow` (`src/lib/db/media.ts`) already writes the row the fast path needs, including
  `createdById` and `kind`; the register route reuses it unchanged.
- `media.filename` carries `media_filename_idx` UNIQUE (`src/migrations/20260211_212425.ts:76`), so a
  second registration of the same blob fails at the insert — that is the signal the blob belongs to a
  row and must not be deleted.
- `blobPublicUrl` + `blobStoreIdOf` (`src/lib/media/blob-public-url.ts:4,10`) build the public URL the
  register route `head()`s and Range-GETs.
- `@vercel/blob` 0.22.3 `head(url, { token })` returns `size`, `uploadedAt`, `contentType`,
  `pathname`; it throws `BlobNotFoundError` for a missing blob.
- Next.js runs one client's Server Actions sequentially, which is why both upload endpoints are Route
  Handlers, not actions (EX-1012).
- The plugin's token route (`clientUploads.access: isAuthenticatedBoolean`) sets no
  `allowedContentTypes` and no size cap; `onUploadCompleted` is a no-op. That stays as is — the type
  gate is the register route's sniff.

## What We're NOT Doing

- Thumbnails / `imageSizes` / the lead dialogs' `MediaStrip` — EX-1013. Files uploaded through the
  new paths get no thumbnail, exactly like EX-1012's; only `MediaStrip` renders one and lead files do
  not come through these forms.
- Minting our own client-upload token with `allowedContentTypes` / `maximumSizeInBytes`.
- Any change to `UPLOAD_CONCURRENCY` (4) or to compression at pick time.
- IndexedDB / optimistic close.
- EX-855's root cause (Payload transactions on Neon) — this change only stops the app's paths from
  hitting it.
- Removing `POST /api/media` — Payload owns it and the admin panel still uses it.

## Implementation Approach

Phase 1 is a pure default flip plus the narrower client type check: every path already threads an
uploader through `resolveUploadIds*`, so changing the default and deleting the opt-ins moves all
forms at once. Phase 2 swaps only the large-file branch's registration step, keeping the browser PUT,
so the 4.5 MB body cap is never in play. Both phases leave the call sites' contracts (`number` id
per file, `MediaUploadError` with `uploadedIds`, `withOrphanCleanup`) untouched, so the forms need no
edits beyond dropping the explicit uploader.

## Critical Implementation Details

**Register route — when it may delete a blob.** The route only ever deletes a blob it refused, and
only when three things hold: the blob is fresh (`head().uploadedAt` within the last hour), no
`media` row names it in `filename` **or** `sizes_thumbnail_filename`, and the refusal came from the
sniff (or a non-UNIQUE insert failure). A stale blob, a UNIQUE violation, or a filename some row
references is answered with an error and left alone. Production holds tax-retained invoices with no
Blob versioning, and the route takes a client-supplied filename — this guard is what keeps a crafted
request from deleting one.

**Stored MIME comes from the sniff**, never from `head().contentType` (that is whatever the browser
declared). Stored `filesize` comes from `head().size`.

**Theoretical race:** another authenticated user who guesses the random suffix of a blob in flight
could register it first. The key is `uniqueFileName`'s random suffix; accepted as negligible for five
internal users.

## Phase 0: Baseline Before

### Overview

Measure the three scenarios on the current staging deploy, before any EX-1014 code, with the
EX-1012 harness. The other forms are unchanged on staging, so staging is the honest "before".

### Changes Required:

#### 1. Baseline document

**File**: `context/changes/2026-10-07-media-upload-other-forms/baseline.md`

**Intent**: Record the before-numbers in the same shape as EX-1012's `baseline.md` (summary table,
protocol table, per-profile run tables, per-request step table, caveats, cleanup), so Phase 3 appends
an "After EX-1014" section and a before → after summary.

**Contract**: Protocol —
- Target: staging (`wykonczymy-git-staging-…vercel.app`), deployment id + commit recorded; preview DB
  and preview Blob.
- Account: the fixed staging OWNER (`pnpm qa:staging-user`), desktop viewport 1440 × 900.
- Profiles: Warsaw LTE (latency 50 ms, down 20 Mbps, up 10 Mbps) and unthrottled (CDP set explicitly),
  each in a freshly launched browser; throttle re-applied at the start of every run.
- Runs: 1 warm-up (discarded) + 3 runs per scenario per profile; report medians and the per-request
  breakdown (`request.timing()`: token, Blob PUT, `POST /api/media`, the form's action).
- Fixtures: synthetic files only (no PII) — the EX-1012 JPEGs in `.playwright-mcp/bl/` and one
  generated ~6 MB PDF. Harness: a standalone Playwright script in the session scratchpad (not the
  shared MCP browser).
- Scenarios and windows:
  1. **Bulk expense, 4 invoiced rows** — management „Dodaj wydatek" form, 4 rows each with one JPEG
     invoice; t0 = capture-phase click on submit, t1 = dialog closed.
  2. **10 photos into an investment gallery** — investment page, gallery add control; t0 =
     `setInputFiles`, t1 = success notice shown.
  3. **One PDF over 4 MB onto a transfer's invoice** — transfers table invoice cell on a test
     transfer; t0 = `setInputFiles`, t1 = success notice shown.
- Records are tagged `EX-1014 baseline …` on one test investment of the preview DB and removed
  through the UI afterwards; cleanup is recorded.

### Success Criteria:

#### Automated Verification:

- `baseline.md` exists with medians for 3 scenarios × 2 profiles (3 runs each) and a per-request
  breakdown

#### Manual Verification:

- None — measurement only.

**Implementation Note**: When this phase's automated verification passes, commit and continue — do
**not** pause for per-phase manual confirmation.

---

## Phase 1: Fast Path Everywhere

### Overview

Make `uploadMediaBySize` the only uploader and refuse unsniffable types before upload.

### Changes Required:

#### 1. Default uploader

**File**: `src/lib/media/upload-ids.ts`

**Intent**: `resolveUploadIdRows` and `resolveUploadIds` upload through `uploadMediaBySize`; the
injectable `upload` parameter goes, since no production caller passes anything else after this change.

**Contract**: `resolveUploadIdRows(count, files)` and `resolveUploadIds(files, kind?)`. The
`MediaUploaderT` type stays only if something still needs it after the removal. The comment at
`upload-ids.ts:9` that names `createMediaRow` is rewritten to the router's two paths.

#### 2. Remove the uploader threading

**Files**: `src/lib/media/submit-with-uploads.ts`, `src/hooks/use-media-upload.ts`,
`src/components/worker-expenses/expense-draft-dialog.tsx`,
`src/components/worker-expenses/expense-draft-pages-cell.tsx`

**Intent**: Drop the `upload` parameter / option and the two explicit `uploadMediaBySize` opt-ins —
the default now does it.

**Contract**: `submitWithUploads(files, submit, kind?)`, `useMediaUpload({ attach, successMessage })`.

#### 3. Client type check on the sniff allowlist

**Files**: `src/lib/media/sniff-mime.ts`, `src/lib/utils/validate-upload-file.ts`

**Intent**: Export the allowlist as one constant array (derive `AllowedMimeT` from it) and have
`uploadFileProblem` refuse a declared type outside it with the existing `uploadNotImageOrPdf` key, so
an SVG/BMP/ICO is refused at pick time on both paths. `isPreviewableMime` stays as is — the preview
dialog uses it.

**Contract**: `export const ALLOWED_UPLOAD_MIMES` (readonly tuple) in `sniff-mime.ts`, still free of
server-only imports so the client bundle can take it.

#### 4. Specs

**Files**: `src/__tests__/lib/media/upload-ids.test.ts`, `upload-ids-kind.test.ts`,
`src/__tests__/lib/utils/validate-upload-file.test.ts`,
`src/__tests__/components/worker-expenses/expense-draft-dialog-mode.test.tsx`, plus any
`submit-with-uploads` / `use-media-upload` spec the parameter removal breaks

**Intent**: Uploader injection becomes `vi.mock('@/lib/media/upload-media')`; assert the forms reach
`uploadMediaBySize` with the right `kind`; `validate-upload-file` gains SVG, BMP, ICO refused and
jpeg/png/heic/pdf accepted.

### Success Criteria:

#### Automated Verification:

- Upload-ids specs pass: `pnpm exec vitest run src/__tests__/lib/media/upload-ids.test.ts src/__tests__/lib/media/upload-ids-kind.test.ts`
- Validation spec passes: `pnpm exec vitest run src/__tests__/lib/utils/validate-upload-file.test.ts`
- Draft dialog spec passes: `pnpm exec vitest run src/__tests__/components/worker-expenses/expense-draft-dialog-mode.test.tsx`
- No production file passes an uploader any more: `grep -rn "uploadMediaBySize" src --include='*.tsx'` returns nothing outside `__tests__`

#### Manual Verification:

- See Phase 3 — every surface is checked once, after both code phases.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Register Files Above 4 MB from `head()`

### Overview

Replace the large-file branch's Payload registration with our own route: the browser keeps its PUT,
the server registers the row from `head()` + a 1 KB Range GET.

### Changes Required:

#### 1. Register route

**File**: `src/app/(frontend)/api/media-register/route.ts`

**Intent**: Turn a freshly PUT blob into a `media` row without the Payload pipeline, mirroring
`api/media-upload/route.ts` (auth, status codes, Polish refusal text, `revalidateTag(CACHE_TAGS.media,
EXPIRE_NOW)`, `[PERF] mediaRegister` log with head / range / insert timings).

**Contract**: `POST` JSON `{ filename: string, kind?: MediaKindT }`.
- `requireAuth(ROLES)` → 401.
- Body invalid, or `filename` containing `/` → 400.
- `head(blobPublicUrl(storeId, filename), { token })`; `BlobNotFoundError` → 400; `uploadedAt` older
  than one hour → 400 (never deletes).
- Range GET `bytes=0-1023` of the public URL → `sniffMime`; `null` → 415 „To nie jest zdjęcie ani PDF",
  after the guarded delete below.
- `insertMediaRow(db, { filename, mimeType: sniffed, filesize: head.size, kind, createdById })` → 200
  `{ id }`. UNIQUE violation on `media_filename_idx` → 409, no delete. Other failure → 500 after the
  guarded delete.
- Guarded delete: `del(url, { token })` only if no `media` row has this name in `filename` or
  `sizes_thumbnail_filename` (one statement in `src/lib/db/media.ts`).

#### 2. Client large-file branch

**File**: `src/lib/media/client-upload.ts`, `src/lib/media/upload-media.ts`

**Intent**: After `upload()` resolves, `uploadMediaFromClient` POSTs `{ filename, kind }` to
`/api/media-register` and returns its id. `createMediaRow`, `rowCreateQueue` and `postMediaRow` are
deleted. The response → id / refusal mapping that `uploadMediaToServer` already does (400/409/413/415 →
`uploadRejected`, other → `uploadSaveFailed`, no id → `uploadNoFileReturned`) is shared by both
paths, not copied.

**Contract**: `uploadMediaFromClient(file, data?)` keeps its signature and its `Promise<number>`.

#### 3. Specs

**Files**: new `src/__tests__/app/(frontend)/api/media-register/route.test.ts`; rewritten
`src/__tests__/lib/media/client-upload.test.ts`; `src/__tests__/lib/media/upload-media.test.ts` if the
shared mapper moves; `src/__tests__/lib/db/media.db.test.ts` for the new reference-check statement

**Intent**: Route spec (mocked `@vercel/blob` `head`/`del`, `fetch`, DB) covers 401, bad filename,
missing blob, stale blob (no `del`), refused type with no row (`del` called), refused type whose
filename a row holds (no `del`), UNIQUE violation (409, no `del`), success (row carries the sniffed
type, `head.size`, `kind`, creator; tag revalidated). Client spec: PUT then register, no `/api/media`
call, status mapping. DB spec: the reference check finds a name in either column.

### Success Criteria:

#### Automated Verification:

- Route spec passes: `pnpm exec vitest run "src/__tests__/app/(frontend)/api/media-register/route.test.ts"`
- Client-upload + upload-media specs pass: `pnpm exec vitest run src/__tests__/lib/media/client-upload.test.ts src/__tests__/lib/media/upload-media.test.ts`
- Media DB spec passes against the 5435 test DB: `pnpm exec vitest run src/__tests__/lib/db/media.db.test.ts`
- `createMediaRow` / `rowCreateQueue` are gone: `grep -rn "createMediaRow\|rowCreateQueue" src` returns nothing

#### Manual Verification:

- See Phase 3.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Baseline After + Manual Checks

### Overview

Repeat Phase 0 against the branch preview and write the broad manual-check section.

### Changes Required:

#### 1. After-measurement

**File**: `context/changes/2026-10-07-media-upload-other-forms/baseline.md`

**Intent**: Same protocol, fixtures, profiles and scenarios as Phase 0, against the branch preview
(same preview DB / Blob). Append an "After EX-1014" section plus a before → after summary table,
`[PERF] mediaUpload` / `mediaRegister` server timings from `vercel logs`, and cleanup.

**Contract**: Pushing the branch to get its preview needs the user's explicit go at that moment —
ask, don't push.

#### 2. Manual-checks registry

**File**: `context/foundation/manual-checks.md`

**Intent**: Add `## EX-1014 — media-upload-other-forms` with every bullet below, in the registry's
Polish UI vocabulary.

### Success Criteria:

#### Automated Verification:

- `baseline.md` has the after-section with medians for 3 scenarios × 2 profiles and a before → after table
- `manual-checks.md` has the EX-1014 section

#### Manual Verification:

Staging (or the branch preview), konto OWNER, chyba że napisano inaczej. Zdjęcia z telefonu albo
JPEG-i ~300 KB; „duży plik" = PDF powyżej 4 MB.

- Wydatek zbiorczy: 4 wiersze, każdy z fakturą → zapis: 4 transakcje, każda faktura otwiera się w podglądzie.
- Wydatek zbiorczy: wiersz z fakturą wielostronicową (3 zdjęcia) i wiersz z PDF → zapis: strony w dobrej kolejności, PDF się otwiera.
- Wydatek zbiorczy z dużym plikiem w jednym z wierszy → zapis się udaje (wolniej), duży PDF się otwiera.
- Edycja transakcji: dodaj stronę faktury i usuń inną → zapis: zostaje właściwy zestaw stron.
- Tabela transakcji → komórka faktury: dodaj zdjęcie, potem duży PDF → oba widoczne i otwierają się.
- Telmak: dodaj fakturę PDF → zapisana i otwiera się.
- Inspekcja: dodaj kilka załączników → po zapisie wszystkie się otwierają.
- Nowa inwestycja z plikami w formularzu → po zapisie pliki są w galerii inwestycji.
- Galeria inwestycji: dodaj 10 zdjęć naraz → wszystkie 10 w galerii, żadne nie zginęło.
- Galeria inwestycji: dodaj plik jako „projekt" (rzut) → ląduje jako projekt, nie jako zwykłe zdjęcie.
- Edycja inwestycji → pole plików: dodaj i usuń plik → zapis zgadza się z tym, co widać.
- Raport ze skanu: dodaj zdjęcia → raport zapisany, zdjęcia się otwierają.
- Plik SVG (i SVG przemianowany na `.jpg`) w dowolnym z tych miejsc → odrzucony z komunikatem „to nie jest zdjęcie ani PDF", nic nie zostaje zapisane.
- Usuń transakcję z fakturą (mały plik) i drugą z dużym PDF → stary link do pliku daje 404 w obu przypadkach.
- Dwie karty naraz: w każdej dodaj 5 zdjęć do galerii (jedna z nich z dużym plikiem) → wszystkie pliki są w galerii, w logach Vercela brak „Failed to persist upload data".
- Okno leada (zgłoszenie z Facebooka) z plikami → miniatury wyglądają jak dotąd.
- Konto pracownika: „Dodaj wydatek" z 3 zdjęciami → „Wyślij" działa jak po EX-1012; dodanie stron do oczekującego zgłoszenia działa.

**Implementation Note**: The manual bullets above are rolled into the registry by this phase itself;
`/10x-implement` must not add a second EX-1014 section.

---

## Testing Strategy

### Unit Tests:

- Size router as the only uploader: `resolveUploadIds*` reach `uploadMediaBySize` with `kind`.
- Pick-time type gate: SVG / BMP / ICO refused; jpeg, png, webp, heic, pdf accepted.
- Register route: every refusal branch, and specifically that `del` is never called for a stale blob,
  a referenced filename or a UNIQUE violation.

### Integration Tests:

- `media.db.test.ts`: the reference check sees a filename in `filename` and in
  `sizes_thumbnail_filename`.

### Manual Testing Steps:

Phase 3's list — every upload surface, both paths, the type gate, deletion 404s, the two-tab EX-855
regression, lead thumbnails and the EX-1012 worker flows.

E2E: the browser-level risk (a form → upload route → row → revalidated page) is deferred to the
`e2e-backlog` at the review gate, as EX-1012's was (EX-1016).

## Performance Considerations

- ≤ 4 MB: one request per file, up to `UPLOAD_CONCURRENCY` in parallel, ~0.9 s server time each
  (EX-1012 `[PERF] mediaUpload` p50) instead of ~1.6 s serialized.
- > 4 MB: token + PUT unchanged; registration becomes `head()` + 1 KB Range GET + one INSERT
  (expected well under 0.5 s) instead of a full download, thumbnail and re-PUT of a multi-MB file.

## Migration Notes

No schema change. Rows created by the new paths have empty `sizes_thumbnail_*`, like EX-1012's. A
rollback is a revert: old rows stay valid either way.

## Whole-tree Gate

Run once, after the final code phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit + integration suites pass: `pnpm test` / `pnpm test:integration` — only when the user asks for
  the full suites; per standing instruction the agent runs touched specs + typecheck only

## References

- EX-1012 change (fast path, router, baseline protocol): `context/changes/2026-10-07-media-upload-speed/`
- Pattern to mirror: `src/app/(frontend)/api/media-upload/route.ts`
- Row insert: `src/lib/db/media.ts`
- Linear: EX-1014 (this change), EX-1013 (thumbnails), EX-855 (Payload writes on Neon), EX-1016 (EX-1012 E2E backlog)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 0: Baseline Before

#### Automated

- [x] 0.1 baseline.md has before-medians for 3 scenarios × 2 profiles with per-request breakdown

### Phase 1: Fast Path Everywhere

#### Automated

- [ ] 1.1 Upload-ids specs pass
- [ ] 1.2 Validation spec passes
- [ ] 1.3 Draft dialog spec passes
- [x] 1.4 No production file passes an uploader — 434b9e45

### Phase 2: Register Files Above 4 MB from head()

#### Automated

- [ ] 2.1 Route spec passes
- [ ] 2.2 Client-upload + upload-media specs pass
- [ ] 2.3 Media DB spec passes
- [x] 2.4 createMediaRow / rowCreateQueue are gone — 8f1f3574

### Phase 3: Baseline After + Manual Checks

#### Automated

- [ ] 3.1 baseline.md has the after-section and before → after table
- [x] 3.2 manual-checks.md has the EX-1014 section — 81e2a1be
