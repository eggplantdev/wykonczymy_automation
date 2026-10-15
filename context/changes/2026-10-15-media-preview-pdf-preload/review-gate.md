# Review-gate ledger — media-preview-pdf-preload (5a8c33612) · 2026-10-15

Scope: `5a8c33612^..5a8c33612` — PDF preview fetched whole into a blob: URL (no endless spinner) +
preload of pages +1..+3 / -1 in `MediaPreviewDialog`. No plan.md, no Linear issue.

## Findings

- [x] 🟡 WARNING · fixed · code-review · `src/hooks/use-pdf-object-url.ts:44` · PDF → another page → back handed the frame the blob: URL the cleanup had just revoked (blank frame) — cleanup now resets the fetched state
      test: test-driven-debugging · DOM — `po powrocie do PDF-a nie podaje ramce zwolnionego adresu`; red with the reset removed (`expected 'blob:pdf-1' not to be 'blob:pdf-1'`), green with it
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/dialogs/media-preview-dialog.tsx:257` · the commit showed Print for a single PDF, whose print-popup iframe waits on a `load` the viewer may never fire — gate restored to EX-659's (`!isPdf || isMultiPage`); Download stays visible for a single PDF (the viewer's own download names the file after the blob UUID)
      test: no automated test — jsdom can't print; manual check „Pojedynczy PDF … tylko Pobierz"
- [x] 🔵 OBSERVATION · skipped · simplify (altitude) · `src/components/dialogs/media-preview-dialog.tsx:116` · `handlePrint` waits on every page's `load` with no time bound, so a multi-page set with a PDF may never print — pre-existing (untouched by this slice); a timeout is behaviour-changing and uncertain (Chrome may print a popup PDF iframe blank anyway) → manual check on staging decides; fix only if it hangs there
      test: no automated test — manual check „Zestaw kilku plików z PDF-ami → Drukuj"
- [x] dismissed · code-review · `src/components/dialogs/preload-preview-neighbours.ts` · whole PDFs preloaded for +1..+3 / -1 cost bandwidth — owner decision (2026-10-15)
- [x] dismissed · code-review · `src/components/dialogs/preload-preview-neighbours.ts:49` · `crossOrigin: 'anonymous'` breaks a cross-origin URL — every preview URL is same-origin `/api/media/file/…` or a local blob:
- [x] dismissed · code-review · `src/hooks/use-pdf-object-url.ts` · blob held while the dialog is closed — both callers unmount the dialog on close, cleanup revokes
- [x] dismissed · simplify (altitude) · `src/payload.config.ts:121` · set `cacheControlMaxAge` (claimed `max-age=0`) — plugin's `index.js` defaults it to 365 days, served `public, max-age=31536000`
- [x] skipped · simplify (altitude) · `src/hooks/media/harden-file-headers.ts:11` · drop `Accept-Ranges` so the viewer loads in one response — server-wide behaviour change, unmeasured; the hook doesn't depend on it
- [x] fixed · simplify · `src/components/dialogs/media-preview-dialog.tsx:76` · manual `isMediaLoading` flag reset only by `goToPage` → derived `loadedImageUrl !== active.url`; `goToPage` inlined
- [x] fixed · simplify · `src/__tests__/components/dialogs/media-preview-dialog.test.tsx:100` · three `fetch` stubs + a second `createObjectURL` stub → one default in `beforeEach`
- [x] fixed · simplify · `src/hooks/use-pdf-object-url.ts:21` · `isLocal` was a redundant effect dependency derived from `url` — inlined, deps `[url]`
- [x] fixed · simplify · `src/hooks/use-pdf-object-url.ts:5` · `PdfSourceT` exported with no importer — unexported
- [x] dismissed · simplify · `src/hooks/use-pdf-object-url.ts:10` · replace `from` + cleanup reset with a keyed child component — not simpler net (a new component file to drop ~4 lines); both guards are needed and pinned by the spec
- [x] dropped · simplify (reuse) · `preload-preview-neighbours.ts:24` + hook · two `startsWith('blob:')` checks — different reasons, two uses; extract at a third
- [x] dropped · simplify (reuse) · dialog · shared `PREVIEW_IMAGE_PROPS` for dialog + preload — low value
- [x] dismissed · simplify (efficiency) · dialog/hook · `getImageProps` per render, refetch on page-back, Blob rewrap — negligible (microseconds / disk-cache hit / Blob references, no copy)
- [x] fixed · comment-noise-audit · `src/hooks/use-pdf-object-url.ts` · JSDoc trimmed
- [x] dismissed · tailwind-v4-audit / feature-first-structure · no findings

## Simplify pass

Ran /simplify (4 angles) — 4 applied, 2 skipped, 5 dismissed/dropped; each folded into ## Findings (tagged simplify).

## Tests & suite

- `vitest run src/__tests__/components/dialogs/media-preview-dialog.test.tsx` — 9/9 passed
- `pnpm typecheck` — clean
- lint / full unit suite / e2e / build — not run (user chose spec + typecheck)
