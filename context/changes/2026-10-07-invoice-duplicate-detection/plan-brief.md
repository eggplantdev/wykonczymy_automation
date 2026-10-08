# Invoice Duplicate Detection — Plan Brief

> Full plan: `context/changes/2026-10-07-invoice-duplicate-detection/plan.md`
> Research: `context/changes/2026-10-07-invoice-duplicate-detection/research.md`

## What & Why

When management accepts a worker's zgłoszenie wydatku, the accept dialog warns if a paragon repeats a
booked transakcja or another pending zgłoszenie. Management can mark that paragon „Duplikat". The aim is
to catch duplicate wydatki, not to police workers, so the worker never sees the mark. To him the paragon
shows as „Odrzucone". (EX-1025)

## Starting Point

The owner accepted a spike (`f4c4153a2`): a hint table, a queue label and a filter. It has gaps:

- It matches on free-text fields plus a file fingerprint.
- It refuses the paragon on the click, under a still-pending zgłoszenie.
- It decides „last paragon" from the prefill instead of the live form.
- It remounts the form, which loses the manager's edits.
- Its SQL scans with correlated JSON expansion.

## Desired End State

- **New fields.** Each wydatek row in the expense form and in the edit form carries „Nr dokumentu",
  „NIP sprzedawcy" and „Data na paragonie". The AI fills them, management can edit them, and they are
  saved on the transakcja.
- **The accept dialog** lists possible duplicates for each paragon, red for strong and muted for weak.
  - „Duplikat" takes the paragon out of the live form and keeps the manager's edits. The mark is saved
    when management accepts.
  - On the last paragon, „Duplikat" rejects the whole zgłoszenie at once.
- **The queue** shows „Duplikat #id" and has a „Duplikaty" filter. The worker sees „Odrzucone".

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| When the mark is saved | With the decision, via `skippedReceipts`; on the last paragon, an immediate reject | A refused paragon under a pending zgłoszenie breaks „Przywróć", the page cap, the blob reclaim and the worker's status | Research / owner |
| Content hash | None | A re-photographed receipt has different bytes; amount + printed date + seller catches the same-file case | Owner |
| Strong signals | Number + amount (vetoed by differing NIPs); amount + printed date + seller | The dump: number alone collides, and the AI reads different numbers off one paragon | Research + Plan |
| Weak signal | Same amount, printed dates ±3 days | Amount alone is 618 pairs of noise; the printed date cuts it to 2 | Research |
| Seller key | NIP when both sides have one, else the description prefix | Old rows have no NIP | Plan |
| Legacy rows | Matcher falls back to parsing „Notatka" line 1 and „Opis" | No backfill in this change | Plan |
| `duplicate_of` | jsonb `{source, id}`, no FK | Survives deletion of the referenced row | Plan (user) |
| `document_date` | varchar ISO, not a Payload `date` | Payload `date` is `timestamptz`, and a date-only value would drift | Plan |
| Company NIP | `COMPANY_NIP` constant; an AI read equal to it is dropped | A faktura prints the buyer's NIP too | Owner |
| „OK, to nie duplikat" | Not stored | Persisted dismissals belong to the audit (EX-1026) | Owner |
| E2E | `e2e-backlog` Linear issue | Browser flow is covered by db + dom specs now | Plan (user) |

## Scope

**In scope:**

- 1 migration: `duplicate_of` on both draft tables, plus 3 identity columns on `transactions`.
- Extractor: number, seller's NIP and printed date.
- The form fields, in the expense form and the edit form.
- Matcher and SQL rewrite.
- „Duplikat" saved with the decision.
- Dialog state fixes.
- Specs, a test-plan row and the E2E issue.

**Out of scope:**

- Content hash.
- Backfill script.
- Telmak reading the new columns.
- Hints anywhere but the accept dialog.
- `CORRECTION`.
- Moving the number out of „Notatka".
- `lessons.md:2127`.

## Architecture / Approach

The AI read and the form both feed `transactions.document_number`, `seller_nip` and `document_date`.
When the dialog opens, `findExpenseDraftDuplicates` (`lib/queries`, returning `ActionResultT`) runs
three single-statement reads in `lib/db`:

- the draft's probes;
- matching booked receipt-type transakcje;
- other pending drafts' read rows, expanded once.

It then runs the pure `match.ts`. The hint table renders inside `ExpenseForm` through a render slot, so
„Duplikat" acts on the live line items. The marks flow out through `receiptDecision`, then
`createBulkTransferAction`, then `decideExpenseDraft`, which writes `skipped_receipts.duplicate_of`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data model + identity | Migration, Payload fields, extractor NIP/number/date, draft-read fields | Prompt confuses buyer and seller NIP |
| 2. Form fields | Three visible fields in both forms, validated and persisted | Mobile layout of the new row |
| 3. Matcher + queries | Structured matching with legacy fallback, single-statement SQL | False strong matches on legacy rows |
| 4. Decision-time „Duplikat" | Mark saved with the decision, live-form dialog, state fixes | Mapping each paragon's row to its live line item |
| 5. Docs + backlog | Test-plan row, E2E issue | — |

**Prerequisites:**

- The company NIP value from the owner, for `COMPANY_NIP`.
- `pnpm install` and `.env` copied into the worktree.
- Local 5433 DB with the stale spike migration row removed.

**Estimated effort:** about 2–3 sessions.

## Open Risks & Assumptions

- The model may still return the buyer's NIP when the seller's is unclear. The `COMPANY_NIP` discard
  covers only our own company.
- Legacy transakcje match only through the parsed fallback until the backfill script runs.
- Prod needs `pnpm db:migrate:prod` (by a human) before the push.

## Success Criteria (Summary)

- A paragon resent by another worker, or with a different number read, shows as a red match in the
  accept dialog.
- Marking a duplicate never loses the manager's edits. The mark is visible only to management.
- A misread number, NIP or date can be corrected on the transakcja after booking.
