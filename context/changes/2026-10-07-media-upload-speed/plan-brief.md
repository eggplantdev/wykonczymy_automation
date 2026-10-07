# Worker expense-draft send — fast upload path — Plan Brief

> Full plan: `context/changes/2026-10-07-media-upload-speed/plan.md`
> Research: `context/changes/2026-10-07-media-upload-speed/research.md`
> Baseline: `context/changes/2026-10-07-media-upload-speed/baseline.md`

## What & Why

A worker's „Wyślij" on the expense-draft dialog keeps the dialog open ~12 s for 6 photos on a normal
Warsaw LTE link, and 81 % of that is server work done one photo at a time (~1.6 s each). The photos are
already compressed to ~305 KB; the time goes to a pipeline built for multi-MB files that downloads every
photo back from storage, makes a thumbnail nobody shows here, and uploads it twice more.

## Starting Point

Every upload goes browser → Blob → serialized `POST /api/media`, where Payload re-reads, thumbnails and
re-uploads the file. The draft action itself is ~0.2 s.

## Desired End State

On the draft dialog and the draft pages cell, each file up to 4 MB goes once to our own endpoint, all in
parallel; the server checks the bytes, stores the file once and registers it. 6 photos on LTE: an
estimated 2–3 s instead of 11.9 s, confirmed by re-running the baseline. Everything else uploads as today.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Speed source | Pipeline, not optimistic close | Dialog closes only once photos are safe | Owner |
| Scope | Worker draft dialog + draft pages cell | Needed ASAP; other forms are EX-1014 | Owner |
| Path choice | By size (≤ 4 MB fast), not by type | A 100 KB PDF must not take the slow path | Owner |
| Transport | Route Handler, one request per file | Server Actions from one client run one at a time | Research / Next docs |
| Row creation | Raw SQL insert, no thumbnail | Payload's pipeline is the cost; only lead dialogs show thumbnails | Owner |
| Byte check | Hand-rolled allowlist sniff (6 formats) | Bytes are in hand; avoids a dependency install | Plan |
| Failure cleanup | Unchanged, by row id | Each file has its row before the send | Owner |
| Opt-in mechanics | Optional uploader threaded through the chain | Other 8 consumers stay byte-for-byte as today | Plan |
| Concurrency | Keep 4 | Revisit only if after-measurement shows a cost | Plan |
| E2E | Deferred to the E2E backlog | No worker-draft spec exists; staging re-measure covers the path | Plan |

## Scope

**In scope:** new `/api/media-upload` route, raw `media` insert, byte sniff, client size router, opting
the two draft surfaces in, after-measurement on staging.

**Out of scope:** other upload forms (EX-1014), thumbnails / lead dialogs (EX-1013), IndexedDB,
optimistic close, PDF xref check, `kind` on pages added later, the drafts-list-after-delete bug.

## Architecture / Approach

`uploadMediaBySize(file)` → ≤ 4 MB: `POST /api/media-upload` (auth → sniff → Blob `put` →
`insertMediaRow` → expire media cache → `{ id }`); > 4 MB: today's `uploadMediaFromClient`. The ids flow
into `sendExpenseDraftAction` / `addExpenseDraftPagesAction` exactly as now.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Server fast path | Route + raw insert + sniff, specs | `addRandomSuffix` default makes key ≠ filename → 404 |
| 2. Size router on draft surfaces | Draft send uses the fast path | Refusal wording drift vs today |
| 3. After-measurement | Before/after on staging in `baseline.md` | Needs a human push to staging |

**Prerequisites:** worktree `../wykonczymy-worktrees/media-upload-speed` needs `pnpm install` (no
`node_modules` yet).
**Estimated effort:** ~1 session for phases 1–2; phase 3 after deploy.

## Open Risks & Assumptions

- The ~1 s floor seen on browser → Blob PUTs may partly reappear as server → Blob `put` time; the
  `[PERF]` line splits it out.
- Fast-path rows carry no width/height — verified no app reader uses them.

## Success Criteria (Summary)

- 6-photo send on Warsaw LTE drops from 11.9 s to a few seconds on staging.
- Photos from fast-path drafts open, convert into transfer invoices and are deleted with their draft.
- No other upload screen changes behaviour.
