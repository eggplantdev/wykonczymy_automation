---
change_id: robocizna-from-kosztorys
title: Derive investment robocizna from the kosztorys executed-work total (retire the manual LABOR_COST workaround)
status: implementing
created: 2026-07-19
updated: 2026-07-19
archived_at: null
branch: kosztorys-bridge
worktree: null
---

## Notes

Owner vision (2026-07-19): investment-page **robocizna and rabat should BE kosztorys values, read**,
not hand-entered `LABOR_COST` / `RABAT` transfers. Those transfers were temporary workarounds — the
two "no source register" billing figures that only ever existed to carry a number, never cash.

This is a **pure read**, NOT a write-back, and does **not** cross FR-015 (a _write_ firewall). Marża
and bilans are already computed on read; only the _source_ of two of their inputs changes. No new
transactions, no mutation of the kosztorys.

Owner constraints captured this session:

- `totalLaborCosts` ← kosztorys „Suma prac wykonanych" (executed Σetapów, client view, **gross**,
  **pre-rabat**). A client billed at netto is the `vatRate = 0` case (gross ≡ net), so one rule
  covers both — no client/subcontractor VAT special-casing.
- `totalRabat` ← the kosztorys unified rabat (global-or-Σper-item), gross. Same read-only treatment.
- Symmetry dissolves the pre/post-rabat double-count: one rabat figure (the kosztorys one) feeds the
  one `totalRabat` term.
- wypłaty / strata / materiały stay transactions — they are real cash with a source register.

See `research.md` → "Decided model" for the mechanism, blast radius, and remaining open questions
(chiefly listing-page perf and the fate of existing `LABOR_COST`/`RABAT` rows on live investments).

## Transition plan (owner, 2026-07-19)

Not a flag day. Two independent switches:

- **Read switch** — `deriveFinancials` sources robocizna/rabat from the kosztorys.
- **Write switch** — stop offering `LABOR_COST`/`RABAT` as manual transfer types.

Per-investment cutover gated on an **explicit "verified/populated" flag**, flipped by hand only after
the owner confirms both robocizna and rabat match during population. NOT implicit "has rows" — a stray
row must not silently reassign an investment's authoritative figures. Investments not yet flipped keep
the transaction-sum fallback, so live investments without a kosztorys don't read 0.

### Screaming reconciliation indicator (build first — the population instrument)

Inside the kosztorys editor, compare and **scream on mismatch** (bold red text, red `!` icon, tooltip
explaining), for BOTH figures:

- robocizna (investment, Σ `LABOR_COST`, gross) vs `toGross(„Suma prac wykonanych", vatRate)`
- rabat (investment, Σ `RABAT`, gross) vs the kosztorys rabat, gross

Compare within 1 grosz (tolerance, not exact float equality). Comparison basis must be apples-to-apples
gross/gross — verify whether `LABOR_COST`/`RABAT` amounts are stored net or gross before writing the
check, or the icon lies. Own slice, taken through plan → implement (needs the investment figures wired
into the editor as props — they are not there today).

### Second surface — investment-page mismatch (owner, 2026-07-19) — IN this slice

The owner also wants the mismatch visible on the **investment page**, where the transition dual-display
(both robocizna values, both rabat values) will live. That page shows only the transaction figure today
and does **not** load the kosztorys tree. But surfacing the kosztorys figure there is not the scary
"listing-scale" derivation — it is **one** investment's tree loaded once (`getKosztorysTree`) and run
through the same pure settlement (`sectionSubtotalsForView(rows, stages, 'client')`) server-side. Two
scalars out, reusing the same `buildKosztorysReconciliation` verdict and the same visual language (bold
red + `!` + tooltip). So it rides EX-535, not a later slice.

**Parity discipline (load-bearing).** The editor computes the kosztorys figure **client-side** (live
rows, reacts to unsaved edits); the investment page computes it **server-side** (persisted rows). To
keep those from drifting — the exact two-planes-both-green failure `lessons.md:19` records — both call
**one** shared pure function (`kosztorysClientTotals(rows, stages, globalDiscount)` →
`{ doneNet, rabatClientNet }`). The hook and the server page are two call sites of that one function, not
two copies of the formula.

**Visual separation (owner).** On the investment page the kosztorys-derived robocizna/rabat must be
**clearly separated** from the transaction totals — a distinct „z kosztorysu" block/badge, not silently
merged into the existing figure — so during transition it is obvious which number is which. Only render
it when the investment actually has a kosztorys. The listing-page aggregate (all investments at once)
stays out of scope — that is the only genuinely heavy case and belongs to the read-switch slice.
