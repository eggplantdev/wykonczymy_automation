# Worker expense-draft send — server-side fast upload path (EX-1012) Implementation Plan

## Overview

A worker's „Wyślij" on the expense-draft dialog waits ~1.6 s of server time per photo, serialized, before
the dialog closes (6 photos: 11.9 s on Warsaw LTE, 81 % of it server time — `baseline.md`). This plan
adds a second ingest path for files ≤ 4 MB: the browser sends each file once to our own Route Handler,
in parallel; the handler sniffs the bytes, PUTs to Blob once and writes the `media` row with raw SQL.
Files above 4 MB keep today's client-upload path. Only the worker expense-draft surfaces opt in.

## Current State Analysis

- Dialog → `submitWithUploads` → `resolveUploadIds` → `resolveUploadIdRows` (4 parallel) →
  `uploadMediaFromClient`: token route → browser Blob PUT → `createMediaRow`, a page-wide serialized
  `POST /api/media` (EX-855). Server side, Payload downloads the file back from Blob, sniffs, reads
  dimensions, makes a sharp thumbnail, INSERTs, then the storage plugin re-PUTs the original + PUTs the
  thumbnail and runs a nested `payload.update` (research §2).
- `sendExpenseDraftAction` is fast (~0.2 s) and takes `mediaIds`; its CTE gates ownership on
  `media.created_by_id` (`src/lib/db/worker-expense-drafts.ts`).
- Failure cleanup is by row id: `withOrphanCleanup` → `discardOrphanedUploads` →
  `deleteOrphanedMediaAction` (EMPLOYEE: own `created_by_id` only) → `payload.delete` → plugin
  `afterDelete` deletes the blob at `<store>/<filename>`.

## Desired End State

- On the expense-draft dialog and the draft pages cell, every file ≤ 4 MB goes through
  `POST /api/media-upload`, all of them in parallel (up to the existing concurrency of 4); no token
  request, no browser Blob PUT, no serialized `/api/media`.
- The row it writes is indistinguishable for every app reader from a Payload-made one (served by
  `/api/media/file/<filename>`, `m.url` set, `created_by_id` set, `kind` kept, reclaimable by
  `payload.delete`), minus thumbnail and width/height.
- Files > 4 MB on the same surfaces, and every other upload consumer, behave exactly as today.
- Re-measured on staging with the `baseline.md` protocol; the after numbers sit next to the before.

### Key Discoveries:

- Next.js dispatches Server Actions one at a time per client (Next docs, `server-actions.mdx`
  „Sequential dispatch") → parallel uploads need a Route Handler.
- Route Handler auth pattern: `requireAuth(…)` + `NextResponse.json({error},{status:401})`
  (`src/app/(frontend)/api/read-worker-report/route.ts:32-33`); `requireAuth` reads the JWT cookie, no DB.
- Plugin Blob layout: no prefix, key = `filename`, `put(..., { access: 'public', addRandomSuffix: false,
  cacheControlMaxAge: 31536000, contentType, token })`
  (`@payloadcms/storage-vercel-blob/dist/handleUpload.js:5-12`). **@vercel/blob 0.22.3 defaults
  `addRandomSuffix` to `true`** — must be passed `false` or the key ≠ `filename` and the file 404s.
- `/api/media/file/<filename>` serves any row whose blob sits at the store root under its filename
  (`staticHandler.js:8-17`, `getFilePrefix.js:6-29`); `afterDelete` deletes by the same key.
- `media` has no `prefix` column; `filename` is UNIQUE (`media_filename_idx`). No app code reads
  `media.width/height` (HEIC backfill rows are already NULL).
- `put()` without `token` falls back to raw `process.env` — pass `serverEnv.BLOB_READ_WRITE_TOKEN`
  (store-mismatch guard lives in `src/lib/env/schema.ts:36-53`).
- A raw insert bypasses `makeRevalidateAfterChange('media')` → the route expires `CACHE_TAGS.media` with
  `revalidateTag(…, EXPIRE_NOW)` itself (Route Handler context → never `updateTag`; example
  `src/app/(frontend)/api/webhooks/landing/route.ts:98`).
- Upload plumbing is already injectable at the bottom: `resolveUploadIdRows(count, files, upload)`
  (`src/lib/media/upload-ids.ts:37-40`); `resolveUploadIds` builds the closure only when `kind` is set
  (`:86`), pinned by `upload-ids-kind.test.ts:22-35`.
- Vercel's 4.5 MB body cap applies to Route Handlers too (413 before our code). Next sets no body limit
  of its own on `request.formData()`; `src/proxy.ts` does not match `/api`.

## What We're NOT Doing

- No change to `uploadMediaFromClient`, `/api/media`, the storage plugin or `imageSizes` — the other
  eight upload consumers keep today's path (EX-1014; thumbnails EX-1013).
- No IndexedDB outbox, no optimistic close (owner, 2026-10-07).
- No thumbnail, no width/height on fast-path rows.
- No PDF xref validation (Payload's check refuses PDFs browsers open fine; the sniff confirms it is a PDF).
- No fallback from the fast path to the slow path on a fast-path failure — the error surfaces with
  today's wording and the worker retries, as today.
- No `kind` for pages added to an existing draft (today's behaviour; separate decision).
- No change to `UPLOAD_CONCURRENCY` (4) — revisit only if the after-measurement shows a second
  round of uploads costing visibly at 6 photos.
- The drafts-list-not-refreshing-after-delete bug seen during the baseline — not this change.

## Implementation Approach

One server module pair (raw insert in `src/lib/db`, route under `(frontend)/api`) and one client
function — the size router — that has the same contract as `uploadMediaFromClient`
(`(file, { kind? }) => Promise<number>`, throws `UploadRefusedError`). The router is threaded through
the existing upload chain as an optional `upload` argument, so only the two draft surfaces opt in and
every other caller is untouched. The threshold is one shared constant read by both the router and the
route.

## Critical Implementation Details

- **Ordering in the route: PUT, then INSERT; on INSERT failure, `del()` the blob.** Once the row exists
  the existing row-id cleanup covers it; before that nothing else knows the key.
- **Sniff on bytes, allowlist, not blocklist.** A small magic-number check over the first bytes —
  JPEG, PNG, WebP, GIF, HEIC/HEIF (`ftyp` brands), PDF (`%PDF-`) — decides the stored `mime_type`; the
  browser's declared type is not trusted. Anything else (SVG, HTML, unknown) → 415 with the existing
  refusal wording. Hand-rolled instead of the `file-type` package: the accepted set is six formats,
  and adding a dependency means `pnpm install`, which on this machine can break the native
  lightningcss binary (AGENTS.md › Dependencies).
- **Perf logging:** the route logs `[PERF] mediaUpload <bytes>B total=…ms put=…ms insert=…ms` with
  `perfStart()` so the after-measurement can read server time from Vercel logs, which the baseline
  could not.

## Phase 1: Server fast path

### Overview

The Route Handler and the raw `media` insert, with their specs. Nothing calls them yet.

### Changes Required:

#### 1. Shared threshold

**File**: `src/lib/media/upload-limits.ts` (new)

**Intent**: One constant both sides read, so the router and the route can never disagree on what the
fast path accepts.

**Contract**: `export const FAST_UPLOAD_MAX_BYTES = 4 * 1024 * 1024`. No `server-only`, no React.

#### 2. Raw media insert

**File**: `src/lib/db/media.ts` (new; beside `media-ownership.ts`)

**Intent**: One INSERT + row mapper that writes a row every app reader treats like a Payload one.

**Contract**: `insertMediaRow(db: DbExecutorT, row: { filename: string; mimeType: string; filesize:
number; kind: MediaKindT | null; createdById: number }): Promise<number>` — sets `url =
'/api/media/file/' + encodeURIComponent(filename)`, `created_at`/`updated_at` by default, returns `id`.

#### 3. Byte sniff

**File**: `src/lib/media/sniff-mime.ts` (new)

**Intent**: Decide the real type from the first bytes, allowlist only (see Critical Implementation
Details).

**Contract**: `sniffMime(head: Uint8Array): AllowedMimeT | null` where `AllowedMimeT` is
`'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/heic' | 'application/pdf'`.

#### 4. Route Handler

**File**: `src/app/(frontend)/api/media-upload/route.ts` (new; not under `/api/media/…`, which is the
Payload catch-all)

**Intent**: Accept one file, store it once, return its row id.

**Contract**: `POST` multipart `{ file: File, kind?: MediaKindT }` →
- 401 when `requireAuth(ROLES)` fails (every role may upload today — `media.access.create` /
  `clientUploads.access` are `isAuthenticated`);
- 400 empty / missing file or unknown `kind`; 413 when `file.size > FAST_UPLOAD_MAX_BYTES`;
  415 when `sniffMime` returns null;
- otherwise filename = `uniqueFileName(file.name)` (`src/lib/utils/unique-file-name.ts`) →
  `put(filename, bytes, { access: 'public', addRandomSuffix: false, cacheControlMaxAge: 31536000,
  contentType: sniffed, token: serverEnv.BLOB_READ_WRITE_TOKEN })` → `insertMediaRow` with
  `createdById = auth.user.id` (on failure `del(blob.url)` and 500) →
  `revalidateTag(CACHE_TAGS.media, EXPIRE_NOW)` → `200 { id }`.
- Errors go through `logError` with the `TODO(EX-449) SENTRY-REQUIRED:` marker like its neighbours.

### Success Criteria:

#### Automated Verification:

- Sniff spec passes: `pnpm exec vitest run src/__tests__/lib/media/sniff-mime.test.ts` (each allowed
  signature; SVG/HTML/`text` and a JPEG-named HTML refused)
- Insert DB spec passes: `pnpm exec vitest run src/__tests__/lib/db/media.db.test.ts` (`url`,
  `created_by_id`, `kind` persisted; `describe.skipIf(!ENV_READY)`)
- Route spec passes: `pnpm exec vitest run 'src/__tests__/app/(frontend)/api/media-upload/route.test.ts'`
  (401 / 413 / 415; success calls `put` with `addRandomSuffix: false` + token and expires the media
  tag; INSERT failure deletes the blob)

#### Manual Verification:

- Covered by Phase 2's checks (the route has no UI of its own).

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Size router on the draft surfaces

### Overview

The client router and the two opt-ins. After this phase the draft send uses the fast path.

### Changes Required:

#### 1. Client fast upload + router

**File**: `src/lib/media/upload-media.ts` (new)

**Intent**: `uploadMediaToServer(file, { kind })` posts one file to `/api/media-upload` and maps the
response onto today's refusals; `uploadMediaBySize(file, data)` picks it for `file.size ≤
FAST_UPLOAD_MAX_BYTES` and `uploadMediaFromClient` otherwise. The router is what EX-1014 reuses.

**Contract**: both `(file: File, data?: { kind?: MediaKindT }) => Promise<number>`. Runs
`uploadFileProblem` first (same as `client-upload.ts:46`); 400/413/415 → `UploadRefusedError(…,
'uploadRejected')`, any other failure → `'uploadSaveFailed'` — the exact keys `client-upload.ts:105-110`
throws, so dialogs show the same Polish text.

#### 2. Thread an optional uploader through the chain

**Files**: `src/lib/media/upload-ids.ts`, `src/lib/media/submit-with-uploads.ts`,
`src/hooks/use-media-upload.ts`

**Intent**: Let a caller choose the uploader without changing what the other callers get.

**Contract**: `resolveUploadIds(files, kind?, upload = uploadMediaFromClient)`; `submitWithUploads(files,
submit, kind?, upload?)`; `useMediaUpload({ …, upload? })`. With no `upload` passed, calls to
`uploadMediaFromClient` stay byte-for-byte as today (`upload-ids-kind.test.ts` keeps passing unchanged).

#### 3. Opt the draft surfaces in

**Files**: `src/components/worker-expenses/expense-draft-dialog.tsx`,
`src/components/worker-expenses/expense-draft-pages-cell.tsx`

**Intent**: Pass `uploadMediaBySize` from both — the send and „add pages to a pending draft".

**Contract**: one extra argument / option each; nothing else in either component changes.

### Success Criteria:

#### Automated Verification:

- Router spec passes: `pnpm exec vitest run src/__tests__/lib/media/upload-media.test.ts` (≤ threshold
  → `fetch('/api/media-upload')`, > threshold → `uploadMediaFromClient`; 413/415/500 mapping; returns
  the id)
- Chain specs pass: `pnpm exec vitest run src/__tests__/lib/media/upload-ids.test.ts
  src/__tests__/lib/media/upload-ids-kind.test.ts` (+ one case: an injected uploader receives
  `(file, { kind })`)
- Dialog spec passes: `pnpm exec vitest run src/__tests__/components/worker-expenses/expense-draft-dialog-mode.test.tsx`
  (asserts `submitWithUploads` gets the router)

#### Manual Verification:

- Staging, as a worker with a kasa and an etap: „Dodaj wydatek" → 3 phone photos → „Wyślij": the dialog
  closes in about 2–3 s, the draft shows 3 pages, each opens in the preview.
- Same worker: a draft with one page → add 2 pages from the pages cell → 3 pages, all open.
- Same worker: attach a PDF e-faktura (~100 KB) → it is sent and opens in the preview.
- Same worker: a file over 4 MB that compression cannot shrink (a large PDF) → still sent (slow path),
  opens in the preview.
- Management: convert one of these drafts into a transfer → its invoice pages show on the transfer.
- Management: delete a fast-path draft → its photos stop opening (`/api/media/file/<name>` 404) — the
  row and the blob are both gone.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: After-measurement

### Overview

Repeat `baseline.md`'s protocol on staging once this branch is deployed there (a human pushes), and
record the result. No code.

### Changes Required:

#### 1. Measurement record

**File**: `context/changes/2026-10-07-media-upload-speed/baseline.md`

**Intent**: Add an „After EX-1012" section — same fixtures, same account, Warsaw LTE + unthrottled
(Fast 4G optional), 1/3/6 photos × 3 runs, medians and per-request breakdown
(`POST /api/media-upload` durations, plus `[PERF] mediaUpload` lines from the Vercel logs) — and a
before/after row in the summary table.

**Contract**: section heading `## After EX-1012`; summary table gains the after columns.

### Success Criteria:

#### Automated Verification:

- None — measurement phase (the protocol is in `baseline.md`).

#### Manual Verification:

- The staging deployment's sha is the merged EX-1012 commit (checked via `gh api` per
  `context/reference/manual-verification.md`).
- 6 photos on Warsaw LTE: median well under the 11.9 s baseline (estimate 2–3 s); if not, the
  per-request breakdown names where the time went before anything else is changed.

---

## Testing Strategy

### Unit Tests:

- `sniffMime`: every allowed signature; truncated input; HTML/SVG/plain text; HTML with a `.jpg` name.
- Route (mocked `put`/`del`, `getCurrentUserJwt`, DB): auth, size, sniff, `put` options, tag expiry,
  INSERT-failure cleanup.
- Router: threshold boundary (exactly 4 MB → fast), refusal mapping, slow path delegation.

### Integration Tests:

- `insertMediaRow` against the 5435 test DB; plus one assertion that `sendExpenseDraftAction`'s
  ownership CTE accepts a row made by `insertMediaRow` for the same worker
  (`src/__tests__/lib/actions/worker-expense-drafts-worker.db.test.ts`, swap its local `insertMedia`
  helper for the real one in one case).

### E2E:

- No Playwright spec exists for the worker draft flow. Browser-level risk (client → route → Blob → DB →
  action) is owed per AGENTS.md › Testing: defer it into the E2E backlog (Linear, label `e2e-backlog`)
  at the review gate; the staging after-measurement exercises the same path end to end meanwhile.

## Performance Considerations

- Per file the server now does: JWT decode, read ≤ 4 MB into memory, sniff, one Blob `put`, one INSERT,
  one tag expiry. Four concurrent invocations hold ≤ 16 MB of file bytes — fine on Fluid Compute.
- Blob advanced ops per image drop from 3 to 1.
- `getPayload()` (for `getDb`) is a cold-start cost on the first request of a fresh instance; the
  existing AI routes pay the same.

## Migration Notes

- No schema change, no migration. Fast-path rows have NULL thumbnail/width/height columns.
- Revert = revert the Phase 2 commit; rows already written stay valid.

## Whole-tree Gate

Run once, after the final code phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Integration suite passes: `pnpm test:integration` (only when the user asks for the full suites —
  per standing instruction the agent runs touched specs + typecheck only)

## References

- Research: `context/changes/2026-10-07-media-upload-speed/research.md` (§1–§8 + Follow-up)
- Baseline: `context/changes/2026-10-07-media-upload-speed/baseline.md`
- Route pattern: `src/app/(frontend)/api/read-worker-report/route.ts`
- Plugin Blob layout: `node_modules/@payloadcms/storage-vercel-blob/dist/handleUpload.js:5-12`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Server fast path

#### Automated

- [x] 1.1 Sniff spec passes — cb41cdec
- [x] 1.2 Insert DB spec passes — cb41cdec
- [x] 1.3 Route spec passes — cb41cdec

### Phase 2: Size router on the draft surfaces

#### Automated

- [x] 2.1 Router spec passes
- [x] 2.2 Chain specs pass
- [x] 2.3 Dialog spec passes

### Phase 3: After-measurement

#### Automated

- [ ] 3.1 None — measurement phase
