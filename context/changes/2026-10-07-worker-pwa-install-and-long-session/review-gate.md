Ok imp# Review-gate ledger — worker-pwa-install-and-long-session · 2026-10-07

Base `staging` (e935a89f) → `worker-pwa-install-and-long-session`. Step 0.5 (browser verification
pass) skipped: it drives Playwright, which runs only on an explicit ask.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit` (diff-scoped), `comment-noise-audit` (flag-only).

## Findings

- [x] 🟡 WARNING · fixed · simplify (altitude) · `src/lib/actions/workers.ts` / `src/lib/auth/get-current-user-jwt.ts:36` · „Edytuj pracownika” writes `active` but expired only `collection:users`, never `user:<id>` — a worker deactivated there stayed logged in up to the 1 h backstop; the session check is now tagged `CACHE_TAGS.users`, so every `users` writer (hooks, `updateWorkerAction`, toggle, trash) evicts it — one PK lookup per open session per eviction, deliberately against the EX-849 rule (rationale at the call site, AGENTS.md, lessons)
      test: TDD · unit — `get-current-user-jwt` spec asserts the `collection:users` tag; mutation-verified (fails with the tag reverted)
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/db/user-sessions.ts:36` · a role change ended no session — with the 90-day token a demoted MANAGER's token kept MANAGER rights until a slide re-signed it (up to 90 days for a copy never refreshed) — `isSessionAlive` also matches `u.role` against the token's role (in the cache key too); owner approved logging the demoted account out
      test: TDD · integration — `user-sessions.db` spec: a role differing from the token's is dead (red before the fix, green after)
- [x] 🟡 WARNING · filed EX-1020 · impl-review F1 + code-review · `src/lib/db/user-sessions.ts:15-19` · Payload `refresh()` writes the whole user doc back, so a refresh racing a deactivation/trash also restores `active`/`trashedAt` — the JOIN narrows the race, it does not close it; four places claimed "closed" — docs corrected to "narrows" (lessons, plan, plan-brief, `isSessionAlive` doc); the race-free own-slide (one `UPDATE users_sessions … WHERE EXISTS(active, untrashed)` + `jwtSign`, no write to `users`) is an auth refactor with its own review, posted on EX-1020
      test: no automated test — the window is the gap between two statements inside one refresh; an interleaving test would pin Payload internals, not our code
- [x] 🟡 WARNING · fixed · impl-review F2 · `public/icons/icon-maskable-512.png` · art reached 236 px from centre against the 204.8 px circular safe zone, so circle-mask launchers clip the base bar — regenerated; farthest opaque pixel now 194 px
- [x] 🟡 WARNING · fixed · code-review + impl-review F3 · `src/components/users/install-app-button.tsx:40-56` · `beforeinstallprompt` fires once per load and was held only by the mounted button — lost on client navigation back to the page, for management reaching their own page, and on a slow hydrate — held in `stores/install-prompt-store.ts` (Zustand) from shell load
      test: no automated test — browser event timing; covered by the Android manual check
- [x] 🔵 OBSERVATION · fixed · impl-review F4 · `src/components/users/install-app-button.tsx:106-108` · after the native prompt is dismissed the button falls back to a disabled spinner until the 60 s run out — `promptUsed` resolves to the menu hint
      test: TDD · unit — `resolveInstallState` resolves a used prompt to the menu hint
- [x] 🔵 OBSERVATION · fixed · impl-review F6 + code-review · `src/lib/auth/get-current-user-jwt.ts:62,66` · a DB error in the session check is logged as "JWT verify failed" — split try/catch, own label, still fails closed
      test: TDD · unit — a rejected `isSessionAlive` logs under its own label and still fails closed
- [x] 🔵 OBSERVATION · fixed · impl-review F7 · `src/lib/actions/auth.ts:38-41` · the logout tag expiry (4th lockout writer) has no spec, and `auth-actions.test.ts` was not re-run — `logoutAction` spec added, suite file green
      test: TDD · unit — logout expires the `users` collection tag
- [x] 🔵 OBSERVATION · fixed · impl-review F8 · `src/app/manifest.ts:25` · `related_applications` pinned to `FRONTEND_URL`; a host mismatch on preview breaks `getInstalledRelatedApps` — relative `/manifest.webmanifest`, resolved against the manifest URL
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/pwa/service-worker-registration.tsx:9`, `install-app-button.tsx:107` · `register()` and `prompt()` rejections are uncaught — `register` logs via `logError`, `prompt` swallowed (a dismissal is not an error)
      test: no automated test — browser-policy rejections
- [x] 🔵 OBSERVATION · fixed · code-review · `public/sw.js:15-18` · no navigation preload: every full navigation waits for the SW to boot — `navigationPreload` enabled on activate, `preloadResponse` used first
- [x] 🔵 OBSERVATION · fixed · code-review · `playwright.config.ts:87-95` · the SW registers under E2E (`pnpm start`) and can sit between `page.route` and the network — `serviceWorkers: 'block'`
- [x] 🔵 OBSERVATION · fixed · code-review · `public/sw.js:6` · the offline page is Polish only; workers on Українська / Русский (EX-996) get Polish — pl/uk/ru picked by `navigator.language` (the account language is behind the unreachable server)
- [x] 🔵 OBSERVATION · dismissed · impl-review F5 + code-review · `src/lib/actions/session-refresh.ts:12` · setting the cookie in a Server Action re-renders the current route once a day — one refresh per device per day; the trade-off is now stated at the call site
- [x] 🔵 OBSERVATION · dismissed · impl-review F9 · `src/collections/users.ts:25` · `Secure` cookie under the E2E harness (http://127.0.0.1) unverified — Chromium treats loopback as a secure context and keeps `Secure` cookies on it; the next E2E run confirms it
- [x] 🔵 OBSERVATION · dropped · code-review · `src/collections/users.ts:40-41` · REST / `/admin` writes to `users` expire only the collection tag, not `user:<id>` — unreachable: `/admin` is unused and nothing in the app PATCHes `users` over REST; the 1 h backstop bounds it anyway
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/auth/get-current-user-jwt.ts:31-34` · a cache fill racing a lockout can store a stale "alive" — millisecond window, bounded by the 1 h backstop, ~5 users
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/collections/users.ts:25` · `Secure` cookie breaks `pnpm start` over a LAN IP on plain http; a `db:import` logs developers out within 1 h — dev-only; `pnpm dev` is not production, and a re-login after a restore is expected
- [x] fixed · simplify · `src/lib/pwa/install-prompt.ts` · hand-rolled external store (listeners set + `useSyncExternalStore`) — replaced by a Zustand store, `src/stores/install-prompt-store.ts`, after the `review-prompt-store` precedent
- [x] fixed · simplify · `src/lib/pwa/install-state.ts:5-11` · three booleans (`standalone`/`ios`/…) for one platform — collapsed into `platform: PlatformT`
- [x] fixed · simplify · `src/components/pwa/install-app-button.tsx` · `getInstalledRelatedApps` called from the button with a `markInstalled` setter — moved into the store's module load, setter removed
- [x] fixed · simplify · `src/lib/pwa/install-prompt.ts` · `InstallPromptSnapshotT` exported, imported nowhere — gone with the file
- [x] fixed · simplify · `src/lib/auth/get-current-user-jwt.ts:46` · `readSession` + `getSessionIssuedAt` read the same session twice with a dead `issuedAt !== undefined` guard — one exported `getSession` returning `{ user, issuedAt }`
- [x] fixed · simplify · `src/lib/actions/toggle-active.ts`, `src/lib/actions/worker-trash.ts`, `src/lib/cache/tags.ts` · `userEntityOpts` and a per-call `entity` field spelling the same tag two ways — removed with the collection tag
- [x] fixed · simplify · `public/sw.js:15-17` · language fallback applied twice — one lookup
- [x] fixed · simplify · `src/lib/actions/auth.ts`, `src/lib/auth/get-current-user-jwt.ts` · comments narrating other files — each now carries only its own rationale
- [x] fixed · simplify (efficiency) · `src/components/pwa/install-app-button.tsx:34-38` · the 60 s timer ran on iOS and in the installed app — gated to `platform === 'browser'`
- [x] fixed · simplify (efficiency) · `src/lib/actions/auth.ts` · logout ran a session check (`getCurrentUserJwt`) only to build a per-user tag — dropped with the collection tag
- [x] dismissed · simplify (efficiency) · `src/components/auth/session-refresher.tsx` · a failed slide retries on every shell render — only while `refresh()` keeps failing, which is rare; the route-handler alternative was weighed in F5
- [x] dropped · simplify (efficiency) · `src/components/pwa/install-app-button.tsx:15` · `readPlatform` runs on every render — a `matchMedia` and a UA regex, negligible
- [x] dropped · simplify · `src/app/manifest.ts:16-17,24` · `purpose: 'any'` / `prefer_related_applications: false` restate defaults — explicit beside the maskable entry, not worth the churn
- [x] dismissed · reuse-scan · `src/components/pwa/install-app-button.tsx:17` · `matchMedia('(display-mode: standalone)')` beside `useMediaQuery` (`src/hooks/use-media-query.ts:7`) — not a match: that hook is false through hydration and subscribes; the platform is one read, and splitting it would spread the standalone check across a hook and `navigator.standalone`
- [x] dropped · reuse-scan · `src/lib/auth/session-refresh.ts:2` · a day in ms spelled again (private `DAY_MS` in `src/lib/queries/trash.ts:23`, literal in `src/lib/utils/days.ts:47`) — no shared constant exists to reuse; promoting one for three private uses is churn
- [x] dropped · reuse-scan · `src/components/pwa/install-app-button.tsx:54-57,80-89` · the outline/sm/w-fit install `Button` written twice (iOS trigger, prompt button) — they differ in icon, `disabled` and `onClick`; a wrapper would save three props
- [x] fixed · structure-scatter + feature-first · `src/components/users/install-app-button.tsx` · PWA component filed under `users/` while this slice opens `components/pwa/` — moved to `components/pwa/`
- [x] fixed · structure-scatter + feature-first + module-cohesion · `src/app/manifest.ts:4,9-10` / `src/lib/pwa/head.ts:5,8` · app name and theme colour spelled in two files — `PWA_NAME` / `PWA_THEME_COLOR` in `lib/pwa/head.ts`
- [x] fixed · code-review + module-cohesion · `src/lib/actions/auth.ts:41` · logout builds `entityTag('user', …)` by hand beside the new `userEntityOpts` — superseded: the session check is now tagged with the collection, logout calls `revalidateCollections(['users'])`
- [x] fixed · module-cohesion · `src/lib/cache/tags.ts:47-51` · doc says every lockout writer "takes these opts", but `toggle-active.ts:55` runs outside `protectedAction` and can't — superseded: `userEntityOpts` and its doc removed with the collection tag
- [x] fixed · code-review · `src/lib/auth/get-current-user-jwt.ts:75,80` · `getCurrentUserJwt` / `getSessionIssuedAt` re-wrap the already-cached `readSession` in React `cache` — plain arrows
- [x] fixed · comment-noise · `src/lib/pwa/install-state.ts:4,6,9,11` · four field docs restate the field or describe the producer in another file
- [x] fixed · comment-noise · `src/lib/db/user-sessions.ts:5,16` · leading sentences restate `deleteUserSessions` / `isSessionAlive`
- [x] fixed · comment-noise · `src/lib/auth/get-current-user-jwt.ts:72,79` · docstrings restate the export and the `cache(` wrapper
- [x] fixed · comment-noise · `src/components/auth/session-refresher.tsx:7` · docstring restates the name and the `fired` ref
- [x] fixed · comment-noise · `src/lib/auth/session-refresh.ts:4` · docstring restates `needsSessionRefresh(issuedAtSec)`
- [x] fixed · module-cohesion · `src/lib/pwa/install-state.ts:1` · `InstallStateT` exported, imported nowhere — un-exported
- [x] dismissed · module-cohesion · `src/components/users/install-app-button.tsx:10-58` · two seams (platform/event lifecycle vs render branches) — one consumer, decision logic already in `lib/pwa`; a split adds files, not clarity
- [x] dismissed · structure-scatter + feature-first + module-cohesion · `src/lib/auth/get-current-user-jwt.ts:30` · `unstable_cache` outside `lib/queries` — private to the one auth reader; moving it makes `lib/queries` ↔ `lib/auth` depend both ways
- [x] dismissed · module-cohesion · `src/lib/cache/tags.ts`, `src/lib/i18n/dictionaries/*`, `src/lib/actions/toggle-active.ts`, `src/lib/db/user-sessions.ts` · scanner size/mix flags — pre-existing size or one concern each
- [x] dismissed · structure-scatter · `src/lib/actions/session-refresh.ts` vs `src/lib/actions/refresh.ts` · similar names, each says what it refreshes
- [x] dropped · structure-scatter · `src/components/kosztorys/worker-report/report-viewport.ts` · a shared `Viewport` const filed in `components/` — on `staging` before this slice, not in its diff
- [x] dismissed · tailwind-v4-audit · `src/app/(frontend)/layout.tsx:53` · `ToastContainer style={{ zIndex }}` — pre-existing, third-party prop
- [x] dropped · tailwind-v4-audit · repo · no Tailwind-aware ESLint plugin — repo-wide tooling gap, not this slice

## Simplify pass

Ran /simplify — 11 applied (incl. the altitude fix), 0 proposed, 4 dismissed/dropped; then primitive-reuse-scan over `.reuse-scan.json` homes (`src/stores` added) — 0 fixed, 3 dismissed/dropped. All folded into ## Findings (tagged `simplify` / `reuse-scan`).

## Tests & suite

- Touched specs (`auth-actions`, `lib/auth/get-current-user-jwt`, `lib/pwa/install-state`, `lib/auth/session-refresh`, `toggle-actions`): 33/33 green.
- `pnpm typecheck` clean; eslint clean on touched files.
- Mutation check: the `collection:users` tag spec fails with the tag reverted.
- `user-sessions.db` (7/7, incl. the new role spec — red first) against 5435.
- `worker-trash.db` 8/8 against 5435.
- Not run: full `pnpm test` / `test:integration` — left to the pre-push hook.
- E2E: not run (explicit ask only); manual checks cover the browser surface.
