---
change_id: kategorie-assetow-i-kompresja
title: Investment asset categories and gentler compression for working files
status: archived
created: 2026-09-22
updated: 2026-09-23
archived_at: 2026-09-23T08:36:36Z
branch: kategorie-assetow-i-kompresja
worktree: null
---

## Notes

Two issues, one change, because both touch the same file-upload path.

**1. Categories.** Assets added to an investment all land in one bag. The plan is to attach an AI
that reads a floor plan and drafts a first quote — fills the kosztorys tables. For that, a plan must
be findable as a plan, not buried among random photos that would all have to be searched.

**2. Compression.** The compressor was too aggressive. It made sense for transfers (invoices), but
investment assets — most of which arrive through the landing form (`workspace/yolo/landing_26`) —
need compression you can still work with.

## First-round rulings (2026-09-22)

- **Category model: "what the file is", not "when it was made".** `media.kind`
  (`faktura` / `projekt` / `zdjecie` / `inne`, EX-802, migration `20260921_0_media_kind.ts`) already
  existed but only the admin panel wrote it; this change starts writing it from the upload path.
- **Existing rows stay `NULL`.** No backfill, no guessing from provenance.
- **Compression profile is per surface.** Invoices keep `1920×1080` / `q 0.6`; assets move toward
  the landing's `MAX_EDGE 2560` / `q 0.8`, threaded through `useMediaUpload` → `ingestPickedFiles` →
  `processUploadFile`.

> **Superseded (same day, owner):** the per-surface classification below replaced "the user picks a
> `kind`, invoice surfaces write `faktura`" — the app now writes only the `projekt` marker, and the
> compression profile follows the marker, not the surface.

## Model reversal: a marker, not a classification (2026-09-22)

> "The only thing that matters is which photos get filtered out when we hand them to the AI for
> analysis. It will analyse only one specific type, so everything else can be `NULL` — and that is
> information too."

- **`kind` is a marker.** The app writes one value — `projekt` — and nothing else. `NULL` stops
  meaning "unknown" and starts meaning "not for analysis". The EX-802 enum stays untouched; the other
  values are still set only by hand in the panel.
- **Invoice surfaces set nothing.** What the file is, the relation says (`transactions.invoice`); a
  marker would only repeat it. Nothing ever filters on `faktura`.
- **UI: one checkbox per batch** — "this is a plan/drawing" in the add-files dialog. Checked →
  `projekt`, unchecked → `NULL`. No four-value select.
- **The compression profile follows the marker.** Only files marked as a plan get `2560` / `q 0.8`;
  other assets stay at `1920×1080` / `q 0.6`. Both decisions happen at the same place and moment.
- **Marking after the fact, in the asset gallery („Oznacz jako rzut").** Closes the one path with no
  upload dialog — lead promotion, which brings the landing's uncompressed originals, the best AI
  material. **Not a backfill** — it is someone pointing at a specific file, not bulk-filling history.

## Standing ruling: old assets stay as they are (2026-09-22)

**No existing file is repaired.** No `kind` backfill, no reprocessing of files crushed by the old
compression, no recovery of originals. This was a new, still-tested feature — old compressed assets
are not a problem this change set out to solve.

Recorded because **it will come back**: app-uploaded files are irreversibly crushed to 763×1080 in
portrait, and the most valuable landing plans have `kind = NULL` — both look like "a gap to close".
They are not. Don't reopen this as a finding, a migration or a backlog task; new files come in with
the new profile and the marker, the rest stays.

## Which surfaces offer the marker (2026-09-22)

Owner: the marker must be available **when adding attachments to an investment — from the
investment edit form and from the investment's asset gallery alike**.

Both mount one component, `MediaUploadDialog` (`src/components/dialogs/media-upload-dialog.tsx`),
switched on with `allowPlanMarker` in `src/components/investments/investment-assets-control.tsx` and
`src/components/forms/investment-form/investment-assets-field.tsx`. Invoice surfaces (transfer,
expense, fleet) don't pass the prop and behave as before.

## Upload transport: client → Blob (2026-09-22)

Owner: "we need to be able to add bigger files here", and should we move entirely to the landing's
system, with separate invoice and plan compression.

The Vercel 4.5 MB request-body cap stands (detail: `context/foundation/lessons.md`), so **bigger files
get in only by the landing's route** — retrying at lower quality just crushes the plan.

- **No parallel pipeline.** `@payloadcms/storage-vercel-blob` has `clientUploads` for exactly this;
  the `media` row is still created by Payload.
- **Every surface moves**, not just assets — the old `/api/upload-file` was one gate for transfer,
  expense and fleet invoices, and leaving half of them on the old transport is drift nobody merges
  later.
- **Compression stays and stops being a limit workaround.** It becomes a quality decision: invoices
  crushed hard, plans gently.
- **Thumbnail risk accepted.** `media.upload.imageSizes` builds `thumbnail` server-side, which a
  client → Blob upload skips. No app code reads `sizes.thumbnail`; only the admin panel does
  (`adminThumbnail`), so the worst case is cosmetic.
- **Deliberately not done (review gate):**
  - **No file-size ceiling** replacing the deleted `MAX_UPLOAD_BYTES`. The MIME guard closes the
    real leak (a banked blob with no row); a size ceiling would bring back the number the plan
    deliberately dropped — a product decision, not a review cleanup. The remaining risk is function
    memory/time when re-downloading the blob, not an orphan.
  - **No browser `del()` of the blob after a failed `POST /api/media`.** The `clientUploads` token
    is write-scoped to one key and does not authorise a delete; orphan sweeping belongs to
    `kosz-plikow`.
