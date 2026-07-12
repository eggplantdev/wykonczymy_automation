# Plan brief — EX-457 receipt-scan HEIC + file-size hardening

**Goal:** iPhone (HEIC) receipts stop breaking, and file-size handling stops lying.

**Core move:** convert HEIC + compress + size-guard **once, at ingest** (the file-pick handlers in
`use-invoice-files.ts`), store the processed File in the shared map that both scan-extraction and
submit-upload already read. This fixes HEIC, kills double-compression, and lets the >4.5 MB guard fire
at pick time — in one refactor.

**HEIC conversion:** client-side, native-first — CompressorJS forces JPEG on Safari (OS codec), lazy
`heic-to` WASM fallback for Chrome/Firefox. Both ship now. Unconvertible → **block** with a Polish
message (never store a broken HEIC).

**Phases:** (1) riders & cleanup — `bodySizeLimit` 10mb→4.5mb, remove dead `mediaId` cache, Sentry
marker; (2) `processUploadFile` pipeline + async ingest, drop the two `compressImage` calls; (3)
per-row processing state + per-item Polish block/oversize messages.

**Tests:** unit for classify/rewrite/guard/`resolveInvoiceMediaIds` (inject the decoder); E2E for the
HEIC→preview render path owed at the review gate (author or defer to `e2e-backlog`).

**Deferred:** backfill of the 17 existing HEIC records — **blocked on a Vercel Blob backup** shipping
first. Server-side `heic-convert` only matters for that follow-up.

**Load-bearing unknown:** Safari-native HEIC decode via CompressorJS is unverified — iPhone spike
gates the majority path.
