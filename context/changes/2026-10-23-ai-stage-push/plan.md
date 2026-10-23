# AI Stage Push Implementation Plan

## Overview

Send a web push when an investment's AI stage changes, so the person who acts next learns about it
without watching the list. Notify only; the AI flow is still started by hand.

| Stage entered                            | List          | Seeded with                   |
| ---------------------------------------- | ------------- | ----------------------------- |
| Gotowa do analizy (`ready_for_analysis`) | `aiPipeline`  | the admin running the AI flow |
| Nowe informacje (`new_information`)      | `aiPipeline`  | same                          |
| Recenzja zakończona (`review_done`)      | `aiPipeline`  | same                          |
| Przeanalizowana (`analyzed`)             | `aiReviewers` | the two reviewers             |

`knowledge_extracted` sends nothing.

## Current State Analysis

- `setInvestmentAiStageAction` (`src/lib/actions/investments.ts:165`) validates and calls
  `payload.update`. It never reads the previous stage, so it can't tell a transition from a re-save.
  Its UI callers: `AiStageSelect` (`src/components/investments/ai-stage-select.tsx`), rendered on
  `/inwestycje` and `/inwestycje/[id]`.
- `analyzed` is written by raw SQL inside the psql transaction in
  `scripts/ai-kosztorys/load-draft-sql-prod.ts:113,142`. That bypasses the action, so today it could
  never push.
- Web push already exists:
  - `sendPushToUser(db, userId, build(locale))` and `isPushConfigured()` are in `src/lib/push/send-push.ts`.
  - The pattern to copy is `src/lib/push/notify-pending-receipts.ts`, called via `after()` in
    `src/lib/actions/transfers.ts:97`.
  - `PushTagT` is `'test' | 'payout-pending'` and doubles as the push-service `topic`.
- Recipient e-mails live in the `notification-recipients` global (`src/globals/notification-recipients.ts`),
  as one array field per list. Each field is `required: true, minRows: 1`.
  - `RECIPIENT_LISTS` / `LIST_LABELS` live in `src/lib/email/recipients.ts`.
  - `saveRecipientListAction` read-modify-writes every list in `RECIPIENT_LISTS`.
  - The editing UI is a per-page `recipient-list-card` on `/flota`, `/sprzet` and `/zgloszenia`. A new list gets no card unless a page renders one.
- Production push subscriptions: none of the three intended recipients has one yet (read-only check,
  2026-10-23).

## Desired End State

- Changing the stage in the app to a notified stage pushes to every live account on that list. The
  person who made the change is skipped.
- Re-saving the stage that is already set sends nothing.
- Loading an AI draft with the loader sets Przeanalizowana through the app action, so the reviewers
  get their push on every round.
- Tapping the notification opens `/inwestycje/<id>`.
- Two investments changing stage close together produce two notifications, not one overwriting
  the other.

### Key Discoveries:

- Same `tag` = collapse, in two places:
  - The push service replaces a pending message that has the same `topic`.
  - `public/sw.js` replaces a shown notification that has the same `tag`.
  - So the tag must be per investment: `ai-stage-${id}` (≤ 32 chars, URL-safe).
- `after()` is the established send point. In tests, the `next/server` stub
  (`src/__tests__/stubs/next-server.ts`) keeps scheduled tasks for the spec to run. A spec that
  never runs them silently skips the push (lessons.md, "Platform facts").
- Because `minRows: 1` is `required`, a new list left empty on any env makes the next
  `saveRecipientListAction` call fail on every page. So the migration must seed rows on every DB.
- Precedent for a seeded recipient list: `src/migrations/20260826_0_notification_recipients.ts`
  (tables `notification_recipients_<list>`, literal role addresses, `ON CONFLICT DO NOTHING`).

## What We're NOT Doing

- Auto-starting the AI flow on Gotowa do analizy.
- A desktop push toggle. Recipients subscribe from the phone menu (`mobile-nav.tsx`).
- A UI for editing the two new lists. Changes go through a migration or a one-off write.
- E-mail for stage changes.
- `src/scripts/load-ai-draft.ts` (local-only Payload loader).
- Pushes for `knowledge_extracted`, or for clearing the stage to none.

## Implementation Approach

The recipient lists come first, because the notifier reads them. The notifier is a pure server module
copied from `notify-pending-receipts.ts`. The action gains a read-before-update and an `after()` that
fires only when the stage actually changes. The loader stops writing the stage itself and calls the
action once psql has committed the draft.

## Critical Implementation Details

- **Timing & lifecycle.** Read the previous stage in the action **before** `payload.update`. Schedule the push in `after()` so a slow push service never delays the response. Resolve recipients inside the `after()` task, not before the update.
- **Loader ordering.** The draft and the stage used to commit in one psql transaction; now they don't.
  - Run psql first.
  - On success, call `setInvestmentAiStageAction`.
  - If that call fails, print a loud error with the exact command to retry. The draft stays loaded, and the stage can be set by hand in the UI, which pushes too.
  - Resolve the action id before running psql, so a missing action fails before anything is written.

## Phase 1: Recipient lists

### Overview

Two new lists in the global, seeded on every DB.

### Changes Required:

#### 1. Global fields

**File**: `src/globals/notification-recipients.ts`

**Intent**: Add `aiPipeline` and `aiReviewers` array fields shaped like the existing lists.

**Contract**: Same field shape as the current lists (`required`, `minRows: 1`, `{ email }` rows, hidden in admin).

#### 2. List registry

**File**: `src/lib/email/recipients.ts`

**Intent**: Register both lists so `saveRecipientListAction` carries them through its read-modify-write.

**Contract**: Add both to `RECIPIENT_LISTS`. Add these `LIST_LABELS` entries:

- `aiPipeline`: „powiadomienia o etapach AI”
- `aiReviewers`: „powiadomienia o szkicach AI do recenzji”

#### 3. Migration with seed

**File**: `src/migrations/20261023_0_ai_stage_recipients.ts` (+ register in `src/migrations/index.ts`)

**Intent**: Create the two list tables and seed them with the company role addresses. Hand-written: copy
the 2026-08-26 precedent.

**Contract**:

- Create `notification_recipients_ai_pipeline` and `notification_recipients_ai_reviewers` with the same columns, FK and indexes as the precedent.
- Seed:
  - `ai_pipeline`: admin@
  - `ai_reviewers`: bartek@ and yuri@
- Use `ON CONFLICT DO NOTHING`.
- `down()` drops both tables.
- Additive.

#### 4. Types

**File**: `src/payload-types.ts`

**Intent**: Regenerate.

**Contract**: `pnpm generate:types`.

### Success Criteria:

#### Automated Verification:

- Migration applies on local dev: `git status src/migrations` clean of foreign files, then `pnpm payload migrate`
- `pnpm generate:types` adds `aiPipeline` / `aiReviewers` to `NotificationRecipient`
- Existing recipient specs pass: `pnpm exec vitest run src/__tests__/lib/actions/notification-recipients*`

#### Manual Verification:

- Saving the fleet list on `/flota` still succeeds after the migration (the new required lists are seeded)

---

## Phase 2: Notifier and action wiring (test-first)

### Overview

Push on a real transition into a notified stage.

### Changes Required:

#### 1. Push tag

**File**: `src/lib/push/send-push.ts`

**Intent**: Allow a per-investment tag.

**Contract**: `PushTagT = 'test' | 'payout-pending' | \`ai-stage-${number}\``.

#### 2. Resolve recipient e-mails to accounts

**File**: `src/lib/db/users-by-email.ts` (new)

**Intent**: Map list e-mails to the ids of live accounts. Accounts that are inactive or trashed are dropped. Case-insensitive match.

**Contract**: `selectLiveUserIdsByEmails(db: DbExecutorT, emails: string[]): Promise<number[]>`. One
statement plus its mapper.

#### 3. Notifier

**File**: `src/lib/push/notify-ai-stage.ts` (new)

**Intent**: Map stage → list, read the list, resolve to accounts, skip the actor, push each with the
investment name.

**Contract**:

- Signature: `notifyAiStageChange(payload, db, { investmentId, investmentName, stage, actorId }): Promise<void>`.
- Stage map: `ready_for_analysis` / `new_information` / `review_done` → `aiPipeline`, `analyzed` → `aiReviewers`. Any other stage sends nothing.
- Message:
  - url `/inwestycje/${investmentId}`
  - tag `ai-stage-${investmentId}`
  - title and body via `translate(locale, 'aiStagePush', …)`
- Errors: a failure per recipient is logged with `// TODO(EX-958) SENTRY-REQUIRED:`, like the receipt notifier.
- An empty list is logged, never thrown (the stage change itself must not fail).

#### 4. Translations

**Files**: `src/lib/i18n/dictionaries/{pl,ru,uk}.ts`

**Intent**: A new `aiStagePush` namespace. Each notified stage gets one title and one body with an `{investment}` placeholder.

**Contract**: Polish copy, by stage:

- Gotowa do analizy → „Inwestycja gotowa do analizy” / „{investment} — można uruchomić analizę AI.”
- Nowe informacje → „Nowe informacje w inwestycji” / „{investment} — AI powinno ją przeanalizować ponownie.”
- Przeanalizowana → „Szkic AI do recenzji” / „{investment} — szkic kosztorysu jest wgrany.”
- Recenzja zakończona → „Recenzja zakończona” / „{investment} — można zebrać powody zmian.”

ru/uk get equivalent translations.

#### 5. Action wiring

**File**: `src/lib/actions/investments.ts` (`setInvestmentAiStageAction`)

**Intent**: Read the current stage and name, update, then push in `after()` only when the stage changed.

**Contract**:

- Read with `payload.findByID({ collection: 'investments', id, depth: 0, select: { aiStage, name } })` before the update.
- Push only when `previous !== parsed.data`. The notifier then filters to the notified stages.
- `actorId` is `user.id`.
- The return value is unchanged.

### Success Criteria:

#### Automated Verification:

- Notifier unit spec (new): `pnpm exec vitest run src/__tests__/lib/push/notify-ai-stage.test.ts`. It must show:
  - stage → list mapping
  - the actor is skipped
  - nothing sent for `knowledge_extracted`
  - an empty list is logged, not thrown
  - the per-investment tag and url
- DB spec for e-mail → account resolution (inactive and trashed excluded, case-insensitive):
  `src/__tests__/lib/db/users-by-email.db.test.ts`
- The action DB spec, extended, shows a push on a transition and none on a re-save of the same stage, with the `after()` task run: `src/__tests__/lib/actions/investment-ai-stage.db.test.ts`
- `pnpm test:integration` limited to the two DB specs above

#### Manual Verification:

- From a phone with push enabled (installed PWA on iPhone), using another account, set an investment to Gotowa do analizy. The admin's phone shows „Inwestycja gotowa do analizy” with the investment name. Tapping it opens that investment.
- Set the same stage again. No second notification arrives.
- Change two investments to Przeanalizowana in a row. The reviewer's phone shows two separate notifications.

---

## Phase 3: Loader sets the stage through the app

### Overview

`load-draft-sql-prod.ts` stops writing `ai_stage` in SQL and calls the action after psql succeeds.

### Changes Required:

#### 1. Loader

**File**: `scripts/ai-kosztorys/load-draft-sql-prod.ts`

**Intent**: Drop both `UPDATE investments SET ai_stage = 'analyzed'` lines. After a successful psql run, call
`setInvestmentAiStageAction(investmentId, 'analyzed')` through `prod-client.ts`.

**Contract**:

- Call `resolveActions('/inwestycje', ['setInvestmentAiStageAction'])` before psql.
- After psql succeeds, call `callAction('setInvestmentAiStageAction', '/inwestycje', [investmentId, 'analyzed'])`.
- If that call fails, report it loudly and exit non-zero, with the retry hint.
- `DRY=1` makes no action call.
- `TOKEN_FILE` is now required for a real run. Update the usage comment at the top of the file.

#### 2. AI-cases runbook pointer

**File**: `../wykonczymy-ai-cases/README.md` (the loader step)

**Intent**: Note that the load now pushes to the reviewers and needs `TOKEN_FILE`.

**Contract**: One line in the existing loader step.

### Success Criteria:

#### Automated Verification:

- `DRY=1` run on a case prints the SQL with no `ai_stage` line and makes no action call
- `grep -n "ai_stage" scripts/ai-kosztorys/load-draft-sql-prod.ts` returns nothing

#### Manual Verification:

- The next real draft load on production sets Przeanalizowana, and both reviewers' phones get „Szkic AI do recenzji”

---

## Testing Strategy

### Unit Tests:

- Notifier: mock `sendPushToUser` / `isPushConfigured` with `vi.hoisted`, as in `notify-pending-receipts.test.ts`. Cover mapping, actor skip, silent stages, empty list and tag/url.

### Integration Tests:

- The action on the test DB (5435). Run the stubbed `after()` tasks, then assert that `sendPushToUser` was called (mocked) for a transition and not for a re-save.
- E-mail → account resolution against real `users` rows.

### Manual Testing Steps:

1. Each recipient enables push on their phone. On iPhone, install the PWA first, because the toggle is hidden in Safari.
2. Flip stages from a different account and check the notifications and the tap target.
3. Load the next AI draft and confirm the reviewers are notified.

## Migration Notes

Additive. A human migrates prod (`pnpm db:migrate:prod`) **before** the push. Until then the new
code would read a missing table on the global. Preview DB: `pnpm db:migrate:preview` after merge. The
test DB template rebuilds on its own because a migration changed.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

## References

- Pattern: `src/lib/push/notify-pending-receipts.ts`, `src/lib/actions/transfers.ts:97`
- Seed precedent: `src/migrations/20260826_0_notification_recipients.ts`
- Prod action client: `scripts/ai-kosztorys/prod-client.ts`
- Outgoing effects: `context/reference/outgoing-effects-isolation.md`. Push is production-only via the VAPID keys.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Recipient lists

#### Automated

- [x] 1.1 Migration applies on local dev — 761c6f864
- [x] 1.2 Types regenerated with aiPipeline / aiReviewers — 761c6f864
- [x] 1.3 Existing recipient specs pass — 761c6f864

### Phase 2: Notifier and action wiring (test-first)

#### Automated

- [x] 2.1 Notifier unit spec — 185fcdab8
- [x] 2.2 E-mail → account DB spec — 185fcdab8
- [x] 2.3 Action DB spec extended (transition vs re-save) — 185fcdab8
- [x] 2.4 Both DB specs pass under test:integration — 185fcdab8

### Phase 3: Loader sets the stage through the app

#### Automated

- [ ] 3.1 DRY run prints SQL without ai_stage, no action call
- [x] 3.2 No ai_stage write left in the loader — 80ebae1ea
