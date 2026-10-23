# AI Stage Push — Plan Brief

> Full plan: `context/changes/2026-10-23-ai-stage-push/plan.md`

## What & Why

The people who act on an investment's AI stage find out about a change only by watching the list. A
web push on each relevant change tells the next person to act. Notification only: the AI flow is
still started by hand.

## Starting Point

- Web push already works for payouts (`sendPushToUser`, sent in `after()`).
- The stage is changed by `setInvestmentAiStageAction`. That action never reads the previous value.
- „Przeanalizowana” is written by the draft loader in raw SQL, which bypasses the app.

## Desired End State

- Gotowa do analizy, Nowe informacje and Recenzja zakończona push to the admin running the AI flow.
- Przeanalizowana pushes to both reviewers on every round.
- Tapping a notification opens the investment.
- Re-saving the same stage sends nothing.
- The person who made the change is not notified.

## Key Decisions Made

| Decision          | Choice                                                         | Why                                                                                                        |
| ----------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Channel           | Existing web push                                              | Already built and in use for payouts                                                                       |
| Subscribe surface | Phone only                                                     | The toggle already lives in the phone menu; no desktop toggle                                              |
| Rounds            | Push the reviewers every time Przeanalizowana is set           | Every round is new work to review                                                                          |
| Nowe informacje   | Push the admin, like Gotowa do analizy                         | Both mean "run the AI"                                                                                     |
| Recipients        | Two lists in the recipients global, seeded by migration, no UI | No names in code; changing them is rare                                                                    |
| Tag               | `ai-stage-<id>`                                                | The same tag collapses notifications on the push service and in the service worker                         |
| Loader            | Sets the stage via the app action after psql commits           | Raw SQL can't push; the draft and the stage are no longer one transaction, so failures are reported loudly |

## Scope

**In scope:**

- two recipient lists with a migration seed
- the notifier, plus the read-before-update in the action
- translations (pl/ru/uk)
- the loader switch
- a one-line runbook note in ai-cases

**Out of scope:**

- auto-triggering the AI flow
- a desktop toggle
- a list-editing UI
- e-mail
- the local-only loader
- `knowledge_extracted`

## Architecture / Approach

`AiStageSelect` or the loader calls `setInvestmentAiStageAction`. The action reads the old stage, then
updates. If the stage changed, `after()` runs `notifyAiStageChange`, which:

- maps the stage to a list
- resolves the list's e-mails to live accounts
- drops the actor
- calls `sendPushToUser` per account with a per-investment tag

## Phases at a Glance

| Phase                      | What it delivers                                              | Key risk                                                                          |
| -------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1. Recipient lists         | `aiPipeline` / `aiReviewers` in the global, seeded everywhere | A list left unseeded breaks saving every other list (`minRows: 1`)                |
| 2. Notifier + action (TDD) | Push on a real transition                                     | A spec that doesn't run `after()` tasks passes vacuously                          |
| 3. Loader                  | Przeanalizowana set through the app                           | Draft loaded but the stage call fails; mitigated by a loud error and a retry hint |

**Prerequisites:**

- A human migrates prod before the push (additive).
- Each recipient enables push on their phone. On iPhone that means installing the PWA first.

**Estimated effort:** about 1 session, 3 phases.

## Open Risks & Assumptions

- None of the three recipients has a push subscription on prod yet. The feature is silent until they enable it.
- On prod, all three seeded addresses match live accounts (ADMIN, OWNER, MANAGER; read-only check, 2026-10-23).

## Success Criteria (Summary)

- Each recipient's phone shows the right notification within seconds of the stage change, and tapping it opens the investment.
- Loading an AI draft notifies both reviewers with no manual step.
