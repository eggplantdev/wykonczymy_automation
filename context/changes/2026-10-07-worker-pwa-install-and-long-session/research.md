---
date: 2026-10-07T13:57:55+02:00
researcher: Claude (Opus 5.5)
git_commit: e935a89f662bcac9a4d844a517ec06644646026d
branch: staging
repository: wykonczymy
topic: "Installable app icon for workers (PWA) and a session that survives monthly use"
tags: [research, codebase, auth, session, jwt, payload, pwa, manifest, proxy, worker-page]
status: complete
last_updated: 2026-10-07
last_updated_by: Claude (Opus 5.5)
---

# Research: Installable app icon for workers and a session that survives monthly use

**Date**: 2026-10-07T13:57:55+02:00
**Git Commit**: e935a89f
**Branch**: staging
**Repository**: wykonczymy

## Research Question

Workers are low-tech and open the app roughly every 2–4 weeks. Two goals:

1. A home-screen icon they tap to open the app, installed from a button inside the app (no browser menus).
2. A session that does not log them out between visits — 90-day token, slid forward on every app open —
   while deactivating / trashing a worker still revokes access immediately (cached `sid` check).

## Summary

- **Session today is a hard 7 days, never refreshed.** `tokenExpiration: 604800` (`src/collections/users.ts:23`); cookie
  `Expires` = JWT `exp` = session row `expiresAt`. No code calls refresh. Nobody recorded why 7 days (`d5b5508b`).
- **Payload already ships everything the sliding refresh needs.** `refresh({ config })` from `@payloadcms/next/auth`
  re-signs the JWT (same `sid`, fresh `exp`, name/role re-read from DB), extends the session row and sets a new cookie. It
  must run in a Server Action and throws when the user is not authenticated. It runs no `beforeLogin`, so it does **not**
  check `active` / `trashedAt` — it is gated only by the session row existing (JWT strategy).
- **The app's fast auth cannot see revocation.** `getCurrentUserJwt` (`src/lib/auth/get-current-user-jwt.ts:31-57`)
  verifies the JWT with jose and reads no DB and not even `sid`. With 90 days that window becomes 90 days. The
  lesson that chose this (`lessons.md:2491`) explicitly says to add the per-request check "only if that window ever has to
  close for a reason beyond the trash" — this change is that reason.
- **The check should read the user row, not only the session row.** Payload's refresh does read-modify-write of the whole
  user doc incl. `sessions`, so a `deleteUserSessions` racing a refresh can write the deleted `sid` back. Checking
  `sid` exists **and** `active = true AND trashed_at IS NULL` in one indexed query makes revocation hold even then.
- **PWA: the proxy blocks installation today.** `src/proxy.ts:37-47` redirects `/manifest.webmanifest`, `/icon`,
  `/apple-icon`, `/sw.js` to `/zaloguj` without a cookie — and browsers fetch the manifest without credentials, so even a
  logged-in user gets login HTML. Must be allow-listed.
- **Android: one-tap install is real; iOS: never.** `beforeinstallprompt` works in Chrome / Samsung Internet / Edge /
  Opera on Android (not Firefox). Chrome still documents a **service worker with a `fetch` handler** as required for the
  prompt (2023 source, unchanged since) plus an engagement heuristic (a tap + ~30 s on site). iOS has no programmatic
  install; the path is ⋯ → Udostępnij → „Do ekranu głównego" (Apple PL guide, iOS 26). iOS 26 opens every home-screen site
  as a web app by default. iOS home-screen apps have their own cookie jar — **expect one login after install on iPhone**.
  Android's installed app shares Chrome's cookies.
- **No prior PWA work anywhere** (src, context, package.json). `public/wykonczymy-app-icon.png` (1024²) is the icon source.

## Detailed Findings

### 1. Session lifecycle (Payload 3.73, as installed)

- **Login** (`node_modules/payload/dist/auth/operations/login.js`): password → `addSessionToUser` (:230) → `beforeLogin`
  hooks (:241-251) → `jwtSign` (:253). JWT = `id, collection, email, sid` + `saveToJWT` fields (`name` users.ts:65,
  `role` :78). `exp = iat + tokenExpiration` (`auth/jwt.js:4-9`). Session row `{id: uuid, createdAt, expiresAt}`
  written via `db.updateOne` — no hooks, no cache tag (`auth/sessions.js:14-50`).
- **Cookie** (`@payloadcms/next/dist/utilities/setPayloadAuthCookie.js`, `payload/dist/auth/cookies.js:70-72`):
  HttpOnly, SameSite=Lax, Path=/, `Expires` = now + tokenExpiration. **Secure is false** — Payload default
  (`collections/config/defaults.js:132-137`), not overridden here.
- **Refresh** — REST `POST /api/users/refresh-token` and server function
  `refresh({ config }): Promise<{ message; success }>` (`@payloadcms/next/dist/exports/auth.js:3`, `auth/refresh.js`):
  - needs an authenticated request; the JWT strategy (`strategies/jwt.js:73-79`) nulls the user if `sid` is not in
    `user.sessions` → the server function **throws** `Cannot refresh token: user not authenticated` (:15-20);
  - `sid` is kept; `name/role/email` are re-signed from the current DB row (role change propagates on refresh);
  - session `expiresAt` extended, expired sessions pruned, **whole user doc written back** (`operations/refresh.js:46-60`)
    — read→write race with `deleteUserSessions` (`src/lib/db/user-sessions.ts:8-9` already warns about this shape);
  - sets a new cookie → must be called from a Server Action, not during RSC render.
- **`expiresAt` is never enforced at auth time** — only row existence. Expired rows are pruned on the next login/refresh.
- **Sessions accumulate, uncapped** (`users_sessions`, migration `20260211_202001.ts:5-10`, FK `ON DELETE cascade`).
  Extra unheld rows come from `verifyCurrentPassword` → `payload.login` (`lib/actions/account-credentials.ts:26`) and
  `resetPasswordAction` (`lib/actions/auth.ts:55-70`). With 90 days they live 90 days. Harmless (nobody holds their `sid`).

### 2. App-side auth readers

- `getCurrentUserJwt` — React `cache()`; returns `SessionUserT = { id, email, name, role }` (`src/types/auth.ts`); does
  not read `sid` or `iat`. Docstring :29 asserts the 7-day trade-off. 6 direct callers:
  `(frontend)/layout.tsx:56`, `(auth)/layout.tsx:10`, `@investmentCrumb/pracownicy/[id]/page.tsx:6`,
  `api/test-email/route.ts:14`, `lib/queries/unread-counts.ts:24`, `lib/auth/require-auth.ts:16`.
- `requireAuth` — 55 call sites / 49 files; all server actions reach it via `authorizedAction`
  (`lib/actions/run-action.ts:107`). So a check inside `getCurrentUserJwt` covers every page and action at once.
- **Never nested in `unstable_cache`** — it reads `cookies()`, which throws inside one; every cached query calls
  `requireAuth` outside. An `unstable_cache` keyed on `(userId, sid)` inside `getCurrentUserJwt`, wrapped by the existing
  `cache()`, is legal (lesson `lessons.md:1522` on nesting does not bite).
- **Redirect-loop guard:** both `(frontend)/layout.tsx:56-57` and `(auth)/layout.tsx:10-11` call `getCurrentUserJwt`.
  A revoked-but-unexpired JWT must read as "no user" in **both**, or `/` ↔ `/zaloguj` loops. A check inside the
  function satisfies that by construction. The stale cookie stays (RSC can't delete it) — harmless.
- `src/proxy.ts:5,24` only tests cookie presence.

### 3. Revocation paths (EX-918)

- Deactivate: `toggleUserActive` → `payload.update` then `deleteUserSessions` in `afterUpdate`
  (`lib/actions/toggle-active.ts:76-78`); revalidates `collection:users` only (:53). Not a `protectedAction`.
- Trash: `trashWorker` (`lib/workers/trash-worker.ts:36-43`) inside `trashWorkerAction`
  (`lib/actions/worker-trash.ts:44-65`, `withPayloadTransaction`); tags `WORKER_TRASH_TAGS = ['users','cashRegisters']`.
- Hard delete: only of an already-trashed worker; FK cascade drops sessions.
- Login door: `refuseDisabledLogin` (`hooks/users/refuse-disabled-login.ts:17-21`) refuses `trashedAt || active === false`.
- Restore creates no session → re-login needed (fine).
- Password / e-mail change (`changeOwnCredentialsAction`, `updateWorkerAction`) touch no sessions — unchanged stance (EX-989).
- **Cache tags:** `entityTag` (`lib/cache/tags.ts:32-34`) supports only `'investment' | 'cash-register'`; no `'user'`.
  Neither deactivate nor trash expires a per-user tag today. The `collection:users` slug is bumped by every user write,
  so tagging the check with it alone would evict every user's entry on any user edit — AGENTS.md's entity-tag rule says
  add `entityTag('user', id)` and pass it from **both** writers (trash via `opts.entityTags`; toggle-active by hand).
  Writers that change whether access holds: deactivate, reactivate, trash, restore, hard delete, logout (sid gone; its
  cookie is deleted too, so no tag needed).

### 4. PWA surfaces

- **No root `src/app/layout.tsx`**; each group is its own root layout with `<html lang="pl">`. `(frontend)/layout.tsx`
  has no `metadata`/`viewport` at all. `(share)/layout.tsx:10-13` has title + noindex. `(payload)` is generated — don't touch.
  Share pages export `REPORT_VIEWPORT` (`components/kosztorys/worker-report/report-viewport.ts`).
- `src/app/icon.tsx` — 32×32 🚧 emoji. No `apple-icon`, `favicon.ico`, `manifest`.
- **Proxy matcher** `src/proxy.ts:46`:
  `'/((?!admin|api|_next|favicon\\.ico|fonts|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)'` — `/manifest.webmanifest`,
  `/icon`, `/apple-icon`, `/sw.js` are all matched → redirected without a cookie. (`/robots.txt`, `/sitemap.xml` too —
  unrelated pre-existing.)
- `next.config.ts` — no `headers()`, no CSP; nothing restricts `manifest-src` / `worker-src`.
- `start_url: '/'` works for every role: `(dashboard)/page.tsx:12-15` sends EMPLOYEE to `/pracownicy/<id>`, management to
  the dashboard; no cookie → `/zaloguj`; after login `login-form.tsx:30` pushes `/`.
- **Button homes:**
  - Mobile drawer `src/components/nav/mobile-nav.tsx` — client, `useCurrentUser` (:39), `useTranslation('shell')` (:41),
    bottom stack :127-143 (Theme, Refresh, Admin, Trash, Logout). Every role, `sm:hidden`.
  - Worker's own page `src/app/(frontend)/pracownicy/[id]/page.tsx` — server; `isOwnPage` (:56);
    `WorkerQuickActions` (`components/users/worker-quick-actions.tsx`, `ACTION_CLASS = 'h-auto min-h-14 whitespace-normal
    text-base'`, wraps at 390px for uk/ru). A client island beside it uses `useTranslation`, not `createTranslator`.
  - Login page — `(auth)` has no `AppLanguageProvider` → Polish only. Not needed: iOS needs a login after install anyway,
    and the button belongs where the worker already is.
- **i18n:** `useTranslation(ns)` (`hooks/use-translation.ts`), dictionaries `lib/i18n/dictionaries/{pl,uk,ru}.ts`; `uk`/`ru`
  typed `TranslationsT`, so a missing key fails typecheck. `shell` namespace fits; example `nav/refresh-data-button.tsx`.
- **Reusable primitives:** `ui/dialog.tsx` (full-screen sheet below `sm`), `ui/button.tsx`, `hooks/use-media-query.ts`
  (`useSyncExternalStore`, SSR-false) for `(display-mode: standalone)`, `hooks/use-persisted-value.ts`
  (`usePersistedFlag`) for a dismiss flag. No UA sniffing exists in `src`.
- **`(share)` report page** `(share)/z/[investment]/[name]/[token]` is linked from the worker's page by absolute URL
  (`components/users/report-work-button.tsx:20,48`). Keep manifest `scope: '/'` so it stays inside the installed app.
  `(share)` would need the same `themeColor` to look consistent.

### 5. Platform facts (web, 2026-10)

- **Chrome Android install criteria** (web.dev/install-criteria; Chrome blog "update-install-criteria", 2023-12):
  manifest with `name`/`short_name`, icons 192 + 512, `start_url`, `display: standalone`, `prefer_related_applications`
  absent/false; HTTPS; engagement (a tap + ≥ 30 s cumulative). Menu install no longer needs a SW, **but the
  `beforeinstallprompt` path still requires a `fetch` handler**. Chrome treats a literally empty fetch listener as no-op.
- **`beforeinstallprompt`** (MDN BCD): Chrome Android, Edge, Opera, Samsung Internet ≥ 5 — yes; Firefox, Safari — no.
  `prompt()` only inside a user gesture, once per event. Doesn't fire when already installed. `appinstalled` on accept.
- **Installed detection:** `matchMedia('(display-mode: standalone)')`; iOS also `navigator.standalone`.
  `getInstalledRelatedApps()` (Chrome Android 84+) with `related_applications: [{ platform: 'webapp', url }]`.
- **iOS:** no programmatic install. iOS 16.4+: Safari, Chrome, Edge, Firefox can add to home screen. iOS 26: every
  home-screen site opens as a web app by default ("Open as Web App" toggle, on). Polish path (Apple support pl-pl):
  „Stuknij w ⋯, a następnie stuknij w **Udostępnij** … stuknij w **Do ekranu głównego**".
- **iOS cookies:** home-screen app storage is isolated from Safari; cookie copy-at-install is documented only for macOS
  "Add to Dock" — assume a fresh login on iPhone. ITP's 7-day cap applies to script-written storage and exempts
  home-screen apps; our httpOnly server cookie is unaffected. Open WebKit bug 272325 (cookies reverting in home-screen
  apps, iOS 17.2–18.1).
- **Android WebAPK** shares Chrome's profile → logged in in Chrome = logged in in the app.
- **Next 16:** `app/manifest.ts` → `/manifest.webmanifest` + auto `<link rel="manifest">` (verified in installed
  16.1.7 source). `apple-icon.png|tsx` → `apple-touch-icon`. `metadata.appleWebApp`; `themeColor` lives on `viewport`.
  Next's PWA guide says manifest + HTTPS suffice and advises against a custom `beforeinstallprompt` button
  ("not cross browser") — contradicts Chrome's own note on the fetch handler; trust Chrome for the button path.

## Code References

- `src/collections/users.ts:23` — `tokenExpiration: 604800`
- `src/lib/auth/get-current-user-jwt.ts:24-57` — JWT-only auth, 7-day trade-off docstring
- `src/types/auth.ts` — `SessionUserT`
- `src/lib/auth/require-auth.ts:16` — every page/action funnels here
- `src/lib/actions/auth.ts:15-39` — `loginAction` / `logoutAction` via `@payloadcms/next/auth`
- `src/lib/db/user-sessions.ts:8-13` — `deleteUserSessions`, race warning
- `src/lib/actions/toggle-active.ts:53,76-78` — deactivate revokes sessions
- `src/lib/workers/trash-worker.ts:36-43`, `src/lib/actions/worker-trash.ts:44-65` — trash revokes sessions
- `src/hooks/users/refuse-disabled-login.ts:17-21` — login door
- `src/lib/cache/tags.ts:5,32-34,96-99,158` — `CACHE_TAGS.users`, `entityTag`, `WORKER_TRASH_TAGS`, `EXPIRE_NOW`
- `src/proxy.ts:5-27,46` — cookie-presence gate + matcher that blocks manifest/icons/sw
- `src/app/(frontend)/layout.tsx:56-57`, `src/app/(auth)/layout.tsx:10-11` — the two layout redirects
- `src/app/icon.tsx` — emoji favicon to replace
- `public/wykonczymy-app-icon.png` — 1024² icon source (also used by e-mail `lib/email/brand-logo.ts:3`)
- `src/components/nav/mobile-nav.tsx:39-41,127-143` — drawer action stack
- `src/app/(frontend)/pracownicy/[id]/page.tsx:56,137-144` — `isOwnPage`, `WorkerQuickActions`
- `src/components/users/worker-quick-actions.tsx:8-9,32` — 390px-safe action styling
- `src/hooks/use-media-query.ts`, `src/hooks/use-persisted-value.ts` — client primitives
- `node_modules/@payloadcms/next/dist/auth/refresh.js:15-50` — `refresh()` server function
- `node_modules/payload/dist/auth/operations/refresh.js:26,41-60,87-97` — refresh semantics + doc write-back
- `node_modules/payload/dist/auth/strategies/jwt.js:73-79` — `sid` existence check in Payload's own strategy

## Architecture Insights

- **Two auth planes, one revocation lever.** Payload's strategy (`/admin`, REST, `refresh`) checks `sid` in DB; the app's
  `getCurrentUserJwt` doesn't. Deleting `users_sessions` rows is the lever both would then honour. Adding the `sid` read to
  the app plane makes the two planes agree — the session row becomes the single source of truth for "is this phone still
  allowed in".
- **Cache-aside with targeted invalidation.** The check is a classic read-through cache keyed by `(userId, sid)`,
  invalidated by an entity tag that only the access-changing writers expire. Login/refresh don't need to expire it: a new
  `sid` is a new key, and refresh doesn't change existence.
- **Sliding expiration (sliding session)** — the server decides "older than N" (cookie is HttpOnly, so the client can't
  read `iat`); a once-per-mount client host fires a Server Action wrapping `refresh()`. Add `iat` to what the server reads,
  pass `needsRefresh` down.
- **Install button = Strategy per platform:** Chromium (captured `beforeinstallprompt`) / iOS (instruction sheet) /
  other (menu hint) / installed (hidden). Detection is a pure function of `navigator` + media query → testable outside React
  (`lessons.md:1037`: extract the logic, the hook stays thin).

## Historical Context (from prior changes)

- `context/foundation/lessons.md:2491-2496` — "Close a disabled account at the door, not per request": costed the
  per-request check (~20 ms warm on Neon, or entity-tagged cache), rejected it for a ≤ 7-day window that fails safe.
  Exit clause triggers now; the lesson must be updated, not contradicted silently.
- `AGENTS.md` Auth And Roles — "auth reads no DB, by choice, so the login door and the session drop are the whole
  revocation" — must change with this work.
- `56591165` (2026-02-16) — `getCurrentUserJwt` introduced for latency (M21 perf push).
- `context/archive/2026-10-05-worker-account/change.md:105-107` (EX-985) — "Sesja zostaje 7 dni"; instant cut-off is
  Aktywny / trash.
- `context/archive/2026-10-05-worker-self-credentials/change.md:25-26` (EX-989) — password change revokes no session,
  same stance. Unchanged by this work.
- `context/foundation/manual-checks.md:325-331` (EX-928) — a stale JWT survived a user reseed and hit raw FK errors; the
  `sid`/user-row check closes that too.
- `context/foundation/test-plan.md:71,99` (risk #20, trashed/inactive account keeps a session) and `:74,102` (risk #23,
  held phone takes over the account) — this change lands on both; #20's coverage must extend to "open app session refused".
- `context/changes/2026-10-07-media-upload-speed/research.md:7` ruled out an offline outbox; `lessons.md:2451` and
  `manual-verification.md:202` — offline Server Actions must toast. A service worker must **not** intercept POSTs or cache
  RSC responses, or it breaks those checks.
- `context/changes/2026-10-07-worker-page-quick-actions/` — shipped today on staging (`062d62d3`…`e935a89f`); same page
  and button styling the install button would sit next to.
- `AGENTS.md` Stack Notes — phone scope EX-785 with exceptions EX-947 (report page) and EX-985 (own worker page), both
  checked at 390px.

## Related Research

- `context/archive/2026-10-05-worker-account/` — EMPLOYEE's own page and session stance
- `context/archive/2026-09-30-worker-work-reports/` — phone exception for the worker surface

## Open Questions

1. **Service worker or not.** Chrome docs say the prompt path needs a `fetch` handler; Next's guide says no. Minimal safe
   SW: handle only `request.mode === 'navigate'`, network-first, offline fallback page on failure; never touch POST / RSC.
   Verify on a real Android phone whether the button appears without it before shipping one.
2. **Engagement heuristic.** `beforeinstallprompt` may not fire until a tap + ~30 s. When the manager onboards a worker on
   the spot, the button may be absent for the first half-minute — show a Chrome-menu hint instead of nothing?
3. **Cookie `Secure` flag** is off (Payload default). One line in `users.ts` `auth.cookies.secure` for production — fold in,
   or separate issue? With a 90-day cookie it matters more.
4. **Refresh threshold** — refresh when the token is older than 1 day (one write per user per day) or on every open?
   1 day keeps DB writes trivial and still slides the 90-day window.
5. **Check shape** — `sid` exists **and** user `active AND trashed_at IS NULL` in one query (closes the refresh
   write-back race and makes the trash/deactivate write order irrelevant). Cache backstop TTL (e.g. 1 h) in case a future
   writer forgets the entity tag?
6. **iOS first login after install** — accept and say so in the instruction sheet ("po dodaniu zaloguj się raz"), or
   test whether iOS 26 copies the cookie (unconfirmed).
7. **Where the button shows** — worker's own page (EMPLOYEE) + mobile drawer (all roles)? Hide forever after install /
   dismiss (`usePersistedFlag`)?
8. **Icon** — replace the 🚧 favicon with the brand icon everywhere, or only manifest + apple-icon?

## Owner decisions (2026-10-07)

- **Placement:** the install button sits directly under „Zmień e-mail lub hasło" on the user's own
  `/pracownicy/[id]` (`isOwnPage`, `page.tsx:130-135`). Not in the mobile drawer.
- **Android not ready yet** (no `beforeinstallprompt` captured): the button shows a loading state, not a menu hint.
  The loading state still needs an end for browsers where the event never comes (Firefox, app already installed but opened
  in the browser tab) — plan decides the end state.
- **iOS instruction:** only the steps (⋯ → Udostępnij → „Do ekranu głównego"). No "log in once" line — logging in after the
  first tap is self-evident.
- **Icon:** brand icon replaces the 🚧 favicon everywhere (default accepted).
- **Secure cookie:** folded into this change (default accepted).
- Technical defaults left to the plan: refresh when the token is older than 1 day; one cached query checks `sid` exists
  and the account is active and untrashed, expired by a per-user entity tag; minimal navigation-only SW if the prompt needs it.
