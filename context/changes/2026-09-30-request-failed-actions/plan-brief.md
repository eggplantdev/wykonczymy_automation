# Request-failed server actions (EX-940) — Plan Brief

> Full plan: `context/changes/2026-09-30-request-failed-actions/plan.md`
> Research: `context/changes/2026-09-30-request-failed-actions/research.md`

## What & Why

A server action whose request never completes (offline, a deploy invalidating the action id)
**rejects** on the client — `protectedAction` never sees it. 23 client call sites don't handle that
rejection: buttons stay stuck, `startTransition` calls take down the page via the error boundary, the
kosztorys grid keeps state the DB doesn't have, and the grid autosave toasts „Failed to fetch".

## Starting Point

`settleAction` already folds a rejection into a Polish `{ success: false }` and the form submit path
uses it everywhere. It carries no code, swallows redirects, and 23 sites (10 of them structural ops in
`use-kosztorys-editor.ts`) bypass it; the grid lanes catch but forward the browser text.

## Desired End State

Every client-side action call ends a transport failure in a Polish message, a control back at rest,
optimistic state rolled back — and a tree refetch only where the operation wipes and reinserts.
Logout still redirects. `pnpm lint` rejects a new unwrapped `…Action()` call in client code.

## Key Decisions Made

| Decision                   | Choice                                              | Why                                                             | Source   |
| -------------------------- | --------------------------------------------------- | --------------------------------------------------------------- | -------- |
| Failure signal             | `code: 'REQUEST_FAILED'` on the settleAction result | Callers branch on it exactly like `NOT_FOUND`                   | Research |
| Redirects                  | `unstable_rethrow` first in settleAction's catch    | A redirecting action rejects client-side by design              | Research |
| Lanes on transport failure | Revert, never reseed                                | Reseed rides the same dead connection and wipes undo            | Research |
| Tree-replacing dialogs     | settleAction + branch on the code → close + refetch | Keeps their refetch; plain `!success` would drop it             | Plan     |
| Versions drawer            | Refetch on `REQUEST_FAILED`, included here          | Same wipe-and-reinsert shape, no refetch today                  | Plan     |
| Editor ops                 | `settled(action)` wrapped once at import            | 10 existing `!success` branches already revert                  | Research |
| Guard                      | Name-based `no-restricted-syntax` (`/Action$/`)     | Cheap, zero custom rule; 24 non-suffixed exports stay unguarded | Plan     |
| Tests                      | By risk: state/logic sites only                     | Mechanical wraps add no signal per site                         | Plan     |

## Scope

**In scope:** error code + redirect-safe settleAction + `settled`; grid lanes and settings save;
10 editor ops; 4 tree-replacing dialogs + versions drawer; 13 remaining sites incl. auth forms;
ESLint guard.

**Out of scope:** import-tracking lint rule; toast dedupe when many cells fail offline;
`handleAcceptCatalogueName` NOT_FOUND reseed; `runReorderReversal` stack placement; renaming actions.

## Architecture / Approach

One funnel: every client call → `settleAction` → `{ success:false, code:'REQUEST_FAILED' }` → the
branch each site already has. Sites whose operation may have committed server-side (tree replace,
restore) branch on the code to refetch; everything else just reverts and toasts.

## Phases at a Glance

| Phase                              | What it delivers                                    | Key risk                                      |
| ---------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| 1. settleAction foundation         | code, `unstable_rethrow`, `settled`                 | Logout silently breaking if rethrow is missed |
| 2. Autosave lanes + settings       | Polish toast + revert on grid edits                 | Accidentally routing REQUEST_FAILED to reseed |
| 3. Editor structural ops           | 10 ops roll back on rejection                       | Hook harness setup cost                       |
| 4. Tree-replacing dialogs + drawer | close + refetch on transport failure                | Losing the specific „przerwane" toasts        |
| 5. Remaining 13 sites              | no stuck buttons, no error page, auth forms recover | `handleStaleTree` must stay unwrapped         |
| 6. ESLint guard                    | new unwrapped calls fail lint                       | Second block overriding the env selector      |

**Prerequisites:** none — EX-940 already In Progress.
**Estimated effort:** ~1–2 sessions.

## Open Risks & Assumptions

- DevTools „Offline" is the manual proxy for a stale action id after deploy — same rejection path, not
  reproducible on demand otherwise.
- The name-based lint misses actions not ending in `Action`; accepted.

## Success Criteria (Summary)

- Going offline anywhere in the app never shows the error page or English text.
- Kosztorys edits and reorders made offline visibly roll back.
- Logout, login and the tree-replacing dialogs behave as before when online.
