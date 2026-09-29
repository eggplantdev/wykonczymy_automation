---
change_id: kosztorys-global-discount
title: Global discount on the kosztorys, overriding per-item discounts
status: archived
created: 2026-07-15
updated: 2026-07-24
archived_at: 2026-07-24T13:46:37Z
branch: dogfooding/kosztorys-editor-ux
worktree: null
---

## Notes

A discount on all executed work, entered once per kosztorys. Owner (2026-07-15): most cases just need
"a discount on the whole of the executed work" — per-item discounts stay, but stop being the default.

> **Superseded:** the control contract (only „Kwotowy" overrides per-item discounts, „%" is a
> destructive one-shot overwrite, reversibility) lives in `context/reference/kosztorys-editor-domain-notes.md`
> („Rabat globalny — kontrakt sterowania", EX-605); base = executed net total and no distribution
> onto sections/stages are in `src/lib/kosztorys/calc.ts` (`globalDiscountAmount`). The sheet probe
> (no whole-kosztorys discount in V1; `transfery!K3` read by nothing) and the sequencing after
> `kosztorys-stages-source-of-truth` are in `context/foundation/lessons.md`. What follows is the one
> part kept nowhere else.

### The `RABAT` transfer was a balance plug, not a commercial discount

Owner's hypothesis (2026-07-15): the transfer `RABAT` appeared "because there was no other way to
enter it when the data lived in two places". The history fits:

```
2026-06-11  2658623  feat(transfers): add RABAT type, labels, and field predicates
2026-06-19  580523d  feat(kosztorys): POC schemat — 5 tabel, kolekcje, migracja
```

`RABAT` predates the first kosztorys schema by 8 days — the kosztorys was still only a sheet, so a
labor discount had nowhere to go but the transfers. The commit gives mechanics only ("RABAT mirrors
LABOR_COST cash semantics: no source register, requires an investment"), no reason for a discount
to _be_ a transfer.

**Live-data evidence (local prod copy, 2026-07-15).** 9 `type='RABAT'` rows in `transactions` (1
`cancelled` — a type test on template investment 90 the same day):

- **First discount = 2026-06-11 14:32, the day of commit `2658623`** (investment 84, 332,70 zł,
  description „rabat"). The type was built to record that one discount.
- **Six entries on the evening of 2026-06-18** (by hand, 21:53→23:32, no description) — five hit the
  balance to the grosz:

  | investment | balance before discount | discount                                      |
  | ---------- | ----------------------- | --------------------------------------------- |
  | 72         | −14,21                  | 14,21                                         |
  | 68         | −30,86                  | 30,86                                         |
  | 71         | −79,11                  | 79,11                                         |
  | 14         | −226,19                 | 226,19                                        |
  | 21         | −882,18                 | 882,18                                        |
  | 74         | −1 013,30               | 1 289,89 (outlier — probably later expenses)  |

  The amount is **computed from the balance** to make it zero. Nobody gives a client a 14,21 zł
  discount.

**What follows for certain.** A discount on the whole of the work (this change) and historical
`RABAT` rows are **different concepts under one name**: those rows are a plug computed _from_ the
balance at the end; this change is an **input** — decided up front, it changes the total, and the
balance follows from it. The arrow points the other way.

**What we don't know — don't guess.** The "no way to enter it" hypothesis is partly contradicted:
`CORRECTION` has existed since 2026-03-25 (44e69ec) with **45 uses since 2026-04-17**, so in June a
balance could be closed with a correction. What a correction can't do is move the margin; `RABAT`
moves both figures, and `LOSS` had its first use **the same evening, 2026-06-18**. So that evening
looks more like a deliberate split of three effects than a missing tool.

All 9 `RABAT` rows were created by one person: role `OWNER`, `users.id = 16` — not the repo owner
("that wasn't me", 2026-07-15). Owner's reading: "the amounts didn't add up, so they entered them as
discounts". **Closed as undecidable:** under either hypothesis the same 9 rows look identical — the
DB knows usage, git knows mechanics, neither knows intent. Only `OWNER` 16 could answer, and nothing
depends on the answer: the plug-vs-input conclusion holds under both.
