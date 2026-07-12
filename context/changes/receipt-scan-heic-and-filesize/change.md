---
change_id: receipt-scan-heic-and-filesize
title: EX-457 receipt-scan HEIC handling + file-size hardening
status: implementing
created: 2026-07-12
updated: 2026-07-12
archived_at: null
branch: null
worktree: null
---

## Notes

EX-457. HEIC handling (client-side native-first conversion via Safari OS codec, lazy WASM fallback for Chrome/FF); plus the file-size riders: bodySizeLimit 10mb→4.5mb, client >4.5MB per-file guard, kill double-compression, remove dead mediaId cache, confirm Sentry marker.

**Deferred out of this change:** backfill/replacement of the 17 existing HEIC media records. Blocked on a **Vercel Blob backup** shipping first — we don't mutate existing blobs without a safety net. File as a follow-up once that backup exists.
