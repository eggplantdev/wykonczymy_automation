---
change_id: kosztorys-section-footer-row
title: Move the section's totals out of its header into a footer row under their own columns
status: archived
created: 2026-07-27
updated: 2026-08-10
archived_at: 2026-08-10T08:21:59Z
branch: ex-607-kosztorys-section-footer-row
---

## Notes

Owner's ask, verbatim: "owner does not like totals in the section name / he want it moved to rows
under each column".

Reverts the layout decision taken in `30a095de` ("move the section band's total into its label
cell"), which folded the band's netto/brutto into the section name because the money columns were
hidden per axis and the figure vanished. The answer this time is a second row rather than a
relocated label: the header keeps identity, a footer carries the figures under the columns they
belong to.

Constraint the owner set explicitly: **only the columns we can already total**.

Follow-up after the first look at it (owner, same day): that constraint means _everything that can be
calculated_, not only what `SectionSubtotalT` happened to carry — the etap axis, „Pozostało" and the
przedmiar qty are all plain sums of their own column and belong in the footer. Resolved by moving the
column-id → total mapping into one lib function, `columnTotalsForRows` (now `src/lib/kosztorys/column-totals.ts`),
called at two scopes: all rows for „Razem", one section's rows for each footer. Σ of the footers is
„Razem" by construction, and a column stays blank only where its total is not a sum of its own cells.
