---
date: 2026-10-05T17:28:49+0200
researcher: Claude (Opus 5.5)
git_commit: 530f8713c43b554ec8a99ef1d1df263cedb0006c
branch: staging
repository: wykonczymy
topic: "EX-949 — a photo of a worker's hand-filled printed rozpiska becomes a zgłoszenie prac via AI"
tags:
  [research, codebase, worker-reports, worker-pdf, ai-vision, media-upload, kosztorys-item-identity]
status: complete
last_updated: 2026-10-05
last_updated_by: Claude (Opus 5.5)
last_updated_note: 'Added follow-up research for the stable-number + check-digit design, the fill-in form, the per-photo AI read, the scan action and verification (2026-10-05T18:07)'
---

# Research: EX-949 — paper → AI → zgłoszenie prac

**Date**: 2026-10-05T17:28:49+0200
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 530f8713 (working tree carries uncommitted EX-971 worker-expenses work, cited where it is the precedent)
**Branch**: staging
**Repository**: wykonczymy

## Research Question

What does the codebase already have, and what is missing, for the decisions in `change.md`: a printed
worker PDF with per-row pozycja ids + an empty quantity column + blank extra rows; one or more photos
read by AI into a zgłoszenie; entry points on the worker link `/z/…`, the worker's page, the
„Zgłoszenia prac" listing and the kosztorys editor's Pracownicy menu; the photo stored with the
zgłoszenie; printed-vs-current opis / j.m. flags; duplicate-id flags.

## Summary

Most of the pipeline exists; four things are genuinely new, and one decision needs amending.

- **Reusable as-is:** the OpenRouter vision client (`withModelFallback`, timeouts, bytes-in
  `generateObject`), the report tables and `insertWorkerReport`, the verification dialog with its
  „do przypisania ręcznie" path, acceptance (which already sums two lines on one pozycja), the
  pending badge, and post-send translation of extras (`after(translateReportExtras)`).
- **New:** (1) a scan route that is **not** management-only — token-gated for `/z/`, session for the
  rest; (2) a way to store photos without a session (no such upload path exists today); (3) a
  manager-side „create zgłoszenie for worker" action — today the only creator is token-bound;
  (4) the PDF layout changes (id, empty column, blank rows).
- **Decision 4 needs amending.** Restore, sheet import, „Wczytaj szablon" and „Wyczyść" wipe and
  re-insert the whole tree, reminting **every** pozycja id. Restore is the documented undo for an
  acceptance, so it plausibly happens while a worker holds a printout — and then every printed id is
  dead. Separately, ids within one investment are a consecutive block, so a one-digit misread lands
  on another **real** pozycja of the same rozpiska. The printed opis + j.m. must therefore be the
  verifier and the fallback key, not just a warning.
- **Two premises in `change.md` were wrong:** the worker's draft is **browser-only** (`localStorage`,
  nothing server-side until „Wyślij"), and the button is „Wyślij", not „zweryfikuj". The worker's
  own page has no report form — it links to `/z/`.

## Detailed Findings

### 1. The worker PDF

- No PDF library: an HTML string is written into a popup and the browser's print dialog saves it.
  `WorkerPrintMenuItem` (`src/components/kosztorys/editor/actions/worker-print-action.tsx:16-71`) →
  `getWorkerKosztorysPrintData` (`src/lib/queries/worker-kosztorys-print-endpoint.ts:18`) →
  `buildWorkerPrintHtml` (`src/lib/kosztorys/print/worker.ts:95-144`) → the shared
  `buildKosztorysPrintHtml` (`src/lib/kosztorys/print/build-html.ts:37-155`), also used by the offer.
- **Only management opens it**, from the editor's Pracownicy menu
  (`kosztorys-workers-menu.tsx:77`). The worker has no PDF on `/z/` or his page (`/p` retired by EX-966).
- **The header already prints both names**: `documentKind` „Kosztorys — {name}" (worker) and
  `title` = investment name (`worker.ts:130-131`, `build-html.ts:122-127`), page one only
  (`styles.ts:38-47`). For people only — the AI does not read it (owner, 2026-10-05).
- Rows: `workerPrintColumns` (`print/worker-columns.ts:39-72`), filtered by the owner's view settings.
  **No id and no row number printed today**, though `row.id` is on every row. Grouped by sekcja: band
  row → items → „Razem — sekcja" (`build-html.ts:66-111`). Etapy are columns.
- Language: worker's `language` (`pl|uk|ru`) → `translateTree` (`worker.ts:104`), labels from the
  `grid` dictionary.
- Print CSS: A4 landscape, 5.5pt, rotated headers, `c-stage-qty` 8mm / `c-qty` 10mm
  (`styles.ts:123-139`) — **too narrow to handwrite in**.
- **Where the new parts go:**
  - Id: not column 0 — index 0 carries the section rail (`build-html.ts:103-104`) and section totals
    assume opis first (`:70-74`). Either a grey span inside the opis cell, or a column appended
    **after** the `.filter(visible)` in `workerPrintColumns` so the owner's hidden-columns setting
    can't hide it.
  - Empty qty column: appended last, its own `col` class, ~15–18mm.
  - Blank „prace spoza rozpiski" rows: after the row loop / `closeSection()` (`build-html.ts:111`) —
    needs a new optional arg on the shared builder (e.g. `trailingRowsHtml`), passed only from
    `worker.ts`.
- Mismatch to watch: the report form drops items with an empty opis
  (`src/lib/kosztorys/worker-report/to-form-data.ts:13`) while the PDF prints them.

### 2. The worker's report form and draft

- `/z/[investment]/[name]/[token]` → `getWorkerReportPage(token)` → `WorkerReportView` →
  `WorkerReportForm` (`worker-report-form.tsx:27`) → `ReportGrid` (`report-grid.tsx:52`): editor body
  in preview mode + a „Zgłaszam" column (`editor/grid/report-column.tsx`). No session; the token is
  the credential.
- `/pracownicy/[id]` has **no form** — `WorkerInvestmentsSection`
  (`src/components/users/worker-investments-section.tsx:32-42`) links „Zgłoś prace" to `/z/`. So the
  worker's two entry points are one surface: **the scan button lives on `/z/`**.
- **Draft = `localStorage`**: `useReportDraft` (`worker-report/use-report-draft.ts:43-98`), key
  `worker-report-draft:{inv}:{worker}`, shape `{ qtyByItem: Record<id,string>; extras: ExtraWorkT[] }`
  (`worker-report/types.ts:1-4`); `pruneDraft` drops ids no longer in his rozpiska.
- Send: `SendBar` → `sendWorkerReportAction(token, lines)` (`src/lib/actions/worker-report.ts:28-92`)
  inside `tokenAction` (`token-action.ts:33-70`). Refuses a repeated `itemId` (`:36-38`), refuses the
  **whole** report on any item outside the tree (`foreignItem`, `token-action.ts:57-60`), refuses an
  extra's unit outside `unitOptions` (`worker-report.ts:49-54`). Inserts `pending`, then
  `after(translateReportExtras)`.
- **AI fill into the draft**: no bulk writer exists (only `setQty` / `saveExtra`). Needs one merging
  `setDraft`, a grid remount (rows seed once, keyed `${locale}-${mode}`, `report-grid.tsx:50-51,70`),
  and pre-filtering of ids against `liveItemIds`. `qtyByItem` is a map, so **two reads of one id
  cannot both live in the draft** — decision 8's "flag, never sum" must surface to the worker before
  the prefill, not in the draft.
- No etap on the report — chosen by the kierownik at acceptance (`acceptSchema.target`,
  `resolveTarget` `accept-worker-report.ts:336-359`); the archived "one report per etap" ruling was
  reversed by the spike (archive `change.md:157-165`).
- 390px: below `sm` only Opis + „Zgłaszam" show, j.m. hidden (`report-column.tsx:85-104`), fixed
  bottom footer.

### 3. Report data model, verification, entry points

- Tables (`src/migrations/20260930_2_add_worker_reports.ts`): `worker_reports` (status
  `pending|accepted|rejected` as text + CHECK — cheap to extend; target etap stored at decision);
  `worker_report_lines` (`kind rozpiska|extra`, `item_id` ON DELETE SET NULL + indexed, copied
  `description`/`unit`/`section_name`, `reported_qty`, `accepted_qty`, `created_item_id`,
  `catalogue_item_id`; `20261005_4` adds `polish_description` / `description_language`).
  **No `sent_by` / source, no media.**
- **Manager creation**: nothing in the schema forbids it; `insertWorkerReport(db, {investmentId,
workerId, lines})` (`src/lib/db/worker-reports.ts:126-151`) takes plain ids. Needs a new
  `investmentAction` repeating `tokenAction`'s gates (scope not blocked, worker active, not a
  template, items in tree). The worker's `/z/` history lists every report for his pair
  (`queries/worker-report-page.ts:85`), so a manager scan **will show there**.
- **Verification dialog lives only in the editor**: `WorkerReportReview`
  (`editor/dialogs/worker-reports/worker-report-review.tsx:63-340`) depends on
  `useKosztorysEditorContext()`. The listing already deep-links `/inwestycje/{id}/kosztorys_v2?zgloszenie={id}`
  — a manager scan from the listing should land there too; no standalone review needed.
  - Photo panel: two-column layout inside `DialogContent` (`sm:max-w-dialog-xl`).
  - Flags: `ReviewRowT` (`review-lines-table.tsx:35-48`) already has `isUnassigned`;
    `RozpiskaDescriptionCell` (`:126-160`) renders „Pozycja usunięta z rozpiski — do przypisania
    ręcznie" + `SearchSelect` + „Przenieś do prac spoza rozpiski". j.m./opis/duplicate flags belong
    beside it as more `ReviewRowT` fields.
  - Acceptance sums two lines on one pozycja per etap (`accept-worker-report.ts:274-286`), so the
    manager path can store both duplicate lines and flag them.
- Entry points:
  - „Zgłoszenia prac" (`src/app/(frontend)/zgloszenia-prac/page.tsx`, `WorkerReportsDataTable`): no
    toolbar actions today; `DataTable` has an unused `toolbar` prop (`tables/data-table/data-table.tsx:68`).
  - Editor Pracownicy menu (`toolbar/menus/kosztorys-workers-menu.tsx:26-86`): per-worker items
    Podgląd / Link do zgłoszeń / Drukuj PDF — a scan item fits beside „Drukuj PDF" with the same
    `disabled={blockReason !== undefined}`; open the review via `workerReports.openReport(id)`.
  - Pickers: `SearchSelect` (`components/ui/search-select.tsx`). Worker → investments:
    `listWorkerStageInvestments` (`db/stage-memberships.ts:25-46`). **Missing**: "workers holding an
    etap on an active investment" for the listing's first picker (`listReportFilterOptions` lists
    only workers who already reported). Closest whole-dialog precedent: EX-971's
    `expense-draft-dialog.tsx` (investment picker + photos).
- Badge: counts `status='pending'` regardless of creator (`countPendingReports`,
  `db/worker-reports.ts:297`); a manager action should pass `investmentEntityOpts(investmentId)` so
  the shell badge refreshes. Worker send uses no cache tags (reads are uncached).

### 4. AI vision and translation

- `src/lib/ai/openrouter-client.ts`: `openrouter`, `timeoutSignal`, `withModelFallback` (fallback
  `google/gemini-2.5-flash`) — generic.
- `src/lib/ai/openrouter.ts`: `RECEIPT_MODEL = 'google/gemini-3.1-flash-lite'`, 30 s + 15 s/page,
  `MAX_RECEIPT_PAGES = 8`, bytes (not URLs) as `file` parts in one `generateObject`, sentinel for
  unreadable. Receipt-specific: prompt, schema, PDF plugin (not needed for photos), post-processing,
  category list.
- Route `src/app/(frontend)/api/extract-receipt/route.ts`: `maxDuration = 300`, multipart, MIME +
  page cap — **`requireAuth(MANAGEMENT_ROLES)`** (`:30`). An API route because of the action body
  cap. Client: `scan-receipt-client.ts` sends bytes via `postFormData`, `MAX_SCAN_BYTES = 4 MB`
  (Vercel's 4.5 MB body limit); scan runs **before** upload.
- Translation: `translateToPolish` (`src/lib/ai/translate.ts:129`) is already wired for report
  extras — `after(translateReportExtras)` on send (`worker-report.ts:86-88`), manager retry on
  fallback model. **The vision read returns extras verbatim; no second translation path.**
- `OPENROUTER_API_KEY` (`src/lib/env/schema.ts:120`); AI is deliberately ungated in dev/preview
  (`context/reference/outgoing-effects-isolation.md:70-77`) — that reasoning was written for company
  invoices; worker handwriting from a public link may deserve a line there.

### 5. Photo upload and storage

- `compressImage` profiles (`src/lib/utils/compress-image.ts:15`): `INVOICE` 1920/q0.6, `PLAN`
  2560/q0.8. Small handwritten digits = **`PLAN`**; its size against the 4 MB scan cap suggests
  **one page per request**, merged client-side.
- Client upload (`src/lib/media/client-upload.ts:27`): browser → Blob via the plugin's token route,
  then `POST /api/media`. **Both hops require a session** (`payload.config.ts:117-128`
  `clientUploads.access`, `collections/media.ts:68` `create: isAuthenticated`). `clientPayload`
  carries the collection slug, so a share token can't ride it.
- **No surface accepts a file without a session.** Options: (a) own `handleUpload` route validating
  the share token in `onBeforeGenerateToken`; (b) **simpler** — the scan route already receives the
  bytes, so it creates the media row itself with `payload.create({ file, overrideAccess: true })`, as
  the landing does (`src/lib/leads/fetch-landing-asset.ts:104`).
- Attaching: EX-971's `worker_expense_draft_media` join table (migration `20261005_3`, both FKs
  cascade) is the shape; it is hand-added to `findReferencedMedia`
  (`delete-unreferenced-media.ts:103`) and `preventReferencedMediaDelete`
  (`prevent-referenced-delete.ts:22`). A `worker_report_media` table needs the same two edits.
- **Gap**: report rows cascade from investment and worker; a cascaded join row drops the reference
  without reclaiming the Blob bytes. `deleteTrashedInvestment`
  (`src/lib/investments/delete-investment-forever.ts:31`) already leaks gallery bytes the same way
  (pre-existing); leads reclaim explicitly (`src/lib/leads/erase-lead.ts:55`).
- Orphans: a photo stored at scan time whose draft is abandoned (worker path) has no owner. Either
  store at send (worker) / at create (manager), or sweep unreferenced scan media.

### 6. Pozycja identity — why decision 4 needs amending

- One wipe (`src/lib/kosztorys/restore-kosztorys.ts:35-38`: `DELETE FROM kosztorys_sections`,
  `DELETE FROM kosztorys_stages`, then `insertKosztorysTree`) serves: „Przywróć wersję"
  (`kosztorys-snapshots.ts:70`), Google-sheet import (`kosztorys-import.ts:281`), „Wczytaj szablon"
  (`reload-from-preset.ts:28`), „Wyczyść" (`kosztorys.ts:303`). All reachable on an active investment.
  Restore is documented as the undo for an acceptance (`kosztorys-editor-domain-notes.md:453-454`).
  Local DB: 43 imports across 37 investments, 3 of them over a tree with etap figures.
- Ids are a `serial` (`20260708_2_add_kosztorys_sections_items.ts:25`) that never rewinds on prod,
  so a **dead** id resolves to nothing — safe. Exceptions: local/test DBs after
  `scripts/reset-sequences.sql:27`, and a prod disaster-restore from a dump.
- **The real hazard is a misread.** A tree's ids are one consecutive block (inv. 149: 411 items,
  ids 35693–36103). A wrong digit resolves to a real pozycja of the same rozpiska — the „plausible and
  silent" failure the lesson forbids (`lessons.md:275-280`).
- No stored stable key exists. A computed one does: `itemKey` = `fold(sekcja)|foldDescription(opis)#occurrence`
  (`sheet-import/item-key.ts:47-64`), already used to carry notes/translations across the import wipe
  and by `diff-versions.ts:36-52` (id first, then text) for the same reason.
- Today's re-pointing for a lost pozycja is `exactItemMatch` (`line-draft.ts:120-128`): raw string
  equality on opis + j.m., unique match only — „Popraw literówki" or a praca present in two sections
  defeats it. The folded `catalogueKey` (`work-catalogue/catalogue-key.ts:15`) is the tolerant variant.

## Code References

- `src/lib/kosztorys/print/build-html.ts:37-155` — shared print builder (rail at col 0, section totals, header)
- `src/lib/kosztorys/print/worker.ts:95-144`, `print/worker-columns.ts:39-72`, `print/styles.ts:123-139`
- `src/components/kosztorys/worker-report/use-report-draft.ts:43-98` — localStorage draft
- `src/lib/actions/worker-report.ts:28-92`, `src/lib/actions/token-action.ts:33-70` — send + token gates
- `src/lib/db/worker-reports.ts:126-151` — `insertWorkerReport`
- `src/lib/actions/accept-worker-report.ts:182-192, 274-286, 336-359` — unassigned refusal, per-etap sum, target
- `src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:63-340`, `review-lines-table.tsx:35-160`, `line-draft.ts:120-142`
- `src/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.tsx:26-86`
- `src/app/(frontend)/zgloszenia-prac/page.tsx`, `src/components/worker-reports/worker-reports-data-table.tsx`
- `src/lib/ai/openrouter-client.ts`, `src/lib/ai/openrouter.ts:17-130`, `src/lib/ai/translate.ts:129`
- `src/app/(frontend)/api/extract-receipt/route.ts:20-47`
- `src/lib/utils/compress-image.ts:4-15`, `src/lib/media/client-upload.ts:27-63`, `src/collections/media.ts:66-95`
- `src/lib/leads/fetch-landing-asset.ts:104` — server-side media create with `overrideAccess`
- `src/lib/kosztorys/restore-kosztorys.ts:35-38` — the tree wipe
- `src/lib/kosztorys/sheet-import/item-key.ts:47-64`, `src/lib/kosztorys/work-catalogue/catalogue-key.ts:15`

## Architecture Insights

- **One action, many doors** holds: the report is keyed worker × investment, the etap is picked at
  acceptance, and `insertWorkerReport` takes plain ids. Entry points differ only in auth wrapper
  (`tokenAction` vs `investmentAction`) and what the picker supplies.
- **Read is not write.** The scan should _produce lines_, then hand them to the existing path: the
  worker's draft (client) or a manager create (server). The AI never writes a figure; the kierownik's
  tick still does — the arc's safety property survives.
- **Identity across a wipe is text, not id** everywhere else in the codebase (sheet import, version
  diff). A printed id is a fast path that must be verified by the printed text, with the text as the
  fallback key.

## Historical Context (from prior changes)

- `context/archive/2026-09-30-worker-work-reports/change.md:83-85` — arc §3: row number + QR (worker
  - etap); superseded by this change (ids, no QR, etap at acceptance).
- same, `:207-210` (#14) — a replaced rozpiska leaves lines „do przypisania ręcznie", suggestion by
  opis + j.m., "**No stable ids**"; `:262-263` — report tables stay out of every tree writer;
  `:82` — identity never goes through translated text.
- `context/foundation/lessons.md:253-258` — `worker_report_lines` is the first outside referrer of
  item ids; "the next referrer copies that shape or makes restore preserve ids". A printed id is a
  referrer on paper — it cannot be SET NULL.
- `context/foundation/lessons.md:275-280` — LLM output → FK: exact match or blank, never fuzzy.
- `context/foundation/lessons.md:2107-2133` — app uploads are re-encoded (`compressImage`); pick the
  profile at ingest, the original is gone afterwards.
- `context/changes/2026-10-05-worker-expenses/` (EX-971, uncommitted) — worker photo upload +
  `worker_expense_draft_media` join table: the storage precedent.

## Related Research

- `context/changes/2026-10-05-worker-expenses/research.md`
- `context/archive/2026-09-30-worker-work-reports/` (slice 1 of the arc)

## Open Questions

**Resolved by the owner after research (2026-10-05):** decision 4 amended as proposed (id = fast
path, verified by folded opis + j.m., text fallback, never the id alone); the scan is
**management-only**, from the „Zgłoszenia prac" listing and the editor's Pracownicy menu. That
removes the worker path entirely: no `localStorage` prefill (§2), no token-gated upload (§5 — a
session exists, so the standard client upload works), no worker-side duplicate handling.

Also resolved: a scanned zgłoszenie is **hidden** from the worker's `/z/` history (change.md #9).
**Superseding the amended decision 4 above:** the printout is in the worker's language
(`translateTree` / `translateUnit`), so a text cross-check would compare Ukrainian against Polish.
The owner chose a **stable per-pozycja number** (own sequence, preserved by restore, carried by
sheet import, `insertItems` is the single item INSERT) **plus a check digit**, and no opis / j.m.
comparison at all (change.md #4). The check-digit question below is therefore settled.

1. **`sent_by` vs `source` column (plan)** — a report must record that it came from a scan so
   `listWorkerReports` on `/z/` can exclude it; pick the column shape.
2. **Check digit on the printed id (plan)** — optional; the opis + j.m. cross-check already catches a
   misread, a check digit would only short-circuit it.
3. **Abandoned uploads (plan)** — photos uploaded before the scan whose zgłoszenie is never created
   (read failed, dialog closed) need a home or a sweep; create the report and its media links in one
   action to keep the window small.
4. **Investment purge leaks Blob bytes (pre-existing)** — fix alongside, or file separately.

## Follow-up Research 2026-10-05T18:07:26+0200

**Git Commit**: dfb01854. Covers the design after the owner's amendments (change.md #4, #8, #13, #14): a
stable per-pozycja number plus a check digit, a separate fill-in form, management-only scanning, and
no text comparison. This section supersedes Open Questions 1–3 above.

### A. Stable number (`ref`) lifecycle

- **One INSERT.** `insertItems` (`src/lib/kosztorys/insert-rows.ts:118-139`, columns :21-38) is the
  only live item insert. Seeds use `payload.create`, and `20260929_1_szablon_as_investment.ts:73`
  has already run.
- **Keep vs mint, per caller:**
  - **Keep.** Restore „Przywróć wersję" (`kosztorys-snapshots.ts:92` → `restoreKosztorys`) and a
    sheet-import _match_ (`kosztorys-import.ts:319` → `replaceTreeWithSnapshot`).
  - **Mint.** `addItemAction` (`actions/kosztorys.ts:555`), `placeCatalogueItems`
    (`place-catalogue-items.ts:39`), accepted extras (`accept-worker-report.ts:262`),
    `appendPresetSections` (`append-preset-sections.ts:58`), Wczytaj szablon
    (`reload-from-preset.ts:28`), overwrite / seed / create szablon (`kosztorys-presets.ts:103`,
    `seed-from-preset.ts:35`, `create-template.ts:28`).
  - **No insert at all.** Wyczyść leaves an empty tree. Undo/redo only re-applies values
    (`use-undo-redo.ts:9-17`); deleting a pozycja snapshots first (`actions/kosztorys.ts:582-586`),
    so it comes back only by restore. Paste only writes cells (`lockRows`,
    `kosztorys-editor-body.tsx:599`). There is no duplicate-row or move-between-sections feature.
- **Mechanism.**
  - Add an optional `ref` on the item payload; `insertItems` writes `ref ?? DEFAULT` and returns
    `ref`. Never bind an explicit NULL: it does not fire the DEFAULT (`snapshot-format.ts:145-147`).
  - Strip `ref` in `serializeKosztorysAsPreset` (`serialize-preset.ts:25-31`). That one point covers
    all five szablon paths.
- **Snapshots.**
  - `serializeTree` spreads every item field (`serialize-tree.ts:6-22`). Adding `ref` to
    `KosztorysItemT`, the tree query (`db/kosztorys-tree.ts:71-77`) and `mapItem` (:151) makes every
    new snapshot carry it.
  - Old snapshots: add `'ref'` to `TolerantT` (`snapshot-format.ts:113-124`) and
    `itemWithColumnDefaults` (:160-179). A missing `ref` mints a new number; no schema-version bump.
  - **Never fall back to `ref ?? id`.** The import plan uses synthetic ids 1..n
    (`build-import-plan.ts:164,217`).
- **Sheet import.**
  - Carry the number beside the note (`build-import-plan.ts:234`) and the translations (:237-241),
    keyed by `itemKey`.
  - The match is one-to-one. `#occurrence` is positional, so two identical opisy that the sheet
    reorders swap numbers. A renamed opis or section mints a new number.
- **Schema.**
  - `kosztorys_items` is a Payload collection, but every insert and read is raw SQL, and `push: false`
    (`payload.config.ts:69-74`). A hand-written column causes no drift. Leave `ref` out of the
    collection so a Payload create fires the DEFAULT.
  - Migration: add the column, backfill `ref = id`, `setval` a new sequence to `max(ref)` computed
    inside the migration, then DEFAULT `nextval`, `NOT NULL`, `UNIQUE`.
- **Global sequence, not per-investment.** A number is never reused, a number from another
  investment fails loudly, and the DEFAULT covers every mint path with no code. Restore is safe
  under UNIQUE: the DELETE and re-INSERT run in one transaction behind
  `lock-investment-for-replace.ts:20`. Local DB: max id 49332 over 17,039 rows, so five digits.
- **Other places keyed by item id (not in scope):** `worker_report_lines.item_id` (SET NULL on
  restore), the `/z/` draft's `qtyByItem` (`use-report-draft.ts:32-34`), and the history diff's id
  match (`history/diff-versions.ts:36-54`). Each could move to `ref` later.

### B. Check digit

- **Damm.** One 10×10 table, about 5 lines of code. It catches every single-digit error and every
  adjacent transposition, which Luhn misses (09↔90). Its result is always 0–9, and zero-padding is
  harmless. Nothing similar exists in the repo.
- **Format `35812-7`.** A dot would read as a decimal, a slash as „1", and a space merges the two
  parts.
- **Print weight.** The grey used today (`#a1a1aa` at 5.5pt) is too faint for a phone photo. Use
  ≥ 7pt and ≥ `#52525b`.

### C. The fill-in form

- **Rows.** The same set the worker link shows by default: `documentRows(…, hideEmptyRows)`
  (`print/document-rows.ts:13`) minus empty opisy (`to-form-data.ts:15-16`). The worker's scope does
  not narrow pozycje, only etapy (`worker-kosztorys.ts:83-88`). Filter on the untranslated tree,
  because `translateTree` falls back to Polish (`translate-tree.ts:34`).
- **Data and window.** `getWorkerKosztorysPrintData` (`worker-kosztorys-print-endpoint.ts:18-29`)
  already returns the tree, language and section translations. Mirror `worker-print-action.tsx`: open
  the window synchronously, then `writeAndPrint`.
- **Roles.** Management only (`worker-kosztorys.ts:144`). A blocked worker gets a disabled item
  (`kosztorys-workers-menu.tsx:69-77`).
- **Layout.**
  - The repeating `thead` and unsplittable rows exist (`styles.ts:34-35`). The worker and investment
    names are on page one only today (`worker.ts:130-131`).
- **Builder — a variant of the worker print, nothing new (owner, 2026-10-05).** The form is
  `buildWorkerPrintHtml` (`print/worker.ts:95-144`) with another column set and footer: same
  `getWorkerKosztorysPrintData`, same `translateTree` + `documentRows`, same `buildKosztorysPrintHtml`,
  same `WIDE_PRINT_STYLES`, same page handling. Custom `cell`s give Nr / opis / j.m. / Wykonano
  (`columns.ts:12-19`); a `moneyKey` no column has turns section totals off (`build-html.ts:58-59`);
  `footerHtml` carries the blank „Prace spoza rozpiski" rows (:113-114). The menu item is
  `WorkerPrintMenuItem` (`worker-print-action.tsx`) parameterised by which builder it calls.
- **i18n.** Labels live in `src/lib/i18n/dictionaries/pl.ts`. `uk`/`ru` are typed off it, so a
  missing key fails the typecheck (`translations.ts:5`).
  - Reuse `report.extrasTitle`, `grid.description`, `report.unitPlaceholder` and
    `report.qtyPlaceholder`.
  - Add `formNumber`, `formExecuted`, `formDocumentKind`.

### D. AI read

- **One photo per request.**
  - Several photos in one POST hit the 4 MB client guard (`scan-receipt-client.ts:9`).
  - Per photo, a failed page retries alone, the timeout stays fixed, and duplicate detection runs in
    our code.
  - The INVOICE profile is enough: 1920 px across A4 is about 165 DPI.
- **Reuse.** `openrouter`, `timeoutSignal`, `withModelFallback` (`openrouter-client.ts:10,23,25,39`),
  `postFormData`, `compressImage`. Move `receiptErrorDetail` (`openrouter.ts:144`) to a shared file.
- **New code.** `src/lib/ai/worker-report-scan.ts`: a schema factory (the unit enum is per call) and a
  prompt. Model: the receipt reader's own `RECEIPT_MODEL` + `withModelFallback`, unchanged (owner: use
  what is built); a model change is a follow-up only if real photos misread.
- **Units.** `unitOptions(tree units)` (`worker-report.ts:49-54`), one line per unit as
  `m2 — м²` (`translateUnit`, `translate-unit.ts:20`). The model returns the Polish value or null; the
  server re-checks against a `Set`.
- **Route.** A route, not an action. The server-action body cap is already `4.5mb`
  (`next.config.ts:20`), so the cap is no longer the reason. The route gives `maxDuration`, a
  readable error instead of a 413, and the `requireAuth(MANAGEMENT_ROLES)` gate
  (`extract-receipt/route.ts:20,30`). It persists nothing.

### E. Create action and data model

- **`createScannedReportAction` on `investmentAction`.**
  - Refuse a szablon in the handler: `investmentAction` does not, and calls `markPresetEdited`.
  - Gate through a token-less `readReportTarget` plus `reportShareRefusal` as-is
    (`share-refusal.ts:7-16`, the SELECT at `worker-report-share.ts:25-33`).
  - Refuse a blocked `resolveWorkerScope` (`token-action.ts:51-53`). No share or token is needed:
    `getWorkerReportPreview` already reads none (`worker-report-page.ts:61-65`).
  - Extract the rozpiska line build from `worker-report.ts:56-82` into a shared helper, but not the
    duplicate refusal (:35-38).
  - Refuse an empty read before inserting: empty `VALUES` is a SQL error.
  - Revalidate with `investmentEntityOpts` (`tags.ts:43`), then `after(translateReportExtras)`.
- **Report columns.**
  - `worker_reports.source` `'link' | 'scan'`, and `created_by` → users `ON DELETE SET NULL`.
  - Filter `/z/` on `source`, not on `created_by IS NULL`: deleting the kierownik's account would
    otherwise move his scans onto the worker's page.
  - Pass the filter only from `worker-report-page.ts:85`. The editor dialog
    (`queries/worker-reports.ts:18`), `listDecidableReports` and `countPendingReports` stay
    unfiltered.
- **Line columns.**
  - `is_uncertain boolean`, and `scanned_ref` for an unresolved number. That line is stored as
    `rozpiska` with `item_id NULL`, which the existing re-point / „Przenieś do prac spoza rozpiski"
    UI already handles; its label „Pozycja usunięta z rozpiski" (`review-lines-table.tsx:131-134`)
    needs a scan variant.
  - "No j.m.", "duplicate" and "unassigned" are derived at read time.
- **No-j.m. extras.** `unit = ''` satisfies NOT NULL. `extraAsItem` (`accept-worker-report.ts:387`)
  would mint a pozycja with an empty j.m., so refuse that unless a katalog praca is set: on the
  server at :221-232 and in `isLineReady` (`line-draft.ts:114-115`).
- **`worker_report_media`.**
  - Model it on `20261005_3:32-40`, with both FKs CASCADE, `position`, and an index on `media_id`.
  - Register it in `prevent-referenced-delete.ts:22` and next to `delete-unreferenced-media.ts:107`.
    Without that, the orphan discard in `submitWithUploads` could delete a committed report's photos.
  - Media kind `'inne'`: `'zdjecie'` is for site photos.
- **Duplicates.** Nothing breaks: no unique constraint, and acceptance sums per pozycja by design
  (`accept-worker-report.ts:274-286`). The real risk is „Zaznacz wszystkie"
  (`review-lines-table.tsx:84`) ticking both lines, which #8 forbids.

### F. UI

- **Listing entry.** `DataTable` `toolbar` → `<DataTableToolbar actions={…}>`, as in
  `cash-registers-table.tsx:116`.
  - Pickers use `SearchSelect` (`ui/search-select.tsx:41`). Investments come from
    `listWorkerStageInvestments` (`stage-memberships.ts:25-46`; already active, untrashed, non-szablon).
  - A new `listWorkersWithActiveStages` is needed (stage workers × active investments × live users),
    with a `'use server'` read in `queries/worker-reports.ts`.
  - Add `reportHref()` beside `REPORT_PARAM` (`report-param.ts`), replacing the inline href at
    `worker-reports-data-table.tsx:44-45`.
- **Editor entry.** A `scan` slot in `KosztorysActionsProvider` (`kosztorys-actions-context.tsx:52-89`),
  shaped like `requestShare` (`worker-actions.tsx:78`). After creation call
  `workerReports.openReport(id)` (`worker-reports-action.ts:32`). The pending count self-corrects on
  body mount (`worker-reports-dialog.tsx:51-57`).
- **Scan dialog.** In `src/components/worker-reports/`, the feature home the editor already imports
  from. Base it on EX-971's `ExpenseDraftDialog` (`useFilePickIngest`, `submitWithUploads`).
  - Promote `useObjectUrls` (`line-item-invoice-field.tsx:15`) to `src/hooks/`.
  - Progress: the `usePendingStore` pill plus a disabled „Odczytywanie…" button, blocking close while
    sending.
- **Review.**
  - A photo pane via `sm:grid-cols-[1fr_minmax(0,22rem)]` around the lines scroll
    (`worker-report-review.tsx:222,271`), with `MediaStrip` tiles opening `MediaPreviewDialog`.
  - Flags on `ReviewRowT` (`review-lines-table.tsx:35-48`), computed in the `reviewRows` map
    (`worker-report-review.tsx:105-123`) and shown in `RozpiskaDescriptionCell` /
    `ManualDescriptionCell`.
  - The header line goes at `worker-report-review.tsx:224-230`.
  - Types: `ReportLineT` / `WorkerReportT` (`worker-report/types.ts:37,65-79`), mapped by
    `toSummary` / `toLine` (`queries/worker-reports.ts:31-69`).

### Remaining open questions

- **Investment purge leaks Blob bytes** (`investmentDeleteBlocker` has no report probe): pre-existing,
  and widened by `worker_report_media`.
