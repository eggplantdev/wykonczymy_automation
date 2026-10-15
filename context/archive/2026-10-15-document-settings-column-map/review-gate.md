# Review-gate ledger — EX-1033 document-settings-column-map · 2026-10-15

Scope: `b7b62700d^..485964557` — `b7b62700d` (lesson + staging manual checks) and `485964557` (code,
migration `20261015_0`, specs); 20 files, no untracked files, none dirty in the tree.

Checks: `/10x-impl-review` (against `plan.md`), `/code-review`, comment-noise-audit (flag-only),
feature-first-structure + module-cohesion-audit + structure-scatter-audit (diff-scoped).
`tailwind-v4-audit` dropped — no markup in the diff. Step 0.5 browser pass dropped — Playwright
only on explicit ask; the staging manual checks from `b7b62700d` cover it.

## Findings

_Trimmed at archive (2026-10-15): pre-trim tally 11 fixed, 5 dismissed, 1 dropped · 0 open. The fixes live in 101b8a610 and 3b4a6f844._

- [x] · 🔵 OBSERVATION · dismissed · `src/migrations/20261015_0_document_settings_column_map.ts:72-82` · `down` keeps only `true` keys, so a later default-hidden key would show — after the legacy-ceiling fix an array never speaks for a key added since, so it reads as its default.
      test: no automated test — covered by the legacy-ceiling unit case.
- [x] · 🔵 OBSERVATION · dismissed · `src/lib/kosztorys/columns/document-column-visibility.ts:36-42` · `toHiddenColumnMap` freezes today's defaults into saved rows — by design: a saved document is the owner's reviewed choice (plan + lesson).
- [x] · 🔵 OBSERVATION · dismissed · `src/globals/kosztorys-worker-view-settings.ts:20` · unplanned `defaultValue: [] → {}` — fails closed, an improvement; prod has the row.
- [x] · 🔵 OBSERVATION · dismissed · stale-client save after a column-adding deploy — action ids change per build; an old deployment writes an array, which the legacy ceiling now covers.
- [x] · dropped · `src/lib/kosztorys/{client,worker}-view/settings.ts` `toStored*` · six-line twins; a generic `(sanitize, ceiling)` helper is as long as what it replaces.
- [x] · dismissed · structure audits · placement correct, 0 scatter; flat `src/lib/kosztorys` and `WorkerViewSettingsT` outside `types.ts` predate the diff.

## Simplify pass

Folded into the fixes above (unpinned reuse, null sentinel, rename, comment trims); nothing further.

## Tests & suite
