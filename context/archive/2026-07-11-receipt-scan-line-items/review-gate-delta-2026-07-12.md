# Review-gate ledger (DELTA) — receipt-scan-line-items (EX-443) · 2026-07-12

Slice was archived 2026-07-11; **18 commits landed on the open PR since the last gate**
(`3656449..HEAD`, ~40 files, +473/−471, mostly refactors: Zod v4 migration, nav
credits→balance + TopNav server component, invoice-thumbnail→preview button, note-dialog→
note-popover/RevealPopover, keep-open-context→store, extract-receipt by-bytes). This ledger
re-reviews **only that delta**. Prior authoritative ledger: `review-gate.md`.

Fan-out (read-only, over `3656449..HEAD`): impl-review, code-review (HIGH), tailwind-v4-audit,
feature-first-structure, module-cohesion-audit, structure-scatter-audit, comment-noise-audit.

Fan-out results: tailwind = clean · module-cohesion = clean · code-review = 1 WARNING + 4 OBSERVATIONs ·
impl-review = 1 WARNING (dismissed, deliberate) + 2 OBSERVATIONs · feature-first + scatter = invoice-preview
pair misplaced · comment-noise = 0 delete / 4 trim / 2 flag.

## Findings

<!-- [box] [severity, bug-checks only] · disposition · `source` · `file:line` · what — reason
     correctness findings carry a `test:` sub-line. Most-severe first. -->

- [x] 🟡 WARNING · **resolved by removal (superseded)** · `code-review` · `note-popover.tsx` · Notes column opened on **hover** across a 4px trigger→content gap → jank + edge-case unreachability (diagonal exit, viewport-flip reposition). Originally fixed with a hover-close bridge; **then superseded entirely (commit `d87d66f`, 2026-07-12):** `NotePopover` was collapsed onto a plain shadcn `Popover` that opens on **click**, and `RevealPopover` (its sole consumer gone) was **deleted** along with all hover-intent machinery. No hover → no gap-crossing risk → the reachability failure mode no longer exists.
      test: no automated test · **manual check now MOOT** — the pointer-timing browser check verified a hover behavior that was removed. `manual-checks.md`'s hover-bridge box (line ~74) should be dropped by whoever holds that file, not tested. Click-open was live-verified in the other agent's full pass (note-popover 6a/6b pass).
- [x] deferred → **filed EX-448** (comment `3ebe3ee0`, 2026-07-12) · `impl-review`+`code-review` · `use-invoice-files.ts:22-73` + `upload-file-client.ts:37-53` + `expense-form.tsx:169` · `setMediaId`/`getMediaId` have zero callers after scan-by-bytes (grep-confirmed); `mediaIdsRef` never populated → `getMediaIds()` always empty → the `stored`-branch in `resolveInvoiceMediaIds` is dead, and the delete/reindex bookkeeping is no-op churn. **Removal is NOT mechanical** — it changes `resolveInvoiceMediaIds`'s tested signature + the hook's contract + the call site + specs, and this exact module is earmarked for the EX-448 uuid-identity rewrite (prior ledger skipped touching it for the same reason). Deferred into EX-448 where it dies naturally; churning it now is throwaway. **Confirmed on EX-448.**
      test: no automated test · unit — pure dead-code removal when it lands under EX-448; existing `use-invoice-files.test.ts` + `invoice-media-resolve.test.ts` + tsc are the guard.
- [x] 🔵 OBSERVATION · **fixed (copy)** · `code-review` · `extract-receipt.ts:28` · Empty-MIME guard returned `'Nie znaleziono pliku'` ("file not found") for a File whose `.type===''` — the file exists; message was wrong. **Fixed:** → `'Nieobsługiwany typ pliku'`.
      test: no automated test · unit — copy-only change on a rare branch; not worth a spec.
- [x] **fixed (placement)** · `feature-first`+`structure-scatter` · `invoice-preview-button.tsx` + `invoice-preview-trigger.tsx` · Both were bare at `src/components/` root (reinforcing the old `invoice-thumbnail.tsx` stray). **Fixed:** `git mv` → `dialogs/invoice-preview-button.tsx` (composes InvoicePreviewDialog, matches `dialogs/sheet-button.tsx`) + `ui/invoice-preview-trigger.tsx` (domain-free primitive); 3 import sites updated.
- [x] **fixed (comment trims)** · `comment-noise` · 4 spots · Trimmed narration in `nav-openrouter-balance.tsx` header, `openrouter-balance.ts` header, and `reveal-popover.tsx` (×2 — clickOnly + component header); kept the load-bearing why in each.
- [x] **fixed (stale comment)** · `code-review` · `use-invoice-files.ts:62-64` · `renameFile`'s comment claimed "the upload already happened (mediaId is tracked)" — false after scan-by-bytes. **Fixed:** rewritten to the truthful display-only + single submit-time upload rationale (the dead-logic removal itself is deferred to EX-448 above).

### Dismissed / deliberate (checked)

- [x] 🟡 WARNING → dismissed · `impl-review` · `extract-receipt.ts` (cd7dfc9) · Byte-extraction reverses the plan's "files never travel a server action" constraint. **Deliberate, sound bug fix** — fixes fill-time media orphaning (removed row/swapped receipt/abandoned form), rewrote `extract-receipt-action.test.ts` to pin "writes nothing during scan", and dropped the `overrideAccess:true` admin media-rename (net safety gain). Supersedes the plan constraint knowingly; plan archives with the slice.
- [x] 🔵 OBSERVATION · dismissed · `impl-review`(payload edge) · `extract-receipt.ts` + `compress-image.ts:9` · `compressImage` skips PDFs, so a PDF receipt bypasses compression and could hit the 10mb `bodySizeLimit`. Benign: degrades to a caught per-row failure (tallied in `failedMessages`), not a crash; `bodySizeLimit:'10mb'` is generous for real receipts. Harden only if PDF receipts routinely exceed 10mb.
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `optimistic-form-store.ts` (b814baf) · keep-open-context→store move also resets `keepOpen` on fresh `openDialog`, where the old useState let the choice stick across reopens. Deliberate, documented, pinned by 2 new store tests; failed-submit retry preserves the choice. code-review independently cleared it (no stray checkbox leak — all FormFooter consumers unmount when closed).
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `openrouter-balance.ts:17-20` · `cache:'no-store'`→`next:{revalidate:60}` alongside `signal:AbortSignal.timeout(4000)`. `signal` opts out of Next's fetch memoization (dedupe-fetch short-circuits on signal); coexistence is a smell but no correctness impact — layout is already dynamic, component under `Suspense fallback={null}`, worst case one fresh ≤4s call per render. Balance may now be ≤60s stale — fine for a nav chip. Intent-flag only.
- [x] dismissed · `comment-noise`(2 flags) · `expense-form.tsx:194` ("map stays empty" — live invariant, not dangling history) + `extract-receipt-action.test.ts:151` (borderline test-title restatement, adds a useful "not X" contrast). Both carry enough why; leave as-is.

### No findings

- [x] dismissed · `tailwind-v4-audit` · Clean — 0 new pre-v4 syntax in the delta (2 pre-existing `h-[70vh]` in invoice-preview-dialog are unchanged, out of scope).
- [x] dismissed · `module-cohesion-audit` · Clean — every changed/new file is single-concern; no splits owed.

## Simplify pass

Ran /simplify (4 angle agents: reuse / simplification / efficiency / altitude) over `3656449..HEAD` +
working tree — **0 applied, 0 proposed, 0 dismissed**. All four returned clean: the delta is itself a net
simplification (extract-receipt −43 lines dropping the media round-trip; keep-open-context→store; nav
client-fetch→server component; note-dialog→shared RevealPopover; Zod v4 mechanical swaps). The only added
complexity (hover-bridge timer, DOM-built print doc) is correctness-driven and comment-justified. One
non-finding watch-item: `keepOpen` now rides `optimistic-form-store` (defensible; revisit only if that store
accretes more UI-only fields). The review-driven mechanical fixes above (hover bridge, file moves, comment
trims, empty-MIME copy) are the entirety of this gate's cleanups — /simplify found nothing further.

## Post-fan-out UI polish (commit `d87d66f`, self-reviewed)

Landed **after** the review fan-out, so the agents never saw it — recorded here for the gate. All
UI-only, typecheck-clean, net **−87 lines** (deletion-heavy), no behavior change to the scan/data paths:

- **Notatka trigger → icon-only `Info` button.** Dropped the truncated inline note text; the cell is now a
  single `Info` icon matching `InvoiceCell`'s ghost icon-button footprint (`size-9`, centered, `hover:bg-accent`).
- **Faktura + Notatka columns centered.** Added an `align: 'center'` branch to the shared table header/row
  renderers (`table-header.tsx`, `data-table-row.tsx`) — purely additive, existing `'right'`/default untouched —
  and set `meta.align: 'center'` on both columns.
- **`RevealPopover` deleted; `NotePopover` collapsed onto a plain `Popover`.** With click-to-open and a single
  consumer, the hover-intent abstraction was pure indirection (see the resolved WARNING above). Focus ring
  removed on the trigger (`outline-none`) per user's call.

Self-review: no correctness surface touched, `pnpm typecheck` **clean (exit 0)**, no new deps, no dead refs
(`grep` confirms zero `RevealPopover` references remain). No re-run of the fan-out warranted for cosmetic churn.

## Tests & suite

- **No new automated tests owed.** The delta is refactor-heavy and code-review cleared correctness on all of
  it; the applied fixes are copy (empty-MIME), placement (`git mv`, guarded by tsc), comment trims, and the
  now-deleted hover popover (superseded by click-open — no behavior left to guard).
- **Manual check — MOOT.** The hover-bridge reachability box (`manual-checks.md` ~line 74) verified a hover
  behavior removed in `d87d66f`; drop it rather than test it. Click-open was live-verified in the other agent's
  full pass (note-popover 6a/6b pass, `388d991..HEAD`).
- `pnpm typecheck` — **clean** (exit 0) after the moves + collapse + edits (re-run post-`d87d66f`).
- **Suite gate — user chose "fast legs (lint + unit)":**
  - `pnpm lint` — exit 1, **15 errors / 87 warnings**. All 15 errors are `no-undef` (`process`/`console`) in
    `scripts/inspect-sheet.mjs`, a pre-existing standalone `.mjs` script **outside the delta and untouched by
    any edit here** (awk-grouped: 15/15 in that one file, 0 in any slice/edited file). Matches the prior gate's
    recorded state. Warnings are the usual unused-arg noise in migrations + generated code. **Green for slice files.**
  - `pnpm test` (unit) — **839 passed, 24 skipped (64 files, 10 skipped), exit 0.**
  - e2e / build — not run (user scoped to fast legs).
