---
change_id: ds-primitive-sweep
title: Sweep hand-rolled UI onto shared ui/ primitives and guard against new copies
status: archived
created: 2026-10-20
updated: 2026-10-20
archived_at: 2026-10-20T15:45:48Z
branch: ds-primitive-sweep
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/ds-primitive-sweep
---

## Notes

Repo-wide sweep of hand-rolled UI primitives onto shared `ui/` components, plus guards (ESLint +
census) so new copies can't land. Parent: EX-1099 (EX-1110's swap list is folded into the census).

The census (2026-10-20, five parallel read-only passes, one per UI family) was the swap worklist;
every line is now swapped or carries an `eslint-disable … --` reason.

### Owner visual defaults (2026-10-20)

Applied to every look-changing swap; don't re-ask:

- Warning colour: one amber `--color-warning` token (replaces amber-600 / chart-orange / Badge pending).
- OK green: `chart-green` (replaces green-600 / emerald / teal).
- Spinner: `GradientSpinner` everywhere, via Button `pending`.
- Dialog widths: md 448 → `dialog-sm` 420; lg 512 → `dialog` 600; others → nearest token.
- Segmented switches: `ToggleGroup variant="muted"` keeps the old look.
- Native `title=` → `SimpleTooltip` / `HintTooltip` (`title` never shows on disabled buttons or
  touch); truncation-reveal `title`s stay.

### Why app-audit-refactor (2026-10-19) missed this

- Duplication was measured with jscpd (token clones, 0.17 %). A component rebuilt with different
  props/classes is not a token clone.
- Each directory was audited on its own, never matched against the `ui/` inventory — no
  "reinvention" lens.
- design-system (2026-10-20) deferred "the census of hand-rolled UI outside `ui/`" and the ESLint
  guard to a later change that was never opened.
- Nothing mechanical blocks a new copy (no lint rule, no AGENTS.md rule).

### Guard design

One local rule `local/no-hand-rolled-ui` (not more selectors on `no-restricted-*`: a later flat-config
block replaces a rule's options and would drop the env/cache guards), with an ESLint bulk-suppression
baseline pruned phase by phase. Signals:

1. Imports outside `src/components/ui/**`: `@radix-ui/*`, `radix-ui`, `cmdk`,
   `vaul`; `react-toastify` other than `ToastContainer`; lucide `Loader2` / `LoaderCircle`.
2. Class-string literals outside `ui/`: raw status palette
   (`(text|bg|border)-(red|green|amber|emerald)-\d+`), raw dialog widths (`sm:max-w-(sm|md|lg|xl|\dxl)`
   on dialog content), `text-destructive text-(sm|xs)` paragraphs.
3. Legit exceptions carry a one-line `eslint-disable-next-line … --` reason.
4. `primitive-reuse-scan` at every slice gate stays the semantic check for copies with no import or
   class signature.

### Verification

Merged into staging untested (`3f237f4c2`, user's call): typecheck, lint, specs and `pnpm build` run
there. Class swaps have no specs by design — the EX-1110 section of `manual-checks.md` covers them.
