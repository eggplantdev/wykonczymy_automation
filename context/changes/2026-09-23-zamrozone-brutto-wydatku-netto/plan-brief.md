# Plan brief — zamrożone brutto wydatku netto

**What:** in the „Wydatki inwestycyjne" table, a „… netto" row takes netto AND brutto from the
invoice (Σ `net_amount` / Σ `amount`), so no stawka moves it. Removes the pie beside the table.

**Why:** today its brutto is `netto × (1 + stawka)`. Inv. 146 at 23% shows 5477,60 against an
invoice brutto of 4809,60.

**Blast radius:** display only. Every billed figure (bilans, marża, Łącznie, listing) reads netto,
which does not change. No SQL, no migration.

**Phases**

1. Carry the recorded brutto: a per-category sum in `deriveCategoryBreakdowns`, a
   `recordedGross` field on netto rows, and bumped cache keys.
2. Price the netto row from the invoice: rewrite `breakdownRowPair`, delete `materialsPair`, add
   unit specs rewritten red-first and a new DOM spec for the table.
3. Remove the „Materiały" tab pie and `expensePieSlices`. The overview pie stays.
4. Docs: domain notes § „WYJĄTEK — wydatek typu netto" and the false fixture comment.

**Owner rulings honoured:** Q1 no stawka → single „Kwota" column showing netto; Q2 the netto row's
Różnica is frozen too; Q3 the pie goes.

**Tests:** unit + DOM, with 8%-apart amounts at a stawka ≠ 23% (every fixture is exactly 23% apart,
so it can't tell frozen from derived). No E2E.

**Manual check:** inv. 146, „Materiały" tab. At stawka 23% and at 12% the netto row reads
4453,33 / 4809,60 / −356,27. In rozliczenie brutto, Kwota shows 4453,33. The pie is gone.
