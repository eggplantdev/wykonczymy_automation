# Review-gate ledger — kosz-zgloszen (EX-970) · 2026-10-02

Base `4330aa8d` (staging merge-base) → `d2aee70c`, 9 commits, 39 files.
Step 0.5 (browser verification) skipped — no Playwright unprompted; manual checks go to the registry.
Fan-out: 10x-impl-review, code-review, tailwind-v4-audit, feature-first-structure, module-cohesion-audit,
structure-scatter-audit, comment-noise-audit (flag-only) → /simplify (+ primitive-reuse-scan).

## Findings

_Trimmed at archive (2026-10-02): 19 fixed findings dropped — each fix is its commit. Pre-trim tally: 19 fixed, 2 filed, 7 dropped, 4 dismissed, 2 no-finding audits · 0 open._

- [x] 🟡 WARNING · dismissed · impl-review + code-review · `src/lib/leads/erase-lead.ts:63` · erase drops the asset references before `deleteUnreferencedMedia`, so a failed reclaim leaves orphaned media — the documented best-effort contract (`deleteUnreferencedMedia` runs after the write that drops the reference, by design: the reverse order could delete a file a row still names); the plan prescribes this order and the failure is logged
      test: no automated test — the orphan is the accepted outcome, nothing to pin
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/actions/promote-lead.ts:24` · a stale tab can still promote / attach files of a lead that was trashed meanwhile — plan scoped it out; the input is the user's own form data and the result is a normal investment, nothing is lost
      test: no automated test — out of scope by plan
- [x] 🔵 OBSERVATION · dropped · code-review · `src/app/(frontend)/api/webhooks/landing/route.ts` · a trashed-but-not-erased lead whose notify crashed mid-flight is re-notified on a webhook redelivery — needs a crash between capture and notify plus a trash in the retry window; a trashed lead is still live data, so a duplicate mail is harmless
      test: no automated test — unreachable in practice
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/components/tables/data-table/data-table.tsx` · column-visibility toggle relies on `getCanHide()` for the select column — benign, `enableHiding: false` keeps it out of the menu
- [x] dropped · comment-noise-audit · `src/migrations/20261002_0_leads_trashed_erased_at.ts` · header line restates the filename — every sibling migration carries the same header; consistency wins
- [x] dropped · simplify (reuse) · `toggleInSet` helper, shared test-fixture builders, a `trashedAt` field factory across collections — params ≈ the code they'd replace, no win
- [x] dropped · simplify (reuse) · `TrashLeadsButton` vs `TrashRowButton` — bulk vs single-row confirm differ in every param; merging is a config object the size of the components
- [x] dropped · simplify (efficiency) · defer the erase reclaim via `after()` — the reclaim already runs after the committed write; deferring it would hide its failure from the action log
- [x] dropped · simplify (efficiency) · `depth: 0` on lead reads, the double fetch in erase, a cached new-count — microseconds on a page used a few times a week
- [x] dropped · simplify · `LeadSourceT` vs `Lead['source']` — same union, the alias predates this change
- [x] dismissed · simplify (reuse) · `stampSequentially` lookalike in another kind — different contract (ordered stamps), not a duplicate
- [x] filed · simplify (altitude) · `src/lib/{cash-registers,equipment,fleet,investments,leads,workers}/purge-trash.ts` · six near-copies of the purge cron body — one runner configured per kind; rewrites five other kinds' crons, needs its own review — filed **EX-975**
- [x] filed · E2E obligation · /zgloszenia → „Do kosza" → /kosz Zgłoszenia → Przywróć → Usuń na zawsze (typed name), galeria inwestycji nietknięta — deferred by plan, filed with label `e2e-backlog` — **EX-976**
- [x] none · tailwind-v4-audit · no findings
- [x] none · feature-first-structure · no findings (its spec-home note is answered by `src/__tests__/lib/leads/erase-lead.test.ts`)

## Simplify pass

Ran /simplify (4 angles + primitive-reuse-scan) — 13 applied, 0 proposed, 1 filed (EX-975), 7 dropped/dismissed; each folded into ## Findings (tagged simplify).

## Tests & suite

- typecheck — pass (post-simplify)
- lint — 0 errors on touched files; 1 pre-existing warning (`useReactTable` incompatible-library); repo-wide 82 warnings, pre-existing
- specs authored, **not run** (user: „no tests now"): `src/__tests__/lib/leads/erase-lead.test.ts`, `src/__tests__/components/leads/leads-data-table.test.tsx`, `src/__tests__/lib/actions/lead-trash.db.test.ts`
- test / test:integration / e2e — deferred by user
