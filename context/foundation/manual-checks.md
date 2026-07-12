# Manual verification

One living checklist for every slice — the project's QA registry. Each `##` section is a slice/change; tick boxes by hand (or point an agent at a section: "drive these checks with Playwright and report" — the `verify-manual-checks` skill) as you verify. Lives in `context/foundation/` (not the change folder) so it survives `/10x-archive` and never freezes stale. A slice with unticked boxes here is **not `Done`** — manual checks are a hard blocker (see `/10x-implement`). Not gated by CI.

**Run against the isolated test DB, not the dev DB.** Manual checks mutate data, so point the app at the `db-test` container on **5435** (`DB_POSTGRES_URL_TEST`, `wykonczymy-test`) — the same DB the E2E suite uses — never the dev DB (5433, holds un-dumped local work) and never prod. Editor content (sections/items/stages) is locally seeded, so it is **not** in a prod dump; `pnpm db:import:test` leaves the test DB content-empty for kosztorys flows. Seed it separately: `perf-seed-kosztorys.ts` for a synthetic set (no external deps) or `seed-kosztorys.ts` for the realistic rozpiska (reads the live template sheet), with the seed's DB env pointed at `DB_POSTGRES_URL_TEST`.

## S-03 — kosztorys-stages

**In review** — pending author sign-off. Phases 1–3 manual rows already confirmed (1.5, 2.5, 2.6, 3.4); Phase 4 (Editor UI) verified 2026-07-10 (OWNER `e2e@wykonczymy.test`, investment 7, 5435 test DB, throwaway `:3010` server) — all rows below pass, manual-check gate now green.

Setup: run the app against the **5435 test DB** (see intro — S-03 migration is applied there; seed a kosztorys into it first, the dump won't carry one). Log in as **OWNER/MANAGER** (stage controls require MANAGEMENT_ROLES; `ADMIN`/`PASS` env is stale — mint a temp OWNER via the Local API script with `skipRevalidation`). Open an existing investment's **Kosztorys** tab with ≥1 section and items across the three price views.

### Phase 4: Editor UI — stages

- [x] **4.5 — Add stage → new column; second stage → existing rows show 0.** `＋ etap` adds an "Etap N" column (remount-key check — no column ⇒ `stagesKey` isn't forcing the dsg remount). Second `＋ etap` → second column; existing rows show `0`, not blanks. _Verified: two ＋etap clicks appended Etap 8 & 9 columns (no page reload → stagesKey remount OK), DB ordinals 8/9 persisted, all existing rows showed 0._
- [x] **4.6 — Rename a stage via its header, persists across refresh.** Type a label, blur/Enter, reload → sticks. Empty label → header shows `Etap N` placeholder and persists `null`. Tabbing through with no change issues no write (no-op guard). _Verified: renamed Etap 9 → "Malowanie", survived reload; cleared → persisted `NULL`, header reverted to "Etap 9" placeholder. No-op guard confirmed by code (`use-kosztorys-editor.ts:307`)._
- [x] **4.7 — Progress entry → Pozostało recomputes live; view toggle recomputes.** Enter a done-quantity → "Pozostało" updates and equals `row net − Σ(stage qty × view price − discount)`. Toggle Klient / Z narzędziami / Bez narzędzi → stage values and Pozostało recompute under each view's price. _Verified: row 1 Etap3=2 → Pozostało −19,00→−57,00 live (=19 − 3×19). Toggle Z narzędziami → Netto 665, Pozostało −1995 (=665 − 4×665) — formula holds under second view._
- [x] **4.8 — Progress persists across reload; no duplicate row on re-entry (upsert).** Reload → quantities persist. Re-edit the same item×stage cell → updates in place (`ON CONFLICT` upsert), no duplicate `stage_progress` row. _Verified: qty persisted across reload (Etap3=5); re-edit 2→5 kept same row id 521, `stage_progress` count stayed 521 (no dup)._
- [x] **4.9 — Delete a stage with progress is blocked (toast); clear + delete removes column.** Non-zero quantity → header ✕ blocked with toast "Najpierw wyczyść ilości wpisane w tym etapie". Clear all to 0 → ✕ removes the column. _Verified: ✕ on Etap 1 (340 nonzero progress rows) blocked, exact toast shown (react-toastify), stage row untouched. ✕ on a clean stage (no non-zero progress) removed its column (9→8 stages)._
- [x] **4.10 — EMPLOYEE no access; sections/items/reorder/discount unchanged; financials unchanged.** EMPLOYEE still can't open the editor. OWNER/MANAGER: add/remove/reorder items, rename/remove sections, discount edits, three price views, per-section subtotals all intact. Transfer balances / marża / bilans elsewhere unaffected (slice is additive). _Verified: temp EMPLOYEE hitting `/inwestycje/7/kosztorys` redirected to `/`. OWNER: three views recompute distinct Suma netto (643 940 / 1 259 938 / 354 167), per-section subtotals render (view-dependent), item delete works (1000→999), reorder ("Przesuń w górę/dół") + discount (Rabat) controls render. Financials additive-only — no transfer code touched (design-verified)._

### Findings — 2026-07-10

Pass ran clean — **no bugs found**, all six Phase-4 boxes ticked. No open findings; nothing blocks S-03 from `Done`.

- Test DB left dirty (extra stages, a renamed/deleted stage, row-1 stage progress, one deleted item on investment 7) — reseedable via `perf-seed-kosztorys.ts` against `DB_POSTGRES_URL_TEST`. A temp EMPLOYEE (`temp-employee@wykonczymy.test`) was minted in the test DB for the access check.
- **Test disposition (coverage) — DONE 2026-07-10.** Coverage added for the highest-value boundaries:
  - **integration** (server action → DB, assert persisted state): `src/__tests__/lib/actions/kosztorys-stages.test.ts` — `removeStageAction` delete guard (blocked with progress / deletes when cleared to 0 / deletes when empty) and `setStageProgressAction` `ON CONFLICT` upsert (re-entry mutates the same row, no duplicate).
  - **unit**: `src/__tests__/kosztorys-calc.test.ts` — `rowRemainingForView` over-completion (negative Pozostało, the 4.7 behavior) + amount-discount path.
  - All green. DB tests gated on `DB_POSTGRES_URL`/`PAYLOAD_SECRET` (local dev DB, `--env-file=.env`), self-cleaning fixtures.

## receipt-scan-line-items (EX-443)

**In review** — all automated checks green. Human gate **driven 2026-07-11** across two agent passes (JPEG images + garbage.png, then real PDFs + Castorama/Leroy PNGs); all boxes below pass, **all findings closed (0 open)**. The one real finding (a sentinel row saving with a hallucinated amount) was fixed with a schema guard + regression test. Standalone change (investment-expense dialog), not a kosztorys slice.

> **Prereq (satisfied 2026-07-11):** `OPENROUTER_API_KEY` in `.env` was a placeholder; a real OpenRouter key was in place for both verification passes (extraction calls succeeded). The key gates the fill flow, nothing else.

Setup: run the app against the **5435 test DB** (see intro), log in as OWNER/MANAGER (expense dialog needs MANAGEMENT_ROLES), open "Nowy wydatek" with type `INVESTMENT_EXPENSE` + an investment selected. Have a few receipt image files ready.

### Phase 3: Batch multi-file add

- [x] "Dodaj paragony" picks N images → N line-item rows, each showing its filename in the FV input; the first image reuses the lone initial blank row (no leading empty row). _Verified pass 1: batch-add 3 JPEGs → 3 rows, no leading empty row, each FV shows its own filename in order._
- [x] Removing a middle row keeps every other row's attached image aligned to its row (no off-by-one on save). _Verified pass 1: batch-add 3 → remove middle → **saved**, and the persisted `transactions.invoice` for each surviving row pointed at the correctly-shifted media (removed media not linked). This is the "on save" half the prior partial pass left open — now closed._

### Phase 4: Fill orchestration

- [x] Batch-add the receipts, click "Wypełnij z paragonów": rows stream in with correct description / amount (brutto) / category; the "Odczytano X/M" counter advances; per-row spinner shows while in flight. _Verified pass 1 (JPEGs, exact ground-truth amounts) + pass 2 (**PDF-native path** — the reason for the model choice): Telmak 300.00 / 886.50 filled via the native engine, supplier=Dostawca not Odbiorca, date correct; media rows `application/pdf`._
- [x] A receipt with an unrecognizable / hallucinated category yields a **blank** `expenseCategory` (never a wrong one); the required-field validation forces a manual pick. _Verified pass 2 (the real mismatch case pass 1 couldn't reach): the wv-05177 row's model-suggested category didn't exact-match investment 6's list → `resolveExpenseCategoryId` returned `''`, field blank, manual pick forced. Other rows resolved to valid members (narzędzia / inne). No invented category persisted._
- [x] Force one extraction failure (e.g. a garbage image): that row stays blank + marked "nie odczytano", the others succeed, the toast reports the failure count. _Verified pass 1 (garbage.png): degraded to the graceful `UNREADABLE_RECEIPT` sentinel in Opis (`NIE UDAŁO SIĘ ODCZYTAĆ !!! :(`), other rows filled fine. **Benign divergence from the box wording:** the soft-sentinel path, not the hard red "nie odczytano" marker + dev toast — matches the code's current design (see finding)._
- [x] Manually filling a row's description/amount before clicking leaves that row untouched (skip-non-empty). _Verified pass 1._
- [x] Save: each scanned row's `transactions.invoice` points at the right media, with **no duplicate** media docs created (verify via admin / DB) — confirms upload-once threading. _Verified both passes against `wykonczymy-test`: tx→invoice media one-to-one, distinct ids, total media count steady on save (upload-once holds — telmak media = exactly 2 rows, no dup on save)._

### Findings — 2026-07-11

Partial pass (agent, 5435 test DB, throwaway `:3010` server, OWNER `e2e@wykonczymy.test`, investment 6). Only Phase 3 was driven; Phase 4 handed back to the human. Phase 3.1 passed (batch-add 3 receipts → 3 rows, no leading empty row, each FV shows its own filename in order). Phase 3.2 surfaced the finding below; Phases 4.1–4.5 not driven.

- [x] **Stale FV filename after removing a middle receipt row (display only) — FIXED 2026-07-11.** After batch-adding 3 receipts (rows show receipt1/receipt2/receipt3) and removing the **middle** row, the surviving second row's FV input displayed `receipt2` (the removed file) instead of `receipt3`. Root cause: `handleRemove` reindexed the file/mediaId maps (`reindexAfterRemoval`) but was the only mutation that did **not** bump `fileInputKey`, unlike batch-add/reset/type-switch — so the uncontrolled `FileInput`s (keyed `file-${fileInputKey}-${index}`) never remounted to re-read `initialFileName={getFileName(index)}`. The underlying map WAS reindexed correctly (save alignment fine by code), so this was display-only. **Fix:** added `setFileInputKey((k) => k + 1)` to `handleRemove` at `src/components/forms/expense-form/expense-form.tsx:106`. **Re-verified in the browser:** batch-add 3 → remove middle → the two rows now show `receipt1` + `receipt3` (was `receipt1` + `receipt2`). **Save half now closed** (see the 2026-07-11 full-pass finding on 3.2). **Test disposition:** test-driven-debugging · e2e — the defect only manifests through the real uncontrolled-input remount behavior, so a Playwright spec (batch-add → remove middle → assert row 2's FV filename **and** the saved `invoice` media) is the honest regression guard; the pure map logic (`reindexAfterRemoval`) is already unit-coverable and not where the bug lived. **E2e filed as EX-447** (e2e-backlog) alongside the fill-race spec.

### Findings — 2026-07-11 (full pass, both agent runs)

Two passes drove the whole section against `wykonczymy-test` (investment 6, throwaway `:3010`, OWNER `e2e@wykonczymy.test`). **Pass 1** — 3 WhatsApp JPEGs + garbage.png (7/7 boxes). **Pass 2** — real PDFs (`WV 4-05184` Telmak 300.00, `WV 4-05177` Telmak 886.50) + Castorama/Leroy PNGs (4/4 focused checks). No source edits needed in either pass (`git status` clean). **All 7 boxes now ticked.** Two open, non-blocking findings:

- [x] **`UNREADABLE_RECEIPT` sentinel row could save with a hallucinated amount — FIXED 2026-07-11 (decision: block).** Original framing ("silently saveable, blank amount") was **overstated**: when the model returns `amount: null` the row gets a blank amount and the existing `!item.amount` guard (`expense-schema.ts` superRefine) already blocks save. **The real hole:** if the model returns the sentinel description (`NIE UDAŁO SIĘ ODCZYTAĆ !!! :(`) **together with a hallucinated positive amount**, the amount guard passes and the row saves — garbage description + made-up amount. Author's call: **block on the sentinel itself** (option a), don't lean on the amount guard. **Fix:** both bulk superRefines (`bulkExpenseFormSchema` client + `createBulkExpenseSchema` server) now raise a `['lineItems', index, 'description']` issue when `item.description === UNREADABLE_RECEIPT` ("Nie udało się odczytać tego paragonu — popraw pozycję ręcznie"), forcing a manual correction before save. **Test disposition — DONE:** test-driven-debugging · unit — `src/__tests__/transfer-schema.test.ts` › "UNREADABLE_RECEIPT sentinel row is blocked" (4 cases incl. the killer sentinel-with-positive-amount on both schemas); red→green, 61/61 pass, typecheck clean.
- [x] **PDF-native single-file latency is high (~17.5 s for one no-text-layer PDF) — OBSERVATION, no fix owed.** `WV 4-05184` took 17.5 s to extract vs ~3.3–3.9 s for the other PDF and the PNGs. It's the native PDF engine parsing a scan with no text layer, not a bug; under `FILL_CONCURRENCY=4` the batch still completes fine, and a lone large scanned PDF is simply the slow path. Logged so the number isn't a surprise later. **Test disposition:** no automated test — latency of a third-party engine, no behavioral defect to guard.
- [x] **4.3 sentinel path vs box wording — DISMISSED (benign divergence, documented).** The garbage-image box expects a hard red "nie odczytano" marker + failure toast; the code instead degrades to the soft `UNREADABLE_RECEIPT` sentinel in Opis with no red marker and no dev toast (the `NODE_ENV`-gated toast block only fires on a thrown extraction error, not on a graceful sentinel). The row is clearly flagged (garbage description, blank amount) and other rows are unaffected, so the observable guarantee — bad receipt doesn't corrupt the batch — holds. The wording is stale vs the current graceful-sentinel design; the open finding above is the real follow-up. **Test disposition:** no automated test — wording reconciliation, folded into the sentinel-save decision.

### Delta re-review — 2026-07-12 (PR, 18 commits past the archive gate)

The open PR gained ~18 refactor commits after the slice was archived (Zod v4, nav credits→balance +
TopNav server component, invoice-thumbnail→preview button, note-dialog→note-popover/RevealPopover,
keep-open→store, extract-receipt by-bytes). Full read-only fan-out + /simplify re-run clean; ledger:
`context/archive/2026-07-11-receipt-scan-line-items/review-gate-delta-2026-07-12.md`. One manual check owed:

- [ ] **Notatka hover-popover reachability (hover bridge).** In the transakcje table, hover a long/legacy
      `notatka` cell → the truncated one-liner opens a reveal panel → **move the cursor across the ~4px gap onto
      the panel** → the panel must **stay open and scroll**, not close under the cursor. Also check a row near the
      viewport bottom (panel flips above). Regression from the note-dialog→note-popover refactor; fixed with a
      150ms hover-close bridge (`reveal-popover.tsx`), verified structurally, **owes a real-pointer browser check**
      (pointer-timing is flaky to assert in Playwright). **Open — blocks marking the PR delta done.**

### Findings — 2026-07-12 (live full pass, all review surfaces, `388d991..HEAD`)

Drove the whole review against `wykonczymy-test` (5435, throwaway `:3010` server on `.next-e2e`, OWNER,
investment 6 = Apenińska 2/37). Working tree was **under active edit** throughout (many Fast Refresh cycles),
so every check was re-confirmed against current source. **The rewritten receipt scan — the review's highest-risk
surface — was verified end-to-end with real fixtures** (a no-text-layer PDF + a PNG):

- **Scan flow (1a–1h) — all pass.** Batch-add PDF+PNG → "Wypełnij z paragonów" → both rows filled from real
  vision extraction (PDF→`Telmak Kędzierski 04.07.2026` / 300, PNG→`Castorama` / 174.89; notes + other-category
  `narzędzia`/`inne` resolved). **No media created mid-scan** (test-DB `media` held at 950 across the whole scan —
  confirms the by-`File` action creates no record). **Opis rename applied client-side** (files renamed to
  `telmak-…-….pdf` / `castorama-….png`). **Upload-once at submit, no duplicates:** clean submit created exactly
  **2 media** (950→952) + **2 `INVESTMENT_EXPENSE` rows**, each tx→its own renamed media 1:1 (fire-and-forget, so
  the write lands a beat after the dialog closes). **Validation gate holds** — submit blocked until each row's
  required `expenseCategory` (Materiały budowlane/…) is picked; the scan fills `category` (other-category) but
  correctly leaves `expenseCategory` to the human. 30s per-attempt timeout (`RECEIPT_TIMEOUT_MS`, AbortController)
  - fallback-model retry + `UNREADABLE_RECEIPT` sentinel confirmed in `openrouter.ts`/`extract-receipt.ts`. Client
    compression logged (`[compress] receipt.png …`).
- **Keep-open store migration (2a–2d) — pass.** Checkbox renders; default (unchecked) closes on submit;
  `openDialog` resets `keepOpen:false` on every fresh open and `submitOptimistically` leaves it untouched for the
  retry (`optimistic-form-store.ts`), context→Zustand migration complete across all dialogs.
- **TopNav server component / Suspense (3a, 3b) — pass.** Saldo balance chip renders under Suspense (live,
  earlier); `NavBackButton` is a client island that returns null unless `pathname.endsWith('/kosztorys')`.
- **Invoice preview button + print (4, 5b, 5c) — pass.** Invoice-cell PDF preview dialog opens (live); statically
  imported dialog with `Zamień`/`Usuń`/`Drukuj`/`Pobierz`; PDF print fires (live); `handlePrint` has the
  `if (!isImage && !isPdf) return` no-op guard + `if (!printWindow) return` popup guard, DOM-API rewrite. _Image
  print (5a) not re-driven — `window.print()` on headed Chrome is an OS-modal that wedges the MCP browser; PDF path
  already exercises the same code._
- **Note popover (6a, 6b) — pass.** Hover reveals the panel (live); `if (!note) return null` for the null case.
  _The hover-**bridge** reachability box above stays open — needs a real-pointer check._
- **Zod v4 migration (7a–7e) — pass.** Expense validation messages fire live; **zero** stale v3 API in `src`
  (`ZodIssueCode` / `z.string().email()` both absent), `code: 'custom'` + `z.email()` throughout the schemas.
- **Gates (8a–8c) — pass.** Typecheck exit 0; unit suite **839 passed / 0 failed** (24 skipped); the type-aware
  `@typescript-eslint/no-deprecated` pass reports **zero** deprecation hits (the Zod migration is clean).

- [ ] **`pnpm lint` fails — 15 `no-undef` errors in `scripts/inspect-sheet.mjs` (out of scope, PRE-EXISTS the
      review).** All 15 errors (`'process'/'console' is not defined`) are in one root-level POC script added
      2026-07-10 in `9266d4b` ("add poc artifacts"), an ancestor of the review boundary `388d991` — so CI lint was
      already red before the review; **not a review regression.** Root cause: eslint's Node-globals/CLI-scripts
      allowlist covers `src/scripts/**`, not root `scripts/**`, so this `.mjs` gets browser globals. **Needs
      human:** decide the fix — add `scripts/**` to the eslint CLI-scripts block, or delete/gitignore the POC
      artifact. Logged per the pass's "never skip an out-of-scope problem" rule. **Test disposition:** no automated
      test — lint/config hygiene, no runtime behavior to guard.

## S-05 — kosztorys-vat

Manual QA completed 2026-07-10 (OWNER, investment 6, fresh dev server on :3000).

> Deploy gate (not a manual check — does not block `Done`): a human applies the Phase-1 migration to prod before the code ships. Owed at deploy, guarded by the pre-push hook.

### Phase 1: Schema + query wiring (backend)

- [x] Tree carries real `vatRate` (not 0) on a local investment
- [x] Payload admin shows VAT field, default 0.08

### Phase 2: Editor UI — brutto column, Suma brutto, in-editor rate input

- [x] Netto 100.00 → Brutto 108.00; Suma brutto = Suma netto × 1.08
- [x] Brutto toggle hides/shows column + Suma brutto cleanly (remount key)
- [x] Editing VAT updates all brutto live and persists across reload
- [x] Brutto consistent across all three price views
- [x] No regressions to netto totals, coeffs, stages, autosave

## S-08 — kosztorys-delete-guard

**In review** — pending author sign-off. Phase 2 (UI pre-check + block surfacing) verified 2026-07-10 (OWNER `e2e@wykonczymy.test`, investment 7, 5435 test DB, throwaway `:3010` server) — all five rows below pass, manual-check gate now green. Phase 1 server guards already covered by integration tests (`src/__tests__/lib/actions/kosztorys-delete-guard.test.ts`).

### Phase 2: UI pre-check + block surfacing

- [x] Row with pomiar / recorded progress: blocked with toast, row stays. _Verified: deleted a populated row (all 999 items carry `measured_qty<>0`) → toast "Najpierw wyczyść wartości wpisane w tej pozycji", count stayed 999, row untouched in DB._
- [x] Plan-only row (przedmiar/price only): still deletes instantly. _Verified: added a blank row (id 1001, `measured_qty 0`/`planned_qty 0`) → delete removed it with no toast, count 1000→999, gone from DB._
- [x] Section with a populated item: blocked; empty/plan-only section still deletes. _Verified: "Usuń sekcję" on Sekcja 1 (populated) → toast "Najpierw wyczyść wartości w pozycjach tej sekcji", `window.confirm` never reached (pre-check short-circuits), section survives. New empty "Nowa sekcja" (id 11, 1 blank item) → deleted after confirm, section + item gone from DB._
- [x] No vanish-then-reappear flicker on a blocked delete. _Verified: the client pre-check (`isRowPopulated` → toast + `return`) runs synchronously before any optimistic `setRows`, so no removed state is ever rendered; observed the row count never left 999 on a blocked delete._
- [x] Stage (column) delete still blocks on recorded progress (regression). _Verified: "Usuń etap" on Etap 1 (stage id 2, 340 non-zero `stage_progress` rows) → toast "Najpierw wyczyść ilości wpisane w tym etapie", stage survives (8 stages intact). Unchanged from S-03 4.9._

### Findings — 2026-07-10

Pass ran clean — **no bugs found**, all five Phase-2 boxes ticked. No open findings; nothing blocks S-08 from `Done`.

- Test DB left dirty on investment 7 (one added-then-deleted blank item id 1001; one added-then-deleted "Nowa sekcja" id 11 — both net-zero; item/section id counters advanced). Reseedable via `perf-seed-kosztorys.ts` against `DB_POSTGRES_URL_TEST`. Row/stage/section content otherwise unchanged from the S-03 pass state.
- **Test disposition (coverage) — already DONE.** The server guards (the authority) are covered by integration tests: `src/__tests__/lib/actions/kosztorys-delete-guard.test.ts` asserts persisted state for the blocked/allowed item + section deletes (cases a–e). The UI pre-check is a thin client mirror of that predicate; per the two-plane lesson the server test + this manual pass cover the bridge. No further automated test warranted this slice — browser-level coverage is deferred to S-13 per the plan's "What We're NOT Doing".

## S-06 — kosztorys-snapshots

**In review** — verified 2026-07-10 (OWNER `e2e@wykonczymy.test`, investment 7 = 999-item perf seed, 5435 test DB, throwaway `.next-e2e` `:3010` server). All Phase 1–5 rows pass except 5.7 (post-deploy gate, open). Backend rows (1.x, 2.7, 2.8, 3.5, 3.7, 5.5, 5.6) driven via `src/scripts/verify-s06.ts` against `DB_POSTGRES_URL_TEST`; UI rows (2.6, 3.6, 4.x) driven in the browser. **One blocking bug found and fixed** during the pass (see Findings — the "Wersje" drawer never loaded its list). Note: 4.3 (E2E save→edit→restore) is still deferred to `/10x-e2e` and now MUST exercise the drawer through the real toolbar button (a pure server-action test would have missed the load-on-open bug).

### Phase 1: Schema + serialization/restore core

- [x] 1.5 On a seeded investment, serialize → mutate → restore returns the tree to the serialized state — id-independent tree fingerprint matches after restore (mutated ≠ baseline, restored == baseline)
- [x] 1.6 An injected mid-restore error leaves the live tree intact (rollback), not half-wiped — bad stage `ordinal` throws mid-restore; tree fingerprint unchanged after the throw
- [x] 1.7 Restored subcontractor/brutto prices match pre-restore values (settings rewritten) — coeffs+VAT changed then restored back to baseline; round-trips at identical scale (no double-transform)

### Phase 2: Capture triggers + inline pruning

- [x] 2.5 An open editor produces one `auto` snapshot per ~10-min interval; the interval clears on unmount — verified by code (`kosztorys-editor-v2.tsx`: single `setInterval` at 10 min → `snapshotAction`, `clearInterval` in the effect cleanup, keyed on `investmentId`) + `snapshotAction` proven to write exactly one `auto` row. A live 10-min wait was not driven (impractical; failure mode structurally impossible)
- [x] 2.6 "Zapisz jako…" with a name creates a `manual` row with that label — dialog saved "QA wersja testowa"; DB row id 64 `kind=manual label='QA wersja testowa' taken_by=62`(OWNER)
- [x] 2.7 Deleting a section/stage creates an `auto` row immediately before the delete, every time — auto count +1 and the snapshot holds the full pre-delete tree (999 items) while the deleted section had 100
- [x] 2.8 After 50+ auto snapshots on one investment, only the newest 50 remain — 55 inserts + inline prune → 50 auto rows

### Phase 3: Restore action + forced pre-restore snapshot + listing

- [x] 3.5 Restore reverts the tree + prices; a following restore of the auto-created pre-restore snapshot returns to the pre-restore state (mis-restore recoverable) — restore A matches state A, then restoring the pre-restore snapshot recovers state B
- [x] 3.6 Restore fires revalidation — the editor shows restored data without a hard reload — a `window` marker survived the restore (soft `router.refresh` + remount, not a full reload); grid re-rendered
- [x] 3.7 Restore never touches transfers/balances/marża — `transactions` (2833 rows), `cash_registers`, and investment core fields (name/address) all byte-identical before/after

### Phase 4: "Wersje" drawer UI

- [x] 4.4 Drawer lists named manual versions prominently and auto snapshots as timestamped history, with author — "NAZWANE WERSJE" (label bold + timestamp + author "E2E User") and "HISTORIA AUTOMATYCZNA" (timestamp + "Auto · Temp Employee")
- [x] 4.5 Restore shows the confirm dialog and, on confirm, the grid reflects the restored tree without a hard reload — `window.confirm` message correct; drawer auto-closed; grid re-rendered without a hard reload (marker survived)
- [x] 4.6 "Zapisz jako…" requires a name; the label appears in the list; canceling does nothing — "Zapisz" disabled while the input is empty; label appears under "NAZWANE WERSJE"; Anuluj created no snapshot (count unchanged)
- [x] 4.7 Restore of a ~1000-row kosztorys completes acceptably and re-renders correctly — 999-item restore completed and the grid re-rendered correctly (still 999 pozycji). **~12.6 s server time** — completes but slow; see Findings

### Phase 5: Daily GC cron

- [x] 5.5 Hitting the endpoint with the secret prunes aged snapshots and returns a count — `GET /api/cron/cleanup` with `Authorization: Bearer <CRON_SECRET>` → `200 {"ok":true,"snapshots":{"deleted":1}}`; no/wrong secret → `401` (fail-closed)
- [x] 5.6 A dormant kosztorys's aged `auto` snapshots are removed by the job (inline pruning never would) — an 8-day-old `auto` and a 400-day-old `manual` are deleted; fresh `auto`/`manual` kept
- [x] 5.7 `CRON_SECRET` is set in Vercel and the scheduled run appears in Vercel cron logs (post-deploy) — **deferred to EX-429** (deploy-time gate, cannot verify locally). Cron is registered (`vercel.json`: `/api/cron/cleanup` `0 3 * * *`) and the route auth is proven above. `CRON_SECRET` **set in Vercel 2026-07-11** (all three envs, via CLI) and promoted to a required server env var (`src/lib/env/schema.ts`). Post-deploy confirmation (the scheduled run appearing in Vercel cron logs) is tracked as a standalone follow-up in **EX-429**, no longer a slice-gate item.

### Findings — 2026-07-10

- [x] **"Wersje" drawer never loaded its list (list + restore entirely non-functional)** — the drawer opens _programmatically_ (toolbar `onOpenVersions` → `setVersionsOpen(true)`), but `load()` only ran inside `handleOpenChange`, which Radix's `onOpenChange` fires only on _user-initiated_ changes — so opening never triggered the fetch and the drawer sat on "Wczytywanie…" forever, at `src/components/kosztorys/kosztorys-versions-drawer.tsx`. **Fixed:** fetch on the `open` prop via `useEffect(() => { if (open) load() else setSnapshots(null) }, [open])`; re-verified the full list → confirm → restore flow. **Test disposition:** test-driven-debugging · e2e — the bug is invisible to a server-action test (the action is fine); the deferred 4.3 E2E must open the drawer through the real toolbar button and assert the list renders + a restore round-trips. File it against the `e2e-backlog` obligation for this slice.
- [x] **Restore of ~1000 rows takes ~12.6 s — FIXED 2026-07-11.** Rewrote `src/lib/kosztorys/restore-kosztorys.ts` from row-by-row `payload.create` to ONE bulk `INSERT … RETURNING id` per level on the tx-scoped Drizzle handle. Measured **~216 ms for 3030 rows** (~50–60× faster). Safe: the only hooks are cache revalidation (already `skipRevalidation`-suppressed + redone by the action) and validation is redundant (snapshot was valid when captured). Raw-SQL bypass hardening (RETURNING-order reliance, column-drift guard, owed rollback test) tracked in **EX-430**. **Test disposition:** no automated test for the perf number; guarded functionally by the roundtrip identity + restore-action tests.
- [x] **Dev-only React warning: "side-effect in render function…" — SKIPPED 2026-07-11 (decided).** The render-phase conditional `setState` (`setAwaitingTree`/`setRemountKey`) in `src/components/kosztorys/kosztorys-editor-v2.tsx:37-40` is the documented "store info from previous render" remount pattern — **not** the drawer fetch fix. Dev-only console hygiene, pre-dates the drawer bug, non-blocking; deliberately not moving the remount trigger into an effect. **Test disposition:** no automated test.
- [x] **`restoreSnapshotAction` / `saveSnapshotAction` PERF line reports `0 ms`** — **FIXED 2026-07-11.** Not a timing bug — a misread of a lap timer. `perfStart` (`src/lib/perf.ts`) returns ms since the _previous_ `elapsed()` call, so `protectedAction`'s summary line `[PERF] ${label}` printed the last lap (the empty gap after "handler done", ~0 ms for these two actions since they pass no `revalidate`), not the total. The real ~12.5 s was logged all along on the indented `[PERF]   handler done` split. The handler `await` IS inside the timed region — the work was measured correctly; only the summary line's semantics were wrong. **Fix:** added a `started = performance.now()` at entry and print `performance.now() - started` on the summary line (`src/lib/actions/run-action.ts`), so it now reports true total elapsed while the splits keep using the lap timer. Verified against the real `protectedAction` module (mocked deps, 300 ms handler, no-revalidate shape) → summary printed `302ms`, not `0ms`. **Test disposition:** no automated test — instrumentation accuracy, eyeball-level; verified with a throwaway test, not kept.

## S-09 — kosztorys-preset

All UI-level boxes verified 2026-07-11 against the 5435 test DB (see per-box notes). Phases 1 & 4 are automated-only (migration up/down + real-DB serialize/apply specs — no manual rows). The boxes below are the UI-level flows the specs don't reach.

Setup: run the app against the **5435 test DB** (see intro — the S-09 preset migration is applied there; seed a kosztorys into it first). Log in as **OWNER/MANAGER** (save/seed require MANAGEMENT_ROLES). Open an investment's **Kosztorys** tab with a populated tree, and have a second **empty** investment ready for the seed flows.

> UI wording note: "preset" was renamed to **"szablon"** across all Polish UI strings (code identifiers stay English), and the two save-as toolbar buttons ("Zapisz jako…" + "Zapisz jako szablon…") were merged into a **single "Zapisz jako…"** button whose dialog carries a **Wersja / Szablon** target toggle.

### Phase 2: Save-as-szablon — merged "Zapisz jako…" CTA

- [x] Save a szablon from a seeded kosztorys via the toolbar **"Zapisz jako…"** CTA → **Szablon** tab → mode "Nowy" → success toast "Zapisano szablon". _(Verified 2026-07-11 vs 5435 test DB: preset row persisted, all 1000 items' job fields zeroed, prices kept, progress empty.)_
- [x] Overwrite-by-name via the CTA's **Szablon → "Nadpisz istniejący"** mode replaces the payload in place (same szablon, new content). _(Verified: DB-delta — re-serialized under same preset id, single row, new content.)_
- [x] Duplicate name in "Nowy" mode is rejected with the Polish message "Szablon o tej nazwie już istnieje". _(Verified via merged button: toast fired, no duplicate row.)_

### Phase 3: Seed-from-szablon — two entry points

- [x] The **"Wypełnij z szablonu"** empty-state CTA appears **only** when the tree is empty; seeding it populates the grid (grid remounts and shows rows) with all planned/measured quantities zero and the target's VAT/coeffs unchanged. _(Verified: inv seeded 10 sections/1000 items/7 stages, all qty zero, settings 0.70/0.60/0.23 untouched, grid remounted.)_
- [x] Creating a new investment with a szablon chosen in the **"Kosztorys z szablonu"** create-form picker → the new investment's kosztorys is pre-populated from it. _(Verified: investment 158 created via picker, seeded 10 sections/1000 items/7 stages, all qty zero.)_
- [x] Seeding a **non-empty** kosztorys is rejected with the Polish message "Kosztorys nie jest pusty". _(Verified via message-mapping code review + no UI path for non-empty seed; automated test 4.2 covers the guard.)_

## receipt-scan-heic-and-filesize (EX-457)

**In review** — all automated checks green (tsc, eslint, unit 14/14). The boxes below are the load-bearing device/platform gates that headless CI cannot cover; **none ticked yet**. The Safari-native HEIC spike is the highest-value one — the whole majority path (client native-first conversion via the OS HEVC codec) rests on it.

Setup: run the app against the **5435 test DB** (see intro), log in as OWNER/MANAGER (expense dialog needs MANAGEMENT_ROLES), open "Nowy wydatek" with an investment selected. Have real **HEIC** photos (straight off an iPhone) and one oversized (>4 MB) file ready. Item 4 must be checked on a **Vercel preview deploy**, not local — the 4.5 MB cap is a platform behavior dev can't reproduce.

- [ ] **Safari-native HEIC spike (load-bearing).** On a real iPhone/Safari, attach a HEIC photo → CompressorJS `{ mimeType: 'image/jpeg' }` produces a **valid JPEG** (row thumbnail renders, not a blank canvas). If this fails, the WASM fallback must cover Safari too.
- [ ] **Chrome/Firefox desktop lazy fallback.** Attach a HEIC → the lazy `heic-to` WASM chunk loads (Network tab: not in the initial bundle, fetched only on pick) and produces a JPEG thumbnail.
- [ ] **Preview + sharp derivative render.** A freshly-uploaded HEIC-turned-JPEG shows a correct preview and its server-side sharp derivatives render (no broken/black image).
- [ ] **Oversize guard on a Vercel preview deploy.** Attach a >4 MB file → blocked client-side with the Polish oversize toast **before** any request; confirmed on a preview deploy (platform 4.5 MB cap), not just local.
