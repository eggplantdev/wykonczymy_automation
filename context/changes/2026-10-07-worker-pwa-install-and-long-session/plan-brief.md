# Installable app icon for workers and a session that survives monthly use — Plan Brief

> Full plan: `context/changes/2026-10-07-worker-pwa-install-and-long-session/plan.md`
> Research: `context/changes/2026-10-07-worker-pwa-install-and-long-session/research.md`

## What & Why

Construction workers are not comfortable with phones and open the app every 2–4 weeks. They need two things:

- an icon on the home screen that they get with one tap;
- a session that does not expire between visits.

A longer session is only safe if deactivating or trashing an account cuts access immediately.

## Starting Point

- The session is a hard 7-day JWT with no refresh.
- App auth reads no DB, so an open session survives deactivation until it expires.
- The app has no manifest, no service worker and a 🚧 favicon.
- The proxy redirects the would-be manifest and SW to `/zaloguj`.

## Desired End State

- On Android, the worker taps „Zainstaluj aplikację" under „Zmień e-mail lub hasło" on their own page and gets the brand icon on the home screen.
- On iPhone, the same button opens a three-step guide.
- The icon opens the app full-screen. The session lasts 90 days and slides forward each time the app is opened.
- A deactivated or trashed worker is out on their next request.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Button placement | Own `/pracownicy/[id]`, under „Zmień e-mail lub hasło"; not in the drawer | That is where the worker lands and manages their account | Owner |
| Android before the prompt is ready | Loading state; after 60 s, one line with the browser-menu path | The owner wants loading. A 60 s limit stops it spinning forever on Firefox or an already-installed app | Owner + Plan |
| iOS guide | Steps only (⋯ → Udostępnij → „Do ekranu głównego") | Logging in after opening is self-evident | Owner |
| Icon | Brand icon replaces 🚧 everywhere; padded maskable variant on a white background | The art runs edge to edge and has alpha, which Android crops and iOS blackens | Owner + Plan |
| Token | 90 days, refreshed when older than 1 day | One write per user per day, and it still slides | Plan |
| Revocation | One cached `(user, sid)` query: the sid exists AND the account is active and untrashed; tag `collection:users` (every `users` write expires it — changed at review from a per-user tag one writer forgot); 1 h backstop. **Temporary**, revisited in EX-1020 | Checking the account state narrows Payload `refresh()`'s write-back race; it does not close it, because `refresh()` also writes back `active`/`trashedAt`. The owner accepted the per-request cost for now | Research + Owner |
| Cookie | `Secure` in production | A 90-day cookie should never travel over http | Owner |
| Service worker | Navigations only, network-first, inline offline line, no caches | Chrome's install path wants a fetch handler. Server Actions and RSC must stay untouched | Plan |

## Scope

**In scope:**
- Revocation check and the three revoking writers
- 90-day sliding token and the Secure cookie
- Manifest, icons and the minimal SW
- Install button with the iOS guide, in pl/uk/ru
- Doc updates: AGENTS.md, lessons, test-plan

**Out of scope:**
- Push notifications or offline data
- An install entry for management or in the drawer
- Revoking sessions on password change
- Token rotation
- `/admin`

## Architecture / Approach

1. **Revocation:** `getCurrentUserJwt` verifies the JWT, then calls `unstable_cache(isSessionAlive(userId, sid))`, tagged `collection:users`. Both layouts and `requireAuth` read it, so revocation is consistent everywhere and nothing loops.
2. **Sliding:** the shell checks `iat`. If the token is older than 1 day, a client host fires `refreshSessionAction` once, which wraps Payload's `refresh`.
3. **PWA:** `app/manifest.ts` plus static icons and `public/sw.js`, with the proxy letting the manifest and SW through.
4. **Install button:** `InstallAppButton` sends the platform signals to a pure `resolveInstallState`, which returns hidden, ready, waiting, ios or manual.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Revocation check | Deactivate or trash cuts access on the next request | A missed writer leaves access stale for up to 1 h (backstop) |
| 2. 90-day sliding session | No logout for monthly users; Secure cookie | `refresh()` throwing must never surface to the user |
| 3. PWA surface | Installable app, brand icon, safe SW | The SW must never intercept POSTs or RSC |
| 4. Install button | One-tap install on Android, guide on iOS | Chrome's engagement heuristic delays the prompt (covered by loading, then the menu line) |
| 5. Living docs | AGENTS.md, lesson and test-plan match reality | none |

**Prerequisites:**
- `db-test` on 5435 for the DB spec.
- A real Android phone and iPhone against staging (https) for the final checks.

**Estimated effort:** about 2 sessions.

## Open Risks & Assumptions

- **The Android prompt is only confirmed on a real device.** Whether Chrome needs the SW's fetch handler is unconfirmed, so the plan ships one; it is harmless.
- **iOS gives the home-screen app its own cookie jar,** so the first open from the icon asks for a login. This is expected and not mentioned in the guide.
- **No migration:** existing 7-day tokens slide to 90 days on their first open after deploy.

## Success Criteria (Summary)

- A worker installs the icon from their page in one tap on Android, or by following three steps on iPhone, and opens the app from it.
- A worker who opens the app monthly stays logged in.
- Deactivating or trashing a worker locks them out immediately.
