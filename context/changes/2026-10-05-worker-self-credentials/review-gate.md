# Review-gate ledger — worker-self-credentials (EX-989) · 2026-10-05

Scope: `de6b71b9...worker-self-credentials` (merge-base with `staging`), commits `e7a816ca..6276e999`.
Step 0.5 (browser verification pass) skipped — not requested this turn; manual checks live in
`context/foundation/manual-checks.md` § EX-989.

## Findings

- [x] 🟡 WARNING · dismissed · code-review · `src/lib/actions/workers.ts:30-60` · `updateWorkerAction` sets an e-mail with no password — owner ruling: management editing an account in „Edytuj pracownika” is the feature, not a hole
      test: no automated test — not a defect
- [x] 🟡 WARNING · fixed · simplify(altitude) · `src/collections/users.ts:50-59` · `unlock` access defaulted to any session, so the phone's holder could `POST /api/users/unlock` and reset the lockout the current-password check depends on → `unlock: isAdminOrOwnerOrManagerBoolean`
      test: test-driven-debugging · integration — `account-credentials.db.test.ts` „an employee cannot lift the account lockout", red then green
- [x] 🟡 WARNING · fixed · code-review · `src/lib/actions/account-credentials.ts:21-33` · catch-all reported an infrastructure error as a wrong password (burns lockout attempts, never logged) → only `AuthenticationError` maps to the refusal, the rest rethrows
      test: test-driven-debugging · integration — „does not report an infrastructure failure as a wrong password", red then green
- [x] 🟡 WARNING · fixed · impl-review F1 · `account-credentials.db.test.ts` · no spec for a deactivated account
      test: TDD · integration — „refuses a deactivated account…" added (behaviour was already correct, passed first run)
- [x] 🔵 OBSERVATION · dropped · code-review · `account-credentials.ts:65-76` · e-mail uniqueness TOCTOU between `findEmailHolder` and `update` — 5 users, the unique index still guards the data
      test: no automated test — race window not reachable at this scale
- [x] 🔵 OBSERVATION · dismissed · code-review · reset-password token survives a credential change — the link reaches only the mailbox owner, who can request a fresh one anyway
- [x] 🔵 OBSERVATION · dismissed · code-review · `payload.login` leaves a session row per verification — documented in the verifier's comment, expires with the cookie lifetime
- [x] 🔵 OBSERVATION · dismissed · impl-review F2 · „Zostaw puste…" hint is a placeholder — it matters only while the field is empty, which is exactly when it shows
- [x] 🔵 OBSERVATION · fixed · impl-review F3 · REST closure also removes self-edit of `name`/`language` — now stated in AGENTS.md
- [x] 🔵 OBSERVATION · dismissed · impl-review F4 · manual checks pending — tracked by the registry, they are the archive blocker, not a finding
- [x] 🔵 OBSERVATION · dismissed · impl-review F5 · stale `defaultValues.email` on reopen — Radix `DialogContent` unmounts on close, form remounts with fresh props; manual check „reopen" covers it
- [x] skipped · simplify(altitude) · `src/lib/actions/auth.ts:28-31` · `loginAction` still reports a DB failure as „Nieprawidłowy email lub hasło" — `auth-actions.test.ts` pins „any other failure → generic message" deliberately; reversing a login-page behaviour is outside this slice
- [x] filed · simplify(reuse/altitude) · `src/lib/actions/account-credentials.ts:43-50` · third hand-wired `requireAuth(ROLES)` + `runAuthorizedHandler`; `protectedAction` should take `roles` — touches two other slices' actions still moving on staging — filed EX-993
- [x] filed · e2e · browser path (dialog → action → revalidate → re-login) owed by the slice — filed EX-994 (`e2e-backlog`)
- [x] fixed · simplify · `account-credentials-schema.ts` · form and action schemas duplicated `email`/`currentPassword` and encoded „keep" two ways → form schema `.extend`s the action schema, one `newPasswordSchema`
- [x] fixed · simplify · `account-credentials-form.tsx:37-41` · `toData` mapper existed only to bridge the two schemas → `toData: (value) => value` (zod strips `confirmPassword`)
- [x] fixed · simplify · `worker-lock.ts:29`, `schemas/password.ts:3` · `LOCKED_ACCOUNT_MESSAGE` / `PASSWORD_MIN_LENGTH` exported with no outside reader → un-exported
- [x] fixed · reuse-scan · `account-credentials-dialog.tsx:18` · `text={TITLE}` repeated `RowActionButton`'s `text ?? label` fallback → removed
- [x] fixed · structure · `'LockedAuth'` literal duplicated across `auth.ts` and the new action → `loginRefusalMessage` in `worker-lock.ts`
- [x] fixed · comment-noise · schema „Domain layer…" deleted, „Form-input layer:" trimmed, db spec header tail trimmed
- [x] dropped · simplify · `account-credentials.ts:72-75` · conditional spreads → `{ email, password: newPassword || undefined }` — marginal, and writing an unchanged e-mail back runs the field's validation for nothing
- [x] dropped · simplify · `pracownicy/[id]/page.tsx` · outer `(isManager || isOwnPage) &&` wrapper → `empty:hidden` — explicit condition reads clearer, same output
- [x] dropped · simplify(efficiency) · `account-credentials.ts:79` · password-only change still bumps `collection:users` — one reference-data rebuild a few times a year
- [x] dismissed · simplify(efficiency) · `['users']` revalidation duplicates the `afterChange` hook — same as `workers.ts` / `user-preferences.ts` (EX-850), zero cost
- [x] dropped · simplify(altitude) · error matching by `name` string vs `instanceof LockedAuth` — `payload` is in `serverExternalPackages`, names survive; the comment documents it
- [x] dropped · reuse-scan · `useAccountCredentialsFormStore` exists only because `useManagedForm` requires a store — same as 3 other draftless forms; making it optional isn't worth the pass-through
- [x] dropped · reuse-scan · `reset-password-form.tsx` still checks pair/length by hand — converting changes its single-line error UI; the rule is already shared via `passwordSchema` / `PASSWORD_MISMATCH_MESSAGE`
- [x] dismissed · reuse-scan · db spec uses its own `ex989-` prefix, not `purgeFixtureUsers` — it cleans in `beforeEach`; the shared sweep would wipe all fixture users 9× per run
- [x] dropped · code-review/structure · `emailSchema` duplicates `worker-schema` — the shared part is one `.trim().toLowerCase()` chain, params == code
- [x] dismissed · structure · `find-email-holder` home — `lib/workers/` is established and `workers.ts` is a consumer
- [x] dropped · structure · `worker-lock.ts` filename no longer matches its content — predates this slice
- [x] dismissed · code-review · `formId` inline — matches the other dialogs
- [x] dismissed · code-review · wrapper div around the manager's edit button — covered by the manual pass
- [x] dismissed · comment-noise · `canUpdateUser` banner — the file uses 7 such banners
- tailwind-v4-audit: clean, 0 findings.

## Simplify pass

Ran /simplify (4 agents: reuse + primitive-reuse-scan, simplification, efficiency, altitude) — 6 applied (1 a correctness fix: `unlock` access), 1 filed (EX-993), 1 skipped, 8 dropped/dismissed; every finding folded into ## Findings (tagged simplify / reuse-scan).

## Tests & suite

- `pnpm typecheck` — only the pre-existing TS2345 in `src/lib/actions/delete-orphaned-media.ts` (from `de6b71b9`, not this slice).
- `pnpm lint` — 0 errors.
- `pnpm test:integration` — stopped by the user mid-run; slice specs passed individually earlier (`account-credentials.db.test.ts`, `worker-duplicate-email.db.test.ts`, 11 tests).
- After the review fixes (touched specs only): `account-credentials.db.test.ts` 9/9, `account-credentials-schema.test.ts`, `auth-actions.test.ts`, `(auth)/zaloguj` login-form, `access-control.test.ts` — 71/71 green. `tsc` — only the pre-existing error above.
- Full suite / `test:integration` / E2E — not run (stopped by user; E2E filed as EX-994).
