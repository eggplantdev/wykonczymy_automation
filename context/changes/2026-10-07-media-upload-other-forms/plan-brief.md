# Every Upload Form on the Size Router — Plan Brief

> Full plan: `context/changes/2026-10-07-media-upload-other-forms/plan.md`
> Predecessor: `context/changes/2026-10-07-media-upload-speed/` (EX-1012)

## What & Why

EX-1012 made the worker's „Wyślij" fast by routing files ≤ 4 MB to our own upload route instead of
the Payload client-upload pipeline. Every other upload form (bulk expense, transfer edit, invoice
cell, Telmak, inspection, investment form and gallery, scanned report) still pays ~1.6 s per file,
one file at a time. EX-1014 moves all of them onto the same router and removes the serialized Payload
registration from the > 4 MB path too.

## Starting Point

`uploadMediaBySize` exists and is opted into by two worker components only; the shared helpers
(`resolveUploadIds*`, `submitWithUploads`, `useMediaUpload`) default to `uploadMediaFromClient`, whose
`createMediaRow` queue serializes `POST /api/media` (EX-855 patch).

## Desired End State

Any upload anywhere: ≤ 4 MB → one parallel `POST /api/media-upload`; > 4 MB → browser PUT to Blob +
a light `POST /api/media-register` (head + first KB + INSERT). The app never calls `POST /api/media`.
SVG/BMP/ICO are refused before upload. Before/after numbers sit in `baseline.md`.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| > 4 MB registration | `head()` + 1 KB Range GET + raw INSERT | no download/thumbnail/re-PUT, no EX-855 queue, PUT stays past the 4.5 MB cap | Plan (owner) |
| SVG / BMP / ICO | refused at pick time and by the server | 0 such files in prod; SVG on a public host = stored XSS | Plan (owner) |
| Blob delete on refusal | only fresh (< 1 h), unreferenced, sniff-refused blobs | the route takes a client filename; prod invoices have no undelete | Plan |
| Measurement | 3 scenarios, LTE + unthrottled, warm-up + 3 runs, medians, before and after | same protocol as EX-1012, comparable numbers | Plan (owner) |
| Rollout | one change, two code phases | each phase independently shippable and revertable | Plan (owner) |
| Manual checks | broad — every upload surface, both paths | the change touches how every file gets stored | Owner |

## Scope

**In scope:** default uploader flip; removal of per-call opt-ins; pick-time type gate on the sniff
allowlist; `/api/media-register`; deletion of `createMediaRow` / queue; before/after baseline; manual
checks.

**Out of scope:** thumbnails and lead dialogs (EX-1013); own token minting; concurrency/compression
changes; IndexedDB; EX-855 root cause; removing Payload's `POST /api/media` (admin panel).

## Architecture / Approach

```
file ──► uploadFileProblem (allowlist) ──► uploadMediaBySize
           ≤ 4 MB: POST /api/media-upload  → sniff → INSERT → put        (EX-1012, unchanged)
           > 4 MB: token → browser PUT → POST /api/media-register → head + 1 KB → sniff → INSERT
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 0. Baseline before | medians for 3 scenarios × 2 profiles on staging | test data left on the preview DB — cleanup via UI |
| 1. Fast path everywhere | all forms ≤ 4 MB parallel + pick-time type gate | a form relying on the Payload thumbnail — only `MediaStrip` does, out of these forms |
| 2. Register > 4 MB from head() | no app path through `POST /api/media` | the delete guard — covered branch by branch in the route spec |
| 3. Baseline after + checks | before → after table, EX-1014 registry section | branch push for the preview needs the owner's go |

**Prerequisites:** staging OWNER account (`pnpm qa:staging-user`); EX-1012 on staging; a branch or
worktree off `staging` (main tree holds another session's work).
**Estimated effort:** ~1–2 sessions; the two baselines are the long part.

## Open Risks & Assumptions

- A browser that declares an unusual type for a valid file (e.g. empty type for HEIC) is already
  refused by `uploadNoType`; the allowlist adds no new case for real photos.
- A PUT that succeeds while the register call fails leaves an unreferenced blob — the same as today's
  PUT-then-`createMediaRow` failure.
- Registration race on a guessed random suffix — negligible at five users.

## Success Criteria (Summary)

- Bulk expense with 4 invoices and a 10-photo gallery add finish markedly faster on LTE and
  unthrottled than the Phase 0 medians.
- A > 4 MB PDF registers without the server downloading it back.
- Every manual check in the EX-1014 section passes, including the two-tab test with no lost files.
