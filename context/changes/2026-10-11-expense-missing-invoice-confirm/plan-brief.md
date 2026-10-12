# Confirm before saving a wydatek inwestycyjny without an invoice — Plan Brief

> Full plan: `context/changes/2026-10-11-expense-missing-invoice-confirm/plan.md`

## What & Why

Investment expenses get booked with no faktura and nobody notices until the invoice download or the
accountant asks. Saving one without a file now stops on a neutral „Brak faktury” dialog that names
the rows — it asks, never refuses, because a purchase with no document still happened.

## Starting Point

No rule or warning exists. The ask-before-write pattern lives only inside `useManagedForm`
(`confirmBeforeSubmit`, used by the deposit form); the expense create and edit forms don't use that
hook.

## Desired End State

„Zapisz” on a wydatek inwestycyjny (brutto or netto) with a row lacking a file shows „Brak faktury”
— „Bez faktury: Klej do płytek, Fuga szara (2 z 3).” — with „Zapisz bez faktury” / „Popraw”. Same in
„Edytuj transakcję” when no page is kept or added. Rows with files and other types save as today.

## Key Decisions Made

| Decision            | Choice                                        | Why                                                         | Source |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------- | ------ |
| Types               | `INVESTMENT_EXPENSE` + `INVESTMENT_EXPENSE_NET` | Both are „wydatek inwestycyjny”; netto needs a faktura most | Plan   |
| „Wliczone w robociznę” | Warns too                                  | The company's books still want the document                 | Owner  |
| `invoiceNote`       | Does not exempt                               | A note is not a document                                    | Owner  |
| Dialog colour       | Neutral                                       | The save is legitimate, not destructive                     | Owner  |
| Edit form           | Warns too; legacy rows ask every save         | Same rule on every path that writes the row                 | Owner  |
| Copy                | Row names + count                             | In a batch the manager sees which receipt he forgot         | Plan   |
| Cancel label        | „Popraw”                                      | Matches the deposit confirm; „Dodaj fakturę” is taken       | Plan   |
| Mechanism           | Extract `useSubmitConfirm` from `useManagedForm` | Three consumers, one awaited-answer implementation        | Plan   |

## Scope

**In scope:** create form (incl. zgłoszenie acceptance), edit form, shared hook + copy, DOM specs,
updating the E2E driver and the EX-460 spec that save without a faktura.

**Out of scope:** server-side enforcement, other expense types, per-row markers, the stale Payload
admin hint on `invoiceNote`.

## Architecture / Approach

`useSubmitConfirm()` returns `ask(copy) → Promise<boolean>` plus `ConfirmDialog` props; `useManagedForm`
is rebuilt on it with an unchanged API. Each form's `onSubmit`, after its existing guards and before
`submit()`, builds the copy from a pure `missingInvoiceConfirm(...)` and awaits the answer.

## Phases at a Glance

| Phase                         | What it delivers                              | Key risk                                   |
| ----------------------------- | --------------------------------------------- | ------------------------------------------ |
| 1. Shared hook + copy         | `useSubmitConfirm`, exported predicate, copy fn | Deposit confirm regressing                 |
| 2. Create form asks           | Dialog in „Nowy wydatek” + zgłoszenie         | Asking before ingest finished; stale specs |
| 3. Edit form asks             | Dialog in „Edytuj transakcję”                 | EX-460 E2E spec now meets the dialog       |

**Prerequisites:** a dedicated branch from a clean tree — the current checkout
(`invoice-download-date-range`) carries another change's uncommitted work.
**Estimated effort:** one session, three small phases.

## Open Risks & Assumptions

- Legacy investment expenses with no faktura will ask on every edit save (accepted).
- E2E specs are updated but not run unless asked.

## Success Criteria (Summary)

- No investment expense is saved without a faktura unless someone clicked „Zapisz bez faktury”.
- Nothing else about saving an expense changes.
