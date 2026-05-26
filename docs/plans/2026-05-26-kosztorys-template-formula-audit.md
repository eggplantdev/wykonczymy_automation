# Kosztorys Template — Formula Audit & Integration Findings

> Analysis of the throwaway test template
> `15AoSJfaHcGwuDCukzu5hKitWE-oPw0xrD_8xtBM2Q8I`
> ("Kopia kosztorys wzór dla konrada do testów"), audited 2026-05-26 via the
> service account using the Sheets API (`valueRenderOption: FORMULA` +
> `UNFORMATTED_VALUE`). Supports the real-Google cutover (Phase 5 of
> `2026-05-26-kosztorys-testing-without-google.md`, Task 10 of
> `2026-05-20-kosztorys-b-iframe-poc-build.md`).

---

## 1. Google access setup (what exists now)

- **Cloud project:** `wykonczymy-kosztorys-ka` (owner: personal account
  `konradantonik@gmail.com`, sandbox — to be re-done on the business account
  before production).
- **APIs enabled:** Google Sheets API + Google Drive API.
- **Service account:** `wykonczymy-sync@wykonczymy-kosztorys-ka.iam.gserviceaccount.com`.
- **Key:** JSON at `~/Downloads/wykonczymy-sa.json` (mode 0600). Pasted into
  `.env` as `GOOGLE_SERVICE_ACCOUNT_JSON` (one line); `KOSZTORYS_TEMPLATE_SHEET_ID`
  set to the test sheet ID above.
- **Sharing:** test sheet shared with the service account at Editor.
- **Verified:** service account reads the sheet end-to-end (auth → API →
  sharing chain confirmed working, not just "looks fine in my browser").

---

## 2. Data-flow architecture (decided this session)

- **One-way: app → sheet**, for material costs only. The app (the `transfers`
  table) is the single source of truth for material spend; the sheet is a
  downstream projection. No sheet → app read path.
- **Ownership split inside the sheet:**
  - `materiały ` columns **B:C, F:G, I** → owned by the app (pushed one-way).
  - Everything else (`kosztorys_robocizny`, `pokoje `, `Podsumowanie`, the
    two `zakres pracy` tabs, headers) → owned by humans editing in the iframe.
    The app never reads or writes these.
- **Column I (`transferId`) is the join key** the reconciler uses to match DB
  rows to sheet rows. Keeping it disciplined also keeps a future two-way sync
  tractable (app-origin rows have an id; human-origin rows don't).
- **Two-way sync: deferred.** If revisited, it needs a read path, a conflict
  policy, and edit attribution (column I already provides the last).
- **Column locking (`addProtectedRange`): wanted, not yet built.** Reverses the
  PoC's "trust team discipline" deferral. Pitfall: the Sheets **file owner can
  always bypass** a protected range — the lock only blocks non-owner editors,
  so auto-provisioned sheets should be **owned by the service account** for the
  lock to bite.

---

## 3. Formula audit

~35,000 formulas total. No `#REF!` anywhere — the formula graph is
structurally intact.

### Dependency map

```
materiały            2 formulas    ← APP WRITES HERE. Nearly pure data.
   │ (referenced 4× by kosztorys_robocizny)
   ▼
kosztorys_robocizny  6,232 formulas ← calculation ENGINE (qty×rate−discount)
   │
   ├──▶ "zakres pracy z narzędziami   "   14,294 formulas / 312 literals
   ├──▶ "zakres pracy z bez narzędzi "    14,294 formulas / 312 literals
   │        near-identical MIRROR/VIEW tabs; 7,809 cross-refs each to engine
   │
   └──▶ Podsumowanie    33 formulas, 28 refs to engine ← summary
pokoje                 59 formulas, 3 refs to engine   ← mostly self-contained
```

The two `zakres pracy` tabs are **materialized views** — almost no original
data, just filtered projections of the engine tab. Same read-model/projection
pattern as the app↔sheet relationship, one layer down.

### Per-tab inventory

| Tab                             | Formulas | Literals | Cross-tab refs              | Notes                                                                                  |
| ------------------------------- | -------: | -------: | --------------------------- | -------------------------------------------------------------------------------------- |
| `kosztorys_robocizny`           |    6,232 |    2,126 | materiały (4)               | The engine. Dominant patterns: `=O#*Q#-(Q#*R#)*O#`, `=D#*$Q#-(D#*$Q#*$R#)` per column. |
| `zakres pracy z narzędziami   ` |   14,294 |      312 | kosztorys_robocizny (7,809) | View tab. Pure `=kosztorys_robocizny!X#` cell mirrors.                                 |
| `zakres pracy z bez narzędzi `  |   14,294 |      312 | kosztorys_robocizny (7,809) | Near-identical clone of the above.                                                     |
| `Podsumowanie`                  |       33 |       28 | kosztorys_robocizny (28)    | Summary. `=SUMIF(kosztorys_robocizny!B:B; A#; kosztorys_robocizny!U:U)` per category.  |
| `materiały `                    |        2 |       13 | —                           | App-owned. Only `=SUM(B3:B)` (B1) and `=SUM(F3:F)` (F1).                               |
| `pokoje `                       |       59 |       21 | kosztorys_robocizny (3)     | Room breakdown. `=B#*C#`, `=(B#+C#)*#`.                                                |

### Errors found

| Cell              | Error     | Cause                                                | Verdict                                                                  |
| ----------------- | --------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `Podsumowanie!C6` | `#DIV/0!` | `=B6/$B$8`; grand total `$B$8 = 0` on empty template | Expected; self-heals with data. Optional polish: `=IFERROR(B6/$B$8; 0)`. |
| `Podsumowanie!C7` | `#DIV/0!` | `=B7/$B$8`; same                                     | Same.                                                                    |

No other error values. No `#REF!`, `#NAME?`, `#VALUE!`, etc.

### Known semantic drift (not an error, but wrong)

- `Podsumowanie!B7` ("Materiały" total) = `=kosztorys_robocizny!T398`, a drifted
  single-cell ref pointing at an **unrelated labor row**, not the materiały
  tab. So app-pushed material costs reach `materiały !B1/F1` but **never roll up
  to the Podsumowanie summary**. Acceptable for the smoke test (we verify the
  push, not the rollup). Fix in the real template:
  `Podsumowanie` "Materiały" should read `='materiały '!B1+'materiały '!F1`.
  (Tracked in the testing plan's Phase 5.)

---

## 4. Integration safety conclusions

- The app writes **only** to `materiały ` B:C / F:G / I (rows 3+). That tab has
  just 2 formulas (open-ended row-1 SUMs), both preserved. **The app's appends
  cannot clobber any of the ~35k formulas** as long as it stays in this lane.
- The row-1 totals use **open-ended ranges** (`=SUM(B3:B)`), so `INSERT_ROWS`
  appends at row 3+ are auto-included — no silent drop. (Contrast a bounded
  `=SUM(B3:B50)`, which would miss appends past row 50.)
- **Never point the app at `kosztorys_robocizny` or the `zakres pracy` tabs** —
  they hold 14k+ row-locked cross-references; writing there risks mass breakage.
- The empty-template cleanup (clearing `materiały ` B3:C/F3:G/I3:I) lost zero
  formulas; the row-1 SUMs and row-2 headers were preserved.

---

## 5. Open items

- [ ] Real template: fix `Podsumowanie` "Materiały" to reference the materiały
      tab (`='materiały '!B1+'materiały '!F1`). — Phase 5
- [ ] Optional: wrap `Podsumowanie` % cells in `IFERROR(...; 0)` so an empty
      sheet shows `0%` not `#DIV/0!`.
- [ ] Build column locking (`addProtectedRange`) on `materiały ` B:C/F:G/I;
      requires auto-provisioned sheets to be service-account-owned.
- [ ] Manual template polish: clear leftover `materiały !A4 "test "` and the
      filled-in quantities in `kosztorys_robocizny`.
- [ ] Re-do the Google Cloud setup on the business account before production.
