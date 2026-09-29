---
change_id: decouple-panel-write-refresh
title: Investment page data-fetching architecture — the summary panel made it unusably slow
status: archived
created: 2026-07-27
updated: 2026-07-27
archived_at: 2026-07-27T21:28:21Z
branch: ex-597-decouple-panel-write-refresh
worktree: null
---

## Notes

**EX-597.** The spike log (`research.md`, deleted 2026-08-08) is in git history; the two
framework/method findings went to `context/foundation/lessons.md` (the "server action forces a route
render" mechanism and the Neon warm/cold measurement rule).

---

## The problem, as stated

Owner, opening the change: **"In its current state the stat panel is basically unusable."**

The acceptance bar was never "measurably faster" — it was that the app **feels as fast as it did
originally, when the investment page was transfers only**. That framing ruled out treating this as a
micro-optimisation pass: the panel had added a whole second data plane (the kosztorys tree) on top of
a page that already had one (transfers + reference data), and nothing was consolidated when it landed.

Two problems were kept deliberately separate:

1. **The write path** — every persisted control triggered a full-route `router.refresh()`. This is
   what made the panel feel _broken_.
2. **The read path** — the page's fetch fan-out was heavy on every render, refresh or not. This is
   what made the page feel _slow_, and it was paid on first load too.

Both were in scope. As it turned out, only one of them was real — see "Outcome".

---

## Outcome

**Owner verdict: "the feeling is drastically improved."** The acceptance bar is met.

**What actually mattered was the client.** The change the owner felt — pending state plus optimistic
values on the settings block — has **no measurable effect on elapsed time**. Perceived and elapsed
latency came apart completely, and every instrument used in this spike measured only the second one.

Ranked by real effect:

| #   | commit(s)             | what                                                      | effect                                                 |
| --- | --------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| 1   | `b4b8a48e` `6ef19850` | pending flag + optimistic VAT/rabat on the settings block | **the one the owner felt** — no effect on elapsed time |
| 2   | `d15ba6ab`            | `deferRefresh` on per-cell autosave                       | 324 766 B → **127 B** per debounced write              |
| 3   | `dd148c15`            | `router.refresh()` deleted                                | render count halved                                    |
| 4   | `73480ff1`            | `fetchReferenceData` deduped per request                  | 3× → 1× per render                                     |
| 5   | `a1bf7234` `72ff0ea1` | media read cached whole under a `media` tag               | removes a serial hop behind the transfers query        |
| —   | `9f14cbeb` `ca5ae1af` | tree read → raw SQL → one `json_agg` query                | **no measurable effect**; kept for code shape only     |

**Caveat found at the review gate, after the table above was written.** `deferRefresh` (#2) was
being partly handed back a few lines from where it was won. `use-kosztorys-editor.ts` ends its
grid-change path with `setTimeout(() => router.refresh(), 700)` — and that timer was **never
cleared**, so the comment beside it ("after the save quiets down") was false: a run of edited cells
queued one full-route refresh _each_. Pre-existing, moved there by `08310f68`, and invisible to every
instrument this spike used, because all of them measured a single write. Fixed at the gate by holding
the handle in a ref and restarting it, mirroring the `flushTimer` directly above.

The lesson generalises past this line: **a per-write saving is only real if nothing downstream
re-adds per-write work.** The measurement that proved `deferRefresh` (324 766 B → 127 B) was taken on
the action's own payload, so it could not have seen a second refresh path 80 lines away.

> **Superseded:** „Opcje rozliczenia" moved off the investment page into the kosztorys editor
> (`a6050f2c`), first behind `?ustawienia=1`, later into a popover (`745ceda5`). The tree read is now
> one `json_agg` query, `getInvestmentName` became `fetchReferenceData` (EX-608), and the media read
> expires with `EXPIRE_NOW` (rationale in code).

---

## The optimistic rule this change discovered

Shipped state of the four „Opcje rozliczenia" controls:

| control               | pending | optimistic | why                                                         |
| --------------------- | ------- | ---------- | ----------------------------------------------------------- |
| VAT                   | ✅      | ✅         | value is denormalized onto `rows` — client-owned, patchable |
| rabat globalny        | ✅      | ✅         | same                                                        |
| sposób rozliczenia    | ✅      | ❌         | lives only on `tree` — server-owned, mount-frozen (EX-441)  |
| stawka netto wydatków | ✅      | ❌         | same                                                        |

The rule is mechanical, not a judgement call: **a setting is optimistic exactly when its value is
denormalized onto `rows`.** Settings that live only on `tree` have nothing local to move, because
`tree` is frozen at mount. Anyone adding a fifth control can read the answer straight off that rule
rather than re-deriving it.

Naming trap: `optimisticSettingSave` is the _pending_ helper,
not the optimistic one — the name predates the split and misleads on first read.

---

## Owner rulings

- **Non-blocking settings declined:** _"the write is fast enough, this is fine."_ The blocking window
  isn't felt, so it doesn't earn local state for the two non-optimistic controls plus an ordering guard.

### Rejected: request-scoped `cache()` on `getKosztorysTree`

Ranked #2 and approved, then dropped on inspection. `applyPercentRabatToAllItemsAction` reads the
tree, mutates rows, and the ensuing render reads it again — a request-scoped memo would hand that
render the **pre-mutation** tree and the grid would show stale prices. Silent wrong data, not a
latency trade. It only becomes available if that read moves after the write. (`fetchReferenceData`
got the same treatment safely only because no server action reads it at all.)

---

## Superseded beliefs

Kept as the record of what was believed and why it was wrong. Full text of each in `research.md` (git history).

| belief                                                                                                             | verdict                                                                                                                                                                                                                                                              | where      |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `sumAllRegisterBalances` is 1015 ms — two full `GROUP BY` scans, a "28× cache cliff"                               | **Wrong.** `EXPLAIN ANALYZE` puts it at **2.4 ms** over 3 044 rows, both legs index-scanned. The 1015 ms was Neon connection setup on a cold request, billed to whichever query touched the DB first. No query-level fix exists.                                     | S2         |
| The tree read's 5 ORM queries are the shape problem — round-trip count is the cost                                 | **Wrong.** The five reads were already fully parallel: one warm sample shows `buildKosztorysTree 45ms` with reads at 20/21/21/21/44 ms — **total equals the slowest read, not their sum.** Collapsing them into one query could never win, and measured, it doesn't. | S8         |
| The 83–119 ms `investment` (1-row) read proves pool contention                                                     | **Wrong.** Cold-start connection setup. Warm it is 21 ms. This retires the theory that motivated `ca5ae1af`.                                                                                                                                                         | S8         |
| "Pending state, **not** optimistic values"                                                                         | **Half right.** Both shipped — see "The optimistic rule" above.                                                                                                                                                                                                      | S7 shipped |
| "The uncached `getKosztorysTree` is the remaining server-side lever, and a bigger one than anything on the client" | **Disproven.** Attacked in two commits, neither moved the clock. The client was the whole story.                                                                                                                                                                     | S8         |

### The pattern behind three of the five

Every one of those wrong beliefs was built on a small sample against Neon, whose latency is
**bimodal — ~20–60 ms warm, ~160–200 ms cold**. A handful of cold reads is dominated by connection
setup and looks _exactly_ like structural cost. A theory was built on two samples, twice.

The method lesson, stated once so it survives the archive: **separate warm from cold before believing
a per-request number, and prefer one request that exposes the mechanism to a dozen that produce a
median.** The 45 ms sample that settled the whole tree question did so because it showed the five
reads overlapping — not because it was faster than the others.
