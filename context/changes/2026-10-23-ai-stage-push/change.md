---
change_id: ai-stage-push
title: Push notifications when an investment's AI stage changes
status: implemented
created: 2026-10-23
updated: 2026-10-23
archived_at: null
branch: staging
worktree: null
---

## Notes

Notify, don't trigger — automation of the AI flow comes later; for now the people who act on a stage must
learn it changed.

| Stage                                    | Recipients                    | Why                                       |
| ---------------------------------------- | ----------------------------- | ----------------------------------------- |
| Gotowa do analizy (`ready_for_analysis`) | the admin running the AI flow | start the analysis                        |
| Przeanalizowana (`analyzed`)             | the two reviewers             | the AI draft is loaded — start the review |
| Recenzja zakończona (`review_done`)      | the admin running the AI flow | collect Powody, extract knowledge         |

- Reuse the existing web push (`src/lib/push/send-push.ts`, `sendPushToUser`), new tag next to
  `payout-pending`; send in `after()` like `notify-pending-receipts.ts`; text via `translate()`.
- Fire only on a real transition into one of the three stages (re-saving the same stage sends nothing).
- Recipients live in the `notification-recipients` global as three new lists (e-mails), resolved to user
  accounts — no names or ids in the repo. Needs a hand-written migration.
- `ready_for_analysis` / `review_done` are set only by `setInvestmentAiStageAction`. `analyzed` is
  written by raw SQL in `scripts/ai-kosztorys/load-draft-sql-prod.ts` (and the Payload local API in
  `src/scripts/load-ai-draft.ts`), which bypasses the action — the loader must set the stage through the
  app action (as `prod-client.ts` does for other steps), or no push goes out.
- A recipient gets the push only on a device where push is enabled (PWA push toggle).
