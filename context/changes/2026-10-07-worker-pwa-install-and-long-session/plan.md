# Installable app icon for workers and a session that survives monthly use — Implementation Plan

## Overview

Workers open the app every 2–4 weeks and are not comfortable with phones. Two things fix that:

- A one-tap "install the app" button that puts an icon on their home screen. Android gets a native prompt and iOS gets a short step guide.
- A session that lasts that long. The token goes to 90 days, slides forward when the app is opened, and is revoked as soon as a manager deactivates or trashes the account. Today revocation is not immediate: an open app session outlives deactivation until the JWT expires.

## Current State Analysis

- **Session:**
  - `users.ts` sets `tokenExpiration: 604800` (7 days), a hard cutoff with no refresh.
  - The cookie is HttpOnly and SameSite=Lax, with `Secure=false` (the Payload default).
- **App auth reads no DB:**
  - `getCurrentUserJwt` (`src/lib/auth/get-current-user-jwt.ts`) only verifies the JWT with jose.
  - So a deactivated or trashed worker with an open session keeps access until `exp`, even though `deleteUserSessions` removes their `users_sessions` rows. That gap is the accepted trade-off in `lessons.md:2491-2496` and the AGENTS.md "Auth And Roles" sentence ("auth reads no DB, by choice"). The 90-day token makes the gap 13× wider, so it now has to close.
- **No PWA surface:** no manifest, no service worker, no apple-icon, and `src/app/icon.tsx` renders a 🚧 emoji.
- **The proxy blocks PWA assets:** `src/proxy.ts` redirects `/manifest.webmanifest` and `/sw.js` to `/zaloguj` when there is no cookie. Manifests are fetched without credentials.
- **The worker's own page** `/pracownicy/[id]` (`page.tsx:120-150`) renders `AccountCredentialsDialog` under `isOwnPage`. The install button goes directly under it.

### Key Discoveries:

- **`refresh({ config })` from `@payloadcms/next/auth`:**
  - It keeps the `sid`, sets a fresh `exp`, re-signs name and role from the DB, extends the session row and sets the cookie with the collection's cookie config.
  - It throws when `payload.auth` finds no user (`node_modules/@payloadcms/next/dist/auth/refresh.js:15-20`) and returns `{success:false}` when the cookie is missing.
  - It runs no `beforeLogin`, so it does not check `active`.
  - It writes the whole user doc, sessions included, so it can race `deleteUserSessions` and write a deleted `sid` back.
- **Both layouts call `getCurrentUserJwt`:** `(frontend)/layout.tsx:56-57` and `(auth)/layout.tsx:10-11`. If the revocation check lives inside that function, a revoked token reads as "no user" in both, and there is no redirect loop.
- **`requireAuth` (`src/lib/auth/require-auth.ts:15-16`) goes through `getCurrentUserJwt`**, so every Server Action inherits the revocation for free.
- **`EntityNameT`** (`src/lib/cache/tags.ts`) is `'investment' | 'cash-register'`, so `'user'` must be added.
- **Writers that revoke access:**
  - `toggleUserActive` (`src/lib/actions/toggle-active.ts:60-80`) is not a `protectedAction` and expires only `collection:users`.
  - `trashWorkerAction` and `restoreWorkerAction` (`src/lib/actions/worker-trash.ts`) go through `protectedAction` with `WORKER_TRASH_TAGS`.
  - Hard delete (`delete-worker-forever.ts`) only ever runs on an already-trashed account, which the check already denies, so it needs no tag.
- **The `makeRevalidateAfterChange` docstring forbids per-row bumps in hooks** (EX-849). Entity tags belong in the action.
- **`public/wykonczymy-app-icon.png`** is 1024², with alpha, and the artwork runs almost edge to edge:
  - It is not maskable as-is, because Android crops it to a circle or squircle.
  - iOS fills transparency with black.
  - The installed icons therefore need a solid background, and the maskable one also needs padding.
- **The proxy matcher already skips `.png`**, so static PNG icons pass without a change. Only the extensionless or non-image paths (`manifest.webmanifest`, `sw.js`) need adding.

## Desired End State

- A worker on Android Chrome opens their own page, taps „Zainstaluj aplikację", confirms the native prompt, and has the Wykończymy icon on the home screen. Tapping the icon opens the app full-screen on their page, already logged in, because WebAPK shares Chrome's cookies.
- A worker on iPhone taps the same button and sees three illustrated steps (⋯ → Udostępnij → „Do ekranu głównego").
- The button is not shown inside the installed app, or when the browser reports the app as already installed.
- A worker who opens the app at least once every 90 days is never logged out.
- A worker who is deactivated or trashed loses access on their next request: they land on `/zaloguj` and no Server Action accepts them.
- The cookie is `Secure` in production.

### How to verify

- DB specs cover the session check: live sid plus an active account returns true, and a deleted sid, an inactive account or a trashed account returns false.
- Unit specs cover the install-state resolver and the refresh threshold.
- Manual checks on a 390px Android and iPhone.

## What We're NOT Doing

- **No push notifications, background sync or offline data.** The SW handles navigations only.
- **No install entry in the mobile drawer or for management.** Owner decision: only the user's own page.
- **No "log in once after installing" line in the iOS guide.** Owner decision: the steps only.
- **No revocation of sessions on password change.** EX-989 stays as it is.
- **No refresh-token rotation or new `sid` on refresh.** The same `sid` is extended.
- **No change to the share-link routes' auth.** They are token links, not sessions.
- **No Payload `/admin` considerations.** The panel is unused.

## Implementation Approach

1. Close the revocation gap first. That makes the 90-day token safe.
2. Then lengthen the token and slide it.
3. Then add the PWA surface: manifest, icons and SW.
4. Then add the button that uses it.

Revocation is one cached query keyed on `(userId, sid)`:

- The query requires the `sid` row to exist and the account to be `active AND trashed_at IS NULL`. Checking the account state, not only the `sid`, closes the `refresh()` write-back race and makes write order irrelevant.
- The cache is tagged `entityTag('user', id)` and expired by the actions that revoke access.
- A 1-hour `revalidate` backstop covers any future writer that forgets the tag.
- The per-request check is **temporary by owner decision (2026-10-07)**. EX-1020 revisits it for a cheaper form once its cost is measured. Keep it isolated inside `getCurrentUserJwt`, so it can be swapped out without touching callers.

Sliding is server-decided because the cookie is HttpOnly:

- The shell computes `needsRefresh` from the JWT's `iat` (older than 1 day).
- A tiny client host fires one Server Action per mount that calls Payload's `refresh`.

## Critical Implementation Details

- **Timing & lifecycle:**
  - The session check must run inside `getCurrentUserJwt`, after `jwtVerify`, and return `undefined` on a dead session. Do not put it in a layout. Both layouts and `requireAuth` must read the same answer, or `(auth)/layout` and `(frontend)/layout` bounce the user between each other.
  - Do not wrap `cookies()` in `unstable_cache`. Only the DB query is cached. The outer `cache()` stays.
  - The refresh host must guard against StrictMode's double effect in dev (a ref), so it does not fire two refreshes.
- **State sequencing:** in `toggleUserActive`, expire the user entity tag after `deleteUserSessions`, alongside the existing collection revalidation. The query is cached, and expiring it before the rows are gone could re-cache `true`.
- **User experience spec:**
  - On Chromium, the button shows a loading state until `beforeinstallprompt` is captured (owner decision).
  - The event may never come: Firefox, the engagement heuristic not yet met, or the app already installed but opened in a browser tab. After 60 s of waiting, the loading state ends in one line of text: „Otwórz menu przeglądarki ⋮ i wybierz »Zainstaluj aplikację«". The plan made this end-state decision; the owner only ruled on the waiting state.
  - `prompt()` must be called from the click handler, and only once per captured event.

## Phase 1: Session revocation check

### Overview

A deactivated or trashed account, or a deleted session, is refused on the next request, in both layouts and in every Server Action.

### Changes Required:

#### 1. Entity name

**File**: `src/lib/cache/tags.ts`

**Intent**: Allow a per-user entity tag.

**Contract**: `EntityNameT = 'investment' | 'cash-register' | 'user'`.

#### 2. Session-alive query

**File**: `src/lib/db/user-sessions.ts`

**Intent**: Add one statement that says whether a `(userId, sid)` pair may still act. Update the module docstring: the line "The app's own reads are JWT-only and ignore it" stops being true.

**Contract**: `isSessionAlive(db: DbExecutorT, userId: number, sid: string): Promise<boolean>`. One SQL statement. It is true only when a `users_sessions` row with `_parent_id = userId AND id = sid` exists AND the `users` row has `active = true AND trashed_at IS NULL`. Before writing the SQL, confirm the actual `users_sessions` column names (`id`, `_parent_id`) against the schema.

#### 3. Cached check in the auth reader

**File**: `src/lib/auth/get-current-user-jwt.ts`

**Intent**: After `jwtVerify`, read `sid` and `iat` from the payload and run the session check through `unstable_cache`. Return `undefined` when there is no `sid` or the check is false. Expose `issuedAt` (seconds) on the result so the shell can decide on a refresh in Phase 2. Rewrite the docstring trade-off paragraph to describe the new contract.

**Contract**:
- `unstable_cache(() => isSessionAlive(db, id, sid), ['session-alive', String(id), sid], { tags: [entityTag('user', id)], revalidate: 3600 })`.
- `SessionUserT` (in `src/types/auth.ts`) gains `issuedAt: number`, or the function returns it alongside. Pick whichever keeps `CurrentUserProvider`'s client payload unchanged. Prefer not sending `issuedAt` to the client if `SessionUserT` is serialized there.

#### 4. Revoking writers expire the user tag

**Files**: `src/lib/actions/toggle-active.ts`, `src/lib/actions/worker-trash.ts`

**Intent**:
- `toggleUserActive` expires `entityTag('user', id)` on both deactivate and reactivate. It is not a `protectedAction`, so it calls `revalidateEntities` directly, after `afterUpdate`.
- `trashWorkerAction` and `restoreWorkerAction` pass the entity tag through `protectedAction`'s `opts.entityTags`.

**Contract**: the writer list is exactly these three. Hard delete needs no tag (see Key Discoveries).

#### 5. Specs

**Files**:
- `src/__tests__/lib/db/user-sessions.db.test.ts` (new; DB on 5435)
- `src/__tests__/lib/auth/get-current-user-jwt.test.ts` (new; node, with `isSessionAlive` and `next/cache` mocked)
- `src/__tests__/toggle-actions.test.ts` and `src/__tests__/lib/actions/worker-trash.db.test.ts` (extend; shared revalidate stub)

**Intent**: Anchor on test-plan risk #20 (a disabled account keeps access).
- The DB spec asserts the four truth-table rows: alive, sid deleted, inactive, trashed.
- The reader spec asserts:
  - a valid JWT with a dead session returns `undefined`;
  - a JWT without `sid` returns `undefined`;
  - a live one returns the user.
- The action specs assert the user entity tag is expired.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/db/user-sessions.db.test.ts` passes (needs `db-test` on 5435)
- `pnpm exec vitest run src/__tests__/lib/auth/get-current-user-jwt.test.ts` passes
- `pnpm exec vitest run src/__tests__/toggle-actions.test.ts src/__tests__/lib/actions/worker-trash.db.test.ts` passes

#### Manual Verification:

- Logged in as a worker in one browser, deactivate them as a manager in another. The worker's next navigation lands on `/zaloguj`, and a pending form submit returns „Nie jesteś zalogowany".
- The same with trashing the worker in `/kosz`. Then restore and reactivate: the worker can log in again.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: 90-day sliding session and Secure cookie

### Overview

The token lasts 90 days and is re-issued at most once a day when the app is opened. The cookie is Secure in production.

### Changes Required:

#### 1. Auth config

**File**: `src/collections/users.ts`

**Intent**: Set `tokenExpiration` to 90 days and turn on `cookies.secure` in production. This file is in the Payload graph, so `process.env.NODE_ENV` is the allowed read. Update the trailing comment.

**Contract**: `tokenExpiration: 7776000`, `cookies: { secure: process.env.NODE_ENV === 'production' }`. Vercel Preview also runs as production over https, which is intended. Local `pnpm dev` stays http, so `secure` is false there.

#### 2. Refresh threshold (pure)

**File**: `src/lib/auth/session-refresh.ts` (new, React-free)

**Intent**: Decide whether the token is old enough to slide.

**Contract**: `needsSessionRefresh(issuedAtSec: number, nowMs: number): boolean`, true when the token is more than 24 h old. The threshold is a named constant.

#### 3. Refresh action

**File**: `src/lib/actions/session-refresh.ts` (new, `'use server'`)

**Intent**: Wrap Payload's `refresh({ config })` in `protectedAction` with every role allowed, and no collection tags or entity tags. Swallow `refresh`'s throw and its `{success:false}` into a failed `ActionResultT`. A failed slide must never surface to the user; the next request's auth decides their fate.

**Contract**: `refreshSessionAction(): Promise<ActionResultT>`. The session check in `getCurrentUserJwt` already ran inside `protectedAction`'s `requireAuth`, so a revoked user never reaches `refresh`.

#### 4. Shell host

**Files**: `src/components/auth/session-refresher.tsx` (new client component), `src/app/(frontend)/layout.tsx`

**Intent**: `AuthenticatedShell` computes `needsSessionRefresh(user.issuedAt, Date.now())` and renders `<SessionRefresher />` only when it is true. The component fires `refreshSessionAction()` once on mount (with a ref guard) and renders nothing.

**Contract**: no props beyond what it needs. It shows no toast, no loader and no `router.refresh()`; the new cookie is used by the next request.

#### 5. Spec

**File**: `src/__tests__/lib/auth/session-refresh.test.ts` (new, node)

**Intent**: Cover the threshold boundary: just under 24 h returns false, just over returns true.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/auth/session-refresh.test.ts` passes

#### Manual Verification:

- Local: temporarily set the threshold constant to 0, reload, and confirm in DevTools → Application → Cookies that `payload-token` gets a new value and an expiry about 90 days out. Then revert the constant.
- On staging (https), the `payload-token` cookie shows `Secure` ✓.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: PWA surface — manifest, icons, service worker

### Overview

The browser recognises the app as installable, and the icon is the brand icon everywhere.

### Changes Required:

#### 1. Icons

**Files**:
- `src/app/icon.png` and `src/app/apple-icon.png` (static files, replacing `src/app/icon.tsx`)
- `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`

**Intent**: Generate these once from `public/wykonczymy-app-icon.png`, all on a solid white background:
- 192 and 512 with the art at about 90%;
- maskable 512 with the art inside the central 80% safe zone;
- apple-icon 180.

Any local tool works (`sharp`, already a Next dependency, via a throwaway script). Do not commit the script. Delete `src/app/icon.tsx`.

**Contract**: the `.png` paths are already exempt from the proxy matcher.

#### 2. Manifest

**File**: `src/app/manifest.ts` (new)

**Intent**: Describe the installed app.

**Contract**: `MetadataRoute.Manifest` with:
- `id: '/'`, `name: 'Wykończymy'`, `short_name: 'Wykończymy'`;
- `start_url: '/'`, `scope: '/'`, `display: 'standalone'`;
- `background_color` and `theme_color` white, `lang: 'pl'`;
- `icons` (192 any, 512 any, 512 maskable);
- `related_applications: [{ platform: 'webapp', url: '<origin>/manifest.webmanifest' }]` with `prefer_related_applications: false`, which `getInstalledRelatedApps` needs. Build the origin from `env.FRONTEND_URL`.

`start_url: '/'` lands an EMPLOYEE on their own page via the existing dashboard redirect.

#### 3. Head metadata

**Files**: `src/app/(frontend)/layout.tsx`, `src/app/(auth)/layout.tsx`

**Intent**: The iOS home-screen app opens on `/zaloguj` first, so both shells declare it as a web app. A theme color tints the Android status bar.

**Contract**:
- `export const metadata = { appleWebApp: { capable: true, title: 'Wykończymy', statusBarStyle: 'default' } }`. Merge with existing metadata if a layout has any.
- `export const viewport = { themeColor: '#ffffff' }`.

#### 4. Proxy allow-list

**File**: `src/proxy.ts`

**Intent**: Let the manifest and the SW through without a cookie.

**Contract**: add `manifest\\.webmanifest|sw\\.js` to the matcher's negative lookahead.

#### 5. Service worker

**Files**: `public/sw.js` (new), `src/components/pwa/service-worker-registration.tsx` (new client component, rendered in `(frontend)/layout.tsx`)

**Intent**: Give Chrome the `fetch` handler its install path expects, with no effect on how the app runs online.

**Contract**:
- The handler responds only when `request.mode === 'navigate'`. It fetches from the network, and on a network failure returns an inline HTML response with one line of Polish text: „Brak połączenia z internetem. Spróbuj ponownie, gdy będzie zasięg." and a reload link.
- It never touches non-navigation requests, so POSTs, Server Actions and RSC fetches pass through untouched and keep their offline toast (`lessons.md:2451`).
- It has no caches and no precache.
- `skipWaiting` + `clients.claim` so an update takes effect without a second visit.
- Registration: `navigator.serviceWorker.register('/sw.js', { scope: '/' })` in an effect, only when `'serviceWorker' in navigator` and `NODE_ENV === 'production'`, so dev's HMR is untouched.

### Success Criteria:

#### Automated Verification:

- `curl -sI http://localhost:3000/manifest.webmanifest` returns 200 with no cookie (dev server running)
- `curl -sI http://localhost:3000/sw.js` returns 200 with no cookie

#### Manual Verification:

- Chrome DevTools → Application → Manifest shows the name, all three icons (the maskable one previewed with the safe zone) and no installability errors on a production build (`pnpm build && pnpm start`).
- The favicon in the browser tab is the brand icon, not 🚧.
- With DevTools → Network → Offline, a navigation shows the offline line, and submitting a form shows the existing offline toast, not the SW page.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Install button on the user's own page

### Overview

Under „Zmień e-mail lub hasło" on `/pracownicy/[id]` (own page only): one button that installs on Android, opens a step guide on iOS, and is absent once the app is installed.

### Changes Required:

#### 1. Install-state resolver (pure)

**File**: `src/lib/pwa/install-state.ts` (new, React-free)

**Intent**: Map the platform signals to what the button shows, so the branching is unit-testable without a browser.

**Contract**:
```ts
type InstallStateT = 'hidden' | 'ready' | 'waiting' | 'ios' | 'manual'
resolveInstallState(input: {
  isStandalone: boolean      // display-mode: standalone, or navigator.standalone on iOS
  isInstalled: boolean       // getInstalledRelatedApps().length > 0
  isIos: boolean             // iPhone/iPad incl. iPadOS reporting as Mac with touch
  hasPrompt: boolean         // a beforeinstallprompt event is captured
  waitedOut: boolean         // 60 s passed without one
}): InstallStateT
```
The checks run in this order:
1. standalone or installed → `hidden`;
2. iOS → `ios`;
3. `hasPrompt` → `ready`;
4. `waitedOut` → `manual`;
5. otherwise `waiting`.

#### 2. Install button component

**File**: `src/components/users/install-app-button.tsx` (new client component)

**Intent**: Gather the signals and render per state.
- On mount it:
  - listens for `beforeinstallprompt` and captures it with `preventDefault`;
  - listens for `appinstalled` (→ hidden);
  - queries `getInstalledRelatedApps` when available;
  - starts the 60 s timer.
- It renders, per state:
  - **`ready`**: a button whose click calls `prompt()` once and drops the event.
  - **`waiting`**: the same button, disabled, with a spinner.
  - **`manual`**: one muted line with the browser-menu path.
  - **`ios`**: a button that opens a `ui/dialog` with three numbered steps, each with its lucide glyph (`Ellipsis`, `Share`, `SquarePlus`) and the Polish Apple wording. There is no extra line about logging in.
  - **`hidden`**: nothing.
- It is styled like the neighbouring `AccountCredentialsDialog` trigger.
- Detection code that is a constant measured once (the UA test) lives in the resolver module, not in a hook. Per AGENTS.md, a hook used by one component stays beside it.

**Contract**: `InstallAppButton()` takes no props and uses `useTranslation('workerPage')` for every string.

#### 3. Placement

**File**: `src/app/(frontend)/pracownicy/[id]/page.tsx`

**Intent**: Render `<InstallAppButton />` directly under `<AccountCredentialsDialog />` inside the existing `isOwnPage` branch. It sits in the same flex-wrap row, after the credentials trigger.

#### 4. Strings

**Files**: `src/lib/i18n/dictionaries/{pl,uk,ru}.ts`

**Intent**: Add the button label, the waiting label, the manual line, the dialog title and the three steps under `workerPage`. Write the Ukrainian and Russian with the same plain register as the existing keys. Typecheck catches a missing key.

#### 5. Spec

**File**: `src/__tests__/lib/pwa/install-state.test.ts` (new, node)

**Intent**: Cover every row of the precedence order:
- standalone beats a captured prompt;
- iOS never waits;
- a timeout without a prompt gives `manual`;
- a prompt arriving after the timeout still wins (`ready`).

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/pwa/install-state.test.ts` passes

#### Manual Verification:

- **Android Chrome, real phone, staging, 390px:**
  - The worker's own page shows the button under „Zmień e-mail lub hasło": loading first, then active.
  - Tapping it shows the native prompt. Installing puts the brand icon on the home screen.
  - The icon opens full-screen on the worker's page, already logged in, and the button is not shown there.
- **iPhone Safari, real phone, staging, 390px:** the button opens the three-step guide. Following it adds the icon. The icon opens full-screen on `/zaloguj`, and after logging in the button is not shown.
- **Already installed (Android), opened in a Chrome tab:** the button is hidden, or it ends in the menu line after 60 s, never stuck loading.
- Switching the account language to Українська / Русский translates the button, the line and the guide.
- The button does not appear on someone else's `/pracownicy/[id]` or for a manager viewing a worker.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 5: Living docs

### Overview

The docs that claim "auth reads no DB" and "7 days" become true again.

### Changes Required:

#### 1. AGENTS.md — Auth And Roles

**File**: `AGENTS.md`

**Intent**: Replace "An app session that is already open lasts until the JWT expires — auth reads no DB, by choice, so the login door and the session drop are the whole revocation" with the new contract:
- 90-day token, slid daily on open;
- one cached `(user, sid)` check per request, tagged `user:<id>`;
- the three writers that must expire it, and the 1 h backstop.

The `JWT auth via Payload … (7-day lifetime)` line becomes 90 days.

#### 2. Lesson

**File**: `context/foundation/lessons.md` (entry at `:2491-2496`)

**Intent**: Its exit clause ("revisit if the token grows long") has fired. Rewrite the entry so it records why the gate moved into the per-request read: the 90-day token, and the `refresh()` write-back race that makes a `sid`-only check insufficient.

#### 3. Test plan

**File**: `context/foundation/test-plan.md` (risk #20 at `:71`, `:99`)

**Intent**: Record the new specs as the coverage for risk #20.

### Success Criteria:

#### Automated Verification:

- None: prose-only phase.

#### Manual Verification:

- `rg -n "7-day|7 days|reads no DB" AGENTS.md src/lib/auth src/lib/db/user-sessions.ts` returns nothing stale.

---

## Testing Strategy

### Unit Tests:

- `needsSessionRefresh` at the 24 h boundary.
- `resolveInstallState`: the full precedence table.
- `getCurrentUserJwt` with a mocked check:
  - dead session → `undefined`;
  - missing `sid` → `undefined`;
  - live → user.

### Integration Tests:

- `isSessionAlive` truth table against the 5435 DB: alive / sid deleted / inactive / trashed.
- The revoking actions expire `user:<id>`, asserted via the shared revalidate stub and the existing DB specs.

### Manual Testing Steps:

1. Deactivate and trash a logged-in worker. Their next request lands on `/zaloguj`.
2. Install on a real Android phone and a real iPhone from staging, then open from the icon.
3. Offline navigation shows the SW line, and offline submit still toasts.

## Performance Considerations

The first request per `(user, sid)` per hour costs one indexed SQL lookup; every other request is a cache hit. The refresh costs one user-doc write per user per day. Both are negligible at this app's scale.

## Migration Notes

- There is no schema change and no migration.
- Existing 7-day tokens keep their old `exp`. The first open more than 1 day after login slides them to 90 days, and nobody is logged out by the deploy.
- A token issued before deploy that has no `sid` is now refused. Payload 3.73 has `useSessions` on by default, so every live token carries one. If a stray token exists, its owner just logs in again.

## Whole-tree Gate

Run **once**, after the final phase.

- Typecheck passes: `pnpm typecheck`
- Lint passes: `pnpm lint`
- Build succeeds: `pnpm build`
- Touched specs pass. The full `pnpm test` runs at the review gate or pre-push, not unasked.

## References

- Research: `context/changes/2026-10-07-worker-pwa-install-and-long-session/research.md`
- Revocation precedent: EX-918 (`refuse-disabled-login.ts`, `deleteUserSessions`)
- Entity-tag precedent: EX-849 (`fetchInvestmentAssets`, `investmentEntityOpts`)
- Lesson to update: `context/foundation/lessons.md:2491-2496`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Session revocation check

#### Automated

- [x] 1.1 `pnpm exec vitest run src/__tests__/lib/db/user-sessions.db.test.ts` passes — c53a13ad
- [x] 1.2 `pnpm exec vitest run src/__tests__/lib/auth/get-current-user-jwt.test.ts` passes — c53a13ad
- [x] 1.3 `pnpm exec vitest run src/__tests__/toggle-actions.test.ts src/__tests__/lib/actions/worker-trash.db.test.ts` passes — c53a13ad

### Phase 2: 90-day sliding session and Secure cookie

#### Automated

- [x] 2.1 `pnpm exec vitest run src/__tests__/lib/auth/session-refresh.test.ts` passes — 296905dc

### Phase 3: PWA surface — manifest, icons, service worker

#### Automated

- [x] 3.1 `/manifest.webmanifest` returns 200 without a cookie — 40033f2c
- [x] 3.2 `/sw.js` returns 200 without a cookie — 40033f2c

### Phase 4: Install button on the user's own page

#### Automated

- [x] 4.1 `pnpm exec vitest run src/__tests__/lib/pwa/install-state.test.ts` passes — 5b3e59c4

### Phase 5: Living docs

#### Automated

- [x] 5.1 None — prose-only phase — 744856d4
