# Google review request — Plan Brief

> Full plan: `context/changes/2026-10-02-investment-review-request/plan.md` · Linear: EX-973

## What & Why

When an investment is finished, the team wants to ask the client for a Google review without leaving
the app: a branded email with a link to the review form, and a record that it was sent.

## Starting Point

The investment has an optional client `email` and a free-text „Opinia" field that was used by hand
as a „did we ask" flag (`tak`/`nie`). 62 of 80 completed investments have no email. The app already
sends one client-facing mail (lead auto-reply) through a branded template.

## Desired End State

A completed investment shows „Poproś o opinię" on the listing and on its page. The dialog asks for
the email (prefilled, saved back to the investment), sends, and the control flips to „Wysłano" with
a resend option. Closing an investment in the edit form opens the same dialog after the save —
unless the flag is already set.

## Key Decisions Made

| Decision            | Choice                                           | Why                                                 |
| ------------------- | ------------------------------------------------ | --------------------------------------------------- |
| Tracking            | Boolean flag, replaces „Opinia"                  | Owner: „just sent"; the field was already that flag |
| Migration           | `tak` → true, rest → false                       | `tak` meant „we asked for a review"                 |
| Old `review` column | Drop later, follow-up issue                      | Old code SELECTs it; a drop must follow the deploy  |
| Flag editable       | Checkbox in the edit form                        | Record requests made outside the app, undo mistakes |
| Post-status prompt  | Second dialog after save, only if flag false     | No re-asking when toggling status back and forth    |
| Listing             | `Opinia` column is the control                   | Status and action in one cell                       |
| Missing email       | Dialog asks, saves it to the investment          | The common case; resend shouldn't ask again         |
| Review link         | Code constant (Google place „Wykończymy.com.pl") | Only Google; admin panel unused                     |
| Who                 | ADMIN / OWNER / MANAGER                          | Same as editing an investment                       |
| Send vs write       | Send first, then write email + flag              | A failed send never sets the flag                   |

## Scope

**In scope:** flag + migration, template CTA button, email + action, dialog, listing cell, page
button, post-save prompt.

**Out of scope:** dropping `review`; who/when sent; prompt on create; editable links; tracking
whether a review was actually left.

## Architecture / Approach

`requestReviewAction` (plain `protectedAction`, since `investmentAction` refuses completed
investments) → `sendReviewRequestEmail` → `renderBrandedEmail` (moved to `lib/email/`, gains a CTA).
One `RequestReviewDialog` (formId `request-review-<id>`) mounted by the listing cell and the page
button; the edit dialog opens it via `openDialog(formId)` instead of mounting a duplicate.

## Phases at a Glance

| Phase                     | What it delivers                                               | Key risk                                |
| ------------------------- | -------------------------------------------------------------- | --------------------------------------- |
| 1. Flag replaces „Opinia" | Column + backfill, every reader switched, checkbox in form     | Missing a `review` reader (raw SQL)     |
| 2. Email and send action  | Template CTA, email, action + unit specs                       | Send/write order                        |
| 3. UI                     | Dialog, listing cell, page button, post-save prompt + DOM spec | Dialog opening after `router.refresh()` |

**Prerequisites:** none. **Estimated effort:** ~1 session.

## Open Risks & Assumptions

- The Google place ID was found via Maps search — the owner confirms the link opens the right form.
- Local sending fails by design (`EMAIL_HOST`); manual email checks need the real host swapped in.
- Prod: migrate (additive) before the push; the `review` drop is a separate post-deploy change.

## Success Criteria (Summary)

- From the listing or the page, one click + an email sends the review mail and marks it sent.
- Closing an investment asks once, never again after the flag is set.
- The 10 `tak` investments show as already sent.
