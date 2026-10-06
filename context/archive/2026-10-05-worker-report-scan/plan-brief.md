# Plan Brief — EX-949 worker-report-scan

## What

A kierownik prints „Drukuj do wypełnienia" for a worker, and the worker writes quantities on the
paper. The kierownik photographs the sheets. The AI reads each photo, and the app creates a `pending`
zgłoszenie prac that opens in the existing verification dialog, with the photos beside the lines.

## Why this shape

Every piece reuses something already built:

- the form is the worker print with other columns;
- the read is the receipt reader with another schema;
- the upload is `submitWithUploads`;
- the review is the existing dialog with three flags.

The only new mechanism is a stable number per pozycja, because the database id is reminted by
restore, import and szablon.

## Key Decisions

| Decision                           | Choice                                                                                     | Source                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------- |
| What the paper records             | Quantity per pozycja in its j.m., not hours                                                | change.md #1                    |
| Who scans                          | Management only; „Zgłoszenia prac" listing + editor Pracownicy menu                        | change.md #2                    |
| Worker / investment identification | Picked by the kierownik; no QR, header not checked                                         | change.md #3                    |
| Row identification                 | Stable `ref` + Damm check digit („35812-7"); no text comparison                            | change.md #4                    |
| Number lifecycle                   | Kept by restore and sheet import; minted by szablon / Wyczyść / add / copy                 | change.md #4, research A        |
| Photos                             | Stored with the zgłoszenie (`worker_report_media`) and shown in verification               | change.md #5                    |
| Draft step                         | None — `pending` straight into verification                                                | change.md #6                    |
| Multi-page                         | One AI request per photo, rows joined, a duplicate number flagged and never summed, cap 12 | change.md #8                    |
| `/z/` history                      | Hides scans (`source = 'scan'`)                                                            | change.md #9                    |
| Unclear digit                      | Best guess + „niepewny odczyt"                                                             | change.md #11                   |
| Extra's j.m.                       | Must be from the kosztorys list; otherwise empty and accepted only with a katalog praca    | change.md #12                   |
| Form printing                      | A variant of the worker print — same builder, styles, page handling; no page numbering     | change.md #13, owner 2026-10-05 |
| AI model                           | `RECEIPT_MODEL` + `withModelFallback` unchanged                                            | owner 2026-10-05                |

## Phases

1. **Stable number + check digit.** A migration (sequence, backfill `ref = id`, unique), carried
   through the insert / snapshot / import, stripped from szablony, plus the Damm module.
2. **„Drukuj do wypełnienia".** `buildWorkerFormHtml` beside `buildWorkerPrintHtml`, with
   `WorkerPrintMenuItem` parameterised and three dictionary keys.
3. **Data model + create action.** `source`, `created_by`, line `is_uncertain` / `scanned_ref`,
   `worker_report_media` + the media guards, `resolveScanLines`, `createScannedReportAction`, and
   the `/z/` filter.
4. **AI read.** A management-only route, one photo per request, with a schema factory that has a
   per-call unit enum.
5. **Scan dialog + entry points.** A dialog based on `ExpenseDraftDialog`, the listing toolbar
   action, and an editor menu item.
6. **Verification.** The photo pane, the flags, duplicates kept out of „Zaznacz wszystkie", the
   no-j.m. accept rule (client + server), and the header line.

## Not doing

- Page numbering or any new print mechanics; QR codes.
- Scanning from `/z/` or the worker's page.
- A new AI model.
- Showing `ref` elsewhere.
- Re-linking report lines through `ref`.
- The investment-purge Blob leak (filed separately).
- Hours.

## Risks

- **The AI misreads a digit.** The check digit catches it, and the line lands „do przypisania".
- **The same sheet is photographed twice.** The lines are flagged as duplicates and are not ticked
  by „Zaznacz wszystkie".
- **Prod deploy order.** The migrations are additive, so prod is migrated before the push, by a
  human.
