# Review-gate ledger — pwa-push-notifications (EX-1040) · 2026-10-11

Scope: `14b36b922...HEAD` on `pwa-push-notifications` (Phases 1–3; Phase 4 blocked on EX-1042).
Step 0.5 verification pass skipped: every surface is gated off without the production-only VAPID
key, so localhost has nothing to exercise; the device checks live in `manual-checks.md`.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `src/lib/push/push-client.ts:45` · turning push on awaited `serviceWorker.ready`, which never settles without a registered worker — toggle spun forever; now fails fast via `getRegistration()`
      test: TDD · unit — `push-client.test.ts` „fails instead of waiting forever when no service worker is registered"
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/push/push-client.ts:42` · `subscribeThisDevice` had no spec (plan 3.1 half met)
      test: TDD · unit — granted → subscribe with key bytes + action with `{endpoint, keys}`; denied/dismissed → neither
- [x] 🟡 WARNING · fixed · impl-review · `src/__tests__/lib/push/push-client.test.ts:131` · browser-unsubscribe-before-action order unasserted (plan 3.2)
      test: TDD · unit — `invocationCallOrder` assertion
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `src/lib/push/push-client.ts:70` · open-time sync ignored the action result, toggle showed „on" for a device the server lacks
      test: TDD · unit — „reports the device off when the server refuses the registration"
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `public/sw.js:56` · `renotify: true` with an empty tag makes `showNotification` throw → nothing shown (iOS revokes such subscriptions); tag now defaults to `generic`
      test: no automated test · — service worker has no harness; covered by `manual-checks.md` § EX-1040 device checks
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `public/sw.js:88` · tap target accepted a cross-origin URL; `navigate`/`focus` failure left the tap doing nothing — now same-origin only, falls back to `openWindow`
      test: no automated test · — service worker has no harness; manual check „dotknięcie otwiera aplikację"
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `src/lib/push/send-push.ts:73` · a throwing gone-delete aborted the loop and returned 0 despite successful sends; no send timeout inside `after()`
      test: TDD · unit — „still counts the sends when forgetting a gone device fails"; timeout passed as `SEND_TIMEOUT_MS`
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/actions/push.ts:11` · no length limits on endpoint / keys — endpoint ≤ 2048, keys ≤ 256
      test: TDD · unit — oversized endpoint case in `push.test.ts`
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/nav/logout-button.tsx:39` · logout waited on the push unsubscribe with no ceiling — raced against 3 s
      test: no automated test · — a timer race on a best-effort side effect; the „never throws" spec covers the failure path
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/db/push-subscriptions.ts:8` · comment claimed the device moves when the new user turns push on; it moves on their first app open (open-time sync)
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/push/push-client.ts:72,96` · missing `TODO(EX-449) SENTRY-REQUIRED` markers; three helpers exported for no importer
- [x] 🔵 OBSERVATION · fixed · impl-review · `plan.md:93,119,189,219,246,269,271,465` · plan text drifted (migration `_2_`, `sendPushToUser(db, …): Promise<number>`, `sent` = accepted devices, bare-endpoint unsubscribe, `.db.test.ts`) + missing localhost `configured: false` manual check
- [x] 🔵 OBSERVATION · skipped · code-review · `src/lib/actions/push.ts:11` · no allowlist of push-service hosts — a hard-coded list can refuse a legitimate service; impact is a blind POST of an encrypted payload from a logged-in account
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/push/push-client.ts:17` · null `applicationServerKey` treated as foreign — our subscribe always passes a key and current browsers report it
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/migrations/20261011_2_add_push_subscriptions.ts` · preview DB needs the migration — known merge step (`pnpm db:migrate:preview`), carried in the close-out
- [x] 🟡 WARNING · fixed · suite · `src/__tests__/components/pwa/push-toggle.test.tsx:56,66,90` · flaky: the label flips when the store updates, before the transition re-enables the button; `findByRole` caught the disabled one (1 of 4 runs) — now `waitFor` on enabled
      test: test-driven-debugging · dom — the flake was the red; 5/5 green after
- [x] fixed · feature-first-structure · `src/lib/pwa/push-client.ts` → `src/lib/push/push-client.ts` · push client lived under `pwa/` beside install logic while its sender sits in `lib/push/`
- [x] fixed · module-cohesion-audit · `src/lib/pwa/read-platform.ts` · one-function file split from `install-state.ts`, its only sibling concern — folded back, file deleted
- [x] fixed · structure-scatter-audit · `push-toggle.tsx` / `install-app-button.tsx` · the same `useSyncExternalStore(noop, read, () => undefined)` copy-pasted — `useClientSnapshot`
- [x] fixed · code-review · `src/__tests__/lib/actions/push.test.ts:4` · spec imported the real `@payload-config` graph — mocked
- [x] fixed · code-review · `src/lib/push/send-push.ts:46` · global `setVapidDetails` mutation per call — per-call `vapidDetails` option
- [x] fixed · comment-noise-audit · `send-push.ts`, `api/test-push/route.ts:9`, `toggle-active.ts:75` · comments restating the code trimmed to their why
- [x] dismissed · comment-noise-audit · `public/sw.js:58` · comment inside an empty catch — required by `no-empty`, and says where control goes
- [x] dropped · code-review · `toggle-active.ts` / `trash-worker.ts` · repeated `deleteUserSessions` + `deletePushSubscriptions` pair — a helper's params equal its body, no win
- [x] dropped · code-review · `src/lib/env/schema.ts` · `.trim()` on VAPID keys for a pasted trailing newline — Vercel strips it; not worth the churn
- [x] dropped · code-review · `src/stores/push-subscription-store.ts` · store stays „subscribed" after an offline logout — the page is torn down by the redirect
- [x] dropped · code-review · `src/lib/pwa/install-state.ts` · `PlatformT` naming nit
- [x] dismissed · tailwind-v4-audit · — 0 findings
- [x] fixed · simplify · `src/lib/push/send-push.ts:15` · `tag: string` let an empty or over-32-char tag reach the push service — narrowed to `PushTagT = 'test'` (Phase 4 adds `'payout-pending'`); sw.js keeps its default as a guard for old payloads
- [x] fixed · simplify · `public/sw.js:79` · the `'generic'` tag default was written twice and its `renotify` reason sat 20 lines from the option — now once, at `showNotification`
- [x] fixed · simplify · `src/lib/push/push-client.ts:89` · nested try/catch around the browser unsubscribe — `.catch(logError)`, the shape `send-push.ts` already uses
- [x] skipped · simplify · `src/components/nav/logout-button.tsx:39` · altitude: move the 3 s limit into `unsubscribeThisDevice` so the toggle can't spin forever — but the toggle would then show „off" while a stalled browser unsubscribe may still hold the subscription; a spinner is honest, a wrong „off" is not. Logout keeps its own race
- [x] dropped · simplify · `src/lib/push/push-client.ts:45,48` · one `getActiveRegistration()` for both call sites / drop `ready` — the two paths need different things (`getSubscription` works on any registration, `subscribe` needs an active worker); a shared helper would make the read path wait on `ready` for nothing
- [x] dropped · simplify · `src/lib/push/push-client.ts:19` · `sameItems` for the key comparison — needs both arrays spread to fit its type, saves 3 lines
- [x] dropped · simplify · `src/lib/push/send-push.ts:47,50,73` · fold the language into the subscriptions join / batch the gone-deletes — one round-trip at most, inside `after()`
- [x] dropped · simplify · `src/components/nav/logout-button.tsx:41` · uncleared race timer — resolving a settled race is a no-op and the redirect tears the page down
- [x] dropped · simplify · `src/__tests__/components/pwa/push-toggle.test.tsx:56` · `expectEnabled` helper for three one-line `waitFor`s
- [x] dismissed · simplify · `src/lib/push/send-push.ts:78,83` · „duplicated" SENTRY marker — two different failures (one device refused vs the whole send aborted), one marker each per AGENTS.md
- [x] dismissed · simplify · `src/components/pwa/use-client-snapshot.ts` · placement — both consumers in one directory, so it stays beside them (AGENTS.md counts directories)

## Simplify pass

Ran /simplify (reuse / simplification / efficiency / altitude agents) over the gate-fix diff — 3 applied, 1 skipped, 5 dropped, 2 dismissed; each folded into ## Findings (tagged simplify). `primitive-reuse-scan` not run: the fix diff adds no markup.

## Tests & suite

- Touched specs (push-client, push-toggle, push actions, send-push, install-state, toggle-actions, nav) — 61/61 green, push-toggle 5/5 after the flake fix.
- `pnpm typecheck` — clean. `eslint` on touched files — clean.
- `pnpm build` + `pnpm test:integration` — green on the pre-gate tree (Phase 3).
- Full `pnpm test` — not run; asked.
