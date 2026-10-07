# Review-gate ledger — media-upload-speed (EX-1012) · 2026-10-07

Scope: `staging...media-upload-speed` (merge-base `df45add9`), code commits `cb41cdec`, `acf9dff9`.

## Findings

- [x] 🟡 WARNING · fixed · code-review + simplify · `src/app/(frontend)/api/media-upload/route.ts:53` · a filename collision let the `put` (no random suffix) overwrite another row's bytes, and the orphan cleanup then `del`-ed that row's file — first fixed with a 23505 guard; `/simplify` (altitude) moved the fix to the root: the row is inserted first, so the UNIQUE index refuses a taken name before any bytes move, and a failed `put` deletes the row (`deleteMediaRow`); the 23505 branch and `del` are gone. Short id also widened 24 → 48 bits (`src/lib/utils/append-short-id.ts:15`)
      test: TDD · unit + integration — route spec "stores no bytes when the row insert fails, a taken filename included" / "removes the row when the Blob put fails"; `media.db.test.ts` "deletes the row a failed Blob put left without bytes"
- [x] filed · gate · E2E · browser → `/api/media-upload` → Blob → DB → send, mixed sizes + sniff refusal — `filed EX-1016` (label `e2e-backlog`)
      test: TDD · e2e — deferred into EX-1016
- [x] 🟡 WARNING · skipped · impl-review · `src/lib/media/upload-ids.ts:11` · concurrency cap left at 4 without a recorded decision — decided to keep 4: Fast 4G is uplink-bound, a higher cap only splits the same bandwidth; recorded in `baseline.md:212`
      test: no automated test — a tuning constant, the measurement is the evidence
- [x] 🔵 OBSERVATION · fixed · code-review + impl-review · `src/lib/media/sniff-mime.ts:42` · fast path refused files the old path accepted: PDF with the `%PDF-` header past byte 0 (BOM/whitespace), TIFF, AVIF — sniff reads the first KB for PDF, TIFF signatures and AVIF brands added
      test: TDD · unit — sniff-mime spec: AVIF, AVIF sequence, TIFF LE/BE, PDF behind BOM / 900 spaces, refusal past 1024 bytes
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/media/sniff-mime.ts:39` · an AVIF whose major brand is `mif1` with `avif` only in compatible brands is stored as HEIC — unreachable: phones and encoders write the `avif` major brand
      test: no automated test — dismissed
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/foundation/manual-checks.md:4475` · mixed-size send (big PDF + photos) runs both paths at once against Neon, unverified — manual check amended to cover it
      test: no automated test — needs live Blob + Neon; covered by the manual check
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/changes/2026-10-07-media-upload-speed/research.md:56` · EX-855 hazard misworded (a single statement "scattered" across connections) — now: absorbed into another request's open transaction
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/media/upload-ids.ts:11` · stale docstrings after the size router (`UPLOAD_CONCURRENCY`, `MediaUploaderT`, `uploadMediaToServer`) — rewritten / trimmed
- [x] 🔵 OBSERVATION · dismissed · impl-review · `context/changes/2026-10-07-media-upload-speed/baseline.md:172` · after-measurement ran on the branch preview, not staging — already stated in the baseline; same Neon/Blob/region as staging
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/app/(frontend)/api/media-upload/route.ts:93` · PERF `total=` duplicated the put+insert sum — dropped
- [x] 🔵 OBSERVATION · dropped · impl-review · `src/app/(frontend)/api/media-upload/route.ts:35` · `request.formData()` outside the try returns a bare 500 on a malformed body — unreachable from our own client, which always posts a valid `FormData`
- [x] dropped · code-review · `src/lib/media/upload-media.ts` · response handling duplicated with `postMediaRow` — the shared helper's parameters would equal the code; no win
- [x] fixed · structure-scatter-audit · `src/lib/constants/route-body.ts:1` · the 4 MiB route-body cap lived twice (`FAST_UPLOAD_MAX_BYTES`, `MAX_SCAN_BYTES` with a stale comment) — one `ROUTE_BODY_MAX_BYTES`; `upload-limits.ts` deleted; scan + worker-report clients adopt it
- [x] fixed · module-cohesion-audit · `src/lib/media/upload-refused.ts:7` · `UploadRefusedError` lived in `client-upload.ts` but both paths throw it — moved to its own module
- [x] fixed · module-cohesion-audit · `src/lib/media/sniff-mime.ts:1` · `AllowedMimeT` exported with no importer — unexported
- [x] fixed · code-review · `src/lib/db/pg-error.ts:1` · the route re-derived the pg-code walk that `with-payload-transaction.ts` already had — one `hasPgCode` + `UNIQUE_VIOLATION`, both callers use it
- [x] skipped · feature-first-structure · `src/lib/utils/validate-upload-file.ts:12` · `uploadFileProblem` is media logic filed under `lib/utils` — predates this slice; moving a shared module now breaks imports in parallel sessions on staging
- [x] dropped · structure-scatter-audit · `src/app/(frontend)/api/media-upload/route.ts` · extract the route body into a `lib/media` service — one caller, the route is the service
- [x] dropped · structure-scatter-audit · `src/lib/media/media-ownership.ts` · fold into the new media modules — unrelated concern, no shared code
- [x] fixed · comment-noise-audit · `src/lib/media/upload-media.ts`, `src/lib/media/upload-ids.ts`, route + specs · restating comments deleted/trimmed (`REFUSED_STATUSES`, "`upload` is injectable", route header, 3 spec comments)
- [x] dismissed · comment-noise-audit · `src/lib/media/upload-media.ts` · `uploadMediaBySize` JSDoc — carries why routing is by size, not type
- [x] dismissed · comment-noise-audit · `src/hooks/use-media-upload.ts:18`, `src/__tests__/components/expense-draft/expense-draft-dialog-mode.test.tsx:99` · flagged comments — both carry rationale the code can't say

- [x] fixed · simplify · `src/app/(frontend)/api/media-upload/route.ts:46` · route cut the first KB before calling the sniffer, which already bounds its own reads — `sniffMime(bytes)`, `SNIFF_BYTES` private again
- [x] fixed · simplify · `src/__tests__/lib/media/upload-media.test.ts:6` · `importOriginal` spread in the `client-upload` mock left over from before `upload-refused.ts` — plain factory
- [x] dropped · simplify · `src/lib/media/upload-ids.ts:94` · `kind ? wrap : upload` ternary could always wrap — saves one branch at the cost of rewriting the exact-call assertion in `upload-ids-kind.test.ts`
- [x] skipped · simplify · `src/lib/media/sniff-mime.ts:1` · three type allowlists (client `uploadFileProblem`, fast-path sniff, Payload `media.upload.mimeTypes`) disagree, so e.g. an SVG ≤ 4 MB is refused while a bigger one is accepted — unifying narrows what the slow path accepts (SVG, exotic image types): behaviour change, owner's call; unreachable in practice since pick-time compression turns raster photos into JPEG and workers don't send SVG
- [x] dismissed · simplify · `src/app/(frontend)/api/media-upload/route.ts:67` · share the Blob layout with the plugin config — `payload.config.ts` sets neither `addRandomSuffix` nor `cacheControlMaxAge` (plugin defaults), so there is no second copy to dedup; the route header documents the coupling
- [x] dismissed · simplify · `src/app/(frontend)/api/media-upload/route.ts:45` · `file.arrayBuffer()` makes a second in-memory copy of ≤ 4 MiB — sub-ms; Blob `put` (~0.9 s) dominates
- [x] dismissed · simplify · `src/app/(frontend)/api/media-upload/route.ts:92` · `revalidateTag(media)` once per file — runs in `waitUntil`, off the response path; the old path did the same via the afterChange hook
- [x] dismissed · simplify · reuse · `postFormData`, `makeRevalidateAfterChange`, `blobPublicUrl` as reuse candidates — different contracts (status needed, Payload-hook-only, CDN URL vs serving path)

## Simplify pass

Ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 3 applied, 1 dropped, 1 skipped, 4 dismissed; each folded into ## Findings (tagged simplify). `primitive-reuse-scan` not applicable: the slice adds no UI (two `upload={uploadMediaBySize}` props).

## Tests & suite

- typecheck — green (after /simplify)
- lint (eslint on every edited source file) — green
- touched + dependent specs (unit/dom) — green: route, media/*, scan-receipt-client, client-upload, expense-form, worker-reports, kosztorys restore/serialize (20 files, 148 + 110 + 42 tests across runs)
- `media.db.test.ts` @ 5435 — green (3 tests)
- full suite (`pnpm test` / `test:integration` / `test:e2e` / `build`) — not run; awaiting the user's go
- E2E — filed EX-1016 (`e2e-backlog`)
- manual checks — `context/foundation/manual-checks.md` § EX-1012, 7 open: Done/archive blocked until they pass
