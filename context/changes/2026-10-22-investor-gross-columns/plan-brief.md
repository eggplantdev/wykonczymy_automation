# Brutto Columns on the Investor's Document — Plan Brief

> Full plan: `context/changes/2026-10-22-investor-gross-columns/plan.md`
> Research: `context/changes/2026-10-22-investor-gross-columns/research.md`

## What & Why

The investor's document (preview and share link) shows only netto columns, by an owner ruling from
2026-09-28. An investor settled brutto sees netto money columns while the summary above them shows
brutto, which confuses them. The owner wants brutto back as an opt-in that is off by default and
doesn't clutter the settings dialog.

## Starting Point

Gross columns already exist as keys with labels, values and totals, and the preview grid builds them.
Only the investor allowlist `PREVIEW_VISIBLE_COLUMNS` keeps them out. Settings are a per-key hidden
map, and a key the map doesn't mention falls back to its code default.

## Desired End State

„Ustawienia podglądu inwestora" has a „Netto | Brutto" toggle that swaps the money checkboxes between
the two families; brutto ones start unticked and are ticked independently of netto. Investments nobody
touches look exactly as they do today, and the PDF stays netto.

## Key Decisions Made

| Decision                    | Choice                                                                     | Why (1 sentence)                                             | Source           |
| --------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------- |
| PDF                         | Netto only for now; brutto keys never print                                | The owner's call: brutto on the link only, PDF later         | Research (owner) |
| `Cena j.m.`                 | Belongs to the netto family, paired with `priceGross`                      | The investor document has no exemption for the price column  | Research (owner) |
| „Brutto" on                 | Mirrors the twins of the visible netto columns                             | Matches what the owner already chose to show                 | Research (owner) |
| Default                     | Brutto off everywhere, including GROSS investments                         | The 2026-08-12 ruling: settlement mode never decides columns | Research (owner) |
| Storage                     | No new field; the pair bulk-edits the existing hidden map                  | No migration, and the server sanitizer stays the same        | Plan             |
| Mirror with nothing visible | Falls back to the twins of the default netto set                           | Otherwise the click does nothing                             | Plan             |
| Order dialog                | Lists brutto rows only while „Brutto" is on; ranks still use the full list | Ranks built from a subset misplace drags                     | Plan             |

## Scope

**In scope:**

- allowlist and document order;
- the money-family toggle module;
- gross twins in the empty-settlement sets;
- the print exemption;
- the dialog pair, the conditional group and the order filter;
- the domain-notes ruling.

**Out of scope:**

- brutto on the PDF;
- a default based on `settlementMode`;
- the worker document;
- the editor's own „Kolumny" menu;
- translating the gross labels.

## Architecture / Approach

The hidden map stays the only source of truth. A pure module,
`lib/kosztorys/client-view/money-family.ts`, works out the pair's checks from the map and applies a
family toggle back onto it. The dialog is a thin UI over that module.

## Phases at a Glance

| Phase                           | What it delivers                                                                                 | Key risk                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------- |
| 1. Working dialog for UI review | Allowlist, family helpers, „Netto                                                                | Brutto" toggle and order filter, all clickable locally       | UI shape still open; no specs until the user accepts it |
| 2. Hardening                    | Empty-settlement twins, print exemption, every spec including the regression guard, domain notes | An existing investment's document changes; the guard pins it |

**Prerequisites:** none.
**Estimated effort:** about one session over two phases.

## Open Risks & Assumptions

- Brutto on the link but not in the PDF is a known mismatch the owner accepted.
- The share page has no language handling, so the gross labels stay Polish.

## Success Criteria (Summary)

- An owner can switch on brutto for one investment, and the investor sees brutto columns on the link.
- Every existing investment's document is unchanged until someone ticks „Brutto".
