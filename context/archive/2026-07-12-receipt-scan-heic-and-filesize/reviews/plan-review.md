<!-- PLAN-REVIEW-REPORT -->

# Plan Review: EX-457 Receipt-scan HEIC + file-size hardening

- **Plan**: context/changes/receipt-scan-heic-and-filesize/plan.md
- **Mode**: Deep
- **Date**: 2026-07-12
- **Verdict**: REVISE → SOUND (all findings fixed in triage)
- **Findings**: 1 critical, 3 warnings, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | FAIL    |
| Plan Completeness     | WARNING |

## Grounding

6/6 paths ✓, mediaId-cache-dead ✓ (`setMediaId` never called; `getMediaIds()` read at expense-form.tsx:169 → always-empty map → dead `stored` branch at upload-file-client.ts:47), compressImage callers ✓ (use-receipt-generation.ts:75, upload-file-client.ts:13, + test mock), process-upload-file.ts absent ✓, brief↔plan ✓.

## Findings

### F1 — Plan has no `## Progress` section

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: End of plan.md
- **Detail**: All 11 other repo plans end with a `## Progress` block; this one had none, and its phases carried no `#### Automated Verification:` bullets. `/10x-implement` and `/10x-tdd` parse Progress to track phases.
- **Fix**: Added a `## Progress` block (Phase 1–3, `#### Automated`, `- [ ] N.M` lines lifted from the named unit tests + typecheck/CSS-build gates).
- **Decision**: FIXED (Fix in plan)

### F2 — Async batch ingest has no concurrency cap

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — registerFilesAt rewire
- **Detail**: Batch pick (10–20+ files) run through processUploadFile (main-thread CompressorJS + ~1.3MB WASM decode) with no cap freezes the UI; the codebase already caps scan/upload at 4 via `mapWithConcurrency`.
- **Fix**: Phase 2 now mandates routing batch processing through `mapWithConcurrency` at cap 4, never unbounded `Promise.all`.
- **Decision**: FIXED (Fix in plan)

### F3 — Partial-batch failure breaks the positional file[i]↔row[i] contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 2 / Phase 3
- **Detail**: A blocked file mid-batch, if it triggers an index shift, silently misaligns every following row's receipt — a correctness bug.
- **Fix A ⭐ (chosen)**: Process at fixed `startIndex + offset` positions, no reindex; add successes at their positions, blocked files keep their row + error, aggregate into one Polish message; successes preserved.
- **Fix B**: Reject the whole batch on any failure (rejected — harsh UX).
- **Decision**: FIXED (Fix A)

### F4 — 4.5 MB guard leaves no headroom for request overhead

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Approach step 5 / Phase 3 size-guard
- **Detail**: The 4.5 MB Vercel cap is on the multipart request body (file + boundary + fields), not the file; guarding at exactly 4.5 MB lets a 4.49 MB file still 413.
- **Fix**: Introduced `MAX_UPLOAD_BYTES = 4 MB` named constant with a headroom comment; updated the Polish `too-large` message and the size-guard unit test (Testing + Progress 2.5) to the same figure.
- **Decision**: FIXED (Fix in plan)

### F5 — Folding compress-image.ts breaks an existing test mock

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — "compress-image.ts folded into the new module"
- **Detail**: `invoice-media-resolve.test.ts:5` mocks `@/lib/utils/compress-image`; deleting the module breaks the mock target.
- **Fix**: Approach now prefers keeping compress-image.ts as the CompressorJS wrapper imported _by_ process-upload-file, or updating the mock in the same change if merged.
- **Decision**: FIXED (Fix in plan)
