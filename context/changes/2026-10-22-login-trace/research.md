---
date: 2026-10-22T10:10:52+02:00
researcher: Claude
git_commit: 954febf566489dca8cc5e127ff735e162bbce4c3
branch: staging
repository: wykonczymy
topic: "Why a worker's phone login silently reloads /zaloguj, and what a login trace needs"
tags: [research, auth, login, hydration, browser-support, vercel-logs, android]
status: complete
last_updated: 2026-10-22
last_updated_by: Claude
---

# Research: Why a worker's phone login silently reloads /zaloguj, and what a login trace needs

**Date**: 2026-10-22T10:10:52+02:00
**Researcher**: Claude
**Git Commit**: 954febf56
**Branch**: staging (prod runs `main`; the login path is behaviourally identical on both)
**Repository**: wykonczymy

## Research Question

Damian Jonski (user 41, EMPLOYEE) pastes a correct e-mail and password on his phone, taps „Zaloguj",
and the page reloads to an empty login form — no error, no „Logowanie…". Same credentials work on a
desktop. Find the cause without touching his phone, and research what a login trace (every step of an
attempt logged with a trace id) would need so the next case of this kind is diagnosable.

## Summary

**Root cause, confirmed from Vercel CDN request records (2026-10-21, 19:04–19:08 UTC):** his phone is
`Mozilla/5.0 (Linux; Android 10; ELE-L29) … Chrome/83.0.4103.106 Mobile Safari/537.36` — a Huawei P30
on **Chrome 83 (June 2020)**. Next 16.1.7 targets **Chrome 111+** (no `browserslist` override in the
repo). The client bundles fail to parse, React never hydrates, so the `<form>`'s `onSubmit` →
`preventDefault` is never attached. Every tap is a native submit: `GET /zaloguj?email=…&password=…`
(the inputs carry `name=`), which renders the login page again, empty. Six such document GETs from his
UA, zero `POST /zaloguj`, zero `.rsc` requests (a hydrated client would fetch `.rsc` for prefetches —
the desktop's Safari 18.6 does, see below).

**Side effect:** the native GET puts his password in the URL — his browser history, and (per Vercel
docs) the „Search Params" field of the request log, kept 1 day on Pro.

**The trace:** the case was solved by the request records alone, once read with the right tool (see
„Diagnostic method"). The generic gap stays: nothing tells a user „your browser is too old", nothing
logs where a login stops, and the old Vercel CLI hid the user agent. Research for a trace and for a
user-facing guard is below; the plan decides scope.

## Detailed Findings

### Evidence (Vercel CDN request records, production)

Read with `npx vercel@latest logs requests -e production --since … --until … -q 'requestPath:*zaloguj*' --json`
— fields include `clientUserAgent`, `clientIpCountry`, `route`, `pathType`. `requestPath` carries no
query string in these records.

| UTC                                                        | Method   | Route                                                          | UA                                                                              |
| ---------------------------------------------------------- | -------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 19:01:24–25                                                | GET      | `/zaloguj.rsc`, `/zaloguj`, `/zaloguj/zapomniane-haslo.rsc` ×2 | Mac Safari 18.6                                                                 |
| 19:01:33.553                                               | **POST** | `/zaloguj` (server action)                                     | Mac Safari 18.6                                                                 |
| 19:01:33.6–.7                                              | GET      | `/zaloguj.rsc` ×2                                              | Mac Safari 18.6                                                                 |
| 19:04:11, 19:05:13, 19:07:33, 19:07:48, 19:07:57, 19:08:10 | GET      | `/zaloguj` (document only)                                     | **Android 10; ELE-L29, Chrome/83**                                              |
| 19:04:42                                                   | GET      | `/zaloguj` + `.rsc` prefetches                                 | Mac Safari 18.6                                                                 |
| 19:07:37–40                                                | GET      | `/zaloguj` ×3                                                  | `WhatsApp/2.23.20.0` (link-preview fetcher — the link was shared over WhatsApp) |

The desktop shows the hydrated pattern (document + `.rsc` prefetches + action POST). The phone shows
only documents — no `.rsc`, no POST.

Prod DB (read-only): user 41 is active, not trashed, `login_attempts = 0`, no lock; sessions only from
2026-10-08 and 2026-10-21 07:45 UTC. The desktop login at 19:01:33 left no row because the user logged
out afterwards (Payload's logout deletes the session row).

### Login path — every way back to /zaloguj without a message

- `src/app/(auth)/zaloguj/login-form.tsx:40-47` — `<form>` with no `method`/`action`; only the React
  `onSubmit` prevents the native submit. `form-input.tsx:16-17` renders `name="email"` / `name="password"`.
- `src/proxy.ts:19-20` — 307 to `/zaloguj` when the `payload-token` cookie is missing.
- `src/app/(frontend)/layout.tsx:72` — `getSession()` undefined → redirect. `get-current-user-jwt.ts`
  returns undefined on: no cookie (`:43`), JWT verify throw (`:48-51`, logged), bad claim types
  (`:55-59`), `isSessionAlive` false (`:63`, cached 1 h, **silent**), DB error (`:64-67`, logged).
- `(dashboard)/page.tsx:9`, `pracownicy/[id]/page.tsx:54` — `requireAuth` → `/zaloguj`.
- `login-form.tsx:45` `router.prefetch('/')` — with no cookie the proxy 307s the prefetch to
  `/zaloguj`, so a `GET /zaloguj.rsc` is not proof of a reload. A document `GET /zaloguj` is.
- Cookie set by Payload `login()` (`@payloadcms/next/dist/auth/login.js:51-61`): `payload-token`,
  HttpOnly, SameSite=Lax, Secure in production (`users.ts:26`), 90-day expiry, path `/`.
- `public/sw.js` intercepts navigations but is registered only by the `(frontend)` shell
  (`service-worker-registration.tsx`) — a phone that never logged in has none.

### Browser support

- Next 16.1.7 default target: Chrome 111, Edge 111, Firefox 111, Safari 16.4
  (`node_modules/next/dist/shared/lib/modern-browserslist-target.js`;
  https://nextjs.org/docs/architecture/supported-browsers). Polyfills only for `fetch`, `URL`,
  `Object.assign`. No `browserslist` in `package.json`, no `.browserslistrc`, no core-js.
- A `browserslist` field can lower the target, but whether Turbopack down-compiles `node_modules`
  (React 19, Payload client code) is unverified — lowering to Chrome 83 is not a safe lever.
- Chrome 83 predates UA reduction, so its UA carries the real model and Android version. A current
  Chrome sends the reduced UA (`Android 10; K`, `Chrome/<major>.0.0.0`); full details then need
  `navigator.userAgentData.getHighEntropyValues([...])` or `Accept-CH`
  (https://www.chromium.org/updates/ua-reduction/).

### What a trace / guard can use

- **Inline script must be raw.** `next/script strategy="beforeInteractive"` is queued through
  `self.__next_s` and executed by Next's own `app-bootstrap.js` — part of the bundle, so it dies with
  it (`node_modules/next/dist/esm/client/app-bootstrap.js`). A raw `<script dangerouslySetInnerHTML>`
  in the `(auth)` layout runs at HTML parse, in any browser. React 19 does not hoist or dedupe inline
  scripts; in a Server Component layout it can't cause a hydration mismatch. It must be ES5.
- **`window.onerror`** sees a bundle `SyntaxError` in full (same-origin `/_next/static` chunks).
- **Hydration signal:** none in production (`window.__NEXT_HYDRATED` is test-mode only;
  `window.next` means the bootstrap ran, not hydration). Use an own `useEffect` marker in `LoginForm`.
- **`navigator.sendBeacon`:** POST, 64 KiB shared queue, string body = `text/plain` (no preflight);
  survives the navigation a native submit starts. Guard `navigator.sendBeacon && …` (ES5).
- **Beacon endpoint:** `src/app/(frontend)/api/login-trace/route.ts` → `/api/login-trace`. The proxy
  matcher excludes `api`; a specific folder wins over Payload's `(payload)/api/[...slug]`. No public
  unsigned POST exists today — read `request.text()`, cap ~2 KB, zod `safeParse`, `console.log` only.
- **`method="post"`** on the plain form: a native submit sends credentials in the body, not the URL;
  Next's action handler bails on a urlencoded POST without `Next-Action` and renders the page (200).
  Logs then show `POST /zaloguj` — distinguishable from the real action by the `next-action` header.
- **Progressive enhancement** (`<form action={serverAction}>`) would let the login itself work without
  JS, but the app behind it would still be dead on Chrome 83 — no value for this case.
- **Logs:** Vercel Pro runtime logs keep 1 day (30 with Observability Plus); 256 lines / 256 KB per
  line / 1 MB per request; `console.log` from route handlers and server actions appears; IP is not a
  log field — log `x-forwarded-for` yourself if needed (https://vercel.com/docs/logs/runtime).
- **Env:** `serverEnv.VERCEL_ENV`, `VERCEL_DEPLOYMENT_ID` exist in `src/lib/env/schema.ts:86-87`;
  `VERCEL_GIT_COMMIT_SHA` is not in the schema.

### Diagnostic method (how this was solved, and the trap)

- Vercel CLI **56.1.0** (installed) auto-filters by the current git branch and drops user agent,
  search params and IP from its rows. Use **`vercel logs requests`** from CLI 65
  (`npx vercel@latest`), which returns `clientUserAgent`, `clientIpCountry`, `route`, `pathType`.
  CLI 65 removed `--no-branch`.
- A document `GET /zaloguj` with no `.rsc` and no `POST` from the same UA = a non-hydrated client.

## Code References

- `src/app/(auth)/zaloguj/login-form.tsx:40-47` — form with no method/action; React-only submit
- `src/components/forms/form-components/form-input.tsx:16-17` — `name={field.name}` puts credentials in a native GET
- `src/app/(auth)/layout.tsx:13-24` — own root `<html>`, no `<head>`, redirects a live session to `/`
- `src/lib/actions/auth.ts:16-32` — `loginAction`, all refusals → one message, nothing logged
- `src/lib/auth/get-current-user-jwt.ts:43-67` — silent session-check branches
- `src/proxy.ts:19-20,28` — cookie gate; matcher excludes `api`
- `src/lib/env/schema.ts:86-87` — `VERCEL_ENV`, `VERCEL_DEPLOYMENT_ID`
- `node_modules/next/dist/shared/lib/modern-browserslist-target.js` — Chrome 111 floor

## Architecture Insights

- The login form has no non-JS fallback, so any client that can't run the bundle fails silently and
  leaks credentials into the URL. The failure is invisible server-side except as repeated document GETs.
- A supported-browser floor is a product fact the UI never states. An ES5 inline check in the `(auth)`
  layout is the only layer that runs on an unsupported engine.

## Historical Context (from prior changes)

- `context/changes/2026-10-21-sentry-error-capture/research.md:55-56,133-140` — already names the
  pre-hydration GET leak (fix: `method="post"` + Sentry URL scrubbing) and plans login refusal reasons,
  login-loop detection and session-check classification. Sentry's client SDK runs inside the bundle, so
  it would **not** have seen this case; only an inline script does.
- Prior prod debug logging (`fc3e2d3f9`, `bbc6f29d4`, `d7fdee996`) was shipped and removed untracked;
  the only tracked temporary is `src/lib/ai/provider-error-detail.ts:1` (`TODO(EX-958)` + a removal
  line in EX-958).
- Prod deploys from `main` via a human-merged `staging → main` PR; `staging` is 44 commits ahead.

## Related Research

- `context/changes/2026-10-21-sentry-error-capture/research.md`

## Open Questions

1. Scope of the plan, now that the cause is known: the full login trace as first asked, a user-facing
   „unsupported browser" guard + `method="post"`, or both.
2. Ship path: hotfix branch off `main`, or wait for the next `staging → main` release.
3. Does his P30 get a current Chrome from Play Store (Huawei P30 shipped with Google services)? If yes,
   the immediate fix for him is updating Chrome and Android System WebView.
