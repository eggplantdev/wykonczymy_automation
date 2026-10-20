# DS Primitive Sweep — Plan Brief

> Full plan: `context/changes/2026-10-20-ds-primitive-sweep/plan.md`
> Census: `context/changes/2026-10-20-ds-primitive-sweep/census.md`

## What & Why

Features keep rebuilding UI primitives (collapsibles, buttons, spinners, dialogs, headings, error lines)
instead of using `src/components/ui/`. The 2026-10-19 audit missed it because it looked for text clones,
not for rebuilt components. Before the design system grows, every copy moves onto `ui/`, and a lint rule
stops new copies.

## Starting Point

There are ~270 hand-rolled sites, listed in `census.md`. `ui/` has its own duplicates: 6 spinners,
2 dialog title styles, 5 heading scales, 3 greens and 3 warnings. Some shapes the features need don't
exist yet. Nothing mechanical blocks a new copy.

## Desired End State

`local/no-hand-rolled-ui` reports nothing outside `ui/`, and the suppression baseline is deleted. Every
census line is swapped or marked legit with a reason. `ui/` has one spinner, one dialog chrome, one
heading family, one warning token and one green, and `/design` shows every piece.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Guard form | Own local ESLint rule + bulk-suppression baseline | Extra selectors on the existing `no-restricted-*` rules would replace their options per block and drop the env/cache guards; the baseline ratchets down each phase | Plan |
| Order | Guard → bugs → `ui/` consolidation → new pieces → swaps by family → close-out | No new copies land mid-sweep; swaps only swap | Session |
| Δ vs = | Done together per family | Visual defaults are settled (below) | Session |
| Warning colour | One amber `--color-warning` token | Replaces amber-600 / chart-orange / Badge pending | Owner default |
| Spinner | `GradientSpinner` everywhere, Button `pending` | Six looks → one | Owner default |
| OK green | `chart-green` | Replaces green-600 / emerald / teal | Owner default |
| Dialog widths | md 448 → `dialog-sm` 420; lg 512 → `dialog` 600; others → nearest token | Tokens already exist | Owner default |
| Segmented switches | `ToggleGroup variant="muted"` keeps today's look | No visible change to the nav switches | Owner default |
| Native `title=` | → `SimpleTooltip` / `HintTooltip`; truncation reveals stay | `title` never shows on disabled buttons or touch | Owner default |
| Tests | Test-first for the 4 testable bugs and for behavioural new pieces; no tests for class swaps | Presentational risk → manual checks | Plan |

## Scope

**In scope:**
- The ESLint guard and the AGENTS.md rule.
- The five census bugs.
- `ui/` dedupe and the new pieces, with `/design` entries.
- Every census swap.

**Out of scope:**
- Storybook and an agent catalogue.
- Redesigns beyond the defaults above.
- A touch-target floor.
- The datasheet-grid cell iteration.
- E2E.

## Architecture / Approach

A rule in `eslint-rules/no-hand-rolled-ui.mjs` flags these signals outside `ui/`:
- raw Radix / cmdk / vaul imports;
- `Loader2`;
- raw palette classes;
- raw dialog widths;
- `text-destructive` paragraphs;
- `<details>`, `<label>`, `<button className>`;
- native `title`.

`eslint-suppressions.json` freezes today's count, and each swap phase prunes it. Phases 3–4 make `ui/`
complete. Phases 5–11 follow the census sections.

## Phases at a Glance

| Phase | Delivers | Key risk |
|---|---|---|
| 1. Guard | Rule + spec + baseline + AGENTS.md | False positives → disable-with-reason noise |
| 2. Bugs | 5 fixes, 4 with failing-first specs | — |
| 3. `ui/` consolidation | Tokens, Button variants, one spinner/dialog/heading/error system | Variant removal ripples to callers (tsc-gated) |
| 4. New pieces | Button sizes/pending, TextLink, InlineLoading, Sheet, Panel, … | Untranslated defaults inside `ui/` |
| 5–11. Swaps | §2 buttons, §3 dialogs, §4/5/10 cards/headings/tables, §6 loading, §7 feedback, §8 fields, §9 disclosure | Line drift; memoized surfaces; the in-flight collapsible work |
| 12. Close-out | Baseline deleted, census closed, EX-1110 done | — |

**Prerequisites:**
- Phase 11 waits for the other agent's collapsible edits to be committed.
- Phases 3–4 avoid `ui/collapsible.tsx` / `ui/select.tsx` while those are dirty.

**Estimated effort:** ~4–6 sessions. Phases 5–11 are mechanical and can run one per sitting.

## Open Risks & Assumptions

- ESLint 9.39's handling of unneeded suppressions (error vs pass) is to be confirmed in phase 1. Pruning
  is a required step either way.
- `title` on intrinsic elements may flag more legit sites than the census lists. Each gets a disable
  with a reason.
- The `mobile-nav` → `Sheet` swap is the one behaviour change on the phone surface, so it needs a LAN
  phone check.

## Success Criteria (Summary)

- Writing a raw `<button className>` or `Loader2` in a feature fails lint, and the message names the
  `ui/` primitive.
- `/design` shows one look per primitive, and the app's screens use it.
- No suppressions file, and every census line closed.
