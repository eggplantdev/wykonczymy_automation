---
change_id: media-upload-speed
title: Worker invoice draft send — cut the per-photo server work that keeps the dialog open
status: archived
created: 2026-10-07
updated: 2026-10-09
archived_at: 2026-10-09T05:39:28Z
branch: media-upload-speed
worktree: ../wykonczymy-worktrees/media-upload-speed
---

## Notes

A worker's „Wyślij" on the expense-draft dialog takes seconds per photo before the dialog closes. The
draft action itself is fast (prod `[PERF]` 68 ms); the time is the serialized `POST /api/media` per
photo. Research: `research.md` (its „Follow-up — owner discussion" section records how the
direction below was reached). Linear: **EX-1012** (this change), **EX-1013** (thumbnails / lead
dialogs), **EX-1014** (other upload forms).

Owner decisions (2026-10-07):

- **No IndexedDB outbox / no optimistic close for now.** The dialog keeps closing only once the photos
  are safely in Blob and referenced by the draft — speed has to come from the pipeline itself.
- **Scope: the worker expense-draft form only, ASAP** (send from the dialog; adding photos to a pending
  draft rides the same tables and is in unless the plan finds a reason otherwise). The other upload
  consumers (bulk expense, transfer edit, galleries, inspection, scanned report) are a separate change.
- **Worker photos skip the client-upload detour.** A compressed faktura photo is a few hundred KB, so
  the browser → Blob → server-downloads-it-back → re-PUT path buys nothing here. The photo goes to our
  own server once; the server checks the bytes (they are in hand, so the byte sniff stays), PUTs to
  Blob once, writes the `media` row with raw SQL — no Payload upload pipeline, no thumbnail.
- **Two paths, chosen by SIZE, not by type.** A file up to 4 MB (every compressed photo, and most
  PDFs — an e-faktura is ~100 KB) takes the fast path; above that it takes today's client-upload path,
  which already exists, so the fallback costs a branch, not a pipeline. Routing by type would send a
  100 KB PDF down the slow path for nothing. The router is one shared function, so the change for the
  other forms reuses it rather than re-deciding.
- **One request per photo, in parallel**, through a Route Handler — Next.js runs a client's Server
  Actions one at a time, so parallel action calls would queue. `sendExpenseDraftAction` stays the
  last step with the ids. Each photo has its row the moment it is stored, so the existing
  `withOrphanCleanup` (cleanup by row id) still covers a failed send — no key-based discard needed.
- **Baseline first, before any code — run by the agent**, preferably on staging (the realistic Neon +
  Vercel + Blob latencies), a local production build (`next build && next start`) acceptable. As
  `qa-staging-worker@…` (kasa + etap given by the OWNER through the UI): the same photo set at
  1 / 3 / 6 photos, 390px + „Fast 4G", 3 runs each, median of „Wyślij" click → dialog closed, plus the
  per-`POST /api/media` durations from the Vercel logs. The same protocol is repeated after the change.
- **Separate changes, not this one:** (1) dropping thumbnails — the lead dialogs move to the shared
  preview modal with a „Zobacz" button, every lead file goes to the inwestycja (removal before that
  happens in the modal), `MediaStrip` and `imageSizes` go — EX-1013; (2) the other upload forms — EX-1014.
- Base the change on `staging`; the research read code from `staging` (6d64a524) because the working
  tree was on an unrelated spike branch.
