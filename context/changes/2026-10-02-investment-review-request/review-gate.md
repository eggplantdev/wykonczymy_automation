# Review-gate ledger — investment-review-request (EX-973) · 2026-10-02

Scope: `71693396...HEAD` (merge-base with `staging`), commits 51e089ab 2b44f30f f6b53347.
Step 0.5 (browser verification) skipped — no browser pass unasked; manual checks live in
`context/foundation/manual-checks.md` § EX-973. Tests: none this run, per user.

## Findings

- [x] 🔴 CRITICAL · fixed · code-review · `src/components/dialogs/edit-investment-dialog.tsx` · post-save prompt opened by the row's formId — the listing's default status filter hides completed rows, so the refresh unmounts the row and the prompt never shows — `review-prompt-store` + `ReviewPromptHost` mounted once in the shell
      test: no automated test — user ruled no tests this run; covered by manual check „Edytuj → Zakończona → dialog opinii"
- [x] 🟡 WARNING · fixed · code-review · `src/lib/actions/review-request.ts` · send-then-write not atomic: a failed flag write read as a failed send, and a retry would mail the client twice — write failure now returns success + warning, logged with `TODO(EX-449)`
      test: no automated test — user ruled no tests this run
- [x] 🟡 WARNING · fixed · code-review · `context/reference/outgoing-effects-isolation.md` · map of outgoing effects omitted the new client-facing mail — added
- [x] 🟡 WARNING · dismissed · code-review · `src/components/tables/investments.tsx` · listing button only visible after switching the filter to „Zakończone" — accepted: the investment page carries the button, and the post-save prompt covers the moment of completion
- [x] 🟡 WARNING · dismissed · impl-review · `src/components/tables/investments.tsx` · trigger lives in „Akcje", not the „Opinia" column the plan named — accepted deviation, recorded in change.md
- [x] 🟡 WARNING · dismissed · impl-review · `src/lib/actions/review-request.ts` · trashed pre-check not in the plan — accepted: mailing a client about a trashed investment is wrong; recorded in change.md
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/dialogs/request-review-dialog.tsx` · overwriting `investment.email` not disclosed — dialog copy now says the address is saved on the investment
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/actions/review-request.ts` · status literal `'completed'` — `investmentLockOf` / `isLockedStatus`
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/stores/form-stores.ts` · dedicated form store for a one-field form — `useManagedForm` requires one; same as the other `persistDraft: false` forms
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/actions/review-request.ts` · a staff role can mail any address — 3 trusted roles, 5 users; not a relay worth gating
- [x] 🔵 OBSERVATION · dismissed · code-review · `investment-form.tsx` · keepOpen path never fires the prompt — edit dialog passes `showKeepOpen={false}`
- [x] 🔵 OBSERVATION · fixed · impl-review · `request-review-button.tsx` · stray `requestReviewFormId` export — removed; formId is a dialog prop default
- [x] 🔵 OBSERVATION · skipped · impl-review · sql-drift spec not run — no tests this run (user)
- [x] fixed · feature-first-structure · `src/types/reference-data.ts` · repeated inline `Pick<InvestmentRefT,…>` — `ReviewRequestInvestmentT`
- [x] fixed · comment-noise · `src/lib/investments/review-request-email.ts` · JSDoc restated the code — trimmed to the throw contract
- [x] fixed · comment-noise · `src/migrations/20261002_1_investments_review_requested.ts` · „hand-written" boilerplate line — deleted (rollback rationale kept)
- [x] dropped · comment-noise · `src/collections/investments.ts` · borderline field comment — not worth the churn
- [x] fixed · simplify · `src/components/forms/investment-form/investment-form.tsx` · result smuggled from `action` to `onSubmitSuccess` through a ref — `onSaved(data)` added to `useManagedForm`/`useFormSubmit` (fires after a confirmed write on both the awaited and optimistic paths)
- [x] fixed · simplify · `investment-form.tsx` · „enters Zakończona" check spelled twice — local `entersCompleted`
- [x] fixed · simplify · `src/stores/review-prompt-store.ts` · caller had to set the target and open the dialog in two steps — one `openReviewPrompt` action; form id moved into the store
- [x] fixed · simplify · `src/lib/email/brand-logo.ts` · `LOGO_URL` duplicated in `notify.ts` and the review email — `BRAND_LOGO_URL`
- [x] fixed · simplify · `src/lib/actions/review-request.ts` · own trashed message — `INVESTMENT_TRASHED_MESSAGE` via `investmentLockOf`
- [x] fixed · simplify · `src/app/(frontend)/inwestycje/[id]/page.tsx` · `!trashed && isLockedStatus(...)` — `investmentLockOf(...) === 'completed'`
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
