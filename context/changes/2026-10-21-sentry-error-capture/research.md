---
date: 2026-10-21T11:22:18+02:00
researcher: Claude
git_commit: 954febf566489dca8cc5e127ff735e162bbce4c3
branch: staging
repository: wykonczymy
topic: 'Where must Sentry error capture go (EX-958)'
tags: [research, sentry, error-monitoring, auth, integrations, server-actions, crons, pii]
status: complete
last_updated: 2026-10-21
last_updated_by: Claude
---

# Research: Where must Sentry error capture go (EX-958)

## Research Question

Where in the app must a prod failure become a Sentry event or alert? Start from EX-958's capture list
and the 54 `TODO(EX-958) SENTRY-REQUIRED` markers, then find everything else: swallowed catches,
log-only errors, generic error messages, integrations, crons, error boundaries, fire-and-forget client
mutations, and failures that never throw (auth refusals, silent wrong state). Rank by user/business
impact. Research only — no Sentry account yet.

## Summary

Most capture comes from **six choke points**, not from a hundred call sites. Sites that bypass them get
individual `captureException` / `captureMessage` calls.

1. `src/lib/actions/run-action.ts:58-61` catch — every `protectedAction` / `sessionAction` /
   `tokenAction` error. Filter `APIError` < 500, `NotFound`, `ValidationError`.
2. `src/instrumentation.ts` `onRequestError` — RSC render, route-handler and server-action throws
   that never reach (1). Doesn't exist yet.
3. `src/instrumentation-client.ts` + `error.tsx` / `global-error.tsx` — client crashes. Init must live
   in `instrumentation-client.ts`, since `(auth)`, `(share)`, `(frontend)`, `(payload)` each have their own
   root layout.
4. `src/lib/utils/log-error.ts` — the planned single sink. Today it drops the stack and dumps `err.data`
   (PII). Turn it into `captureException(err, { fingerprint: [label] })`; then every existing marker
   becomes a one-line change.
5. The mail adapter's `sendEmail` in `src/payload.config.ts` — every outgoing mail, whichever feature sends it.
6. Sentry Cron Monitors (`withMonitor`) on all 6 crons — a cron that never ran, or 401s on a
   `CRON_SECRET` mismatch, is invisible today.

Above the choke points, the **P0** gaps are where a person is told "OK" or told nothing, and the
failure leaves no trace. Today's two incidents are both in this class:

- **Mail** — the SMTP 535 outage was visible only as boot-time `console.error`. `forgotPasswordAction`
  (`src/lib/actions/auth.ts:52-55`) swallows every send error and reports success. Lead mails retry 3×
  and then sit in `failed` forever (`src/lib/leads/capture-lead.ts:27`).
- **Login** — `loginAction` (`auth.ts:29-31`) folds unknown e-mail, wrong password and an empty field
  into one generic message and logs nothing. Damian's failed submit could not be diagnosed.
- **Lost leads** — a Facebook / WPForms lead that fails the schema is never stored, and the only copy is a
  shape-alert mail that goes through the same SMTP.
- **Owner's sheet silently wrong** — `transfer-sheet-sync.ts:82,150,194`.

One finding is a **prerequisite**, not a capture: the login form's pre-hydration GET puts the password in
the URL (see Auth). Fix it and set up scrubbing before the SDK goes live.

Free-plan budget (5k errors/month) holds if the noise list below is respected. Business refusals, stale-row
`NotFound` and auth redirects must never become events.

## Detailed Findings

### 1. Choke points and setup

- **`run-action.ts:58-61`** (C1) — wrap the catch. Reuse the existing `APIError`-status check from
  `delete-cash-register-forever.ts:36`. Downgrade `NotFound` to a breadcrumb: a kosztorys autosave racing
  another tab hits it constantly (`action-failure.ts:21` already maps it for the user).
- **`run-action.ts:93`** — `requireAuth` runs outside the try. "Brak uprawnień" from a logged-in user means
  the UI showed a button to the wrong role → warning tagged with action label + role. "Nie jesteś
  zalogowany" → breadcrumb.
- **`run-action.ts:52-54`** — a cache refresh that throws after the commit reports a false failure to the
  user. Capture it and keep it from turning into an error result.
- **`run-action.ts:56`** — the only place every action's label and total ms exist together. Over ~3 s →
  `captureMessage('slow_action', 'warning')`, fingerprint `['slow-action', label]`. Cheaper than
  tracing; keep `tracesSampleRate: 0` to start.
- **Bypasses of C1** — these need their own capture:
  - `auth.ts` actions;
  - `toggle-active.ts:54`, `toggle-lead-contact-status.ts:30`;
  - work inside `after()`;
  - client toast catches.
- **`settle-action.ts:20`** (C2, client) — classify into offline / version skew ("Failed to find Server
  Action" after a deploy) / real error. Only the last one is an error event; skew is a warning with a
  single fingerprint.
- **`onRequestError`** (C3) — the plain-`Error` auth refusals thrown from `src/lib/queries/*` would flood it.
  Filter them, or introduce an `AuthRefusal` class.
- **Error boundaries** (C4) — only `(frontend)/error.tsx:19` exists. `(share)`, `(auth)` and `(legal)` have
  none, so a worker's share page crash goes to the bare Next fallback. Skip client capture when
  `error.digest` is set: the server already reported it.
- **Uploads** (C5) — `upload-ids.ts:45-49`, `submit-with-uploads.ts:16-21`.

### 2. Integrations (P0 / P1)

| P   | Site                                                                                        | Failure                                                        | Capture                                             |
| --- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| P0  | `payload.config.ts:79-93` adapter `sendEmail`                                               | Any mail failure (today's 535)                                 | Error, fingerprint `mail.send` + SMTP code          |
| P0  | `@payloadcms/email-nodemailer` boot `verifyTransport`                                       | `console.error` on every cold start; the only 535 signal today | `skipVerify: true` + daily verify in a cron → error |
| P0  | `auth.ts:52` forgot-password                                                                | Reset mail lost, user told it went out                         | Error (keep the success response)                   |
| P0  | `leads/capture-lead.ts:27`                                                                  | Lead mail fails 3×, `failed` never retried                     | Error per lead                                      |
| P0  | `api/facebook-leads/route.ts:73-79`, `reconcile-sweep.ts:47`                                | Schema-failing lead never stored                               | Error — it's a lost sale                            |
| P0  | `facebook-leads/route.ts:78` shape-alert mail                                               | Lead's only copy goes through SMTP                             | Error, independent of mail                          |
| P0  | `api/wpforms/route.ts:27,41,58`                                                             | WPForms lead lost                                              | Error                                               |
| P0  | `transfer-sheet-sync.ts:82,150,194`                                                         | Owner's sheet wrong on money rows                              | Error per transfer id                               |
| P0  | `erase-lead.ts:61` → `delete-unreferenced-media.ts:18,27`                                   | "Deleted forever" while the blob remains                       | Error                                               |
| P0  | `review-request.ts:41,56`                                                                   | Review request not sent                                        | Error                                               |
| P1  | `fetch-recent-leads.ts:43,52`, `fetch-form.ts:16-25`                                        | Meta API failure                                               | Error, deduped                                      |
| P1  | `actions/sheets.ts:114`                                                                     | `void applyMaterialSync().catch` never fires                   | Error                                               |
| P1  | `actions/sheets.ts:59`                                                                      | Sheet read failure                                             | Error                                               |
| P1  | `read-expense-draft-receipts.ts:63,71`                                                      | Receipt OCR fails                                              | Warning                                             |
| P1  | `api/media-register/route.ts:62,77`                                                         | Media register fails                                           | Error                                               |
| P1  | `plugin-cloud-storage` afterDelete                                                          | Blob not removed                                               | Warning                                             |
| P1  | `push-client.ts:68,85`, `public/sw.js` push path                                            | Push subscribe/deliver fails                                   | Warning; 401/403 → breadcrumb                       |
| P1  | `openrouter.ts` + `api/extract-receipt`; `worker-report-scan.ts` + `api/read-worker-report` | Same AI failure caught twice                                   | Capture once at the route                           |
| P1  | 6 crons in `vercel.json` (incl. `notify-pending-receipts.ts`, `translate-catalogue`)        | Never ran / 401                                                | Cron Monitors                                       |

**Dedupe/rate-limit by fingerprint** — these repeat by design:

- SMTP verify; non-prod mail and Sheets no-ops (gate the SDK on `VERCEL_ENV=production`);
- model fallback, translation batches;
- push 401/403, push subscription sync;
- media-register misconfig, Meta retries, Sheets 429.

### 3. Auth and session (P0 / P1)

- **`auth.ts:29-31` loginAction (P0)** — Payload throws `AuthenticationError` for both an unknown e-mail and a
  wrong password (`node_modules/payload/dist/auth/operations/login.js:23,181`), and `ValidationError` for
  an empty field (login.js:53-93), e.g. Android autofill not reaching the controlled input. All of them
  show "Nieprawidłowy email lub hasło".
  - **Capture:** `captureMessage('auth.login_refused', 'warning')`, fingerprint `[…, reason]`, reason one
    of `unknown_email | wrong_password | locked | disabled | empty_field | other`.
  - **Classify:** on refusal only, run one query: `SELECT id, active, trashed_at, lock_until,
login_attempts FROM users WHERE email = lower(trim($1))`.
  - **PII:** never send the e-mail — user id, or a truncated HMAC. A non-auth error (DB) is error level.
- **`(auth)/zaloguj/login-form.tsx:40` — pre-hydration submit (P0, PII).**
  - **Cause:** the `<form>` has no `method`/`action`, and `form-input.tsx:17` renders `name={field.name}`.
    A tap before hydration (slow Android) does a native GET to `/zaloguj?email=…&password=…`.
  - **Effect:** the password lands in Vercel request logs and would land in Sentry URLs and breadcrumbs.
    The page reloads empty and no action runs.
  - **Matches Damian's case:** ~40 `/zaloguj` GETs with no submit. Verify with the log query strings.
  - **Fix:** `method="post"` (a native POST to the page carries no credentials in the URL), plus `beforeSend` /
    `beforeBreadcrumb` scrubbing of `/zaloguj*` query strings.
- **Login loop (P1)** — the action returns success, `router.push('/')`, and if the cookie didn't stick
  `(frontend)/layout.tsx:72` silently redirects back.
  - **Client:** set a `sessionStorage` marker on success; the login page mounting within ~30 s of it →
    `auth.login_loop`.
  - **Server:** a breadcrumb at layout.tsx:72 recording whether a `payload-token` cookie was present.
- **`get-current-user-jwt.ts:63` (P0)** — a valid JWT refused by `isSessionAlive`
  (`src/lib/db/user-sessions.ts:18-35`, one `SELECT 1`) with no reason. Row missing, account
  inactive/trashed and role changed all look the same.
  - **Why it matters:** Payload `refresh()` rewrites the whole `sessions` array it read earlier
    (`refresh.js:51-58`). A new-phone login landing in that window loses its row — the open EX-1020 race.
  - **Capture:** classify **inside** the `cached()` callback (`get-current-user-jwt.ts:30-35`; a `false` is
    cached 1 h), so it fires once per sid. Warning when `session_row_missing` and the token is < 1 day old.
- **`get-current-user-jwt.ts:49`** — split `JWTExpired` / malformed (noise) from a signature failure: a
  `PAYLOAD_SECRET` mismatch logs everyone out → error.
- **`get-current-user-jwt.ts:64`** — DB error branch → error.
- **`session-refresher.tsx:14` + `actions/session-refresh.ts:11` (P1)** — the result is thrown away. A
  returned `{success:false}` is never logged, because `sessionAction` logs only throws. A once-a-month
  worker depends on the daily slide. Warning, at most one per user per day.
- **`auth.ts:70-72` resetPassword (P1)** — Payload's expired token is `APIError` 403 (`resetPassword.js:52`)
  → breadcrumb. Anything else is mislabelled "Link wygasł" → error.
- **`account-credentials.ts:35-80`** — refusals are noise. A successful e-mail/password change → info
  breadcrumb `{userId, emailChanged, passwordChanged}`, for "changed my e-mail, can't log in".

### 4. Worker share links and phone flows (P1)

- **`token-action.ts:44-56`** — `foreignItem` / `unknownUnit` (`worker-report.ts:50`) mean the worker's page
  is stale (manager re-imported or restored while it was open) → warning with investment/worker ids.
  This is exactly "my report didn't go through".
- **`worker-report-page.ts:39-64`**:
  - `unconfirmed-plane` → warning per investment+worker: the worker can't report and the manager
    doesn't know.
  - `mixed-planes` → error: an invariant breach, since `kosztorys-stages.ts:56,129,177` refuse it on write.
  - `no-stages` → breadcrumb.
  - `closed` / `inactiveWorker` / `stagesCompleted` → none.
- **`expense-draft-dialog.tsx:111-125`** — unhandled rejection on the worker's phone send. Capture at
  (3), and fix the missing catch.
- **`use-report-draft.ts:44` → `report-grid.tsx:118`** — worker draft lines dropped after a tree rewrite
  → client warning (P2).
- **Retired links `zgloszenie-prac/[...rest]`, `p/[...rest]`** — a worker on an old bookmark can't report →
  info, single fingerprint, path not sent (P2).

### 5. Silent wrong state (code fixes, not captures)

- **`queries/investments.ts:77-97` `getInvestment` (P1)** — `catch { return null }` inside a `cached()`
  callback. A transient DB error is cached as `null` until the next `investments` write, so
  `/podglad-inwestora/[id]` and `/podglad-pracownika/...` 404 persistently. Catch Payload `NotFound`
  only (`unstable_cache` doesn't store a throw). It is the only swallowing `cached()` callback in `src/lib`.
- **`[...catchAll]/page.tsx`** — renders `NotFound` instead of calling `notFound()`, so unknown URLs answer 200. A same-origin `referer` means a broken in-app link → warning by pathname (P1).
- **`collections/hooks/transfers/guard-delete.ts:14`** — `.catch(() => undefined)` fails open on a DB error.
  Narrow it to `NotFound` (P2; REST/admin only).
- **`actions/sheets.ts:136`** — a DB error is reported as "Kosztorys nie istnieje". Same fix (P2).
- **`client-view/settings.ts:49-63`** — a malformed stored `hiddenColumns` falls back to defaults silently
  (fails closed) → warning (P2).
- **`release-landing-assets.ts:18-19`** — `LANDING_CLEANUP_URL` is optional in prod, so the cleanup turns
  itself off silently. Decide whether to add it to the prod `superRefine` (P2).
- **Existing non-throw markers must become `captureMessage` warnings** (nothing throws there):
  - `insert-rows.ts:63`;
  - `create-investment.ts:28`;
  - `openrouter-client.ts:26`;
  - `contract-dialog.tsx:57`;
  - `preview-kosztorys-history.ts:84`.

### 6. Product bugs found on the way (not capture — flag separately)

- **Duplicate expense** — "No connection" after the commit, then a retry, duplicates the expense
  (`expense-form.tsx:229` → `createBulkTransferAction`). There's no idempotency key. A phone flow at scale.
- **Autosave rollback drift** — `use-grid-change-pipeline.ts:56-74`, `use-item-ops.ts:120-135`,
  `use-section-crud.ts:179-185`.
- **Lost edit on close** — closing the tab inside the 500 ms debounce loses the edit.
- **`use-auto-snapshot.ts:25`** — the result is ignored.
- **`with-payload-transaction.ts:15-32`** — a rollback throw replaces the original error, so the event
  would show the wrong cause.
- **`transfers/validate.ts:109`** — an English developer message reaches the user.

## Do NOT send to Sentry

- Auth noise:
  - redirects to `/zaloguj` with no cookie;
  - an EMPLOYEE bounced from a management page;
  - `JWTExpired`, malformed cookies;
  - "Nie jesteś zalogowany" (breadcrumb only).
- Unknown share tokens and links:
  - unknown `/k/*`, `/z/*` tokens;
  - missing `[id]` rows, non-numeric ids;
  - external-referer catch-all hits;
  - an unknown `?wersja=`.
- Kosztorys editor noise: stale-row `NotFound`, a successful stale-tree recovery,
  `use-external-change-reload.ts:37` probe failures.
- Returned business refusals and Zod failures:
  - `noChange`, `emailTaken`, `wrongCurrentPassword`;
  - `closed`, `stagesCompleted`, `inactiveWorker`, `ALREADY_DECIDED`;
  - `validateTransfer` 400s;
  - delete blockers, `/kosz` typed-name refusals.
- Reconciliation mismatches — a business to-do, per AGENTS.md.
- `localStorage` failures, orphan media left by the reference scan.
- `[PERF]` lines under the threshold, `[validateTransfer]` Start/Passed logs.
- The pg SSL `console.error` on every boot. Fix it with `sslmode=verify-full` in the **Vercel**
  `DB_POSTGRES_URL` only, not `.env` (`db-dump.sh` reads those URLs).
- Never enable `captureConsoleIntegration`: it would turn every marker-less log above into an event.

## PII and scrubbing (prerequisite)

- `sendDefaultPii: false`, no Replay, `tracesSampleRate: 0` to start.
- `Sentry.setUser({ id, role })` only. `SessionUserT` (`get-current-user-jwt.ts:69`) carries e-mail and name.
- In `beforeSend` / `beforeSendTransaction` / `beforeBreadcrumb`:
  - scrub `/zaloguj*` query strings and `?token=`;
  - parameterize `/k/[token]`, `/z/[investment]/[name]/[token]`, `/podglad-pracownika/…` (the token is
    the credential, the path carries the worker's name).
- Never send refusal message text — `mixedPlaneWorkersMessage` embeds worker names.
- Raw webhook bodies are logged today (`api/landing/route.ts:43`, `api/wpforms/route.ts:28`). Drizzle errors
  carry `params:`, and invoice filenames and push endpoints appear in messages. Strip them in `logError`
  before capture.

## Setup traps

- No `instrumentation.ts` yet. Use `src/instrumentation.ts` + `src/instrumentation-client.ts`, and add both to
  the ESLint `ENV_IGNORES` (`eslint.config.mjs:9-14`), or route the DSN through `src/lib/env/`.
- Compose `withSentryConfig(withPayload(nextConfig))`. Next 16.1.7 + Turbopack needs a recent
  `@sentry/nextjs` v10.
- Skip the source-map upload when `SENTRY_AUTH_TOKEN` is absent (local, preview without the token).
- No `tunnelRoute`: `src/proxy.ts` redirects tokenless requests.
- Don't import the Sentry server SDK into the Payload CLI graph (`payload.config.ts`, collections). It must
  survive `payload generate:types`; the `sendEmail` wrapper may need a lazy import.
- Env:
  - `NEXT_PUBLIC_SENTRY_DSN` + `NEXT_PUBLIC_VERCEL_ENV` go in the client schema;
  - build-time vars (`SENTRY_AUTH_TOKEN`, org, project) go in `next.config.ts` only;
  - capture only when `VERCEL_ENV=production`, mirroring the mail and Sheets gates.
- Sentry alert mail travels over Sentry's infra, not our SMTP. That is the whole point after today's outage.
- Vercel runtime logs live ~1 day on this plan. Anything relying on `console.*` for diagnosis is gone
  before a worker reports the problem.

## Code References

- `src/lib/actions/run-action.ts:52-61,93` — action catch, post-commit refresh, auth outside try
- `src/lib/utils/log-error.ts` — planned single sink (drops stack, dumps `err.data`)
- `src/payload.config.ts:79-93` — nodemailer adapter, `skipVerify`
- `src/lib/actions/auth.ts:16-32,44-56,70-72` — login / forgot / reset
- `src/app/(auth)/zaloguj/login-form.tsx:40` + `src/components/forms/form-components/form-input.tsx:17` — pre-hydration GET
- `src/lib/auth/get-current-user-jwt.ts:30-35,49,63,64` — session check
- `src/lib/db/user-sessions.ts:18-35` — `isSessionAlive`
- `src/lib/queries/investments.ts:77-97` — cached null on DB error
- `src/lib/leads/capture-lead.ts:27`, `src/app/api/facebook-leads/route.ts:73-79`, `src/app/api/wpforms/route.ts:27,41,58` — leads
- `src/lib/actions/token-action.ts:44-56`, `src/lib/queries/worker-report-page.ts:39-64` — worker report
- `src/app/(frontend)/error.tsx:19` — the only error boundary

## Architecture Insights

- The action layer is already a funnel (`runAuthorizedHandler` behind all three action kinds). Capture
  belongs there plus `onRequestError` — call sites only where they bypass it.
- The repo's convention of returning `ActionResultT` instead of throwing is why "nothing is logged" is so
  common: a returned failure never reaches any catch. Expected refusals stay silent by design. Only the
  _unexpected_ returned failures (session slide, login reason, stale worker page) earn a `captureMessage`.
- Fail-closed vs fail-open: most silent catches fail safe (orphan file, default disclosure). The ones to
  fix in code are those that fail open (`guard-delete.ts:14`) or poison a cache (`getInvestment`).
- Vendor swap stays cheap if every call goes through `logError` and one `captureMessage`-style helper
  next to it. Better Stack is SDK-compatible.

## Historical Context

- `context/foundation/lessons.md` — the 2026-09-29…10-01 SMTP cert/SNI outage (fixed by setting the host to
  `mail.wykonczymy.com.pl`). 2026-10-21 was the second mail outage noticed only by a user.
- EX-958 (Linear, Urgent) — the umbrella issue. Two names in it are stale:
  - `notify-pending-payouts` → `notify-pending-receipts.ts`;
  - `preventDeleteWithTransactions` → `refuseDeleteWhen` / `makePreventDelete`
    (`collections/hooks/prevent-delete.ts`).

## Open Questions

1. Is the slow-action threshold of 3 s right for phone users, or should tracing at a low sample rate
   replace it (spans have a separate quota)?
2. Login refusal e-mail identity: user id only (when found), or also an HMAC of unknown e-mails, so support
   can match "I typed X"?
3. Should `LANDING_CLEANUP_URL` be required in prod?
4. Should the product bugs in §6 (duplicate expense above all) become their own Linear issues, outside EX-958?
5. Does the pre-hydration GET explain Damian's case? Check today's `/zaloguj` request query strings —
   count only, never print values.
