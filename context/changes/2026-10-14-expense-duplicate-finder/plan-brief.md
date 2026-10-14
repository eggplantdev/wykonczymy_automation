# Expense duplicate finder — Plan Brief

> Full plan: `context/changes/2026-10-14-expense-duplicate-finder/plan.md`

## What & Why

A diagnostic „Szukaj duplikatów” dialog on the home transfers list (`/`). It checks the documents the
table currently shows, plus a picked range, against every receipt in the company and every waiting
paragon. Matches come back as strong and weak groups of links (EX-1026). The same engine also makes the
„Zweryfikuj” dialog catch a paragon sent twice inside one zgłoszenie (EX-1053 follow-up).

## Starting Point

The matcher (`matchExpense`) and the loaders already exist, but they are built around a single probed
zgłoszenie. They exclude that zgłoszenie entirely (`excludeDraftId`), which hides duplicates inside it.
The same-amount window is anchored on today, so an old period can never produce a weak match.

## Desired End State

Management opens „Szukaj duplikatów” on `/`, picks a range and gets:

- strong groups (same number / same paragon), expanded;
- a collapsed „Słabe (N)” section with one block per amount.

Each row opens the transakcja, or the zgłoszenie's „Zweryfikuj” dialog, in a new tab. In „Zweryfikuj”,
twin paragony of one zgłoszenie flag each other.

## Key Decisions Made

| Decision           | Choice                                                                 | Why (1 sentence)                                                                | Source |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| Candidates         | Booked transakcje and pending zgłoszenia read rows                     | Diagnostic: anything that is or could be booked                                 | User   |
| Results            | Links only, no actions, no dismissed-pairs store                       | Diagnostic tool; decisions stay in the existing flows                           | User   |
| Strength split     | Strong expanded; weak collapsed and grouped by amount                  | Measured: same-amount noise dominates the weak tier                             | User   |
| Compared against   | In-scope documents vs the whole company                                | Re-sends cross investments                                                      | User   |
| Host               | Home `/` list only; scope = its filters + range                        | Mirrors InvoiceDownloadDialog, no new pickers                                   | User   |
| Zgłoszenie link    | `/zgloszenia-wydatkow?zgloszenie=N` opens its dialog                   | Lands where the decision is made                                                | User   |
| Zgłoszenie dialog  | Moves onto the engine; undecided paragony compared with each other     | Closes the EX-1053 gap                                                          | User   |
| Same-amount window | Pairwise (between the two dates), not from today                       | Otherwise old periods yield no weak matches                                     | Plan   |
| Sibling rule       | Decided read rows dropped; a read row never pairs with its own booking | Replaces whole-zgłoszenie exclusion with a precise one                          | Plan   |
| Pending in finder  | All undecided pending read rows are always probes                      | The queue is small, every row is still bookable, filters name transakcja fields | Plan   |

## Scope

**In scope:** pairwise window; grouping engine; loaders without `excludeDraftId`; „Zweryfikuj” on the
engine; finder server read; dialog on `/`; `?zgloszenie=N`; unit, DB and DOM specs; test-plan #26.

**Out of scope:** actions or dismissals in the finder; other transfer lists; backfilling numbers/NIPs on
old rows; changing what counts as strong or weak; E2E.

## Architecture / Approach

Documents (transakcje, merged paragony, undecided pending read rows) carry their origin (zgłoszenie +
read rows). The engine indexes documents by cents and number, matches both orientations and applies
the sibling rules. It returns pairs, and on top of them groups: union-find for strong, buckets by
amount for weak. „Zweryfikuj” reads the pairs; the finder reads the groups. Candidates are loaded by
the probes' amounts and numbers, so a narrow scope stays a narrow load.

## Phases at a Glance

| Phase                        | What it delivers                                    | Key risk                                                      |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| 1. Engine (pure)             | Pairwise window, pairs + groups with identity rules | A sibling rule too loose (self-matches) or too tight (misses) |
| 2. Loaders + zgłoszenie path | In-zgłoszenie duplicates in „Zweryfikuj”            | 0- vs 1-based read row indexing in origins                    |
| 3. Finder query              | Scope → strong/weak groups, management only         | All-time load size with pages                                 |
| 4. UI                        | Dialog on `/`, links, `?zgloszenie=N`               | Opening the dialog on arrival exactly once                    |

**Prerequisites:** EX-1053 committed (done); local 5435 test DB imported.
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- The all-time scan may be slow with pages inline. The plan's fallback: load pages for group members
  only, if the manual timing check calls for it.
- Assumes pending zgłoszenia are always probes regardless of table filters. Revisit if the queue grows
  large.

## Success Criteria (Summary)

- From `/`, management finds a receipt booked twice (also across investments and in older periods) in
  one click, and opens both sides.
- „Zweryfikuj” flags a paragon photographed twice within one zgłoszenie.
