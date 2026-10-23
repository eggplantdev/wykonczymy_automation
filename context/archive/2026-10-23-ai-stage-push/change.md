---
change_id: ai-stage-push
title: Push notifications when an investment's AI stage changes
status: archived
created: 2026-10-23
updated: 2026-10-23
archived_at: 2026-10-23T07:21:50Z
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

## Decisions kept at archive

- **Recipients are e-mail lists in the `notification-recipients` global, matched back to live accounts
  (`lower(email)`).** A users relationship would drop `users-by-email.ts`, but reusing the global was
  chosen so no names or ids sit in the repo. Cost accepted: a typo'd or changed address drops out
  silently; the error log fires only when no address on the list matches. The lists have no editing
  card — a change of recipient is a migration or a one-off write.
- **The seed exists because every list is `required` + `minRows: 1`** and `saveRecipientListAction`
  rewrites all lists — an unseeded list breaks saving the others. It hardcodes `_parent_id` 1, which
  `20260826_0` creates on every environment.
- **Accepted race:** the action reads the old stage, then updates. Two simultaneous changes can send
  one push too many or too few — a handful of managers set this by hand.
- **The loader no longer sets the stage in the draft's psql transaction.** It sets „Przeanalizowana”
  through `setInvestmentAiStageAction` after psql commits, because only the app sends the push; a failed
  call prints a loud "set it by hand" error. A round loaded while the stage is already
  „Przeanalizowana” sends nothing.
- **Untested:** the loader's action call has no automated test, and its DRY run was not executed (it
  needs a prod session token).
