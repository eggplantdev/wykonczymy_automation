---
change_id: investment-transactions-page
title: A separate per-investment transactions page in place of the „Transakcje” tab idea
status: preparing
created: 2026-10-11
updated: 2026-10-11
archived_at: null
branch: null
worktree: null
---

## Notes

Started as a „Transakcje” tab in the kosztorys Podsumowanie. Research (`research.md`) showed the
filters decide it: the transfers table's filters, sort and pagination live in the URL, and on the
kosztorys editor route every URL change re-renders the whole editor. A state-only tab was considered
and **dropped (user, 2026-10-11)** — the user wants a separate transactions page instead.

Research finding that carries over: the investment page minus what the kosztorys already duplicates
(info, notes, gallery, „Edytuj inwestycję”, the v2 summary panel) is already a transactions page —
the „Transfery” table with URL filters, „Drukuj”, „Faktury”, audit mode, plus the temporary v1 reading.

Linear: EX-1041.

**Decision (user, 2026-10-11):** `/inwestycje/[id]` IS the transactions page — no new route. The
change makes it read as one: the URL stays, the ~40 entry links and E2E specs stay valid.
