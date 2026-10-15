# Review-gate ledger — staging sweep 15.10 11:22 → 18:07 · 2026-10-15

Scope: `d9f419c83..4c5898e52` — every non-merge commit touching code (`src`, `scripts`, `.husky`,
`package.json`, `vercel.json`, `context/changes/*/scripts`) after the previous sweep ledger's scope end,
33 commits, 192 files. **Deliberately overlaps** the EX-1033, ungated-commits, roundtrip-audit,
media-preview-pdf-preload, investment-status-rejected and staging-sweep-review gates — a commit
reviewed twice beats one missed (owner, 2026-10-15). Doc/archive/ledger-only commits excluded.

Clusters:

- **A — kosztorys / katalog / investments / scripts:** `485964557 101b8a610 9e0ab86d0 c08ea6d59 3acf64e03
96f1c3302 3895c6862 136710194 f8bc0a26d 29f7795aa 06af1643f f004b9d08 825e2300c a4ac52ffe 231040966`
- **B — cache / perf / db / media / tooling:** `52b72f2fc 1e0a27fc3 08319d490 79af6694a c39d84100 5a8c33612
321ebd874 108516943 7e5df60f2 de84d27f8 3b4a6f844 ec685e507`
- **C — worker expenses / worker reports:** `4c5898e52 921b50f3a 128d0e66f 28cad89da b73d388fe 11286f761`

Checks: code-review ×3 (one per cluster), 10x-impl-review (the two plans in scope:
`catalogue-auto-translate` EX-1065, `investment-status-rejected` EX-1066), comment-noise-audit,
feature-first-structure + module-cohesion-audit + structure-scatter-audit, tailwind-v4-audit.
Step 0.5 browser pass dropped: Playwright only on explicit ask.

## Findings

- [x] 🟡 WARNING · fixed · impl-review (EX-1065) · `src/app/(payload)/api/cron/translate-catalogue/route.ts:20` ·
      an OpenRouter outage reads as a green night: `translateRows` never rejects, so every batch fails and the
      route still answers `ok: true` / 200 — `daily-snapshots` answers `ok: failed === 0` for exactly this — route now answers `ok: failed === 0`
      test: TDD · unit — route spec: fill resolves `{ items: 0, failed: 3 }` → `ok: false` (each batch is already logged in `translate.ts`)
- [x] 🟡 WARNING · fixed · code-review A (`101b8a610`) · `src/lib/kosztorys/client-view/settings.ts:112`,
      `worker-view/settings.ts:90`, both view-settings dialogs · saving runs the in-memory `hiddenColumns: string[]`
      through `sanitize*` → `resolveHiddenColumns`, which reads any array as the legacy format and replaces the
      owner's choice with the code default for every column outside the frozen legacy set. Latent today (full list
      = legacy set); the first column added to either document view can then never be shown / never be hidden —
      `toStored*` maps the in-memory list itself; the dialogs hand `onSaved` the stored copy read back
      test: authored — `settings-new-column.test.ts` widens the ceiling with a mocked column, shows/hides it, round-trips
- [x] 🟡 WARNING · fixed · code-review C (`4c5898e52`) · `src/components/worker-expenses/expense-draft-duplicate-hints.tsx:41` ·
      „OK, to nie duplikat” forgotten after „Połącz” / „Rozłącz”: the `dismissed` set moved into a per-row component
      mounted under `key={item.id}`, and merge/split mint new ids → remount → the dismissed hint is back, and its
      „Duplikat” now rejects the whole merged row. Lift `dismissed` (still by `rowKey`) above the rows — now `AcceptingT.dismissedDuplicates`
      test: test-driven-debugging · DOM — authored in `pending-expense-drafts.test.tsx` „„OK, to nie duplikat” przeżywa połączenie paragonów”
- [x] 🟡 WARNING · fixed · code-review C (`4c5898e52`) · `src/components/forms/expense-form/expense-form.tsx:345` ·
      with `isSaveBlocked` out of `isBusy`, merge/split are live after a failed photo download and rebuild the row's
      files from the (empty) pages — the FV added by hand vanishes silently and „Przyjmij” locks again. Keep
      merge/split disabled while `isSaveBlocked` (as before the commit); Przyjmij/Odrzuć per row stay live — `receiptGrouping.isRegroupBlocked` disables Połącz/Rozłącz
      test: test-driven-debugging · DOM — authored „nie pozwala łączyć paragonów, gdy zdjęć nie da się pobrać”
- [x] 🟡 WARNING · fixed · code-review B (`5a8c33612`/`321ebd874`) · `src/components/dialogs/media-preview-dialog.tsx:116-136` ·
      „Drukuj” on a multi-page set with a PDF still points the print iframe at `file.url` — the very load these commits
      found never fires `load`, so `pending` never hits 0 and nothing prints. Fetch PDFs to blob URLs (shared with
      `usePdfObjectUrl`), revoke after print (predates the commits; unconfirmed in a browser) — `fetchPdfObjectUrl`
      (`lib/media/pdf-object-url.ts`) shared by the hook and `handlePrint`; object URLs revoked on `afterprint`
      test: no automated test — the browser's PDF viewer; manual check § staging-sweep-review-2 box 1
- [x] 🔵 OBSERVATION · fixed · code-review C (`4c5898e52`) · `expense-draft-duplicate-hints.tsx:44-47` · a same-draft
      twin merged into this very row hints at itself („Pozycja N” = own N) and „Duplikat” would reject the row against
      its own draft — drop a match whose twin's `itemId === itemId`
      test: TDD · DOM — authored „drops a match from this same zgłoszenie once a merge put both paragony in this row”
- [x] 🔵 OBSERVATION · fixed · code-review C (`4c5898e52`) · `expense-draft-duplicate-hints.tsx:90-96` · „Duplikat”
      ignores `grouping.disabled` (per-row „Odrzuć” honours it) — double click → `ALREADY_DECIDED` toast + resync; pass `disabled`
      test: no automated test — server already refuses the second call
- [x] 🔵 OBSERVATION · fixed · impl-review (EX-1065) · `src/app/(payload)/api/cron/translate-catalogue/route.ts` ·
      no `maxDuration = 300` though `translate.ts` sizes batches against that ceiling; every other AI/heavy route declares it
      test: no automated test — a config export
- [x] 🔵 OBSERVATION · dismissed · impl-review (EX-1065) · scope · `f8bc0a26d` (EX-990) and `96f1c3302` are not EX-1065 — benign, in this gate's scope anyway; `touch-kosztorys-prod.ts` writes prod only when a human runs it
- [x] 🔵 OBSERVATION · dismissed · impl-review (EX-1065) · `manual-checks.md` § EX-1065 box 3 open — owed manual check, tracked in the registry, not a code finding
- [x] 🔵 OBSERVATION · dropped · impl-review (EX-1066) · `plan.md` still names `BOOKING_PICKER_STATUSES` (became `OFFERED_FOR_BOOKING`) — drift already recorded in that gate's ledger; `/10x-archive` distills it
- [x] 🔵 OBSERVATION · dismissed · impl-review (EX-1066) · `CLOSED_INVESTMENT_STATUSES` / `isClosedStatus` outside plan — the EX-1066 gate's own /simplify consolidation, recorded there
- [x] 🔵 OBSERVATION · dismissed · impl-review (EX-1066) · `a4ac52ffe` badge outside plan — own manual-checks section (2 open boxes)
- [x] 🔵 OBSERVATION · fixed · impl-review (EX-1066) + comment-noise · `src/lib/db/snapshots.ts:79` · comment says excluded kosztorysy can no longer change — an Odrzucona one stays editable; and the clause after the colon restates the WHERE — reword to „investments still worth a nightly version”, drop the restatement
      test: no automated test — comment only

- [x] · fixed · code-review C · `src/components/worker-expenses/draft-prefill.ts:44` · doc says files are empty
      „and the dialog opens only to reject” — a read zgłoszenie is now acceptable with a photo added by hand — reworded
- [x] · dropped · code-review C · `src/components/worker-expenses/use-expense-draft-acceptance.tsx:236` ·
      `aiReadRows.length === 0` re-derives `ExpenseForm`'s `isParagonMode` — a shared helper would be the same one
      comparison under a name, across a component boundary; no win
- [x] · dropped · code-review C · `expense-draft-duplicate-hints.tsx:50` + `expense-form.tsx:378` · `paragonOfReadRow`
      per row × per paragon is O(n³) per render — dozens of paragony at most; not worth the churn
- [x] 🔵 OBSERVATION · dismissed · code-review A (`3acf64e03`) · `src/lib/actions/work-catalogue.ts:177` ·
      „Aktualizuj pozycję w katalogu prac” is hidden in a szablon only in the UI; the action still accepts a szablon
      pozycja (stale tab / direct call, management only) — owner, 2026-10-15: goes away when the szablon moves to its
      own tables (`szablon-own-structure`), no refusal now
- [x] 🔵 OBSERVATION · dismissed · code-review A (`06af1643f`) · `src/lib/kosztorys/worker-payout-pairs.ts:104` · a
      worker's debt on an Odrzucona investment counts as „aktywne” (only „Zakończona” goes to „zakończone”) — fits
      „status is a label, not a gate”, but the bucket was never ruled on — unreachable: an Odrzucona investment has no executed work, so no debt to bucket (owner, 2026-10-15)
- [x] 🔵 OBSERVATION · dismissed · code-review A (`06af1643f`) · `src/lib/db/snapshots.ts:226` · Odrzucona snapshots never
      purged (no `completed_at`) — bounded, line 84 stops new nightly ones
- [x] · dismissed · code-review A · `translate-catalogue/route.ts` `maxDuration` · duplicate of the impl-review line above
- [x] · dismissed · code-review A · `485964557 9e0ab86d0 c08ea6d59 96f1c3302 3895c6862 f8bc0a26d 29f7795aa f004b9d08
    825e2300c a4ac52ffe 231040966` + migration `20261015_0` · verified clean
- [x] 🔵 OBSERVATION · dropped · code-review B (`c39d84100`) · `src/payload.config.ts:79` · pool `error` listener lost
      after Payload's dev HMR `reload()` — dev only, production never reloads
- [x] 🔵 OBSERVATION · dismissed · code-review B (`5a8c33612`) · `preload-preview-neighbours.ts:7` · up to 4 PDFs
      prefetched on a phone — preview is outside phone scope (EX-785); deliberate
- [x] · fixed · code-review B (`de84d27f8`) · `src/components/ui/textarea.tsx:8-10` · deleted „A caller's `rows` stays
      the floor.” — it was the why of `Math.max(rows ?? 0, …)`; restore
- [x] · dismissed · code-review B · `52b72f2fc 1e0a27fc3 08319d490 79af6694a 108516943 7e5df60f2 3b4a6f844 ec685e507` · verified clean
- [x] · dismissed · code-review C · `921b50f3a 128d0e66f 28cad89da b73d388fe 11286f761` · verified clean

- [x] · skipped · feature-first + scatter · `src/lib/queries/reference-data.ts` · new `fetchInvestmentNotes` runs a raw
      `SELECT … FROM investments` + mapper inside `lib/queries` — statement + mapper belong in `src/lib/db/`; keep the cache wrapper — the file already runs
      six other inline statements (`fetchReferenceData`); moving the one new one splits the file's own convention,
      and moving all seven is a layering refactor of its own, not this gate's
- [x] · fixed · feature-first · `src/__tests__/sum-transfers.test.ts` · grew +94 lines of `listTransferFacets` coverage at
      the legacy top level — `git mv` to `src/__tests__/lib/db/sum-transfers.test.ts` (the same diff mirrored `dashboard.test.ts`)
- [x] · fixed · module-cohesion · `src/lib/constants/investment-status.ts` `isOfferedForBooking` ↔ `investment-lock.ts`
      `isBookableInvestment` · two booking rules whose docblocks warn against widening one into the other, split across files — colocated
      in `investment-lock.ts`, spec merged into `investment-lock.test.ts`
- [x] · fixed · structure-scatter · `src/components/forms/form-fields/{line-items-field,collapsible-line-item,line-item-invoice-field}.tsx` ·
      one consumer (`expense-form`), now paragon-specific — moved to `forms/expense-form/`, dropped from the `form-fields` barrel
- [x] · fixed · structure-scatter · `src/components/dialogs/preload-preview-neighbours.ts` · 5th media-preview file in generic
      `dialogs/` while `src/components/media/` exists — the five media-preview files + their spec moved to `media/`
- [x] · dismissed · dead-code (structure trio) · `lib/db/notifications.ts` `countUnreadLeads` / `countUnreadFleetDeadlines` /
      `countUnreadWarranties`, `payout-confirmation.ts` `countRejectedPayouts`, `worker-expense-drafts.ts` `countPendingExpenseDrafts`,
      `worker-reports.ts` `countPendingReports` · superseded by `countShellBadges`, now test-only — they are the
      oracle `shell-badge-counts.db.test.ts` pins the merged statement to (its header says so); deleting them deletes the guard
- [x] · fixed · primitive-reuse (structure trio) · `src/scripts/fill-translations-from-catalogue.ts:118-123` · repeats the
      body of `fillCatalogueTranslations` — `--apply` calls the helper
- [x] · dismissed · module-cohesion · `ParagonRowT` / `DuplicateHintsStateT` / `MediaPreviewDialogPropsT` / `HiddenColumnMapT` ·
      component/module contract types beside their owner
- [x] · dismissed · module-cohesion · `use-kosztorys-editor.ts` / `kosztorys-editor-body.tsx` / `worker-expense-drafts.ts` /
      `worker-reports.ts` size · ±12 lines in this diff; pre-existing (EX-515 covers the hook)

- [x] · dismissed · tailwind-v4 · scope-wide · no pre-v4 syntax added (0 `var()`-in-brackets, 0 inline
      styles, 0 new arbitrary values); `textarea.tsx:18` `shadow-sm` matches `input.tsx` on purpose
- [x] · fixed · comment-noise · `scripts/perf/lib.mjs:21` · JSDoc restates `login()` — delete
- [x] · fixed · comment-noise · `scripts/perf/lib.mjs:37` · JSDoc narrates Next's RSC/prefetch modes — delete
- [x] · fixed · comment-noise · `src/components/worker-expenses/expense-draft-duplicate-hints.tsx:21,43` · „The form row these hints frame” / „A paragon of this same zgłoszenie…” restate `itemId` / `twinOf` — delete
- [x] · fixed · comment-noise · `src/hooks/use-plan-marker.ts:10` · header paragraph names the hook — drop it, keep the why paragraph
- [x] · fixed · comment-noise · `src/lib/ai/fill-catalogue-translations.ts:6` · caller list — trim to the szablony why
- [x] · fixed · comment-noise · `src/lib/constants/investment-lock.ts:47` · spliced JSDoc line past 100 cols — reflow
- [x] · dismissed · comment-noise · `src/app/(payload)/api/cron/translate-catalogue/route.ts:10` · „Scheduled from vercel.json.” — mirrors `fleet-reminders/route.ts:10`; points at the config that owns the schedule
- [x] · dismissed · comment-noise · `src/components/worker-expenses/expense-draft-duplicate-hints.tsx:40` · „OK only hides … nothing is stored” — states a deliberate non-persistence decision, not visible from `useState` alone (could have been a server dismiss)

## Simplify pass

Ran the gate's fix pass by hand (no separate /simplify report) — 22 fixed, 1 skipped, 1 dropped, 1 dismissed in this pass; each folded
into ## Findings above. No further reuse/altitude findings surfaced while applying them.

## Tests & suite

New/changed specs (not run — the test hook needs the user's explicit go):
`src/__tests__/lib/kosztorys/client-view/settings-new-column.test.ts`,
`src/__tests__/app/(payload)/api/cron/translate-catalogue/route.test.ts`,
`src/__tests__/components/worker-expenses/{expense-draft-duplicate-mark,pending-expense-drafts}.test.tsx`,
`src/__tests__/lib/constants/investment-lock.test.ts` (merged), moved `lib/db/sum-transfers.test.ts`,
`components/media/media-preview-dialog.test.tsx`. Typecheck not run either.
