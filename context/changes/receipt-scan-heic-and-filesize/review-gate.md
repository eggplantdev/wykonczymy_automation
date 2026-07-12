# Review-gate ledger — receipt-scan-heic-and-filesize (EX-457) · 2026-07-12

Base: `1da49ed` · Slice commits: `8e342f7 c1952e6 82a9ec0 69c5c37 508e76f b44145f`

Touched source files:

- `next.config.ts`, `package.json`, `pnpm-lock.yaml`
- `src/lib/utils/process-upload-file.ts` (new), `src/lib/utils/compress-image.ts`, `src/lib/utils/upload-file-client.ts`
- `src/components/forms/expense-form/expense-form.tsx`
- `src/components/forms/form-fields/line-items-field.tsx`
- `src/components/forms/hooks/use-invoice-files.ts`, `use-receipt-generation.ts`
- `src/__tests__/process-upload-file.test.ts` (new), `src/__tests__/invoice-media-resolve.test.ts`

> Step 0.5 verification pass **skipped**: the slice's manual checks are device/platform-bound
> (real iPhone/Safari HEIC decode; Vercel preview deploy for the 4.5 MB platform cap) — a headless
> browser agent cannot drive them. They stay pending in `context/foundation/manual-checks.md`
> and are a `Done` blocker, tracked there, not here.

## Findings

<!-- ONE checkbox per finding. Format: [box] [severity, bug-finding only] · disposition · `source` · `file:line` · what — reason -->

- [x] 🟡 WARNING · fixed · `code-review` · `expense-form.tsx:130-162` · ingest await not in try/finally → an unexpected (non-BlockedFileError) rejection, e.g. dynamic `import()` chunk-load failure, skips `markIngesting(..,false)` and strands rows in the spinner permanently, disabling every row's delete + the scan button with no recovery but reload — fixed via `runIngest` try/catch/finally that always clears ingesting + surfaces a generic error toast
      test: test-driven-debugging · e2e — timing/browser-level (ref-read vs async resolve); regression guard filed into the owed HEIC E2E, **EX-460**
- [x] 🟡 WARNING · fixed · `impl-review` · `expense-form.tsx` / `form-footer.tsx` · submit not blocked mid-ingest → `getFiles()` reads `invoiceFilesRef` before `processUploadFile` resolves, so a row submitted during the ~1-2s HEIC convert saves with `invoiceMediaIds[i]=undefined` — receipt silently lost. Plan Risks explicitly required blocking this. Fixed: optional `disabled` prop on FormFooter ORed with isSubmitting, fed `isIngesting`; plus an onSubmit short-circuit backstop
      test: test-driven-debugging · e2e — browser-level submit-timing; regression guard filed into the owed HEIC E2E, **EX-460**
- [x] 🔵 OBSERVATION · skipped · `code-review` · `line-items-field.tsx:177` · `reuseFirstRow` overwrites an already-attached file on the lone blank row 0 silently — benign edge (blank row is legitimately being reused; description/amount blank is the reuse signal), not worth the added branch
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `use-invoice-files.ts:68` · blocked files in a batch leave orphaned empty rows not named in the toast — by design; the positional `lineItems[i]↔file[i]` contract is correctly preserved (verified: rows pushed for all picked up-front, fixed-index writes, no reindex on block). Empty rows are skipped by generation and deletable
- [x] 🔵 OBSERVATION · fixed · `impl-review` · `expense-form.tsx:70` · `blockedFilesMessage` joins per-file lines with `\n`, which react-toastify collapses to whitespace in HTML → run-on paragraph with several blocked files — fixed by rendering the toast body as JSX with explicit line breaks
- [x] 🔵 OBSERVATION · deferred · `impl-review` · owed HEIC E2E (pick HEIC → row shows JPEG thumbnail → preview renders) not authored — **filed EX-460** (e2e-backlog), findings #1 & #2 regression guards folded in
      test: e2e — the slice's owed browser spec; carries the #1/#2 regression guards, filed **EX-460**
- [x] · fixed · `comment-noise` · `expense-form.tsx:209` · "the AI scan no longer persists anything, so there is nothing pre-uploaded to reuse" is vanished-state phrasing (contrasts a deleted path a future reader can't see) — reworded to present-tense why
- [x] · dismissed · `comment-noise` · `line-items-field.tsx:68` · "show a spinner, disable actions" tail is mild prop narration, but the meaning clause ("still being processed at ingest") is load-bearing — keep
- [x] · dismissed · `feature-first` · `expense-form.tsx:65` · `blockedFilesMessage` could move to a sibling like `map-line-item.ts` if the file grows — non-exported local presentation helper, fine at current size; no action
- [x] · fixed · `simplify` · `expense-form.tsx:130-162` · the two ingest handlers duplicated a near-identical try/catch/finally + toast block (worsened by my WARNING fix) — extracted a shared `runIngest(indices, ingest)` wrapper; handlers now one line each
- [x] · skipped · `simplify` · `process-upload-file.ts:53` · `isImageFile` re-implements the image-MIME predicate from `compress-image.ts:9` — deduping forces a static import of `compress-image` (eager `compressorjs`, regressing the deliberate lazy-load), a dependency inversion, or a new micro-file for one boolean; all disproportionate to a single duplicated expression
- [x] · dismissed · `simplify` · `compress-image.ts:47` · `compressToJpeg` repeats the `new Compressor(...)` scaffold from `compressImage` — different contracts (throw-vs-return-original is the load-bearing divergence for the WASM fallback); extracting a shared core adds more complexity than it removes
- [x] · dismissed · `simplify` · `use-invoice-files.ts:57,74` · impl-review's "dead re-throw guard" claim is wrong — the non-HEIC `compressImage` path is unwrapped, so a chunk-load `Error` propagates un-wrapped and these guards route it to the component's generic-error catch; keep

## Simplify pass

Ran /simplify — 1 applied (runIngest extraction), 0 proposed, 4 dismissed/skipped/no-action; each finding folded into ## Findings (tagged simplify). Efficiency + altitude passes both CLEAN (single-compression verified end-to-end; FormFooter `disabled` prop, `toastMessage` ReactNode widening, and the defense-in-depth submit guards all judged right-altitude). No separate report file — nested under the review gate, one ledger.

## Tests & suite

Ran in-loop during review/simplify fixes:

- `pnpm tsc --noEmit` → exit 0 (clean)
- `pnpm lint` (eslint) → exit 0 (clean)
- unit: `process-upload-file.test.ts` + `invoice-media-resolve.test.ts` → 14/14 green

Full suite (`typecheck && lint && test && test:e2e && build`) — **not auto-run**; the gate defers the full-suite run to a user decision (see close-out). E2E leg deferred with the owed HEIC spec → **EX-460** (e2e-backlog).
