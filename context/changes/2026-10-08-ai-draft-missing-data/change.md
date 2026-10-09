---
change_id: ai-draft-missing-data
title: Komentarz AI — what the inquiry left unknown and what the agent assumed, per pozycja
status: in-progress
created: 2026-10-08
updated: 2026-10-08
archived_at: null
branch: null
worktree: null
---

## Notes

EX-1030 — Kosztorys AI „Brak danych”: an agent-owned field next to AI przedmiar (`aiPlannedQty`) holding the text of what is missing to compute a pozycja's quantity (e.g. „wysokość pomieszczeń”). Written only by the draft loader (`src/scripts/load-ai-draft.ts`, `DraftRowT` gains an optional field, reset on every run), shown as a column in the „Przegląd AI” view, read-only in the grid. It is NOT a fifth REVIEW_STATUSES value — Status stays the manager's verdict; a row with missing data awaits data, not a verdict. Rule behind it (owner, 2026-10-08): the agent never assumes or guesses; an incomputable quantity is left out and the reason is recorded, unless there is a very strong hint in domain knowledge or prior tests. Related: EX-1006, change 2026-10-01-ai-kosztorys-generation-tests.

### Revised after the in-app spike (owner, 2026-10-08)

- **The no-assumptions rule is dropped.** The agent may assume; what matters is an exact view of
  what it assumed. The spike's twin quantity („AI przedmiar bez założeń” + its netto and total) is
  dropped with it.
- **Komentarz AI** is its own column in „Przegląd AI”, separate from the people's Komentarz — the
  investor may be shown Komentarz, so the loader never writes there any more. Every cell keeps the
  fixed structure, questions included, answers in bold:
  `Czego nie było wiadomo: …` / `Co / ile założono: …`. **A question with nothing to report is not
  written** (owner, 2026-10-09: „jak nic, to nie ma sensu tego pisać”) — the field stays empty, its
  line is not shown, and a row with neither stays blank. Where a quantity came from is not an
  assumption, so it is not a reason to fill „Co / ile założono”. Several items go one per line in
  the draft; the cell shows them as one answer separated by commas.
- Stored as two fields (`ai_missing_data`, `ai_assumptions` — migration
  `20261008_2_add_kosztorys_item_ai_comment`); the draft JSON carries them as `missingData` /
  `assumptions`. A draft's old `note` key is no longer read.
