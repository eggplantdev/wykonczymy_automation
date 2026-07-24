# Rename decisions — kosztorys-terminology (owner rulings)

Owner naming calls that gate the EX-548 codemod. Anything the research
(`research.md`) flagged as "owner-decision needed" gets resolved here on
`file:line`, then folds into `/10x-plan`. Code register only.

## Q1 — Labor B2 operand (RESOLVED: variant B, 2026-07-20)

The recon (`reconciliation.ts:73`) compares the **pre-rabat** kosztorys labor
against Σ LABOR_COST. Two distinct figures live in `use-kosztorys-editor.ts`:

- `:339` `sumaPracNet` — robocizna netto **pre-rabat** (the actual recon operand)
- `:357` `laborCostsNetFromKosztorys` = `totalNet − discountAmount` — robocizna
  netto **post-rabat** (feeds `computeSummarySplit` + `computeDoZaplatyRM`, NOT recon)

**Ruling — move the suffixed name onto the real operand:**

| Figure                     | Old name                     | New name                         |
| -------------------------- | ---------------------------- | -------------------------------- |
| pre-rabat operand (`:339`) | `sumaPracNet`                | **`laborCostsNetFromKosztorys`** |
| post-rabat (`:357`)        | `laborCostsNetFromKosztorys` | **`laborCostsNetAfterDiscount`** |

Rationale: the plane-suffix pair `…FromKosztorys` / `…FromTransactions` must name
the two figures the recon actually compares. Σ LABOR_COST (transactions twin) is
pre-rabat, so the kosztorys twin must be the pre-rabat `sumaPracNet`. Corrects
glossary rows 87-89.

## Q2 — `rabatAmount` collision (RESOLVED: `effectiveDiscountNet`, 2026-07-20)

`use-kosztorys-editor.ts:366` `rabatAmount = discountAmount + itemRabatTotal`.
Glossary target `discountAmount` is occupied by the global-only figure at `:351`.

**Verified NOT "global + per-item added":** it is global XOR per-item, never both.
Under a live global discount `applyDiscount` returns gross (`calc.ts:29`), so
`rowDiscountForView = 0` (`calc.ts:98`) → `itemRabatTotal = 0`; and
`discountAmount = 0` when global is off (`isGlobalDiscountActive`, `calc.ts:21-22`).
The sum is a branch-free way to pick whichever mode is active (comment
`:358-359`). So `combined*`/`total*` names would lie.

**Ruling:** `rabatAmount` → **`effectiveDiscountNet`** — "the discount currently in
effect, whichever mode". `discountAmount` (`:351`, global-only) stays as-is.

## Q3 — `computeDoZaplatyRM` / `doZaplaty` (RESOLVED: full-word English, 2026-07-20)

`summary-economics.ts:67` — Cat gray, missing from glossary. Sheet footer
„Aktualnie do zapłaty R+M" = robocizna + materiały − wpłaty (`= −Bilans` on the
R+M base).

**Ruling — Cat B1:** „do zapłaty" has a clean English equivalent ("amount due"), so
it fails the rule-1 A-test → English, like `bilans→balance` / `marza→margin`.

- `computeDoZaplatyRM` → **`computeAmountDueLaborAndMaterials`**
- the `doZaplaty*` family → **`amountDueLaborAndMaterials`**

**No initials, no abbreviations** (owner, 2026-07-20): the `RM` suffix is spelled
out as `LaborAndMaterials` — never `RM` / `LM` / single letters. Aligns with the
global TS rule "full, descriptive identifiers; no abbreviations". The UI label
stays „R+M" (Polish UI); only the code identifier changes.

---

## Status

All three research-flagged owner-decisions RESOLVED. Feeds `/10x-plan
kosztorys-terminology` as fixed rename spec. Glossary corrections still owed by the
plan: rows 116-117 (przedmiar/pomiar not drift), 72-74 (`totalRabat` not canonical),
87-89 (labor operand is the pre-rabat figure per Q1), 49/71-75 (rabat is B2 not B1).
