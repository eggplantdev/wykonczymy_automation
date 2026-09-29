---
change_id: kosztorys-stage-worker-assignment
title: Assign one worker per etap so należne is attributed per person
status: archived
created: 2026-07-27
updated: 2026-08-08
archived_at: 2026-08-08T14:47:35Z
branch: staging
worktree: null
---

## Notes

Linear: **EX-613**

Assign a worker to a stage so we know who is owed what on an investment. Before this, the code stated
the gap outright (`src/lib/kosztorys/subcontractor-summary.ts`): subcontractor due was
investment-level, payouts were per worker, and nothing linked executed work to a person.

Decided with the owner (2026-07-27):

- **One stage, one worker.** Nullable relationship on `kosztorys-stages`, sibling to `plane`.
  Splitting a stage between people is explicitly out of scope for now.
- **Meaning: „kto ma zrobić"** (who is to do it) — a planned assignment, editable, chooseable at
  stage creation (optional, never forced, unlike `plane`).
- **Subcontractor due counts executed work only** (pomiar, never przedmiar).
- **Unassigned stages** get their own residual row and are never distributed across assigned
  workers. Unlike a null `plane`, a null worker must NOT lock quantity entry.
- **The payout roster pre-fills, never gates.** Adding a payment must stay possible with no
  assignment — two warnings, neither blocking: (a) the investment has unassigned stages, so the
  roster's remaining figures read short; (b) the selected worker has no stages here, so their
  remaining will look like an overpayment. **Non-blocking does NOT mean quiet** (owner, 2026-07-28:
  „ten wykrzyknik ma krzyczeć, to są pieniądze" — "that exclamation mark must scream, it's money") —
  both reuse the existing destructive-toned primitives at full volume; no softer advisory tier.
- **Worker with no stages: due `0`, remaining negative**, flagged „brak przypisanych etapów" so it is
  distinguishable from a genuine overpayment.
- Workers missing from `users` are added by hand first — not a code concern.

Open questions — **all resolved with the owner 2026-07-28**:

1. **Live vs saved → one shared derivation, divergence bounded by the save.** The editor's figure and
   the payout roster's figure must come from the **same pure function**, fed by live grid state on one
   side and DB-assembled rows/stages on the other. The only possible disagreement is then the ~500 ms
   debounce window, which is accepted. Two independent derivations are explicitly rejected: that
   divergence would be unbounded and invisible.
2. **Loud reassignment → confirm dialog, nothing more.** An `AlertDialog` naming the stage, the amount
   of executed work, and both workers. **No auto-snapshot, no undo entry** — nothing is destroyed and
   reassigning back is the inverse. The visible aftermath is the signal: the losing worker's remaining
   goes negative and reads red.
3. **Client disclosure → no change.** The share keeps shipping the tree as before.
4. **Two residuals → settlement plane dominant.** A stage with no plane earns nobody anything, so "no
   worker" on it is a claim about zero; only the plane warning renders. **A missing worker never locks
   quantity entry** (unlike a missing plane). **Owner's corollary: a plane-less stage accepts no worker
   at all** — the picker is disabled until a plane is chosen, because an assignment there would show a
   name against a silent `0 zł`.
5. **Negative remaining → always red, with a description of which case it is.** All three meanings
   (genuinely overpaid / stages reassigned away / never had stages here) read red; the copy beside the
   figure distinguishes them.
6. **Roster → union of "has stages" and "has payouts", sorted by remaining desc**, no-worker bucket
   pinned last.
7. **MANAGER visibility → no change.** The „Podwykonawcy" panel is **not** role-gated (only „Marża"
   is, via `financials`), and it stays that way. MANAGER sees the per-worker figures.

> **Superseded (2026-07-29, `36a53a48`):** the roster block was dropped from the payout form and
> `subcontractor-roster.ts` deleted, so the roster pre-fill, its two warnings and the ordering rule
> (6) no longer apply. The rest — one worker per stage, plane dominance, always-red negative
> remaining, MANAGER visibility — still stands.
