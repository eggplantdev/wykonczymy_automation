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

_Trimmed at archive (2026-10-15): `fixed` findings dropped — their record is the commit. Pre-trim tally: 22 fixed, 18 dismissed, 4 dropped, 1 skipped, 0 open._

- [x] 🔵 OBSERVATION · dismissed · impl-review (EX-1065) · scope · `f8bc0a26d` (EX-990) and `96f1c3302` are not EX-1065 — benign, in this gate's scope anyway; `touch-kosztorys-prod.ts` writes prod only when a human runs it
- [x] 🔵 OBSERVATION · dismissed · impl-review (EX-1065) · `manual-checks.md` § EX-1065 box 3 open — owed manual check, tracked in the registry, not a code finding
- [x] 🔵 OBSERVATION · dropped · impl-review (EX-1066) · `plan.md` still names `BOOKING_PICKER_STATUSES` (became `OFFERED_FOR_BOOKING`) — drift already recorded in that gate's ledger; `/10x-archive` distills it
- [x] 🔵 OBSERVATION · dismissed · impl-review (EX-1066) · `CLOSED_INVESTMENT_STATUSES` / `isClosedStatus` outside plan — the EX-1066 gate's own /simplify consolidation, recorded there
- [x] 🔵 OBSERVATION · dismissed · impl-review (EX-1066) · `a4ac52ffe` badge outside plan — own manual-checks section (2 open boxes)

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
- [x] · dismissed · code-review B · `52b72f2fc 1e0a27fc3 08319d490 79af6694a 108516943 7e5df60f2 3b4a6f844 ec685e507` · verified clean
- [x] · dismissed · code-review C · `921b50f3a 128d0e66f 28cad89da b73d388fe 11286f761` · verified clean

- [x] · skipped · feature-first + scatter · `src/lib/queries/reference-data.ts` · new `fetchInvestmentNotes` runs a raw
      `SELECT … FROM investments` + mapper inside `lib/queries` — statement + mapper belong in `src/lib/db/`; keep the cache wrapper — the file already runs
      six other inline statements (`fetchReferenceData`); moving the one new one splits the file's own convention,
      and moving all seven is a layering refactor of its own, not this gate's
- [x] · dismissed · dead-code (structure trio) · `lib/db/notifications.ts` `countUnreadLeads` / `countUnreadFleetDeadlines` /
      `countUnreadWarranties`, `payout-confirmation.ts` `countRejectedPayouts`, `worker-expense-drafts.ts` `countPendingExpenseDrafts`,
      `worker-reports.ts` `countPendingReports` · superseded by `countShellBadges`, now test-only — they are the
      oracle `shell-badge-counts.db.test.ts` pins the merged statement to (its header says so); deleting them deletes the guard
- [x] · dismissed · module-cohesion · `ParagonRowT` / `DuplicateHintsStateT` / `MediaPreviewDialogPropsT` / `HiddenColumnMapT` ·
      component/module contract types beside their owner
- [x] · dismissed · module-cohesion · `use-kosztorys-editor.ts` / `kosztorys-editor-body.tsx` / `worker-expense-drafts.ts` /
      `worker-reports.ts` size · ±12 lines in this diff; pre-existing (EX-515 covers the hook)

- [x] · dismissed · tailwind-v4 · scope-wide · no pre-v4 syntax added (0 `var()`-in-brackets, 0 inline
      styles, 0 new arbitrary values); `textarea.tsx:18` `shadow-sm` matches `input.tsx` on purpose
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
