# Review-gate ledger — media-upload-other-forms (EX-1014) · 2026-10-07

Scope: branch `media-upload-other-forms` vs `staging` merge-base `062d62d3`. Step 0.5 (browser
verification) skipped — no Playwright driving unasked; the 17 manual checks in
`context/foundation/manual-checks.md` § EX-1014 stay with the human.

Fan-out: `/10x-impl-review` (APPROVED, 2 warnings), `/code-review` (0 critical, 2 warnings),
`feature-first-structure` + `module-cohesion-audit` + `structure-scatter-audit`, `comment-noise-audit`
(flag-only). `tailwind-v4-audit` dropped out — the diff touches no `className`.

## Findings

- [x] 🟡 WARNING · fixed · code-review · `src/app/(frontend)/api/media-register/route.ts:119` · the sniff labelled the row but the blob is served with the type the browser declared at PUT — a `%PDF-`-headed HTML file registered as a PDF and went out as `text/html` — the route now refuses (and guarded-deletes) a blob whose declared `contentType` is off the allowlist; the residual hole (the token route alone serves such a file, no row needed) filed EX-1021
      test: TDD · unit — `route.test.ts` „refuses PDF bytes the browser declared as markup"
- [x] 🟡 WARNING · filed · code-review · `src/payload.config.ts:128` · the plugin's token route mints a write token for any existing key with no overwrite guard — a PUT can destroy a stored faktura's bytes; pre-existing, outside the diff, unverified — filed EX-1021
      test: test-driven-debugging · integration — recorded in EX-1021 (repro first, against the preview store)
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/media/validate-upload-file.ts:14` · SVG/BMP/ICO are refused at submit (before the upload), not at pick as `change.md` / the commit claimed — docs reworded to the real behaviour (`change.md`, `sniff-mime.ts` header). A pick-time check was not added: nobody photographs an invoice as SVG, and BMP/GIF are re-encoded to PNG at ingest anyway, so the earlier refusal has no real user
      test: no automated test — wording only; `validate-upload-file.test.ts` already pins the refusal
- [x] 🟡 WARNING · fixed · impl-review · `context/foundation/manual-checks.md:4617` · the SVG check expected „to nie jest zdjęcie ani PDF", which the UI never shows — rewritten to the two real toasts („Dozwolone są tylko zdjęcia i pliki PDF" / „Plik „….jpg" został odrzucony — może być uszkodzony.") and to „po kliknięciu zapisu"
      test: no automated test — a manual-check wording fix
- [x] 🔵 OBSERVATION · fixed · code-review + impl-review · `src/app/(frontend)/api/media-register/route.ts:103` · the Range GET had no timeout, and a CDN ignoring `Range` would stream the whole file into `arrayBuffer()` — `AbortSignal.timeout(10 s)` + `readHead` reads at most `SNIFF_BYTES` and cancels the body. Deleting the blob on a failed read was NOT added: the blob is the user's upload and a retry can still register it
      test: TDD · unit — „sniffs only the first KB when the CDN ignores the range", „answers 500 and keeps the blob when the range read fails"
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/app/(frontend)/api/media-register/route.ts:92,110` · head and range failures logged without the `TODO(EX-449) SENTRY-REQUIRED:` marker — added
- [x] 🔵 OBSERVATION · fixed · code-review · `context/foundation/lessons.md:2208` · the EX-855 lesson implied raw SQL escapes the overlapping-transaction hazard — corrected: same pool, so an insert can still ride another request's open transaction
- [x] 🔵 OBSERVATION · filed · impl-review · `context/changes/2026-10-07-media-upload-other-forms/baseline.md` · orphan `media` rows 2148/2208/2218/2349 after gallery runs, untracked — filed EX-1022
      test: test-driven-debugging · integration — recorded in EX-1022
- [x] 🔵 OBSERVATION · fixed · impl-review · `baseline.md:190` · duplicated `## After EX-1014` heading — removed
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/media/media-route-response.ts:5` · a register 400 (blob missing / older than 1 h) toasts as „może być uszkodzony" — only reachable when a PUT that just succeeded is not found, or after an hour-long stall; not worth a new message key
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/media/client-upload.ts:39` · a PUT that lands and a register that then fails leaves a blob with no row, which `discardOrphanedUploads` (ids only) can't reach — identical to the pre-change slow path, not a regression
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/media/upload-ids.ts:42` · the new `kind?` third parameter on `resolveUploadIdRows` — harmless, every caller verified
- [x] dismissed · structure-scatter-audit · `src/components/forms/form-fields/line-items-field.tsx:52` · a type list besides `ALLOWED_UPLOAD_MIMES` — it gates the RAW browser type before ingest re-encodes BMP/GIF to PNG, so the post-ingest allowlist would refuse files ingest fixes. (The other two this audit named, `extract-receipt` and `media.ts`, were unified in the simplify pass below — the earlier „admin-only" reading of `media.ts` missed REST `POST /api/media` and the landing import)
- [x] fixed · feature-first-structure · `src/lib/utils/validate-upload-file.ts` · media validation filed under generic `utils` while all its consumers and its allowlist live in `lib/media` — moved to `src/lib/media/validate-upload-file.ts` (spec moved to the mirror path, 2 imports)
- [x] fixed · structure-scatter-audit + comment-noise-audit · `src/app/(frontend)/api/extract-receipt/route.ts:22`, `src/components/forms/expense-form/use-receipt-generation.ts:111` · stale comments still pointing at `Media.upload.mimeTypes` as the upload gate — reworded to the byte sniff
- [x] fixed · comment-noise-audit · `upload-ids.ts:9`, `validate-upload-file.ts:5,17`, `sniff-mime.ts:30`, `client-upload.ts:13,17`, `route.ts:22,26`, `lessons.md:2208` · narration / vanished-state / restating comments — deleted or trimmed (`route.ts:26` reworded to „a fresh, unreferenced upload")
- [x] fixed · comment-noise-audit · `route.test.ts:100,128`, `media.db.test.ts:105`, `client-upload.test.ts:34`, `expense-draft-dialog-mode.test.tsx:98`, `validate-upload-file.test.ts:19` · spec comments restating the test title or narrating the change — deleted; the stale test title „…which the media collection would reject after the PUT" → „…before the upload"
- [x] dismissed · comment-noise-audit · `src/lib/media/media-route-response.ts:16` · log tag `[upload-media]` now shared by both routes — it names the client module that logs it, and the route is in the message
- [x] fixed · simplify · `src/lib/media/sniff-mime.ts:16` · `(ALLOWED_UPLOAD_MIMES as readonly string[]).includes(…)` cast would have been duplicated by the register route's content-type check — one `isAllowedUploadMime` type guard, used by both

- [x] fixed · simplify · `src/collections/media.ts:52`, `src/lib/leads/fetch-landing-asset.ts:20` · the collection still took `image/*`, so SVG/BMP/ICO stayed open through REST `POST /api/media` (any logged-in user, unused by the app) and the anonymous landing import kept its own regex — `mimeTypes: [...ALLOWED_UPLOAD_MIMES]`, landing gate → `isAllowedUploadMime`. Makes „refused everywhere" true; a landing BMP/ICO is now refused like in every app form. Manual check added (landing photo + PDF)
      test: TDD · unit — `fetch-landing-asset.test.ts` adds `image/bmp` to the refused set
- [x] skipped · simplify · `src/collections/media.ts` access · closing REST `create` on `media` entirely — changes what a user may do; the narrowed `mimeTypes` already closes the SVG hole
- [x] fixed · simplify · `src/lib/media/upload-media.ts:23` · `uploadFileProblem` ran in both path functions under the one router every upload crosses — runs once in `uploadMediaBySize`; `uploadMediaToServer` unexported; one SVG test per size at router level
- [x] fixed · simplify · `src/__tests__/lib/media/media-route-response.test.ts` · the 400/409/413/415 → refused / 500 → failed / no-id table was tested twice (both path specs; a 409 can't even come from the fast route) — one spec on `mediaIdFrom`, duplicates removed
- [x] fixed · simplify · `src/app/(frontend)/api/extract-receipt/route.ts:45` · third copy of the type list (`/^(image\/|application\/pdf$)/`) — `isAllowedUploadMime`; the scan receives post-ingest files, so BMP is already PNG there
- [x] fixed · simplify · `upload-media.ts`, `client-upload.ts`, `upload-ids.ts` · `{ kind }` wrapper object threaded through three layers — `kind?: MediaKindT` passed directly
- [x] fixed · simplify · `src/lib/media/upload-ids.ts` · `resolveUploadIds` had one caller — inlined into `submitWithUploads`; `upload-ids-kind.test.ts` merged into `upload-ids.test.ts`
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
