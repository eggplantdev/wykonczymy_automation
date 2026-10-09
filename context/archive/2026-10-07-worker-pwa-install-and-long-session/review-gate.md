Ok imp# Review-gate ledger — worker-pwa-install-and-long-session · 2026-10-07

Base `staging` (e935a89f) → `worker-pwa-install-and-long-session`. Step 0.5 (browser verification
pass) skipped: it drives Playwright, which runs only on an explicit ask.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit` (diff-scoped), `comment-noise-audit` (flag-only).

## Findings

- [x] 🟡 WARNING · filed EX-1020 · impl-review F1 + code-review · `src/lib/db/user-sessions.ts:15-19` · Payload `refresh()` writes the whole user doc back, so a refresh racing a deactivation/trash also restores `active`/`trashedAt` — the JOIN narrows the race, it does not close it; four places claimed "closed" — docs corrected to "narrows" (lessons, plan, plan-brief, `isSessionAlive` doc); the race-free own-slide (one `UPDATE users_sessions … WHERE EXISTS(active, untrashed)` + `jwtSign`, no write to `users`) is an auth refactor with its own review, posted on EX-1020
      test: no automated test — the window is the gap between two statements inside one refresh; an interleaving test would pin Payload internals, not our code
- [x] 🔵 OBSERVATION · dismissed · impl-review F5 + code-review · `src/lib/actions/session-refresh.ts:12` · setting the cookie in a Server Action re-renders the current route once a day — one refresh per device per day; the trade-off is now stated at the call site
- [x] 🔵 OBSERVATION · dismissed · impl-review F9 · `src/collections/users.ts:25` · `Secure` cookie under the E2E harness (http://127.0.0.1) unverified — Chromium treats loopback as a secure context and keeps `Secure` cookies on it; the next E2E run confirms it
- [x] 🔵 OBSERVATION · dropped · code-review · `src/collections/users.ts:40-41` · REST / `/admin` writes to `users` expire only the collection tag, not `user:<id>` — unreachable: `/admin` is unused and nothing in the app PATCHes `users` over REST; the 1 h backstop bounds it anyway
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/auth/get-current-user-jwt.ts:31-34` · a cache fill racing a lockout can store a stale "alive" — millisecond window, bounded by the 1 h backstop, ~5 users
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/collections/users.ts:25` · `Secure` cookie breaks `pnpm start` over a LAN IP on plain http; a `db:import` logs developers out within 1 h — dev-only; `pnpm dev` is not production, and a re-login after a restore is expected
- [x] dismissed · simplify (efficiency) · `src/components/auth/session-refresher.tsx` · a failed slide retries on every shell render — only while `refresh()` keeps failing, which is rare; the route-handler alternative was weighed in F5
- [x] dropped · simplify (efficiency) · `src/components/pwa/install-app-button.tsx:15` · `readPlatform` runs on every render — a `matchMedia` and a UA regex, negligible
- [x] dropped · simplify · `src/app/manifest.ts:16-17,24` · `purpose: 'any'` / `prefer_related_applications: false` restate defaults — explicit beside the maskable entry, not worth the churn
- [x] dismissed · reuse-scan · `src/components/pwa/install-app-button.tsx:17` · `matchMedia('(display-mode: standalone)')` beside `useMediaQuery` (`src/hooks/use-media-query.ts:7`) — not a match: that hook is false through hydration and subscribes; the platform is one read, and splitting it would spread the standalone check across a hook and `navigator.standalone`
- [x] dropped · reuse-scan · `src/lib/auth/session-refresh.ts:2` · a day in ms spelled again (private `DAY_MS` in `src/lib/queries/trash.ts:23`, literal in `src/lib/utils/days.ts:47`) — no shared constant exists to reuse; promoting one for three private uses is churn
- [x] dropped · reuse-scan · `src/components/pwa/install-app-button.tsx:54-57,80-89` · the outline/sm/w-fit install `Button` written twice (iOS trigger, prompt button) — they differ in icon, `disabled` and `onClick`; a wrapper would save three props
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
