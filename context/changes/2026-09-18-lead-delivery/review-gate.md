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
      each asserted to be refused *without fetching*.
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
      `assets` sat in the form-*values* layer although no `AppField` renders it, forcing a
      placeholder `[]` at four call sites. Moved to the domain schema only;
      `InvestmentFormDataT` is now `z.input`, so a caller may omit what the submit wrapper supplies.
- [x] fixed · reuse · `src/scripts/backfill-heic-media.ts:189` · third hand-maintained media
      relations list, probing 2 of 5 collections — now derives from `MEDIA_RELATIONS`, the registry
      this slice introduced for exactly that drift.
- [x] fixed · efficiency · `src/hooks/prevent-delete.ts:52` · the guard read only `totalDocs` but
      used `payload.find`, which issues a rows query *and* a count — `payload.count` halves the
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
      it" — the altitude audit independently called the same file the *right* shape (a thin preset
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
      `InvoicePreviewDialog` with `invoices={files}`, and `MediaFileT` is defined *as*
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

| Leg | Result |
| --- | --- |
| `pnpm typecheck` | clean |
| `pnpm lint` | 0 errors, 83 warnings (all pre-existing `no-unused-vars` in `src/migrations/*` and legacy specs) |
| `pnpm test` (node + dom) | 306 files, 3705 passed, 71/307 skipped |
| `pnpm test:integration` (5435 `db-test`) | 69 files, 304 passed |
| `pnpm build` | clean (exit 0) |
| `pnpm test:e2e` | not run — ~1h per run, and the obligation is discharged by EX-825 |
| `pnpm test:parity` | not run — known-failing on pre-existing test-DB drift (investment #137 has 0 rows in `kosztoryses`), unrelated to this slice |

## Archive gate

- Findings: **0 open** — every box is checked.
- Manual verification: **blocked** — `context/foundation/manual-checks.md` §„EX-802 — lead-delivery
  (wykonczymy half, 2026-09-21)" has 15 unticked boxes.

So the slice is **in review**, not done, and must not be archived until those checks are signed off.
