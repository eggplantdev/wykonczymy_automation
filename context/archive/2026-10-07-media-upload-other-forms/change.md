---
change_id: media-upload-other-forms
title: Every upload form on the size router — fast path up to 4 MB, head()-registered rows above it
status: archived
created: 2026-10-07
updated: 2026-10-09
archived_at: 2026-10-09T05:39:30Z
branch: media-upload-other-forms
worktree: ../wykonczymy-worktrees/media-upload-other-forms
---

## Notes

Follow-up of EX-1012 (`context/changes/2026-10-07-media-upload-speed/`), which moved only the worker
expense-draft dialog onto `uploadMediaBySize`. Every other upload form still takes the slow
client-upload path: browser PUT → serialized `POST /api/media` → Payload downloads the blob back,
sniffs it, builds a thumbnail, re-PUTs both. Linear: **EX-1014**.

Owner decisions (2026-10-07):

- **Above 4 MB: register from `head()`.** The browser keeps its direct PUT to Blob (the only route past
  Vercel's 4.5 MB body cap); our server then reads `head()` plus the first KB by a Range GET, sniffs it,
  and inserts the row with raw SQL. No Payload upload pipeline and no serialized `createMediaRow`
  queue on any path the app uses — `POST /api/media` remains for the unused admin panel only.
- **SVG / BMP / ICO are refused** everywhere, at submit before the upload and on the server. Prod
  history holds 0 such files (jpeg 1056, pdf 884, png 16); an SVG on a public blob host is a stored-XSS vector.
- **Baseline before and after**, the EX-1012 protocol: staging OWNER, Warsaw LTE + unthrottled,
  warm-up + 3 runs, medians, three scenarios — bulk expense with 4 invoices, 10 photos into an
  investment gallery, one PDF over 4 MB onto a transfer's invoice.
- **A broad manual-check pass** across every upload surface — the change touches how every file in the
  app gets stored.
- **Rollout: one change, two code phases** (fast path everywhere, then the >4 MB register route).
