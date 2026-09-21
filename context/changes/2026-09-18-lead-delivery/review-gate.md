# Review-gate ledger — lead-delivery · 2026-09-21

Scope: `git diff 8c5885f0~1..b092c002` (58 files, six phases + epilogue) plus the working-tree
changes this gate itself produced. Branch `staging`, nothing pushed.

Step 0.5 (verification pass) did not run — `verify-manual-checks` covers this slice through
`context/foundation/manual-checks.md`, whose 15 boxes are still unticked. That is the **archive
blocker**, not a finding.

## Findings

<!-- Format: [box] · <severity, correctness only> · disposition · `source` · `file:line` · what — reason -->

- [x] 🔴 CRITICAL · fixed · code-review · `src/app/(frontend)/api/webhooks/landing/route.ts` · the
      enquiry was written only after every asset download finished, so one dead Blob URL lost the
      lead — capture first, attach in a second write, reclaim the media if that write fails.
      test: test-driven-debugging · unit — `persists the lead even when every asset fetch throws`
      and `reclaims the media it stored when the attach write fails` are the red-first repros.
- [x] 🔴 CRITICAL · fixed · code-review · `src/app/(frontend)/api/webhooks/landing/route.ts` ·
      reordering removed the `findStoredLead` pre-check, so a redelivery would re-download into a
      second set of orphan media rows — replaced by `captureLead`'s own dedup plus
      `uploadFieldIds(lead.assets).length ? [] : submission.assets`.
      test: TDD · unit — both halves pinned (`re-downloads nothing … that kept its files`,
      `retries the download when the captured lead carries no files`).
- [x] 🟡 WARNING · fixed · code-review · `src/components/investments/investment-assets.tsx:59` ·
      the remove button was self-gated only, so a removal overlapping an upload wrote back the
      pre-upload list — dropping the new file and leaking its media row. Now cross-gated both ways.
      test: TDD · dom — `disables the picker while a removal is in flight`.
- [x] 🟡 WARNING · fixed · code-review · `src/lib/leads/fetch-landing-asset.ts` · the content-type
      gate was an unanchored prefix test, so `application/pdfx` passed and cost 8 MB of transfer
      before Payload refused it with the wrong cause.
      test: TDD · unit — table over `application/zip` / `application/pdfx` / `image/svg+xml`,
      each asserted to be refused _without fetching_.
- [x] 🟡 WARNING · dismissed · code-review · `src/lib/env/schema.ts:86-87` · „make
      `LANDING_BLOB_HOST` / `LANDING_WEBHOOK_SECRET` optional" — verified benign and actively
      wrong: optional turns `serverEnv.LANDING_BLOB_HOST` into `string | undefined` and breaks
      `assertAllowedUrl`'s `.toLowerCase()`, weakening the SSRF allowlist. The comment at :82-87
      states the intent; both vars are present in `.env`.
- [x] fixed · simplify/altitude+reuse · `src/lib/actions/investment-assets.ts` +
      `src/lib/actions/transfers.ts:327-402` · the attach/detach trio was a verbatim clone of
      `setTransferInvoices` — both now call `setUploadField` / `appendUploadIds`
      (`src/lib/media/set-upload-field.ts`). One home for the read-modify-write, the awaited
      reclaim, and the append-dedup. Verified by the DB integration suite (69 files / 304 tests).
- [x] fixed · simplify/altitude · `src/lib/leads/store-lead.ts:29` · `findStoredLead` was exported
      for a caller that was never written, documented by a mechanism the route no longer uses —
      module-private again, doc corrected.
- [x] fixed · simplify · `src/lib/leads/store-lead.ts:15,79` · `StoreLeadInputT.assets` had no
      producer left (the route attaches in its second write) — deleted, and
      `store-lead.db.test.ts` now exercises the `leads_rels` round trip through that second write,
      which is the path production takes.
- [x] fixed · simplify/altitude · `src/lib/invoices/invoice-field.ts:7,10` · `InvoiceFieldT` and
      `invoiceIds` were pure aliases of `UploadFieldT` / `uploadFieldIds` — two names for one
      concept. Deleted; the three consumers import the real thing.
- [x] fixed · simplify · `src/components/forms/investment-form/investment-schema.ts:21` ·
      `assets` sat in the form-_values_ layer although no `AppField` renders it, forcing a
      placeholder `[]` at four call sites. Moved to the domain schema only;
      `InvestmentFormDataT` is now `z.input`, so a caller may omit what the submit wrapper supplies.
- [x] fixed · reuse · `src/scripts/backfill-heic-media.ts:189` · third hand-maintained media
      relations list, probing 2 of 5 collections — now derives from `MEDIA_RELATIONS`, the registry
      this slice introduced for exactly that drift.
- [x] fixed · efficiency · `src/hooks/prevent-delete.ts:52` · the guard read only `totalDocs` but
      used `payload.find`, which issues a rows query _and_ a count — `payload.count` halves the
      statements on every media delete.
- [x] fixed · efficiency · `src/lib/queries/investment-assets.ts:45` · `CACHE_TAGS.media` in the
      tag list was redundant (both writers already bust `investments`) and over-broad — any faktura
      uploaded anywhere busted every investment's gallery cache.
- [x] fixed · efficiency · `src/lib/queries/leads.ts:59` · the explicit `limit` still paid a
      discarded `COUNT(*)` — `pagination: false`.
- [x] fixed · simplify · `src/components/leads/promote-lead-dialog.tsx:12` · a keyed lookup table
      whose keys one branch immediately threw away — three literal pairs, written as three pairs.
- [x] fixed · comment-noise · `src/components/forms/investment-form/investment-schema.ts:3`,
      `src/types/leads.ts`, `src/hooks/use-media-upload.ts:41`,
      `src/components/dialogs/edit-investment-dialog.tsx:38` · three factually wrong comments
      (one falsified by the line below it, one JSDoc attached to the wrong symbol, one dangling
      referent) plus a third copy of the same rationale, trimmed to a pointer.
- [x] fixed · tailwind/next-image · `media-strip.tsx`, `investment-assets.tsx`,
      `lead-answers-dialog.tsx`, `invoice-preview-dialog.tsx` · `sizes` was absent or stale on
      every new `next/image`, so Next served wrong-resolution sources. `sizes` is now a required
      `MediaStrip` prop, and each caller's value tracks its real rendered width on this repo's
      overridden 768 / 1024 / 1280 scale.
- [x] dropped · comment-noise · slice-wide · the audit's „8 pure restatements" bucket could not be
      reproduced — a scan of all 197 added comment lines found no comment that fails the STRIP
      TEST. What actually landed is the four corrections above; nothing further was deleted.
- [x] dropped · comment-noise · `src/components/dialogs/invoice-preview-dialog.tsx:60` · proposed
      trim — the comment carries real rationale (why the pager clamps rather than resets), so it
      survives the STRIP TEST.
- [x] dropped · reuse/altitude · `investment-assets.ts` / `leads.ts` / `invoice-field.ts` ·
      proposed `toMediaFile` helper collapsing the three „drop url-less rows, map to a media file"
      copies — the three inputs are a raw SQL row, a Payload doc and a `MediaInfoT`, with different
      field names each. The caller must rename before calling, so the helper reduces to
      `x.url ? x : null`. Params == the code; no win.
- [x] dropped · altitude · `delete-unreferenced-media.ts:32` vs `prevent-delete.ts:49` · proposed
      shared `countMediaReferences` — the two genuinely differ: the guard must join the delete's
      transaction and parallelise, the cleanup must stay serial (the Neon shared-session hazard its
      docstring documents). A helper would need both behaviours as flags.
- [x] dismissed · simplify · `src/hooks/use-invoice-upload.ts` · „single-consumer wrapper, inline
      it" — the altitude audit independently called the same file the _right_ shape (a thin preset
      over the generalised `useMediaUpload`, not a fourth special case). Keeping it.
- [x] dismissed · efficiency · `src/components/investments/investment-assets.tsx:39` ·
      `router.refresh()` after an action that already revalidated — this is the app-wide optimistic
      pattern (`use-form-submit`), not a local redundancy. Changing it belongs in that hook.
- [x] skipped · efficiency · `src/lib/media/delete-unreferenced-media.ts:33` · „drop the pre-check
      loop and let the new `media` beforeDelete guard refuse instead" — real (the two walks
      double-probe the same 5 relations), but it converts a best-effort cleanup into exception
      control flow across a path that must never fail the user's mutation. Behaviour-changing and
      uncertain; the `payload.count` fix above takes the free half of the win.
- [x] filed EX-825 · e2e · slice-wide · no browser spec covers landing intake → investment gallery
      → promotion end to end; the route spec mocks the DB and fetcher, the DOM spec mocks the
      action, and `promote-lead.db.test.ts` calls the action directly. Labelled `e2e-backlog`,
      which discharges the gate's Step-3 E2E obligation.
- [x] filed EX-826 · altitude · `lib/invoices/` vs `lib/media/` · the generalisation stopped
      halfway: `useMediaUpload` still calls `submitWithInvoicePages`, `MediaStrip` mounts
      `InvoicePreviewDialog` with `invoices={files}`, and `MediaFileT` is defined _as_
      `InvoiceFileT & {...}`. Issue widened to the whole move, not just the dialog rename.
- [x] filed EX-827 · altitude · `api/webhooks/landing/route.ts:39-87` · third hand-copied webhook
      envelope (wpforms, facebook-leads, landing); they have already drifted with no record of
      which differences are intentional. Wants a `leadWebhook({…, afterCapture })` helper.
- [x] filed EX-828 · reuse/altitude · `src/lib/queries/leads.ts:49` · `resolveLeadAssets` bypasses
      the cached `fetchMediaByIds` sweep for a 375 ms ORM hydration inside a search-keyed cache.
      Blocked on widening `fetchAllMedia`'s select with `sizes_thumbnail_url`.
- [x] filed EX-829 · altitude · `src/collections/media.ts:8-15` + `20260921_0_media_kind.ts` ·
      `media.kind` has zero writers and zero readers; its whole surface is a select in `/admin`.
      Either build the promised classification or drop the column — an owner's decision, and a
      shipped prod migration, not a cleanup.
- [x] filed EX-830 · efficiency · `src/lib/actions/investment-assets.ts:65,77` · attaching a photo
      revalidates the entire investments plane because `protectedAction` accepts only
      `CACHE_TAGS` keys, never a raw entity tag. Same for the transfers pair.

## Simplify pass

Ran `/simplify` — 4 read-only agents (reuse / simplification / efficiency / altitude), 22 raw
findings, deduped to 17 distinct ones. 10 applied, 5 filed, 3 dropped, 2 dismissed, 1 skipped;
every one is a checkbox in `## Findings` above (tagged `simplify` or by audit angle). No separate
report file — this ledger is the report.

## Tests & suite

| Leg                                      | Result                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                         | clean                                                                                                                        |
| `pnpm lint`                              | 0 errors, 83 warnings (all pre-existing `no-unused-vars` in `src/migrations/*` and legacy specs)                             |
| `pnpm test` (node + dom)                 | 306 files, 3705 passed, 71/307 skipped                                                                                       |
| `pnpm test:integration` (5435 `db-test`) | 69 files, 304 passed                                                                                                         |
| `pnpm build`                             | clean (exit 0)                                                                                                               |
| `pnpm test:e2e`                          | not run — ~1h per run, and the obligation is discharged by EX-825                                                            |
| `pnpm test:parity`                       | not run — known-failing on pre-existing test-DB drift (investment #137 has 0 rows in `kosztoryses`), unrelated to this slice |

## Second pass — 2026-09-21 (cleanup callback)

The delete-on-confirmed-delivery callback (`dace70ce`) landed after the first gate closed, so it
gets its own fan-out. Same ledger, same rules; this pass's findings are below.

### Findings — second pass

- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/leads/verify-signature.ts` · one secret, no
      domain separation: `LANDING_WEBHOOK_SECRET` signed both the inbound submission and the outbound
      cleanup call, so a captured inbound signature was already a well-formed cleanup signature over
      the same bytes — and a cleanup body is nothing but a `submissionId`, which every envelope
      carries. So any copy of a signed submission (the landing's retry queue, a log) was a valid,
      never-expiring „delete this submission's files" instruction. Fixed by deriving the signing key
      from the secret AND a scope (`HMAC(secret, scope)`): `landing-submission` inbound,
      `landing-cleanup` outbound. `meta` stays on the bare secret — Meta owns that scheme. Mirrored
      in `landing_26/src/lib/contact/sign.ts` and in the shared contract doc in both repos. The
      second win is the accident, not the attacker: the signature layer now refuses a request either
      side sends to the wrong endpoint, which it previously waved through.
      test: TDD · unit — three specs in `verify-signature.test.ts` („refuses a submission signature
      presented as a cleanup instruction" + its mirror + „leaves the Meta scope on the undivided
      secret") and a scope assertion in `release-landing-assets.test.ts`. Red-first validated by
      collapsing `keyFor` back to the bare secret: 4 failed, restored, 142 passed.
- [x] 🔴 CRITICAL · fixed · code-review · `src/app/(frontend)/api/webhooks/landing/route.ts` · the
      enquiry was written only after every asset download finished, so one dead Blob URL lost the
      lead — capture first, attach in a second write, reclaim the media if that write fails.
      test: test-driven-debugging · unit — `persists the lead even when every asset fetch throws`
      and `reclaims the media it stored when the attach write fails` are the red-first repros.
- [x] 🔴 CRITICAL · fixed · code-review · `src/app/(frontend)/api/webhooks/landing/route.ts` ·
      reordering removed the `findStoredLead` pre-check, so a redelivery would re-download into a
      second set of orphan media rows — replaced by `captureLead`'s own dedup plus
      `uploadFieldIds(lead.assets).length ? [] : submission.assets`.
      test: TDD · unit — both halves pinned (`re-downloads nothing … that kept its files`,
      `retries the download when the captured lead carries no files`).
- [x] 🟡 WARNING · fixed · code-review · `src/components/investments/investment-assets.tsx:59` ·
      the remove button was self-gated only, so a removal overlapping an upload wrote back the
      pre-upload list — dropping the new file and leaking its media row. Now cross-gated both ways.
      test: TDD · dom — `disables the picker while a removal is in flight`.
- [x] 🟡 WARNING · fixed · code-review · `src/lib/leads/fetch-landing-asset.ts` · the content-type
      gate was an unanchored prefix test, so `application/pdfx` passed and cost 8 MB of transfer
      before Payload refused it with the wrong cause.
      test: TDD · unit — table over `application/zip` / `application/pdfx` / `image/svg+xml`,
      each asserted to be refused _without fetching_.
- [x] 🟡 WARNING · dismissed · code-review · `src/lib/env/schema.ts:86-87` · „make
      `LANDING_BLOB_HOST` / `LANDING_WEBHOOK_SECRET` optional" — verified benign and actively
      wrong: optional turns `serverEnv.LANDING_BLOB_HOST` into `string | undefined` and breaks
      `assertAllowedUrl`'s `.toLowerCase()`, weakening the SSRF allowlist. The comment at :82-87
      states the intent; both vars are present in `.env`.
- [x] fixed · simplify/altitude+reuse · `src/lib/actions/investment-assets.ts` +
      `src/lib/actions/transfers.ts:327-402` · the attach/detach trio was a verbatim clone of
      `setTransferInvoices` — both now call `setUploadField` / `appendUploadIds`
      (`src/lib/media/set-upload-field.ts`). One home for the read-modify-write, the awaited
      reclaim, and the append-dedup. Verified by the DB integration suite (69 files / 304 tests).
- [x] fixed · simplify/altitude · `src/lib/leads/store-lead.ts:29` · `findStoredLead` was exported
      for a caller that was never written, documented by a mechanism the route no longer uses —
      module-private again, doc corrected.
- [x] fixed · simplify · `src/lib/leads/store-lead.ts:15,79` · `StoreLeadInputT.assets` had no
      producer left (the route attaches in its second write) — deleted, and
      `store-lead.db.test.ts` now exercises the `leads_rels` round trip through that second write,
      which is the path production takes.
- [x] fixed · simplify/altitude · `src/lib/invoices/invoice-field.ts:7,10` · `InvoiceFieldT` and
      `invoiceIds` were pure aliases of `UploadFieldT` / `uploadFieldIds` — two names for one
      concept. Deleted; the three consumers import the real thing.
- [x] fixed · simplify · `src/components/forms/investment-form/investment-schema.ts:21` ·
      `assets` sat in the form-_values_ layer although no `AppField` renders it, forcing a
      placeholder `[]` at four call sites. Moved to the domain schema only;
      `InvestmentFormDataT` is now `z.input`, so a caller may omit what the submit wrapper supplies.
- [x] fixed · reuse · `src/scripts/backfill-heic-media.ts:189` · third hand-maintained media
      relations list, probing 2 of 5 collections — now derives from `MEDIA_RELATIONS`, the registry
      this slice introduced for exactly that drift.
- [x] fixed · efficiency · `src/hooks/prevent-delete.ts:52` · the guard read only `totalDocs` but
      used `payload.find`, which issues a rows query _and_ a count — `payload.count` halves the
      statements on every media delete.
- [x] fixed · efficiency · `src/lib/queries/investment-assets.ts:45` · `CACHE_TAGS.media` in the
      tag list was redundant (both writers already bust `investments`) and over-broad — any faktura
      uploaded anywhere busted every investment's gallery cache.
- [x] fixed · efficiency · `src/lib/queries/leads.ts:59` · the explicit `limit` still paid a
      discarded `COUNT(*)` — `pagination: false`.
- [x] fixed · simplify · `src/components/leads/promote-lead-dialog.tsx:12` · a keyed lookup table
      whose keys one branch immediately threw away — three literal pairs, written as three pairs.
- [x] fixed · comment-noise · `src/components/forms/investment-form/investment-schema.ts:3`,
      `src/types/leads.ts`, `src/hooks/use-media-upload.ts:41`,
      `src/components/dialogs/edit-investment-dialog.tsx:38` · three factually wrong comments
      (one falsified by the line below it, one JSDoc attached to the wrong symbol, one dangling
      referent) plus a third copy of the same rationale, trimmed to a pointer.
- [x] fixed · tailwind/next-image · `media-strip.tsx`, `investment-assets.tsx`,
      `lead-answers-dialog.tsx`, `invoice-preview-dialog.tsx` · `sizes` was absent or stale on
      every new `next/image`, so Next served wrong-resolution sources. `sizes` is now a required
      `MediaStrip` prop, and each caller's value tracks its real rendered width on this repo's
      overridden 768 / 1024 / 1280 scale.
- [x] dropped · comment-noise · slice-wide · the audit's „8 pure restatements" bucket could not be
      reproduced — a scan of all 197 added comment lines found no comment that fails the STRIP
      TEST. What actually landed is the four corrections above; nothing further was deleted.
- [x] dropped · comment-noise · `src/components/dialogs/invoice-preview-dialog.tsx:60` · proposed
      trim — the comment carries real rationale (why the pager clamps rather than resets), so it
      survives the STRIP TEST.
- [x] dropped · reuse/altitude · `investment-assets.ts` / `leads.ts` / `invoice-field.ts` ·
      proposed `toMediaFile` helper collapsing the three „drop url-less rows, map to a media file"
      copies — the three inputs are a raw SQL row, a Payload doc and a `MediaInfoT`, with different
      field names each. The caller must rename before calling, so the helper reduces to
      `x.url ? x : null`. Params == the code; no win.
- [x] dropped · altitude · `delete-unreferenced-media.ts:32` vs `prevent-delete.ts:49` · proposed
      shared `countMediaReferences` — the two genuinely differ: the guard must join the delete's
      transaction and parallelise, the cleanup must stay serial (the Neon shared-session hazard its
      docstring documents). A helper would need both behaviours as flags.
- [x] dismissed · simplify · `src/hooks/use-invoice-upload.ts` · „single-consumer wrapper, inline
      it" — the altitude audit independently called the same file the _right_ shape (a thin preset
      over the generalised `useMediaUpload`, not a fourth special case). Keeping it.
- [x] dismissed · efficiency · `src/components/investments/investment-assets.tsx:39` ·
      `router.refresh()` after an action that already revalidated — this is the app-wide optimistic
      pattern (`use-form-submit`), not a local redundancy. Changing it belongs in that hook.
- [x] skipped · efficiency · `src/lib/media/delete-unreferenced-media.ts:33` · „drop the pre-check
      loop and let the new `media` beforeDelete guard refuse instead" — real (the two walks
      double-probe the same 5 relations), but it converts a best-effort cleanup into exception
      control flow across a path that must never fail the user's mutation. Behaviour-changing and
      uncertain; the `payload.count` fix above takes the free half of the win.
- [x] filed EX-825 · e2e · slice-wide · no browser spec covers landing intake → investment gallery
      → promotion end to end; the route spec mocks the DB and fetcher, the DOM spec mocks the
      action, and `promote-lead.db.test.ts` calls the action directly. Labelled `e2e-backlog`,
      which discharges the gate's Step-3 E2E obligation.
- [x] filed EX-826 · altitude · `lib/invoices/` vs `lib/media/` · the generalisation stopped
      halfway: `useMediaUpload` still calls `submitWithInvoicePages`, `MediaStrip` mounts
      `InvoicePreviewDialog` with `invoices={files}`, and `MediaFileT` is defined _as_
      `InvoiceFileT & {...}`. Issue widened to the whole move, not just the dialog rename.
- [x] filed EX-827 · altitude · `api/webhooks/landing/route.ts:39-87` · third hand-copied webhook
      envelope (wpforms, facebook-leads, landing); they have already drifted with no record of
      which differences are intentional. Wants a `leadWebhook({…, afterCapture })` helper.
- [x] filed EX-828 · reuse/altitude · `src/lib/queries/leads.ts:49` · `resolveLeadAssets` bypasses
      the cached `fetchMediaByIds` sweep for a 375 ms ORM hydration inside a search-keyed cache.
      Blocked on widening `fetchAllMedia`'s select with `sizes_thumbnail_url`.
- [x] filed EX-829 · altitude · `src/collections/media.ts:8-15` + `20260921_0_media_kind.ts` ·
      `media.kind` has zero writers and zero readers; its whole surface is a select in `/admin`.
      Either build the promised classification or drop the column — an owner's decision, and a
      shipped prod migration, not a cleanup.
- [x] filed EX-830 · efficiency · `src/lib/actions/investment-assets.ts:65,77` · attaching a photo
      revalidates the entire investments plane because `protectedAction` accepts only
      `CACHE_TAGS` keys, never a raw entity tag. Same for the transfers pair.

## Simplify pass

Ran `/simplify` — 4 read-only agents (reuse / simplification / efficiency / altitude), 22 raw
findings, deduped to 17 distinct ones. 10 applied, 5 filed, 3 dropped, 2 dismissed, 1 skipped;
every one is a checkbox in `## Findings` above (tagged `simplify` or by audit angle). No separate
report file — this ledger is the report.

## Tests & suite

| Leg                                      | Result                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                         | clean                                                                                                                        |
| `pnpm lint`                              | 0 errors, 83 warnings (all pre-existing `no-unused-vars` in `src/migrations/*` and legacy specs)                             |
| `pnpm test` (node + dom)                 | 306 files, 3705 passed, 71/307 skipped                                                                                       |
| `pnpm test:integration` (5435 `db-test`) | 69 files, 304 passed                                                                                                         |
| `pnpm build`                             | clean (exit 0)                                                                                                               |
| `pnpm test:e2e`                          | not run — ~1h per run, and the obligation is discharged by EX-825                                                            |
| `pnpm test:parity`                       | not run — known-failing on pre-existing test-DB drift (investment #137 has 0 rows in `kosztoryses`), unrelated to this slice |

## Second pass — 2026-09-21 (cleanup callback)

The delete-on-confirmed-delivery callback (`dace70ce`) landed after the first gate closed, so it
gets its own fan-out. Same ledger, same rules; this pass's findings are below.

### Findings — second pass

- [ ] 🔵 OBSERVATION · proposed · code-review · `src/lib/leads/verify-signature.ts` · one secret, no
      domain separation: `LANDING_WEBHOOK_SECRET` signs both the inbound submission and the outbound
      cleanup call, so a captured inbound signature is already a well-formed cleanup signature over
      the same bytes. Bounded today (the cleanup body is `{submissionId}` only, and an inbound
      envelope never parses as one), but the separation belongs in the scheme, not in the body shape.
      **Held back on purpose:** it changes the cross-repo wire format while a parallel session is
      building the landing receiver — needs your call on whether to land it now or after that half
      exists.
      test: TDD · unit — a spec asserting a cleanup signature is refused by the inbound verifier,
      authored with the fix.
- [x] 🔴 CRITICAL · fixed · code-review · `src/app/(frontend)/api/webhooks/landing/route.ts:141` ·
      a redelivery whose FIRST pass dropped a file released the landing's prefix anyway — the loop
      never ran, so `failed` was empty, and the landing deletes the prefix wholesale. That deletes
      the only surviving copy of a file we never got. The release is now **counted**
      (`held === expected`), not inferred from an empty `failed`.
      test: test-driven-debugging · unit — „keeps the landing copies on a redelivery that is missing
      a file"; red-first validated by reverting the guard to `if (!failed.length)` (1 failed), then
      restored (16 passed). Its twin „releases again on a redelivery whose first pass was complete"
      pins the other side.
- [x] 🟡 WARNING · fixed · code-review · `src/app/(frontend)/api/webhooks/landing/route.ts:144` ·
      the callback's 10 s timeout sat in the response path, so a landing that is allowed to be down
      pushed a DELIVERED enquiry past the sender's retry threshold — manufacturing the redelivery
      the finding above then had to survive. Moved behind `after()`: past the response, still inside
      the invocation (`maxDuration` docstring updated to say so).
      test: no automated test · — the spec's `next/server` mock invokes `after` synchronously;
      response latency is not assertable at the unit layer and does not justify an E2E.
- [x] fixed · comment-noise · `src/lib/leads/release-landing-assets.ts:26`,
      `src/__tests__/lib/leads/release-landing-assets.test.ts` · four restating comments trimmed to
      the one trap worth keeping (`vi.hoisted`) and the one rationale (assert by verifying, not by
      recomputing the digest).
- [x] fixed · simplify · `src/__tests__/app/(frontend)/api/webhooks/landing/route.test.ts:39` ·
      the spec's hand-rolled `sign()` now delegates to the shared `signBody`.
- [x] dismissed · simplify · `src/__tests__/leads/verify-signature.test.ts:7`,
      `src/__tests__/lib/leads/landing.test.ts:36` · these two keep their hand-rolled `createHmac`
      deliberately — they are the specs OF the signature scheme, and an independent digest is the
      oracle. Swapping in `signBody` would reduce them to `verify(sign(x)) === true`, which passes
      even when both halves are wrong together.
- [x] fixed · docs · `context/reference/landing-intake-contract.md:96` · the contract predicted two
      opposite sweep outcomes for identical landing-side state. Rewritten: the sweep is a deadline,
      not a reprieve — a partial delivery's queue row is gone, so the age window reclaims the last
      copy unless a human acts. Plus a new „The callback is counted, not inferred" paragraph.
- [x] fixed · docs · `context/reference/landing-intake-contract.md:67` · name drift —
      `LANDING_CALLBACK_URL` in the doc vs `LANDING_CLEANUP_URL` in the code. Doc renamed to match
      the code, in both repos.
- [x] fixed · docs · `src/lib/leads/verify-signature.ts` · the verifier's docstring named only
      Meta's `X-Hub-Signature-256`; it now says both inbound schemes are the same mechanism.
- [x] fixed · docs · `src/lib/env/schema.ts:82` · „Both required:" headed three vars, one of them
      optional. Reworded to name the two that are.
- [x] fixed · fixture · `src/__tests__/fixtures/landing-submission.ts` (+ the byte-twin in
      `landing_26`) · asset urls now sit under the pinned `leads/<submissionId>/` prefix, so the
      fixture demonstrates the prefix the cleanup callback deletes.
- [x] dropped · structure · `src/lib/leads/` · the four lead modules could be grouped into an
      `intake/` subdir — real, but the directory has six files and no competing home; churn for
      nothing.

### Tests & suite — second pass

| Leg                                               | Result                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| landing route spec                                | 16 passed (incl. the 2 new callback cases)                                                              |
| `src/__tests__/lib/leads` + `src/__tests__/leads` | 139 passed, 6 skipped                                                                                   |
| `pnpm test` / `typecheck` / `lint` / `build`      | not re-run — the first pass's gate covered the tree; this pass touches `src/lib/leads` + its specs only |
| `pnpm test:e2e`                                   | not run (~1 h; obligation discharged by EX-825)                                                         |

## Third pass — 2026-09-21 (review of the scope change)

Read-only review of the uncommitted diff, main thread, no fan-out — a 14-file diff in one
subsystem does not earn the ceremony.

- [x] 🟡 WARNING · fixed · code-review · `src/app/(frontend)/api/webhooks/facebook-leads/route.ts:41`
      · the added `'meta'` argument pushed the call to 104 columns, past the 100 prettier enforces.
      It would have been silently reformatted by lint-staged AFTER the commit, leaving the index
      holding pre-prettier bytes — the `MM` state this slice already hit once. Formatted before
      staging instead.
      test: no automated test · — formatting is `pnpm lint` / lint-staged's job, not a spec's.
- [x] fixed · docs · `context/reference/landing-intake-contract.md:14,69` · both endpoint blocks
      still described the header as „HMAC of the RAW body", which now under-specifies it — the key
      is scoped. Each block names its scope.
- [x] dismissed · comment-noise · `src/__tests__/lib/leads/release-landing-assets.test.ts` · the
      second pass deleted three comments that did carry rationale (why an absent URL is a skip, why
      the failure is swallowed, why the body has one field). Checked: all three survive verbatim in
      `release-landing-assets.ts`'s docstring, one file away, which is where a reader looking for
      the WHY goes. Not restored.
- [x] dropped · code-review · `src/app/(frontend)/api/webhooks/landing/route.ts:141` · a redelivery
      whose envelope carries MORE assets than the first pass is silently a no-op — the guard skips
      the download because some are held, and the count then refuses the release. Safe (nothing is
      deleted) but nothing is fetched either, and no alert fires. Dropped, not filed: the landing
      re-sends its queue row verbatim, so the same `submissionId` with a grown asset list has no
      producer, and the pre-existing redelivery guard already behaved this way.
- [x] 🔵 OBSERVATION · skipped · code-review · `src/__tests__/fixtures/landing-submission.ts:13` ·
      `locale: 'pl'` was dropped from the fixture — **not this pass's edit**. It belongs to the
      parallel session that owns the „locale leaves the wire" decision, and the `landing_26` twin
      already matches, so the two are consistent. Carried into the commit because it is one hunk in
      a file this pass also edited, and splitting it would desync the twins. Flagged, not reverted.
      test: no automated test · — coverage of an optional field, and the schema still accepts it.

### Tests & suite — third pass

| Leg                                                              | Result                          |
| ---------------------------------------------------------------- | ------------------------------- |
| `pnpm typecheck`                                                 | clean                           |
| `pnpm exec eslint src/lib/leads src/app/(frontend)/api/webhooks` | clean                           |
| `pnpm exec prettier --check` (touched files)                     | clean after the fix above       |
| leads + landing route specs (node + dom)                         | 18 files, 142 passed, 6 skipped |

## Archive gate

- Findings: **0 open** — every box is checked across all three passes. The domain-separation
  finding was applied on 2026-09-21 after discussion, while the landing's receiver was still
  unbuilt and the change was still one function per side.
- Manual verification: **blocked** — `context/foundation/manual-checks.md` §„EX-802 — lead-delivery
  (wykonczymy half, 2026-09-21)" has 15 unticked boxes, and end-to-end verification is itself blocked
  on the owner-side items (Vercel Protection Bypass secret, `LANDING_CLEANUP_URL`, the landing half).

So the slice is **in review**, not done, and must not be archived until those checks are signed off.
