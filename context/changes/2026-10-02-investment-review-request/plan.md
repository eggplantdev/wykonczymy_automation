# Google review request for a completed investment — Implementation Plan

Linear: EX-973 · decisions: `change.md`

## Overview

When an investment is finished, the team asks the client for a Google review. The app gets a
„Poproś o opinię" action that emails the client a branded message with a link to the Google
review form, and records a „wysłano" flag. The flag replaces the leftover `Opinia` textarea, which
was already used by hand as exactly that flag (`tak` / `nie`).

## Current State Analysis

- `investments` has an optional `email` (client) and a free-text `review` („Opinia") textarea,
  `src/collections/investments.ts:84`. In the 2026-10-02 dump the textarea holds `tak` (10),
  `nie` (17), `niee` (1) and `11 listopada` (1) — it was a manual „did we ask for a review" flag.
- 62 of 80 completed investments have no `email`, so asking for the address is the common path.
- `review` is read in: the collection, `investment-schema.ts`, `investment-form.tsx`,
  `edit-investment-dialog.tsx`, `add-investment-dialog.tsx`, `promote-lead-dialog.tsx`,
  `types/reference-data.ts`, `types/table-rows.ts`, `lib/queries/reference-data.ts:76,135` (raw SQL),
  `lib/queries/shape-investments.ts:111`, `components/tables/investments.tsx:304`,
  `components/investments/investment-info-fields.tsx`, and the spec
  `__tests__/components/investments/investment-info-fields.test.ts`.
- The „Zakończyć inwestycję?" confirmation is `confirmBeforeSubmit` in `investment-form.tsx:87` —
  it runs **before** the write, and the edit `FormDialog` closes on success.
- `investmentAction` refuses every write on a completed investment, so it can't host this action;
  plain `protectedAction` already gates on `MANAGEMENT_ROLES` (= ADMIN/OWNER/MANAGER).
  `guardTrashedInvestment` (collection `beforeChange`) refuses updates to a trashed investment.
- Client-facing mail precedent: `sendAutoReply` (`src/lib/leads/notify.ts:242`) — `renderBrandedEmail`
  + `from: serverEnv.LEADS_REPLY_FROM`. The template renders plain paragraphs only; no link/button.
- `FormDialog` open state is the global `useOptimisticFormStore.openFormId` keyed by `formId`, so any
  component can open a mounted dialog with `openDialog(formId)`.

## Desired End State

- A completed, non-trashed investment shows „Poproś o opinię" on the listing (in the `Opinia`
  column) and on its page (next to „Edytuj inwestycję"). Once sent, both read „Wysłano" with a resend
  option. Other statuses show „—" / nothing.
- The button opens a dialog with an email field prefilled from the investment. Sending emails the
  client, saves the typed address to `investment.email`, and sets the flag.
- Saving the edit form with a status change INTO „Zakończona" while the flag is false opens that
  same dialog right after the save. Reopening and re-closing an investment whose flag is true
  never asks again.
- The edit form carries a „Prośba o opinię wysłana" checkbox for requests made outside the app.
- Migrated data: every investment whose `review` was `tak` has the flag set; all others are false.

### Key Discoveries:

- One `FormDialog` per formId mounted per screen: listing cell and page button each mount one
  `RequestReviewDialog` with formId `request-review-<id>`; the edit dialog only calls `openDialog`.
- `EMAIL_HOST=disabled.invalid` outside production → a local send fails on DNS; testing the real mail
  means swapping the commented real host in `.env` (`context/reference/outgoing-effects-isolation.md`).

## What We're NOT Doing

- Dropping the `review` column — follow-up Linear issue, after the deploy is live (see Migration Notes).
- Storing when / by whom the request was sent — owner chose a plain flag.
- A review prompt on create (add-investment / promote-lead) — only the edit transition prompts.
- Editable review links / a settings screen — the Google URL is a code constant.
- Tracking whether the client actually left a review.

## Implementation Approach

Data model first (flag + migration + every reader switched), then the server half (template, email
builder, action) with unit specs against a fake Payload, then the UI wired to the action through one
dialog that three entry points open.

## Critical Implementation Details

**Opening the dialog after the edit save.** Don't mount a second `RequestReviewDialog` inside
`EditInvestmentDialog` — after `router.refresh()` the listing cell / page button for the now-completed
investment mounts its own with the same formId, and two dialogs would open. Instead the edit dialog
calls `openDialog('request-review-<id>')` on success; the refreshed control's `FormDialog` reads
`openFormId` from the store and opens on mount.

**Prompt condition** is computed from the submitted values, not from props:
`defaultValues.status !== 'completed' && value.status === 'completed' && !value.reviewRequested`.
Ticking the checkbox in the same save therefore suppresses the prompt.

**Send before write.** The action sends first, then writes `{ email, reviewRequested: true }` in one
`payload.update` with `user`. A failed send writes nothing, so the flag never claims a mail that
didn't leave; the dialog keeps the typed address for a retry.

## Phase 1: Flag replaces „Opinia"

### Overview

Add the boolean, backfill it from `tak`, and switch every reader/writer of `review` to it.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20261002_1_investments_review_requested.ts` (+ register in `src/migrations/index.ts`)

**Intent**: Hand-written, additive. Adds the flag and copies the manual `tak` marks into it. Leaves
`review` in place — the live code still SELECTs it.

**Contract**: `ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "review_requested" boolean NOT NULL DEFAULT false;`
then `UPDATE "investments" SET "review_requested" = true WHERE trim(lower("review")) = 'tak';`.
`down` drops `review_requested` only. Header comment: additive → prod migrate BEFORE the push.

#### 2. Collection + types

**Files**: `src/collections/investments.ts`, `src/types/reference-data.ts`, `src/types/table-rows.ts`

**Intent**: Replace the `review` textarea with a `reviewRequested` checkbox field
(label pl „Prośba o opinię wysłana", `defaultValue: false`), and `review: string` with
`reviewRequested: boolean` in both row types.

**Contract**: field `reviewRequested: checkbox` → column `review_requested`.

#### 3. Reads

**Files**: `src/lib/queries/reference-data.ts`, `src/lib/queries/shape-investments.ts`

**Intent**: SELECT `i.review_requested` instead of `i.review` and map it to `reviewRequested`
(`=== true`); pass it through in `shape-investments`.

#### 4. Form + dialogs + card

**Files**: `investment-schema.ts`, `investment-form.tsx`, `edit-investment-dialog.tsx`,
`add-investment-dialog.tsx`, `promote-lead-dialog.tsx`, `investment-info-fields.tsx`

**Intent**: Form schema `review: z.string()` → `reviewRequested: z.boolean()` (domain default
`false`); the textarea becomes a checkbox field; defaults pass `investment.reviewRequested` /
`false`. The „Opinia" entry leaves `buildInvestmentInfoFields` (the page button carries the state).

#### 5. Specs

**Files**: `src/__tests__/components/investments/investment-info-fields.test.ts`,
`src/__tests__/reference-data-sql-drift.test.ts` (check it still names the right column)

**Intent**: Update fixtures from `review` to `reviewRequested`; drop the „Opinia" expectation.

### Success Criteria:

#### Automated Verification:

- Migration applies on the local dev DB: `pnpm payload migrate` (after `git status src/migrations`)
- Backfill is right: `SELECT count(*) FROM investments WHERE review_requested` equals the count of `review` = `tak` (10 on the 2026-10-02 dump)
- `pnpm generate:types` succeeds
- `pnpm exec vitest run src/__tests__/components/investments/investment-info-fields.test.ts src/__tests__/reference-data-sql-drift.test.ts` passes

#### Manual Verification:

- Edit dialog shows the „Prośba o opinię wysłana" checkbox instead of the „Opinia" textarea; ticking it and saving persists
- An investment migrated from `tak` shows the checkbox ticked

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Email and send action

### Overview

Shared branded template gains a button; a review-request email builder and the server action.

### Changes Required:

#### 1. Move + extend the branded template

**Files**: `src/lib/leads/email-template.ts` → `src/lib/email/branded-template.ts`; importers
`src/lib/leads/notify.ts`, `src/scripts/trigger-test-lead.ts`; spec
`src/__tests__/leads/email-template.test.ts` → `src/__tests__/lib/email/branded-template.test.ts`

**Intent**: Two features now use it, so it leaves `leads/`. Add an optional call-to-action button
rendered after the paragraphs.

**Contract**: `BrandedEmailT` gains `cta?: { label: string; href: string }` — an inline-styled `<a>`
in brand navy (email clients strip `<style>`); label and href escaped. Spec: CTA renders with the
escaped href; absent `cta` renders no `<a>`.

#### 2. Review-request email

**File**: `src/lib/investments/review-request-email.ts`

**Intent**: Builds and sends the client mail. Owns the Google review URL constant
(`https://search.google.com/local/writereview?placeid=ChIJdwKTEzbNHkcRZA6UBMGUMdc`) and the Polish
draft copy (owner iterates). Throws on send failure.

**Contract**: `sendReviewRequestEmail(payload: Payload, to: string): Promise<void>` —
`from: serverEnv.LEADS_REPLY_FROM`, logo by absolute `FRONTEND_URL` URL like `notify.ts`.
Draft copy — subject „Jak oceniają Państwo naszą pracę? — Wykończymy"; heading „Dziękujemy za
wspólną realizację"; paragraphs „Dzień dobry," / „dziękujemy, że powierzyli nam Państwo
wykończenie wnętrza. Mamy nadzieję, że efekt spełnia Państwa oczekiwania." / „Będziemy bardzo
wdzięczni za krótką opinię w Google — zajmie mniej niż minutę, a kolejnym klientom pomoże nas
znaleźć." / „Pozdrawiamy,\nZespół Wykończymy"; CTA „Wystaw opinię".

#### 3. Action

**File**: `src/lib/actions/review-request.ts`

**Intent**: `'use server'` action behind `protectedAction` (MANAGEMENT_ROLES). Validates the email,
loads the investment, refuses unless status is `completed`, sends, then writes email + flag in one
update (`user` passed so the collection guards run, incl. the trash guard). Revalidates
`['investments']`.

**Contract**: `requestReviewAction(investmentId: number, email: string): Promise<ActionResultT>`.
Schema `requestReviewSchema = z.object({ email: z.email('Nieprawidłowy adres email') })` beside the
form (Phase 3) and imported here. Error copy: not completed → „Prośbę o opinię można wysłać tylko
dla zakończonej inwestycji."; send failure → „Nie udało się wysłać wiadomości. Spróbuj ponownie."
(log the cause).

#### 4. Specs

**Files**: `src/__tests__/lib/investments/review-request-email.test.ts`,
`src/__tests__/lib/actions/review-request.test.ts`

**Intent**: Routing contract only, not copy (as `notify.test.ts`): sent TO the given address, FROM
`LEADS_REPLY_FROM`, html contains the Google review URL. Action, with a fake Payload + mocked auth +
shared revalidate stub: (a) a non-completed investment → error, no send, no update; (b) invalid
email → error, no send; (c) success → send called, then update with `{ email, reviewRequested: true }`;
(d) send throws → error result and **no update**.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/email/branded-template.test.ts src/__tests__/lib/investments/review-request-email.test.ts src/__tests__/lib/actions/review-request.test.ts src/__tests__/leads/notify.test.ts` passes
- No import of `@/lib/leads/email-template` remains: `grep -rn "leads/email-template" src` is empty

#### Manual Verification:

- With the real `EMAIL_HOST` swapped into `.env`, a send to your own address arrives with logo, copy and a working „Wystaw opinię" button (not in spam)

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: UI — dialog and three entry points

### Overview

One dialog; listing cell, page button and the post-save prompt all open it.

### Changes Required:

#### 1. Form + dialog

**Files**: `src/components/forms/request-review-form/request-review-form.tsx` (+ `request-review-schema.ts`),
`src/components/dialogs/request-review-dialog.tsx`

**Intent**: `FormDialog` (formId `request-review-<id>`, `showKeepOpen={false}`) wrapping a one-field
form on `useManagedForm` (`persistDraft: false`). Field „Email klienta" prefilled from
`investment.email`; the description names the investment and, when already sent, says so
(„Prośba została już wysłana — wysłać ponownie?"). Submit „Wyślij" / „Wysyłanie…"; success toast
„Wysłano prośbę o opinię".

**Contract**: `RequestReviewDialog({ investment: Pick<…, 'id' | 'name' | 'email' | 'reviewRequested'>, trigger })`.

#### 2. Listing column

**File**: `src/components/tables/investments.tsx`

**Intent**: The `review` column becomes `reviewRequested` („Opinia"): completed + not sent →
`RequestReviewDialog` with a „Poproś o opinię" button; completed + sent → „Wysłano" plus a small
resend trigger; any other status → „—" (a sent flag on a reopened investment still reads „Wysłano",
without the trigger).

#### 3. Investment page

**File**: `src/app/(frontend)/inwestycje/[id]/page.tsx`

**Intent**: Next to `EditInvestmentDialog`, render `RequestReviewDialog` when
`investment.status === 'completed' && !trashed`; trigger label „Poproś o opinię" or
„Wyślij ponownie prośbę o opinię" by the flag.

#### 4. Post-save prompt

**Files**: `src/components/forms/investment-form/investment-form.tsx`,
`src/components/dialogs/edit-investment-dialog.tsx`

**Intent**: `InvestmentForm` gets an optional `onEnteredCompleted` callback, fired after a successful
save that meets the prompt condition (see Critical Implementation Details). `EditInvestmentDialog`
passes one that calls `openDialog('request-review-<id>')`.

#### 5. DOM spec

**File**: `src/__tests__/components/forms/investment-form/investment-form-review-prompt.test.tsx`

**Intent**: Render `InvestmentForm` with `vi.mock`ed action resolving success: status
`active` → `completed`, flag false → `onEnteredCompleted` called once; flag true → not called;
already `completed` → `completed` → not called; checkbox ticked in the same save → not called.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/forms/investment-form/investment-form-review-prompt.test.tsx` passes

#### Manual Verification:

- Listing: a completed investment without the flag shows „Poproś o opinię"; sending (real host) flips the cell to „Wysłano"; an active investment shows „—"
- Investment page: the button shows only for a completed, non-trashed investment; label switches after sending
- Dialog with no client email: typing an address and sending saves it to the investment (visible on the card)
- Invalid email shows the field error; nothing sent
- Edit an active investment → „Zakończona" → confirm: after the save the review dialog opens; cancel it, reopen to „Aktywna" and back to „Zakończona" with the flag already set by a send → no dialog
- With `EMAIL_HOST=disabled.invalid` (default dev), sending shows the error toast and the flag stays false

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- Template CTA rendering + escaping; email routing (to/from/link); action guard order and
  send-before-write (Phase 2).

### Component Tests:

- The prompt condition across the four status/flag combinations (Phase 3).

### E2E:

- The flow crosses client → action → DB → revalidation, but sending is impossible outside
  production by design, so a browser spec could assert only the failure path. Decide at the review
  gate: author a failure-path spec or file it to the `e2e-backlog`.

## Migration Notes

- `20261002_1` is **additive** → `pnpm db:migrate:prod` (human) **before** pushing to main.
- Dropping `review` is **destructive** and must run **after** the deploy is live, because the old
  code SELECTs it. Separate migration, separate change: file a follow-up Linear issue at the end of
  implementation.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (ask before running — machine-wide lock)
- `pnpm build`

## References

- Client mail precedent: `src/lib/leads/notify.ts:242` (`sendAutoReply`)
- Lock confirm: `src/components/forms/investment-form/investment-form.tsx:87`
- Outgoing mail gate: `context/reference/outgoing-effects-isolation.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Flag replaces „Opinia"

#### Automated

- [x] 1.1 Migration applies on the local dev DB — 51e089ab
- [x] 1.2 Backfill count matches `tak` count — 51e089ab
- [x] 1.3 `pnpm generate:types` succeeds — 51e089ab
- [ ] 1.4 info-fields + sql-drift specs pass

### Phase 2: Email and send action

#### Automated

- [ ] 2.1 template, email, action and notify specs pass
- [x] 2.2 no `leads/email-template` import remains

### Phase 3: UI — dialog and three entry points

#### Automated

- [ ] 3.1 review-prompt DOM spec passes
