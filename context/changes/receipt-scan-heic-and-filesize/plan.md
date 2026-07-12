---
change_id: receipt-scan-heic-and-filesize
title: EX-457 receipt-scan HEIC handling + file-size hardening
status: planned
created: 2026-07-12
updated: 2026-07-12
---

# EX-457 — Receipt-scan HEIC handling + file-size hardening

## Overview

Two coupled problems on the expense receipt-scan / upload path:

1. **HEIC (iPhone) images are broken.** Canvas can't decode HEIC on Chrome/Firefox, so
   `compressImage` (`src/lib/utils/compress-image.ts:9`) treats them as non-images and passes the raw
   HEIC through. The result: broken invoice previews, sharp-derivative failures (NULL dimensions), and
   an unreliable model-extraction path (Gemini's HEIC support is flaky via the OpenRouter proxy). 17
   such records already exist in the DB.
2. **File-size handling is misleading and unguarded.** `next.config.ts:12` advertises a `10mb`
   server-action body limit while Vercel hard-caps request bodies at **4.5 MB** (platform-level
   `413 FUNCTION_PAYLOAD_TOO_LARGE`, thrown before our code runs — uncatchable server-side). There is
   no client-side guard, so an oversize file fails opaquely.

Plus two structural cleanups the path has accreted: **double compression** (every file is compressed
once for extraction and again for upload) and a **dead `mediaId` cache** left over from the abandoned
upload-once refactor.

## Decisions (settled)

- **HEIC conversion is client-side, at ingest**, native-first: CompressorJS forces JPEG output on
  Safari (canvas decodes HEIC via the OS HEVC codec); a **lazy-loaded WASM decoder (`heic-to`)** is
  the fallback for Chrome/Firefox. Both ship in **this** change.
- **When conversion fails entirely** (non-Safari and WASM unavailable/failed): **block the file** with
  a clear Polish message — never store a broken HEIC.
- **Backfill of the 17 existing HEIC records is OUT of scope**, deferred behind a **Vercel Blob
  backup** shipping first (no mutating existing blobs without a safety net). File as a follow-up.
- Reject oversize PDFs (>4.5 MB after processing) with a per-item Polish message — same guard path as
  images. (User confirmed real-world PDFs won't breach; the guard is the safety net, not the common case.)

## Current State

- `src/lib/utils/compress-image.ts` — CompressorJS wrapper. `isImage` = `type.startsWith('image/')`
  only (a HEIC with an **empty** `File.type`, which Chrome/FF often report, slips through as
  non-image). No `mimeType` option → output type mirrors input → HEIC re-encode is a no-op. `catch`
  returns the **original** on failure (line 39) — the raw-HEIC passthrough.
- `src/components/forms/hooks/use-invoice-files.ts` — holds the `invoiceFilesRef` map (raw Files,
  keyed by row index). `registerFilesAt` (batch pick) and `handleFileChange` (per-row pick) are the
  **ingest** points. Also holds the **dead** `mediaIdsRef` cache: `getMediaId` / `setMediaId` /
  `getMediaIds` — `setMediaId` is never called, so the map is always empty; only `.delete()`
  invalidations touch it.
- `src/components/forms/expense-form/expense-form.tsx` — `getFiles()` (line 156) feeds submit's
  `resolveInvoiceMediaIds` (line 166) **and** the scan via the `getFiles` prop to `useReceiptGeneration`
  (line 201). Single map, two consumers.
- `src/components/forms/hooks/use-receipt-generation.ts:75` — scan path: `compressImage(files.get(i))`
  → `extractReceiptAction(compressed)`. The compressed File is **discarded** (extraction only); the
  raw File stays in the map. (compression #1)
- `src/lib/utils/upload-file-client.ts:13` — submit path: `compressImage(file)` again → upload.
  (compression #2, the double-compress). `resolveInvoiceMediaIds` (line 37) always gets an empty
  `mediaIds` map → the `stored !== undefined` branch (line 47) is dead.
- `next.config.ts:12` — `serverActions.bodySizeLimit: '10mb'`.
- Sentry markers: `TODO(EX-449) SENTRY-REQUIRED` already present in `openrouter.ts` and
  `use-receipt-generation.ts:99,124`.

DB (local Docker 5433, refreshed from a prod dump): 17 HEIC media, all ≤3.63 MB, **0 files over
4.5 MB** — survivorship-biased (oversize attempts 413 and never persist), so the size risk is
unmeasurable, not zero.

## Desired End State

- A HEIC picked on any supported browser is converted to a resized JPEG **once, at ingest**, before
  it reaches either extraction or upload; its filename extension and MIME become `.jpg` /
  `image/jpeg`, so sharp derivatives and previews just work.
- A file that can't be converted, or exceeds 4.5 MB after processing, is **rejected at pick time** with
  a Polish message naming the offending item — it never enters the files map.
- Each file is compressed exactly once.
- The dead `mediaId` cache is gone; `resolveInvoiceMediaIds` collapses to "upload each file".
- `bodySizeLimit` reads `4.5mb` with a comment explaining the Vercel cap.

## Approach

Move HEIC-convert + compress + size-guard to a **single processing step at ingest** (the
`registerFilesAt` / `handleFileChange` handlers), storing the **processed** File in the map. Both
consumers already read that map, so extraction and upload inherit the processed bytes for free — the
double-compress and the "extraction gets flaky HEIC" problems both dissolve by construction. The
handlers become async with a per-row "processing" state.

New module `src/lib/utils/process-upload-file.ts`:

```
processUploadFile(file): Promise<File>   // throws BlockedFileError on unconvertible / oversize
  1. classify: image if MIME starts image/ (non-svg) OR extension ∈ {.heic,.heif,.jpg,.jpeg,.png,...}
  2. if not an image → size-guard only, return as-is (PDF path)
  3. if HEIC (mime image/heic|heif OR extension .heic/.heif):
       a. try CompressorJS with { mimeType: 'image/jpeg' }  (Safari native decode)
       b. on failure → lazy `import('heic-to')`, decode HEIC→JPEG blob, then CompressorJS resize
       c. rewrite name .heic/.heif → .jpg, type → image/jpeg
       d. if both a & b fail → throw BlockedFileError(reason: 'heic-unconvertible', filename)
  4. else (jpeg/png) → CompressorJS resize/quality as today
  5. size-guard: if result > MAX_UPLOAD_BYTES → throw BlockedFileError(reason: 'too-large', filename, size)
```

**Guard threshold with headroom.** The Vercel 4.5 MB limit is on the **request body**, not the file:
both consumers wrap the file in multipart form-data (the scan server action + the `/api/upload-file`
route), so the body is file bytes + boundary + other fields. Guarding at exactly 4.5 MB leaves no
room — a 4.49 MB file can still produce a >4.5 MB body and hit the uncatchable 413 the guard exists to
prevent. Set `MAX_UPLOAD_BYTES = 4 MB` (a named constant in `process-upload-file.ts`) so the ~0.5 MB
delta absorbs the multipart/field overhead, and the user-facing message names that same figure.

`compress-image.ts` is folded into / called by this module (it already owns the CompressorJS resize).
**Prefer keeping `compress-image.ts` as the CompressorJS wrapper, imported _by_
`process-upload-file.ts`, rather than merging it away** — `src/__tests__/invoice-media-resolve.test.ts`
does `vi.mock('@/lib/utils/compress-image', …)` to keep browser-only compressorjs out of that test, so
deleting the module breaks its mock target. If it is merged, update that mock to point at the new
module in the same change.
The HEIC-by-extension check fixes the empty-`File.type` blind spot.

## Phases

### Phase 1 — Riders & cleanup (isolated, low-risk)

- `next.config.ts:12` — `'10mb'` → `'4.5mb'` + comment: Vercel hard-caps function/action request
  bodies at 4.5 MB (`413 FUNCTION_PAYLOAD_TOO_LARGE`, uncatchable in-function); this must not exceed it.
- Remove the dead `mediaId` cache from `use-invoice-files.ts` (`mediaIdsRef`, `getMediaId`,
  `setMediaId`, `getMediaIds`, its `reindexAfterRemoval` call, the `.delete()` invalidations, the
  `initialFiles`-adjacent bits) and from `expense-form.tsx` (`getMediaIds` import/usage) and
  `upload-file-client.ts` (`resolveInvoiceMediaIds` collapses to upload-each; drop the `mediaIds`
  param + dead `stored` branch). **Gate deletion on `pnpm typecheck`**, not grep.
- Confirm a Sentry marker covers the oversize / extraction-failure surface — the existing
  `TODO(EX-449) SENTRY-REQUIRED` markers are the standing convention; add one at the new client
  block/guard surface (Phase 3) rather than a bare comment.

### Phase 2 — Process-at-ingest pipeline

- Add `src/lib/utils/process-upload-file.ts` (`processUploadFile` + `BlockedFileError` + reason type)
  per Approach. Add `heic-to` to `package.json` (hand-edit per AGENTS.md dependency rule; lazy
  `import()` so it stays out of the initial bundle). Verify `heic-to`'s decode API before wiring.
- Rewire ingest in `use-invoice-files.ts`: `registerFilesAt` / `handleFileChange` become async, run
  each file through `processUploadFile`, store the processed File (or surface the `BlockedFileError`
  to the caller — see Phase 3). Preserve `renameFile`'s same-bytes-clone behavior on the processed File.
  **Cap batch processing concurrency**: `registerFilesAt` (10–20+ files) must route the per-file
  `processUploadFile` calls through the existing `mapWithConcurrency` at a matching cap (4), never an
  unbounded `Promise.all` — each call is main-thread CompressorJS + a possible ~1.3 MB WASM decode, so
  an uncapped batch freezes the UI. This mirrors the scan (`GENERATION_CONCURRENCY`) and upload
  (`UPLOAD_CONCURRENCY`) paths.
- Remove `compressImage` from the scan path (`use-receipt-generation.ts:75` uses the already-processed
  File) and from the submit path (`upload-file-client.ts:13`). Single compression achieved.

### Phase 3 — Guard UX & Polish messaging

- Per-row **processing** state while ingest awaits (HEIC/WASM convert can take ~1–2 s) — reuse the
  existing `fileInputKey` remount + a pending flag; disable the row's actions meanwhile.
- Surface `BlockedFileError` as a per-item Polish message naming the file and cause:
  - `too-large`: `Plik „<name>" przekracza 4 MB — zmniejsz go i spróbuj ponownie.` (must name the
    same figure as `MAX_UPLOAD_BYTES`, not the raw 4.5 MB platform cap)
  - `heic-unconvertible`: `Nie udało się przekonwertować „<name>" — zapisz jako JPG i spróbuj ponownie.`
    The blocked file is **not** added to the map (no row occupies it, or the row shows the error).
- **Batch-pick partial-failure semantics** (positional `lineItems[i] ↔ file[i]` contract): a blocked
  file mid-batch must **never trigger a reindex/index shift** of the following files — that would
  silently misalign every later row's receipt (a correctness bug, not just UX). Process the batch at
  its fixed `startIndex + offset` positions; add each **success** at its own position, leave each
  **blocked** file's position without a stored File and surface its error on that row. Collect the
  blocked files into a **single aggregated** Polish message (one per-file line each) rather than N
  separate toasts. Successes are kept — one bad HEIC in a 20-file batch never discards the other 19.
- Add the `TODO(EX-449) SENTRY-REQUIRED` marker at this block surface.

## Testing

Anchor on risk, cheapest layer that gives real signal (per AGENTS.md).

**Unit (Vitest, `src/__tests__/`)** — the pure, browser-free logic:

- classification: HEIC-by-extension with empty `File.type` is treated as image (regression guard for
  the current passthrough bug).
- filename/type rewrite `.heic → .jpg`, `image/jpeg`.
- size-guard threshold: `MAX_UPLOAD_BYTES` (4 MB) boundary → `BlockedFileError('too-large')`.
- `resolveInvoiceMediaIds` after cache removal: uploads each file, positional, gaps → `undefined`.
- `reindexAfterRemoval` still correct on the files map alone.

CompressorJS (canvas) and `heic-to` (WASM) are browser runtimes — not unit-testable. Inject the
convert/compress step so the pure orchestration (classify → route → guard → error) is tested without a
real decoder.

**E2E (owed, browser-level).** The HEIC upload→preview render path crosses the browser boundary and is
exactly the EX-455 symptom class. This slice **owes** an E2E: author a Playwright spec (pick a HEIC →
row shows a JPEG thumbnail → preview renders) at the review gate, **or** defer it to the `e2e-backlog`
Linear issue (project "Wykonczymy") with the issue id recorded. "Verified manually on iPhone" does not
discharge it.

## Manual checks

(Registry: `manual-checks.md` — the Safari spike is the load-bearing one.)

- **Safari-native HEIC spike** — on a real iPhone/Safari, confirm CompressorJS `{ mimeType:
'image/jpeg' }` actually decodes HEIC → valid JPEG (not a blank canvas). This validates the
  majority path; if it fails, the WASM fallback must cover Safari too.
- Chrome/Firefox desktop: pick a HEIC → verify lazy `heic-to` loads and produces a JPEG.
- Preview + sharp derivative render correctly for a freshly-uploaded HEIC-turned-JPEG.
- Verify on a **preview deploy** (Vercel), not just local — the 4.5 MB cap is a platform behavior.

## Risks & Assumptions

- **Safari native decode unverified** — the whole majority path rests on the spike above. Confidence
  MEDIUM until run.
- **`heic-to` bundle/behavior** — ~1.3 MB WASM; must stay lazy (`import()` only when a HEIC is picked
  on a non-Safari browser). Verify it's not pulled into the initial chunk.
- **Async ingest UX** — making pick handlers async introduces a visible latency window; the pending
  state must not let a user submit a row mid-convert.
- Compression quality reaching the model is **unchanged** (extraction already got the compressed
  bytes), so no OCR-accuracy regression is expected.

## Out of scope (follow-ups)

- Backfill/replacement of the 17 existing HEIC media records — **blocked on a Vercel Blob backup**.
- Server-side HEIC conversion (`heic-convert` / Node libheif) — only relevant to that deferred backfill.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not
> rename step titles. Manual verification lives in the Manual checks section / `manual-checks.md`
> registry, not here.

### Phase 1 — Riders & cleanup

#### Automated

- [x] 1.1 Type checking passes after dead-cache removal (`pnpm generate:types && pnpm tsc --noEmit`)
- [x] 1.2 `resolveInvoiceMediaIds` unit test passes — uploads each file positionally, gaps → `undefined` (`invoice-media-resolve.test.ts`)
- [x] 1.3 `reindexAfterRemoval` unit test still passes on the files map alone (`use-invoice-files.test.ts`)

### Phase 2 — Process-at-ingest pipeline

#### Automated

- [ ] 2.1 Type checking passes (`pnpm tsc --noEmit`)
- [ ] 2.2 Dev CSS build still works after `heic-to` install (`pnpm dev` starts, no lightningcss error)
- [x] 2.3 Classification unit test passes — HEIC-by-extension with empty `File.type` treated as image (`process-upload-file.test.ts`) — 8e342f7
- [x] 2.4 Filename/type rewrite unit test passes — `.heic → .jpg`, type `image/jpeg` (`process-upload-file.test.ts`) — 8e342f7
- [x] 2.5 Size-guard boundary unit test passes — `MAX_UPLOAD_BYTES` (4 MB) → `BlockedFileError('too-large')` (`process-upload-file.test.ts`) — 8e342f7

### Phase 3 — Guard UX & Polish messaging

#### Automated

- [ ] 3.1 Type checking passes (`pnpm tsc --noEmit`)
