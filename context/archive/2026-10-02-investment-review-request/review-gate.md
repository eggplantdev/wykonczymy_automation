# Review-gate ledger — investment-review-request (EX-973) · 2026-10-02

Scope: `71693396...HEAD` (merge-base with `staging`), commits 51e089ab 2b44f30f f6b53347.
Step 0.5 (browser verification) skipped — no browser pass unasked; manual checks live in
`context/foundation/manual-checks.md` § EX-973. Tests: none this run, per user.

## Findings

- [x] 🟡 WARNING · dismissed · code-review · `src/components/tables/investments.tsx` · listing button only visible after switching the filter to „Zakończone" — accepted: the investment page carries the button, and the post-save prompt covers the moment of completion
- [x] 🟡 WARNING · dismissed · impl-review · `src/components/tables/investments.tsx` · trigger lives in „Akcje", not the „Opinia" column the plan named — accepted deviation, recorded in change.md
- [x] 🟡 WARNING · dismissed · impl-review · `src/lib/actions/review-request.ts` · trashed pre-check not in the plan — accepted: mailing a client about a trashed investment is wrong; recorded in change.md
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/stores/form-stores.ts` · dedicated form store for a one-field form — `useManagedForm` requires one; same as the other `persistDraft: false` forms
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/actions/review-request.ts` · a staff role can mail any address — 3 trusted roles, 5 users; not a relay worth gating
- [x] 🔵 OBSERVATION · dismissed · code-review · `investment-form.tsx` · keepOpen path never fires the prompt — edit dialog passes `showKeepOpen={false}`
- [x] 🔵 OBSERVATION · skipped · impl-review · sql-drift spec not run — no tests this run (user)
- [x] dropped · comment-noise · `src/collections/investments.ts` · borderline field comment — not worth the churn
- [x] dropped · simplify · `RequestReviewButton` call sites · move the completed-status guard into the button — two call sites, no win
- [x] dismissed · simplify · `src/app/(frontend)/layout.tsx` · mount the host under `/inwestycje` only — the edit dialog is also opened from the kosztorys summary tab outside `/inwestycje`
- [x] dropped · simplify · `LEADS_REPLY_FROM` name says „leads" — renaming churns Vercel env vars for a cosmetic gain
- [x] skipped · simplify · fold the review prompt into the „Zakończyć inwestycję?" confirm as a checkbox — UX + action-order change; needs the owner's call, current flow works

## Simplify pass

Ran /simplify (4 agents) — 7 applied, 0 proposed, 4 dropped/dismissed/skipped; each folded into ## Findings (tagged simplify).

## Tests & suite

- typecheck ✓
- eslint on touched files ✓ (0 errors)
- build — not runnable in the worktree (Turbopack rejects the symlinked `node_modules`); verify from the main tree / CI
- unit / integration / e2e — deferred by user („no tests"); plan Progress 1.4, 2.1, 3.1 left open
