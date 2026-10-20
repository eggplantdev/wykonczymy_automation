# In-app Design System Page — Plan Brief

> Full plan: `context/changes/2026-10-20-design-system/plan.md`
> Research: `context/changes/2026-10-20-design-system/research.md`

## What & Why

Every new feature adds near-duplicate components. Agents have nothing to anchor to, so they rebuild what
`ui/` already has, and the app drifts visually. The owner can't judge consistency by clicking through
dozens of pages. This change adds one page that renders every token and every `ui/` primitive side by side.

## Starting Point

`/warianty-badge` already does this for badges, with a gated page and real components looped over their
own variant maps. `ui/` holds about 80 primitives with private variant maps. The tokens are in `@theme`
in `globals.css`. Dark mode is class-based.

## Desired End State

`/design-system` is a management-only page: one long page with a sticky table of contents covering colours
(light and dark side by side), typography, radius and shadow, badges, buttons, fields, overlays, dialogs,
feedback, layout, navigation and data display. Every `ui/` module except the exclusion list is on it.
Adding a variant to a typed primitive fails `tsc` until the page shows it.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Source of truth | Code (`@theme` + `ui/`), not Figma | One artifact that can't fall out of sync. | Plan |
| Tooling | No Storybook | Overkill now; the page loops over real variant maps. | Plan |
| Shape | One long page + sticky TOC | Side by side is what exposes drift. | Plan |
| `/warianty-badge` | Absorbed as the badges section, then deleted | One route, one pattern. | Research → Plan |
| Fidelity | Only real components; no primitive edited for the page | Imitations drift; the page must show what ships. | Plan |
| Overlays | Held open via `open` where Radix allows, otherwise a trigger | Visible at a glance without fake frames. | Plan |
| Drift guard | `satisfies Record<VariantT, true>` per typed variant prop | `tsc` catches a new or removed variant without exporting anything. | Plan |
| Datasheet-grid cells | Iteration 2 | Keep the first page small. | Plan |
| Tests | None | Spike or experiment; a broken primitive breaks the page visibly. | Plan |

## Scope

**In scope:**
- The `/design-system` route.
- Foundations: colours, typography, radius and shadow.
- Every `ui/` primitive except datasheet-grid and env-badge.
- Deleting `/warianty-badge` and repointing `roles-inventory.md:321` to the new route.

**Out of scope:**
- Consolidation: dead Button variants, the spinner merge, success/warning tokens, a sans font.
- The agent catalogue and the ESLint guard.
- The census of hand-rolled UI outside `ui/`.
- Datasheet-grid cells.
- Nav entry, i18n, phone layout.

## Architecture / Approach

The route folder holds the following:
- A server `page.tsx` that calls `requireManagementPage()`.
- A client body.
- `SHOWCASE_SECTIONS` (`{ id, label }[]`), which feeds both the TOC and the section headings.
- `ShowcaseRow`, promoted from the old `Row`.
- One file per section under `sections/`.

Each section imports real components and loops over exported arrays, or over exhaustiveness records
derived from the components' prop types.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Skeleton, foundations, badges | Route, gate, TOC, colours/typography/radius, badges moved, old route gone | Literal class arrays missing a token |
| 2. Components | Every remaining `ui/` primitive, looped over its variants | Held-open portalled overlays stacking or detaching on scroll → fall back to triggers |

**Prerequisites:** none. **Estimated effort:** 1–2 sessions.

## Open Risks & Assumptions

- Some primitives need context, such as the language provider or the current user. The page sits inside
  the authenticated shell, so the providers exist. Any primitive that needs domain data gets sample props.
- Held-open overlays may not survive page scroll cleanly. If so, they switch to triggers; nothing
  showcase-only gets added.
- A primitive with no typed variant prop (a hand-written class map) can't be exhaustiveness-guarded
  without exporting its map. Those are listed by hand and may drift until the consolidation change.

## Success Criteria (Summary)

- The owner opens one URL and sees every button, input, dialog, badge and colour, in both themes.
- An agent can point at a section and name the primitive to reuse.
- A new variant on a typed primitive can't ship without showing up on the page.
