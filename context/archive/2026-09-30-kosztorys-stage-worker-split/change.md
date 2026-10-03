---
change_id: kosztorys-stage-worker-split
title: Several workers per etap, splitting its executed-work pool by percent or by amount
status: archived
created: 2026-09-30
updated: 2026-10-03
archived_at: 2026-10-03T05:52:30Z
branch: kosztorys-stage-worker-split
worktree: null
---

## Notes

Linear: **EX-943**

Reverses EX-613's „one stage, one worker — splitting a stage between people is explicitly out of
scope" (`context/archive/2026-07-27-kosztorys-stage-worker-assignment/change.md`). The owner's sheet
has no split to copy (a stage header there is just a crew name), so every rule below is an owner
decision, not parity.

Decided with the owner (2026-09-30):

- **Several workers per etap.** The pool being split is the etap's executed-work value — the figure
  EX-613 credits wholesale to the one assigned worker today (pomiar × stawka podwykonawcy, pre-rabat,
  at the etap's own plane).
- **Two modes, chosen per etap: percent or amount.** Example: 4 workers — 25% each, or 1 000 zł to
  each of three and the rest to the fourth.
- **The pool is always distributed in full, in both modes, by the same rule: every worker but one
  carries an entered value, the remaining one takes the rest.** Percent: 25/25/25 entered → the
  fourth gets 25% automatically; 90% or 110% cannot be entered. Amount: fixed amounts entered → the
  „reszta" worker gets pool − Σ amounts.
- **Fixed amounts cannot exceed the pool** (owner, after research — reverses the earlier option A).
  Saving a split whose Σ fixed amounts is above the etap's current executed-work value is refused,
  so the reszta is never negative at the moment of saving. Early in an etap (2 000 zł executed) three
  fixed 1 000 zł shares cannot be entered yet.
- **Worker link / Podgląd / PDF on a shared etap:** rows of the whole etap as today, plus
  „Twój udział: 25% / 1 000 zł" in the summary. Co-workers' names and shares are NOT shown.
- Existing single-worker etapy migrate as a one-person split (100% / reszta) — no figure moves.

Decided with the owner after research (2026-09-30):

- **No executed work → nothing is split** („nie dzielimy pieniędzy, których nie ma"). An etap with
  a pool of 0 credits nobody, and — per the cap above — accepts no fixed amount either.
- **Setting up a split on an etap with no executed work:** either percent mode (the shares are
  known upfront, each accrues 0 zł until work lands), or amount mode with every fixed amount at 0 —
  the cap leaves nothing else enterable.
- **No worker's share is ever negative** — not at save time and not later („nie da się być na
  minusie"). Σ shares === pool still holds.
- **The pool dropping below the saved fixed amounts after the fact** (pomiar corrected down, plane
  switched to the cheaper stawka, cena edited) **shrinks the fixed amounts pro rata**; the reszta
  holder gets 0 and the etap shows a warning „popraw podział" until someone does. The pomiar
  correction itself is never refused — it records what was done on site.
- **An etap bez rozliczenia (no plane) credits nobody** — fixed amounts included — and keeps the
  warning, as today.
- **„Wartość przedmiaru" in the worker view stays the whole przedmiar value** — not scaled by the
  share. (Supersedes the earlier „scales by the percent share" note.)
- **A negative figure reads „nadpłata", like everywhere else** — no new label or state. (With the
  cap below, a share is never negative, so „nadpłata" only ever means payouts above the share.)
- **Worker PDF / Podgląd: section and column totals stay whole-etap**; „Twój udział" is shown
  separately in the summary.
- **A new etap added from the menu copies the last etap's whole split** (mode, people, values,
  reszta holder) — the same way it copies the plane and worker today.
- **Split dialog behaviour** (owner, at planning): a person added to the etap enters with 0 and the
  current reszta holder keeps the rest; switching % ↔ kwota zeroes every entered value (different
  units — nothing is converted); saving asks no extra confirmation (the dialog shows each person's
  zł live, so „Zapisz" is the decision); a pro-rata shrink shows a marker in the etap header and a
  new entry in the problem filter.
- **Removing the reszta holder requires picking a new one** in the dialog. Restoring a snapshot whose
  reszta holder was deleted (non-interactive) hands the reszta to the first remaining member.

Implementation notes (review gate, 2026-09-30):

- **The copied split keeps the percentages but zeroes the fixed amounts.** A new etap has no executed
  work yet, and the cap above refuses any fixed amount against a pool of 0 — copying the amounts
  would make the add itself fail.
- **`src/lib/db/stage-memberships.ts` is a second db file for `kosztorys_stage_workers`** on purpose:
  it holds the users delete guard's count, which `collections/users.ts` imports, so it must stay out
  of `server-only` (the Payload type-generation graph loads it). The writes live in `db/stage-split.ts`.
- **The import keeps `workerId` on its per-etap defaults** and turns it into a one-person split at the
  write — the sheet has no split to import.
