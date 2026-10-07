---
date: 2026-10-07T09:56:04+02:00
researcher: Claude (Opus 5.5)
git_commit: 6d64a524
branch: staging
repository: wykonczymy
topic: "Why the worker invoice-draft send is slow, and how to cut it without an offline outbox"
tags: [research, media, upload, vercel-blob, payload, worker-expense-drafts, performance]
status: complete
last_updated: 2026-10-07
last_updated_by: Claude (Opus 5.5)
last_updated_note: "Follow-up: owner discussion — direction changed to a server-side fast path; open questions answered"
---

# Research: Speeding up the worker invoice-draft send

> **Direction changed after this research (2026-10-07 discussion).** Options A/B/C and the open
> questions below are kept as the record of what was weighed; the chosen design is in
> **Follow-up — owner discussion** at the end and in `change.md`. Option B's batch tokens + `head()`
> registration is **not** the plan any more.

**Date**: 2026-10-07T09:56:04+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 6d64a524 (`staging`, read via `git show staging:<path>` — the working tree was on an unrelated spike)
**Repository**: wykonczymy

## Research Question

On the worker's expense-draft dialog, „Wyślij" takes a long time before the dialog closes. What is being
done, and how do we make it substantially faster — **without** an IndexedDB outbox / optimistic close
(owner ruling 2026-10-07)? Direction to evaluate: one server action that registers the media rows
together with the draft, batch-minted upload tokens, measurement.

## Summary

- The dialog closes after `await submit()` (`src/components/worker-expenses/expense-draft-dialog.tsx`),
  i.e. after every photo's full upload pipeline **and** the action. `router.refresh()` runs after close.
  Compression (HEIC→JPEG, 1920px q0.6) happens at pick time, not at submit. The AI read runs in
  `after()` and does not delay the response (prod `[PERF] sendExpenseDraftAction` = 68 ms).
- **The cost is `POST /api/media`, once per photo, serialized page-wide** (`createMediaRow` queue,
  `src/lib/media/client-upload.ts`, added in `b78d1c7d` for EX-855). Prod log gaps between consecutive
  rows: **~1.6–2.9 s per photo** (2026-10-07, start-to-start, includes the client round trip).
- Per photo the server does: JWT user lookup → `head()` + **full download of the blob back into the
  function** → file-type sniff + PDF check → `image-size` → filename-uniqueness SELECT → **sharp
  400×300 thumbnail** → INSERT → revalidate `media` → plugin `afterChange` **re-PUTs the original**
  (unconditionally, `clientUploadContext` is ignored) **and PUTs the thumbnail** → a nested
  `payload.update` that always runs (SELECT, lock `deleteMany`, UPDATE, afterRead, revalidate #2) →
  COMMIT. Bytes cross the network three times; 3 Blob advanced ops per image.
- Before that, each photo also costs a token request to `/api/vercel-blob-client-upload-route`
  (function invocation + JWT DB lookup; minting itself is local HMAC) and very likely a no-op
  `blob.upload-completed` callback invocation.
- **The proposed direction is sound for drafts**: register `media` rows inside the action as an extra
  data-modifying CTE in the existing single-statement `insertWorkerExpenseDraft`. One statement is
  atomic whichever Neon connection runs it, so it cannot be scattered across connections the way a
  Payload transaction is. It can still be absorbed into another request's open transaction on a
  shared connection (the EX-855 pool hazard is app-wide for raw statements), so the
  page-wide serialization can go for this path. What the redesign must take over from Payload, and the
  one new hole it opens (blobs with no row on failure), are listed below.

## Detailed Findings

### 1. Client path (staging)

- `expense-draft-dialog.tsx` → `submitWithUploads` (`src/lib/media/submit-with-uploads.ts`) →
  `resolveUploadIds` → `resolveUploadIdRows` (`src/lib/media/upload-ids.ts`, `UPLOAD_CONCURRENCY = 4`
  for Blob PUTs) → `uploadMediaFromClient` (`src/lib/media/client-upload.ts`): `upload()` from
  `@vercel/blob/client` with `handleUploadUrl` = token route, then `createMediaRow` → serialized
  `POST /api/media` with a JSON `file` field carrying `clientUploadContext`.
- Compression at pick: `useFilePickIngest` (`src/components/forms/hooks/use-file-pick-ingest.ts`) →
  `ingestPickedFiles` → `processUploadFile`; INVOICE profile `{ maxEdge: 1920, quality: 0.6 }`
  (`src/lib/utils/compress-image.ts:16`). PDFs pass through uncompressed.
- Edit path (adding pages to an existing draft): `ExpenseDraftPagesCell` → `useMediaUpload`
  (`src/hooks/use-media-upload.ts`) → same pipeline → `addExpenseDraftPagesAction`. Pages added there
  get no `kind` (the dialog stamps `'faktura'`).

### 2. Server path of `POST /api/media` (node_modules: payload 3.73.0, plugin-cloud-storage 3.73.0, storage-vercel-blob, @vercel/blob 0.22.3)

1. Auth: JWT strategy `findByID` on the user (`payload/dist/auth/strategies/jwt.js:67`).
2. `addDataAndFileToRequest.js:43-81` → upload handler = `storage-vercel-blob/dist/staticHandler.js`:
   `head()` (`:17`) + full fetch of the public URL with `?uploadedAt` (`:55`, likely a cache miss) →
   `Buffer.from(await response.arrayBuffer())`.
3. `create` → `generateFileData`: `checkFileRestrictions` (byte sniff + PDF xref check — source of the
   „PDF with no xref" 400), `getImageSize`, `getSafeFileName` (DB lookup), `createImageSizes` (sharp
   thumbnail, `media.ts` `imageSizes`). Main sharp pipeline skipped (no resize/format options), so the
   original bytes are unchanged. INSERT.
4. `afterChange`: `makeRevalidateAfterChange('media')`, then the plugin hook
   (`plugin-cloud-storage/dist/hooks/afterChange.js`): `getIncomingFiles` returns original + thumbnail
   with no `clientUploadContext` check → `svb/handleUpload.js` `put()` for both (original overwritten
   at the same key; 0.22.3 sends no `allowOverwrite`, prod shows it succeeds).
5. `handleUpload` returns the whole `data`, so the hook always calls `req.payload.update(...)`
   (`afterChange.js:42-50`). `req.file` is reset by `local/update.js:13`, so no second sharp/PUT —
   incidental, not designed. Still: SELECT, `checkDocumentLockStatus` → `deleteMany`, UPDATE,
   afterRead, revalidate #2. Local data: `updated_at` lands 0.9–1.5 s after `created_at`. This is the
   write that logged „Failed to persist upload data" under EX-855.

Per image: 3 PUTs (1 browser, 2 server), 1 `head()`, 1 full GET, ~7–9 SQL statements, 2
revalidations, sharp CPU. PDF: 2 PUTs, no thumbnail, the rest the same.

### 3. The action (`src/lib/actions/worker-expense-drafts.ts`, staging)

- `sendExpenseDraftAction`: zod → `sessionAction` (JWT only, `[PERF]` logging, `getPayload`) →
  `findDraftTargetError` (2 sequential reads: `listWorkerStageInvestments`, `isWorkerLiveRegister`) →
  `insertWorkerExpenseDraft` → `after(() => readExpenseDraftReceipts(db, draftId))`. No revalidation.
- `insertWorkerExpenseDraft` (`src/lib/db/worker-expense-drafts.ts:138-167`) is **one CTE statement**:
  `pages_in` joins `media m ON m.created_by_id = workerId` (ownership gate), inserts the draft only if
  every id matched, then `worker_expense_draft_media (draft_id, media_id, position)`.
- `readExpenseDraftReceipts` (`src/lib/actions/read-expense-draft-receipts.ts`) downloads each page
  from the Blob public URL and calls the LLM; needs `filename` + `mime_type`; never throws.
- Next 16.1.7 `after()` runs after the response is finished in Server Functions (docs via Context7,
  `after.mdx`); confirmed in prod by the 68 ms action.

### 4. Upload tokens

- Token route: `storage-vercel-blob/dist/getClientUploadRoute.js` → `handleUpload` from
  `@vercel/blob/client`; `onUploadCompleted` is a no-op, but the token still embeds `callbackUrl`, so
  Blob should call back once per file (UNVERIFIED that it fires).
- Batch-minting is possible: `generateClientTokenFromReadWriteToken` (`@vercel/blob/dist/client.js:285`)
  is a local HMAC, one token per `pathname`, options `maximumSizeInBytes`, `allowedContentTypes`,
  `validUntil`. **Trap: default `validUntil` is now + 30 s** (`client.js:258-270`) — a slow phone
  upload needs it set explicitly. Browser side: client `put(pathname, file, { access: 'public', token,
  contentType })`. Omitting `onUploadCompleted` drops the callback invocation.
- Minting must stay behind the same gate as today (`clientUploads.access: isAuthenticatedBoolean`,
  opened to EMPLOYEE in EX-971).

### 5. What a raw `media` insert must reproduce

Columns (`20260211_212425.ts:36-57` + `kind` in `20260921_0_media_kind.ts`): `filename` is UNIQUE.

- `url` = `/api/media/file/<encodeURIComponent(filename)>` — raw SQL readers select `m.url`
  (`src/lib/queries/media.ts:33`, `src/lib/db/worker-expense-drafts.ts:55,213`,
  `src/lib/db/telmak-check.ts:31`). Payload's own reads regenerate it from `filename`.
- `created_by_id` (a field hook today) — the draft's ownership join depends on it; inside the same CTE
  the join must read the new rows' `RETURNING`, not `media` (one snapshot per statement).
- `filename`, `mime_type`, `filesize`, `kind`; timestamps default.
- **Expire `CACHE_TAGS.media` inline** in the action (`fetchAllMedia` is tagged with it; lesson „No
  second exit via `after()`" — not in `after()`).
- Lost vs Payload: width/height, focal point, thumbnail, server-side byte sniff/PDF check. Thumbnails
  are read by `worker-reports.ts:276`, `queries/investment-assets.ts:20`, `queries/leads.ts:78`,
  `media-strip.tsx:85-96` (shows `ImageOff` when missing) — **not** by draft reads.
- Integrity: the client mints the key (`uniqueFileName`). The action must `head()` each key (exists,
  size, content-type within limits) and rely on `filename` UNIQUE so a forged second row cannot point
  at someone else's blob (which reclaim would later delete). `head()` content-type is the browser's
  claim, not a sniff.

### 6. Failure cleanup — the new hole

- Today every blob has a row before the action runs: `withOrphanCleanup` → `discardOrphanedUploads` →
  `deleteOrphanedMediaAction` (EMPLOYEE filtered to own uploads) → `reclaimUnreferencedMedia` →
  `payload.delete` → plugin `afterDelete` deletes blob + thumbnail. **Every blob delete goes through a
  row.**
- Rows created inside the action ⇒ a refused/failed send leaves PUT blobs with no row, invisible to all
  current cleanup. There is no orphan-sweep cron (`/api/cron/cleanup` purges snapshots/trash only).
  Needed: a key-based discard (`del()` by pathname) that refuses any key with a `media` row and only
  accepts keys minted for the caller (e.g. a per-user prefix in the minted pathname), or accept a small
  leak as with today's 400 case (`validate-upload-file.ts` notes it).
- Lesson „A raw table that holds media ids…": drafts are already registered in `findReferencedMedia` /
  `preventReferencedMediaDelete`; nothing new there unless a new table appears.

### 7. Other consumers of the same pipeline

| Caller | Action | Link |
|---|---|---|
| `expense-draft-dialog.tsx` | `sendExpenseDraftAction` | raw CTE `worker_expense_draft_media` |
| `expense-draft-pages-cell.tsx` (`useMediaUpload`) | `addExpenseDraftPagesAction` | raw CTE, same table |
| `scan-report-dialog.tsx` (`'inne'`) | `createScannedReportAction` | raw CTE `worker_report_media` |
| `expense-form.tsx` (`submitWithUploadRows`) | `createBulkTransferAction` | Payload `transactions.invoice` in `withPayloadTransaction` |
| `edit-transfer-form.tsx` | `updateTransferAction` | Payload update |
| `invoice-cell.tsx`, `telmak-check.tsx` (`useInvoiceUpload`) | `addTransferInvoicesAction` | `setUploadField` |
| `inspection-form.tsx` | `createInspectionAction` | Payload `vehicle-inspections.attachments` |
| `investment-form.tsx` | `createInvestmentAction` | Payload `investments.assets` |
| `investment-assets-control.tsx`, `investment-assets-field.tsx` | `addInvestmentAssetsAction` | `setUploadField` |

The two raw-CTE paths (drafts, scanned report) take the raw-insert design directly. The Payload paths
run inside `withPayloadTransaction`, i.e. the EX-855 hazard is theirs regardless; investment assets
need thumbnails (MediaStrip).

## Options for the plan

- **A — trim Payload's waste, keep `POST /api/media` (all consumers benefit).** Wrap the Blob adapter's
  `handleUpload` so a file carrying `clientUploadContext` is not re-PUT and returns nothing (kills the
  original re-upload **and** the nested `payload.update`); batch tokens. Keeps thumbnails and the byte
  check, keeps the serialization (EX-855) and the download + sharp. Smaller, global, partial win.
- **B — raw registration in the action (drafts + scanned report).** Batch tokens → parallel PUTs →
  one action: `head()` all keys in parallel, one CTE inserting `media` + draft + pages, expire
  `CACHE_TAGS.media`. No download, no sharp, no server PUTs, no serialization. Needs the key-based
  discard (§6) and test rework (§8). Biggest win on the reported path.
- **C — B for the two raw-CTE paths, A for the Payload paths.** Likely the right end state; A alone is
  a reasonable first slice if the plan wants the global win first.

Expected effect (estimate, to verify): 3 photos today ≈ token RTT + parallel PUTs + 3 × ~2 s
serialized; with B ≈ 1 token RTT + parallel PUTs + one action (~0.2–0.5 s with parallel `head()`).

## Measurement

- `[PERF] <label> Nms` from `sessionAction` reaches Vercel runtime logs (`src/lib/actions/run-action.ts`,
  `src/lib/perf.ts`). Nothing times `/api/media` or the token route (Payload endpoints).
- `vercel logs --json` (CLI linked + authenticated) has timestamps and status but no duration; the
  per-row figure above is from start-to-start gaps (raw dumps were in the session scratchpad, not kept).
- Before/after on staging: devtools Network for one 3-photo send (token, PUT, `/api/media`, action
  timings), or a client-side `performance.now()` around `submitWithUploads` logged once.

## Historical Context

- `context/archive/2026-09-22-kategorie-assetow-i-kompresja/change.md:78-103` (`ccef8024`): client→Blob
  because of Vercel's 4.5 MB function body cap; the row stays created by Payload to reuse the plugin.
  **Raw SQL was never weighed.** Its premise „no app code reads `sizes.thumbnail`" is now stale.
- `context/archive/2026-09-18-lead-delivery/change.md:70-104`: one generic `media` collection so one
  reference scan drives reclaim.
- Worker report scan research (`a61123c8^:context/changes/2026-10-05-worker-report-scan/research.md`):
  recommended creating the report and its media links in one action to shrink the orphan window.
- `b78d1c7d` (serialized row creates), `c32e0c8f` (its manual checks closed), EX-855 (Backlog — adapter
  fix not landed; `payload.config.ts` still a plain `vercelPostgresAdapter`).
- `context/reference/blob-recovery-runbook.md` §2: `put`/`copy`/`list` are advanced ops, `del` free;
  account now on a paid plan.

## Tests that pin today's contract

- `src/__tests__/lib/media/client-upload.test.ts` — serialized `createMediaRow`, continue after failure,
  Polish refusal wording.
- `upload-ids.test.ts`, `upload-ids-kind.test.ts` — positional ids, `MediaUploadError.uploadedIds`,
  `kind` stamping.
- `lib/actions/worker-expense-drafts-worker.db.test.ts`, `lib/db/worker-expense-drafts.db.test.ts:152`
  — seed `media` by raw INSERT and pass `mediaIds` (action input contract), foreign-page refusal.
- `delete-orphaned-media.db.test.ts` — EMPLOYEE own-files filter.
- `expense-draft-dialog-mode.test.tsx` (mocks `submitWithUploads`), `expense-draft-pages-cell.test.tsx`.
- Manual checks to keep passing: `context/foundation/manual-checks.md` b78d1c7d block (bulk expense
  with 4 invoiced rows, 10 photos to a gallery, no „Failed to persist upload data") and the EX-971 /
  EX-1001 / EX-1005 draft checks.

## Open Questions

1. Is losing the server-side byte sniff / PDF xref check acceptable for drafts? (A broken PDF would
   then surface only at the AI read, which never throws.)
2. Orphan blobs on a failed send: key-based discard, or accept the leak like today's 400 case?
3. Scope of the first slice: drafts only (B), drafts + scanned report, or A globally first (C)?
4. Does Blob actually fire the no-op upload-completed callback per file? (Cost only, not correctness.)
5. Advanced-ops allowance on the current paid plan — informational; B cuts 3 PUTs/photo to 1.

## Follow-up — owner discussion (2026-10-07)

### Where the thumbnails came from

- `imageSizes: [{ name: 'thumbnail', 400×300 }]` + `adminThumbnail: 'thumbnail'` arrived in `5d72f612`
  (2026-02-11, „add more collections") — the first scaffold of `media`, Payload's template for the
  **admin panel's** list thumbnail. The panel is unused. Nobody chose it for the app.
- For ~7 months nothing in the app read `sizes.thumbnail`; every upload paid sharp + a thumbnail PUT.
- **Today the only screen that DISPLAYS it is `MediaStrip` (`media-strip.tsx:85`), and `MediaStrip` is
  rendered only in the lead dialogs** — `lead-answers-dialog.tsx:42`, `lead-assets-dialog.tsx:186,215`,
  `promote-lead-dialog.tsx:112`. `queries/investment-assets.ts:20` and `db/worker-reports.ts:276`
  SELECT `sizes_thumbnail_url`, but their screens render through `MediaPreviewButton` → the shared
  preview modal, which loads the original via `next/image`. (The §7 / Summary claim that investment
  assets need thumbnails was wrong.) `scripts/backfill-heic-media.ts:408` is a one-off.
- The re-PUT of the original and the nested `payload.update` are not a thumbnail cost and not a repo
  choice: `plugin-cloud-storage`'s `afterChange` ignores `clientUploadContext`, and the Blob adapter's
  `handleUpload` returns `data`, so the update always runs.
- Dropping `imageSizes` globally removes only sharp + one PUT per image — not the download-back, the
  re-PUT, or the nested update. Side effects to handle in that change: lead tiles would lose their
  image (→ owner ruling below), and the plugin's `afterDelete` deletes `doc.sizes[*].filename` from the
  CURRENT schema, so already-stored thumbnails are left in Blob when their row is deleted (small,
  acceptable or a one-off sweep); `sizes_thumbnail_*` columns can stay or be dropped (destructive:
  push first, migrate after; two SELECTs read them).

### Why the server downloads the file back (the „third step")

Payload's upload pipeline assumes the file arrives **in the request body**: validate bytes → read
dimensions → thumbnails → write to storage. Vercel caps a function body at 4.5 MB, so `clientUploads`
(EX-829, `kategorie-assetow-i-kompresja`) sends the bytes browser → Blob directly and the server only
gets a note „I uploaded X". Payload then runs the **same** pipeline, which needs bytes, so it fetches the
file back from Blob (`payload/dist/utilities/addDataAndFileToRequest.js:43-81` → adapter
`staticHandler`), runs the steps, and the plugin's `afterChange` — not knowing the file is already
there — PUTs it again plus the thumbnail. The detour was right for plans and big PDFs and wrong for a
compressed faktura photo of a few hundred KB, which never came near 4.5 MB. Owner verdict: an absurd
pipeline to pay for here; „one pipeline for everything" was the mistake. Precisely: **one storage model
is right** (one `media` table, one `/api/media/file/…` route, one reclaim) and stays; **one ingest path
for every file size** is what was wrong.

### Byte-check risk (asked, then made moot)

Weighed for the token + `head()` design, where the server never holds the bytes. `checkFileRestrictions`
does: (1) content sniff vs declared type — the only real risk: a logged-in worker bypassing the app
could store HTML/SVG and have an OWNER open it; mitigated by `allowedContentTypes` (no SVG) +
`maximumSizeInBytes` on the token and a `head()` check; residual = garbage labelled `image/jpeg`,
renders broken, no script runs; (2) PDF xref check — today it refuses some PDFs browsers open fine;
(3) executable blocklist — covered by the type allowlist. **Moot under the chosen design**: the fast
path receives the bytes, so it sniffs them (`file-type`) for free.

### Next.js detail that shapes the design

Server Actions invoked from one client run **one at a time** (the router's action queue), so N
parallel action calls would queue. Parallel per-photo uploads therefore go through a **Route Handler**,
not a Server Action. (Verify against the Next 16.1 docs at plan time.)

### Decisions (owner, 2026-10-07)

- **Scope: worker expense drafts only** („dodawanie zgłoszeń przez pracowników"), needed ASAP. Other
  forms and the thumbnail removal are separate, later changes.
- **No IndexedDB / optimistic close.**
- **Two ingest paths, chosen by file SIZE, not type.** ≤ 4 MB (every compressed photo, most PDFs — an
  e-faktura is ~100 KB) → fast path: one request per file to our server → byte sniff → one Blob `put()`
  → raw-SQL `media` row (no Payload upload pipeline, no thumbnail). > 4 MB → today's client-upload
  path, unchanged. Routing by type would send a 100 KB PDF down the slow path for nothing. The router
  is one shared function, so the other-forms change reuses it.
- **Failure cleanup stays by row id.** Every fast-path file has its `media` row as soon as it is
  stored, so `withOrphanCleanup` → `deleteOrphanedMediaAction` keeps covering a failed send; the
  key-based discard from §6 is not needed.
- **Baseline first, before any code**, measured by the agent — preferably on staging (most realistic:
  Neon + Vercel + Blob latencies), a local production build (`next build && next start`) acceptable.
  The same protocol after the change.
- **Lead dialogs (separate change):** no per-file pick any more — every lead file goes to the
  inwestycja; the dialogs get a „Zobacz" button into the shared preview modal, where a file can be
  removed from the lead before it is added. `MediaStrip` + pick plumbing go, then `imageSizes` /
  `adminThumbnail`.
- **Other forms (separate change):** reuse the size router; the > 4 MB path there should stop
  downloading the file back (register the row from `head()`), and/or wrap the adapter's `handleUpload`
  to skip the re-PUT (option A).

### Answers to the open questions above

1. Byte check — kept: the fast path holds the bytes.
2. Orphan blobs — no new hole: rows exist per file before the send action; cleanup by row id.
3. Scope — drafts only (the scanned report and the rest go with the other-forms change).
4. Upload-completed callback — irrelevant on the fast path (no client token).
5. Advanced ops — fast path: 1 `put` per file instead of 3.
