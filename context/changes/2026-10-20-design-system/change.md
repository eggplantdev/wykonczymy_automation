---
change_id: design-system
title: In-app design system page — inventory, consolidate and document UI primitives
status: implementing
created: 2026-10-20
updated: 2026-10-20
archived_at: null
branch: design-system
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/design-system
---

## Notes

Source of truth is code, not Figma: tokens in Tailwind v4 `@theme` (`src/styles/globals.css`), components in
`src/components/ui/`, and a dev-facing in-app page that renders everything.

1. Inventory every existing UI primitive on the page — buttons, inputs, selects, typography, colors, badges,
   etc. — including the hand-rolled ones scattered across features (expected: dozens).
2. Review the page for inconsistencies; collapse duplicates onto shared tokens + `components/ui` variants.
3. Keep the page as the reference to relate to as the app grows.

Sequencing: start small — a first page with the existing tokens and core primitives, iterate on how it
should look, and only once the look is decided run the full-repo census of hand-rolled UI and the sweep.

Decided: one long page with a sticky table of contents (not sub-pages) — side-by-side is what exposes drift.
Try it and revisit if it gets unwieldy.

Decided: only real components on the page — no imitation frames or showcase-only copies of a primitive's
chrome, and no primitive changed just so the page can show it. Dialogs open from a trigger. Small overlays
(dropdown, select, popover, tooltip) are shown held open via their controlled `open` prop where Radix allows
it, falling back to a trigger.

Decided: the new page absorbs `/warianty-badge` (badges become one section; one route, one pattern).

Decided: the datasheet-grid cells (`ui/datasheet-grid/`) go into a second iteration, not the first page.

Nature: between a spike and an experiment — the first time this repo gets a design system, so the goal is
to get the problem out of the way fast and learn from the page, not to build a polished catalogue. No tests;
the page renders real code, so a broken primitive breaks the page visibly.

Motivation (owner, 2026-10-20): every new feature adds near-duplicate components — agents have nothing to
anchor to, don't reuse the existing primitives, and the app drifts visually. Stop the multiplication now.
Second: the owner can't judge visual consistency by clicking through dozens of pages — needs every
primitive (all button variants and colours, inputs, dialogs, textareas, …) in one place.

Scope of this change: the page only — every primitive in `src/components/ui/`. An agent catalogue and an
ESLint guard against hand-rolled primitives come later, as their own change; the page alone already makes
drift easy for the owner to spot.

Storybook: overkill for now — not planned. Page loops over each component's own exported variant maps
(the `/warianty-badge` pattern), so nothing is listed twice.

Not in scope: per-page breakpoint mockups.
