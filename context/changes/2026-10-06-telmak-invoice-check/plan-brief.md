# Telmak invoice check — Plan Brief

> Full plan: `context/changes/2026-10-06-telmak-invoice-check/plan.md`

## What & Why

Every month Telmak sends a package of ~100 PDF documents (WV / KWV / WZ / FP). Checking them by hand
against the Telmak register found 5 discrepancies in September — missing bookings, a wrong amount, a
cancelled row, a booking without its PDF. This change turns the accepted clickable spike into
production code: drop the package on `/kasa/11`, see what disagrees, fix it from the same dialog.

## Starting Point

An uncommitted spike in the `telmak-invoice-check` worktree works end to end in dev and reproduces the
manual September report exactly. Its code sits in the wrong layers (SQL beside auth, column defs inside
the dialog), the button is gated by the register's name, and nothing is under test.

## Desired End State

Same dialog and behaviour, shown on the Telmak register by id to management; SQL in `lib/db`, columns
in `components/tables/`; parser, comparison and SQL under test; production build proven to ship the
pdfjs worker; the browser path filed to the E2E backlog.

## Key Decisions Made

| Decision       | Choice                                 | Why (1 sentence)                                                     |
| -------------- | -------------------------------------- | -------------------------------------------------------------------- |
| Which register | Telmak only, `TELMAK_REGISTER_ID = 11` | No migration, survives a rename; the id is shared by prod and dumps. |
| Roles          | ADMIN / OWNER / MANAGER                | `/kasa` is management-only already; managers book Telmak.            |
| E2E            | Deferred to an `e2e-backlog` issue     | Unit + DB specs cover the real risks (misread amount, wrong match).  |
| Parsing        | Browser, pdfjs, deterministic          | No upload of the package, no LLM; layout drift fails loudly.         |
| Fixtures       | Hand-built line arrays, invented data  | No real invoices/PII in the repo.                                    |

## Scope

**In scope:** layer moves, id gate, parser/comparison unit specs, SQL DB spec, build check, E2E issue.

**Out of scope:** other suppliers, register setting/migration, storing the package, OCR/LLM fallback,
i18n of the dialog, the E2E spec itself.

## Architecture / Approach

Browser: pdfjs → lines → `parseTelmak` → docs. Server action `fetchTelmakCheckRows` (auth) →
`loadTelmakCheckRows` (SQL: register rows ±1 month + any row whose note number is in the package) →
browser `compareTelmak` → „Faktury do weryfikacji” table; problem ids → `fetchTelmakTransferRows` →
„Transakcje do weryfikacji” with the transfers-list columns. Attach reuses `useInvoiceUpload`.

## Phases at a Glance

| Phase                        | What it delivers                               | Key risk                                    |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------- |
| 1. Logic under unit test     | Parser + comparison specs, register constant   | Fixtures drifting from the real layout      |
| 2. SQL into `lib/db`         | Data-access split + DB spec                    | Note-number normalization differs SQL vs JS |
| 3. UI placement, gate, build | Columns moved, id gate, build proof, E2E issue | pdfjs worker not emitted by `next build`    |

**Prerequisites:** `db-test` container on 5435 for phase 2.
**Estimated effort:** one session.

## Open Risks & Assumptions

- The pdfjs worker URL form may need adjusting for the production bundler.
- Telmak may change its document layout; the parser rejects rather than guesses, and the toast asks
  the user to report it (Sentry capture pending EX-449).

## Success Criteria (Summary)

- A manager drops the monthly package on `/kasa/11` and sees exactly the documents that disagree.
- A missing PDF is attached from the dialog in one click.
- The check works on a production build.
