# Review-gate ledger — media-upload-other-forms (EX-1014) · 2026-10-07

Scope: branch `media-upload-other-forms` vs `staging` merge-base `062d62d3`. Step 0.5 (browser
verification) skipped — no Playwright driving unasked; the 17 manual checks in
`context/foundation/manual-checks.md` § EX-1014 stay with the human.

Fan-out: `/10x-impl-review` (APPROVED, 2 warnings), `/code-review` (0 critical, 2 warnings),
`feature-first-structure` + `module-cohesion-audit` + `structure-scatter-audit`, `comment-noise-audit`
(flag-only). `tailwind-v4-audit` dropped out — the diff touches no `className`.

## Findings

- [x] 🟡 WARNING · filed · code-review · `src/payload.config.ts:128` · the plugin's token route mints a write token for any existing key with no overwrite guard — a PUT can destroy a stored faktura's bytes; pre-existing, outside the diff, unverified — filed EX-1021
      test: test-driven-debugging · integration — recorded in EX-1021 (repro first, against the preview store)
- [x] 🔵 OBSERVATION · filed · impl-review · `context/changes/2026-10-07-media-upload-other-forms/baseline.md` · orphan `media` rows 2148/2208/2218/2349 after gallery runs, untracked — filed EX-1022
      test: test-driven-debugging · integration — recorded in EX-1022
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/media/media-route-response.ts:5` · a register 400 (blob missing / older than 1 h) toasts as „może być uszkodzony" — only reachable when a PUT that just succeeded is not found, or after an hour-long stall; not worth a new message key
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/media/client-upload.ts:39` · a PUT that lands and a register that then fails leaves a blob with no row, which `discardOrphanedUploads` (ids only) can't reach — identical to the pre-change slow path, not a regression
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/media/upload-ids.ts:42` · the new `kind?` third parameter on `resolveUploadIdRows` — harmless, every caller verified
- [x] dismissed · structure-scatter-audit · `src/components/forms/form-fields/line-items-field.tsx:52` · a type list besides `ALLOWED_UPLOAD_MIMES` — it gates the RAW browser type before ingest re-encodes BMP/GIF to PNG, so the post-ingest allowlist would refuse files ingest fixes. (The other two this audit named, `extract-receipt` and `media.ts`, were unified in the simplify pass below — the earlier „admin-only" reading of `media.ts` missed REST `POST /api/media` and the landing import)
- [x] dismissed · comment-noise-audit · `src/lib/media/media-route-response.ts:16` · log tag `[upload-media]` now shared by both routes — it names the client module that logs it, and the route is in the message

- [x] skipped · simplify · `src/collections/media.ts` access · closing REST `create` on `media` entirely — changes what a user may do; the narrowed `mimeTypes` already closes the SVG hole
- [x] dismissed · simplify · `src/lib/media/sniff-mime.ts:3` · unexport `ALLOWED_UPLOAD_MIMES` — superseded: the `media` collection now reads it
- [x] dismissed · simplify · `src/components/forms/form-fields/line-items-field.tsx` · reuse agent re-raised unifying `isReceiptFile` onto the allowlist — runs pre-ingest, BMP would be dropped (same reason as the scatter line above)
- [x] dismissed · simplify · `api/media-register` + `api/media-upload` · shared route helper — opposite store orders and error handling; its parameters would be the code it replaces
- [x] dropped · simplify · `api/media-register/route.ts` · start `getPayload` in parallel with `head()` — wins only on a cold start

## Simplify pass

Ran /simplify (4 agents: reuse, simplification, efficiency, altitude) — 8 applied, 1 skipped, 4 dismissed/dropped; each folded into ## Findings (tagged `simplify`). No separate report.

## Tests & suite

- Not run — user's kickoff choice „Nie, bez testów": no vitest / typecheck / lint in this session; the user runs them. Specs authored or reshaped (unrun): `route.test.ts` (+3), `media-route-response.test.ts` (new), `upload-media.test.ts`, `client-upload.test.ts`, `upload-ids.test.ts` (kind cases merged in), `fetch-landing-asset.test.ts` (+`image/bmp`), `validate-upload-file.test.ts` (moved).
- E2E: browser-level slice — deferred into the E2E backlog by extending EX-1016 (`e2e-backlog`) with scenarios 5–7 (register path > 4 MB, gallery `kind`, SVG refused before any request).
- Manual checks: 18 in `manual-checks.md` § EX-1014, unticked — slice stays In Review.
