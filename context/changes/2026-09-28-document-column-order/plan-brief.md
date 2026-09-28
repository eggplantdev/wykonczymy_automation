# Owner-set column order for the investor and worker documents (EX-884) — Plan Brief

> Full plan: `context/changes/2026-09-28-document-column-order/plan.md`
> Research: `context/changes/2026-09-28-document-column-order/research.md`

## What & Why

The owner wants to set the column order of what the investor and the worker see, from the same
settings windows where they already tick which columns are shown. Today the order is fixed in code.
The only adjustable order is the owner's per-browser workbench preference, which by ruling
(2026-07-28) must never shape a client document.

## Starting Point

Each audience already has ONE ordered column list, shared by screen and PDF (commit `170d5586`). The
grid, the offer PDF and the worker PDF all iterate it. Settings hold only the ticks and "hide empty
pozycje". Investor settings are per investment with a firm-wide fallback; worker settings are one
firm-wide set.

## Desired End State

„Ustaw kolejność kolumn…” in both settings windows opens the existing drag window, and the order is
saved with that window's „Zapisz”. The podgląd, the `/k/` link and „Generuj ofertę” follow the
investor order. The worker link, Podgląd pracownika and the worker PDF follow the worker order.
„Opis prac” is always first and always visible, so the PDF's „Razem — sekcja” figure can never land
under the wrong heading.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where the order lives | Server-side, on the existing settings rows (3 new `jsonb` columns) | A document may only be shaped by what the owner saved, never by a browser. | Research |
| Firm default vs investment | The investment's own row wins as a whole, order included | Same rule as the ticks: one rule to remember, no new fallback. | Plan |
| Reorder UI | A separate drag window over the settings window, saved by „Zapisz” | Reuses the workbench window and keeps the settings window short. | Plan |
| PDF section total | „Opis prac” pinned first | The owner prefers a fixed first column over label gymnastics. | Plan |
| „Opis prac” hidden? | It can no longer be unchecked on either document | Closes the one remaining hole in the pin; 0 stored rows hide it today. | Plan |
| „Przywróć domyślną kolejność” | Investor: the firm order (built-in if none). Worker: the built-in order. | One click brings an investment back into line with the firm. | Plan |
| Ordering rule | One pure function per audience, used by grid and both PDFs | Screen and paper cannot drift. | Research |

## Scope

**In scope:** migration + Payload fields; sanitize (ranks, pinned „Opis prac”); ordering at the
three consumers; the dialog read returning the firm order; both settings windows' order button;
unit, DOM and one DB spec.

**Out of scope:** the workbench's per-browser order; ceilings (what MAY be shown); reordering etapy
inside their family; the summary block; E2E (owed at the review gate); EX-886's DROP migration.

## Architecture / Approach

Settings `{ hiddenColumns, hideEmptyRows }` gain `columnRanks` (a sparse key→rank map, as in the
workbench). `orderDocumentKeys` pins „Opis prac” and sorts the rest by rank. `clientDocumentColumns(ranks)`
and `workerDocumentColumns(plane, ranks)` replace the bare constants at the grid (`documentOrder`) and
both print column builders. The drag window writes into the settings draft; „Zapisz” persists it
through the existing save actions.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Storage and rules | Migration, fields, sanitize, ordering rule | `baseRanks` built off the wrong list → drags land one slot off |
| 2. Documents follow the order | Grid + both PDFs read the stored order; firm order in the dialog read | Endpoint shape change breaks the offer-print read if a caller is missed |
| 3. Settings windows | Order button, pinned tick, reset to firm/built-in, DOM specs | Nested dialog focus/close ordering; draft lost between windows |

**Prerequisites:** none. `20260928_3` (investor-change-history) is already committed; this change takes `_4`.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- `investor-change-history` phase 5 edits the neighbouring lines of `use-kosztorys-editor.ts`, so
  re-read before editing. Its snapshot view reuses the current settings, so it inherits the order.
- Prod has not been checked for stored settings hiding „Opis prac” (local dump: 0 of 11). If prod
  differs, those documents gain the column on deploy, which is the decided behaviour.
- The prod migration must run before the push (additive), by a human.

## Success Criteria (Summary)

- The owner reorders once, and the screen and paper of that audience show the same new order.
- „Opis prac” is always first; every section total sits under its own heading.
- No browser-local setting can change any client or worker document.
