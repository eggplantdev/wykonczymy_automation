---
date: 2026-10-11T21:02:25+02:00
researcher: Claude (Opus 5.5)
git_commit: 14b36b922a6e4f0c9d344b2a128d7a17a827c659
branch: staging
repository: wykonczymy
topic: 'Web Push notifications + app icon badge for the installed PWA (EX-1040)'
tags: [research, codebase, pwa, push, service-worker, badge, notifications, env, isolation]
status: complete
last_updated: 2026-10-11
last_updated_by: Claude (Opus 5.5)
---

# Research: Web Push notifications + app icon badge for the installed PWA

**Date**: 2026-10-11T21:02:25+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 14b36b922
**Branch**: staging
**Repository**: wykonczymy

## Research Question

What does EX-1040 have to build on, and where does each piece hook in? The first trigger is a
worker being told that a wypłata awaits his confirmation. That status comes from
`worker-payout-confirmation` (EX-1042), which another session is building in parallel.

## Summary

- **Nothing push-related exists yet.** There is no `PushManager`, `setAppBadge`, `showNotification`,
  `web-push` or VAPID anywhere in `src/`, `public/` or `package.json`.
- **The PWA groundwork is already in place.** There is a registered service worker at scope `/`, a
  manifest, standalone and iOS detection, and an install button on the user's own
  `/pracownicy/[id]`.
- **The server side has a home for every piece:**
  - `sessionAction` handles subscribe and unsubscribe.
  - `after()` sends post-commit.
  - The raw-table migration pattern holds the subscription table.
  - The `serverSchema` field plus `superRefine` handles a production-only secret.
  - The `translate()` helpers and `selectUserLanguage` produce the push text in the worker's own
    language.

Five facts shape the plan more than the plumbing does:

1. **The VAPID key pair is the isolation gate, and it is enforced by the push service.** A
   subscription is bound to the public key it was made with (RFC 8292 §4.2). A push signed with
   another pair gets `403`: Apple returns `VapidPkHashMismatch`, FCM returns 403, and Mozilla may
   return 401. If the production pair lives only in Vercel Production, the prod subscriptions that
   every dump carries cannot be reached from a laptop or a preview. This is the same "the provider
   refuses, not our code" model as Sheets, Blob and SMTP. The corollary is that **401/403 must never
   delete a subscription**. Only 404/410 mean "gone". Otherwise a dev run against a dump would wipe
   production's subscriptions on the next import.
2. **The badge count only exists on iOS and desktop.** The Badging API is unsupported on Android
   Chrome; there the launcher shows a dot while an unread notification exists. On iOS the badge
   shows only once notification permission has been granted. So on Android, "badge = number of
   pending wypłaty" degrades to "a dot while the notification sits in the tray".
3. **The badge count and the trigger both depend on EX-1042's status column, which does not exist
   yet.** `transactions` has only `cancelled` and `settled`. Everything else can be built and
   test-pushed before EX-1042 lands: the table, subscribe, SW handlers, the sender and the lockout
   cleanup.
4. **A PAYOUT naming a worker does not mean there is a phone to push to.** In the local dump only
   7 of 38 EMPLOYEEs holding wypłaty have a live session. Also, 19 PAYOUTs are booked to
   MANAGER/OWNER accounts and 25 to inactive EMPLOYEEs. EX-1042's open question 2 ("who gets
   asked?") also decides who gets pushed. The real test at send time is "does a subscription row
   exist for an active, untrashed user?".
5. **Lockout must reach subscriptions.** A trashed or deactivated worker's phone must stop
   receiving pushes. Deleting rows on the lockout paths is not enough on its own, because
   `updateWorkerAction` can flip `active` without deleting sessions. So the sender must also filter
   on `active IS NOT FALSE AND trashed_at IS NULL`, mirroring `isSessionAlive`.

## Detailed Findings

### Client: service worker and registration

- `public/sw.js` handles navigations only, network-first, with no cache, and serves an inline
  pl/uk/ru offline page (`public/sw.js:7-25, 36-47`). On install it calls `skipWaiting()` (`:27`).
  On activate it enables `navigationPreload` and runs `clients.claim()` (`:30-34`). It has no
  `push`, `notificationclick` or `pushsubscriptionchange` handler, so these get added beside the
  `fetch` handler.
- Registration happens in `src/components/pwa/service-worker-registration.tsx:9-15`. It runs in
  production only, as `register('/sw.js', { scope: '/' })`, with no update check. It is mounted
  only in `src/app/(frontend)/layout.tsx:61`, which redirects users without a session. So **every
  logged-in role** registers it, and its `/` scope also controls `/zaloguj` and the share routes.
  - **Consequence for local work:** there is no SW in `next dev`. Testing push locally means
    lifting the production-only guard behind a flag, or running `next build && next start` over
    HTTPS. The Next guide uses `next dev --experimental-https`.
- `/sw.js` gets no special headers (`next.config.*` sets none). The Next PWA guide recommends
  `Cache-Control: no-cache` plus a CSP for it. This is optional: browsers re-check a top-level SW
  script against the network by default (`updateViaCache: 'imports'`).
- The proxy matcher (`src/proxy.ts:40`) already exempts `sw.js`, `manifest.webmanifest`, all
  `.png` files and everything under `/api`. A notification icon or badge PNG under `/icons/` needs
  no matcher change. A new extension under `public/` would need one (lessons.md:2579).

### Client: install state, gesture and badge sync

- The standalone check is `readPlatform` (`src/components/pwa/install-app-button.tsx:15-21`):
  `(display-mode: standalone)` or `navigator.standalone`, else iOS or browser. It is read with
  `useSyncExternalStore`, which is `undefined` on the server. iOS detection is in
  `src/lib/pwa/install-state.ts:31-32`. The `@custom-variant standalone` is in
  `src/styles/globals.css:13`.
- The install prompt store is `src/stores/install-prompt-store.ts:26-38`.
- The install button renders only on the user's own page:
  `src/app/(frontend)/pracownicy/[id]/page.tsx:139-145`
  (`{isOwnPage && <InstallAppButton />}`). This button row is the natural home for a "Włącz
  powiadomienia" button. On iOS it must render **only in standalone**, because Safari tabs get no
  push. `pushManager.subscribe` has to be called **directly in the click handler** (Apple), and
  never on load (Chrome's quiet-permission UI penalises that).
- The mobile menu footer (`src/components/nav/mobile-nav.tsx:129-147`) is a second candidate. It
  already uses the `workerPage` namespace (`:45`).
- For badge sync on app open, the shell already mounts small one-shot client hosts:
  `ReviewPromptHost` (`(frontend)/layout.tsx:108`) and `SessionRefresher`. `SessionRefresher` is
  daily-gated, so it is too rare for this. An `AppBadgeSync` would sit next to them and call
  `navigator.setAppBadge(n)` or `clearAppBadge()` with a server count. The same client mount is
  the place to re-check `pushManager.getSubscription()` and re-upsert it, because iOS has no
  `pushsubscriptionchange` and silently drops subscriptions (WebKit bug 273063).
- i18n: the catalogues are `src/lib/i18n/dictionaries/{pl,uk,ru}.ts`, and `uk`/`ru` are typed
  `typeof pl`, so a missing key fails typecheck. The install keys sit in `workerPage`
  (`pl.ts:100-106`).

### Server: env layer and the isolation gate

- A server secret is a `serverSchema` field (`src/lib/env/schema.ts:66`; every var is required and
  has no `.default()`). It is read through `serverEnv` (`env/server.ts`, which is `server-only`).
- A client-visible key takes **two edits**: one in `clientSchema` (`schema.ts:8-11`) and one as
  the static key in `env/index.ts:6-10`, because a wholesale `process.env` parse leaves vars
  undefined in the browser.
- The production-only precedent is `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON`. It is
  `.optional().refine(...)` (`schema.ts:105-114`) and required when
  `VERCEL_ENV === 'production'` in `superRefine` (`:132-151`), with the check keyed on
  `VERCEL_ENV`, never `NODE_ENV`. A `VAPID_PRIVATE_KEY` modelled the same way gives:
  - **On production, a missing key fails the boot.** Without the boot check, pushes would just
    stop silently.
  - **Outside production, the absence is the gate.** The sender is a no-op when the key is
    absent.
  - **A developer can still work on push**, using their own pair on localhost or a preview.
    Subscriptions made under that pair work there, and prod subscriptions from the dump are refused
    by the push service. This mirrors "no reverse refusal, on purpose" for the Sheets Editor
    (`context/reference/outgoing-effects-isolation.md:116-119`).
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` differs per environment, and the client subscribes with whatever
  key its build carries. Changing the production pair later invalidates every subscription. So the
  open-time re-check should compare `subscription.options.applicationServerKey` with the current key
  and resubscribe when they differ.
- The VAPID subject must be `mailto:` or `https:`. Apple rejects a localhost placeholder with
  `403 BadJwtToken`.
- `outgoing-effects-isolation.md` gets a new row: Web Push, gate **jest**, enforced by the VAPID
  pair. Its rule (`:121-125`) applies: the damage reaches people outside the developer's machine,
  namely real workers' phones.

### Server: subscription storage

- Raw-table pattern: `src/migrations/20261005_3_add_worker_expense_drafts.ts` uses
  `user_id ... REFERENCES users(id) ON DELETE CASCADE`, `CHECK` constraints and indexes, with
  `down()` as `DROP TABLE IF EXISTS`. It is registered by hand in `src/migrations/index.ts`
  (`:138` for the import, `:826-830` for the entry). The latest migration is
  `20261009_4_kosztorys_stages_completed.ts`. `push: false` (`payload.config.ts:75`) keeps Payload
  from dropping an unknown raw table.
- The proposed shape: `push_subscriptions(id, user_id FK CASCADE, endpoint text UNIQUE, p256dh,
auth, user_agent, created_at, last_seen_at)`. The unique `endpoint` makes subscribe an upsert
  that **reassigns** the device to the current user. That covers a phone shared between two
  workers, or a manager logging in on a worker's phone.
- The migration is additive and orderless: no live code reads it until the sender ships.
- `src/lib/db/push-subscriptions.ts` (statement + mapper) follows the `lib/db` rule. Subscribe and
  unsubscribe live in `src/lib/actions/push.ts` via `sessionAction`
  (`src/lib/actions/run-action.ts:88-95`). That action is open to every role and is scoped to
  `ctx.user`, never to a passed id.

### Server: lockout and logout

- `deleteUserSessions` (`src/lib/db/user-sessions.ts:12-14`) has three callers:
  - deactivate: `src/lib/actions/toggle-active.ts:75-78`
  - trash: `src/lib/workers/trash-worker.ts:43`
  - hard delete: `src/lib/workers/delete-worker-forever.ts:47`, which the FK cascade covers.
- Deactivate and trash should drop the account's subscriptions in the same place.
- `updateWorkerAction` (`src/lib/actions/workers.ts:43-61`) can change `active` or `role`
  without deleting sessions. `isSessionAlive` (`user-sessions.ts:26-44`) covers it per request.
  The sender needs the same account filter when it selects subscriptions (lessons.md:2502).
- Logout (`src/lib/actions/auth.ts:35-43`) knows the device only if the client sends its
  endpoint. So the logout button should call `pushManager.unsubscribe()` and send the endpoint
  before the session ends. An iOS home-screen app has its own cookie jar (lessons.md:2578), so its
  logout is independent of Safari's.

### Server: sending

- **Sibling senders.** These are the mail senders `lib/leads/notify.ts:88`, `lib/fleet/notify.ts:58`,
  `lib/equipment/notify.ts` and `lib/investments/review-request-email.ts`. A
  `src/lib/push/send-push.ts` with `sendPushToUser(userId, message)` fits beside them:
  - It selects the user's live subscriptions (with the account filter).
  - It sends with `web-push` 3.6.7 (`@types/web-push` 3.6.4). This needs the Node runtime, which
    server actions are on.
  - It deletes a subscription on 404/410, keeps it on 401/403, and logs through `logError` with
    `// TODO(EX-449) SENTRY-REQUIRED:` (convention: `review-request.ts:41-43`).
- **Payload.** It carries `{ title, body, url, badgeCount, tag }` as JSON, kept well under about
  3.9 KB. The text is composed server-side in the recipient's language via `translate(locale, ns,
key, params)` (`src/lib/i18n/translations.ts:36-60`). The locale comes from
  `selectUserLanguage(db, userId)` (`src/lib/db/user-language.ts:5-11`); empty means Polish.
  Never translate through the `lib/constants/transfers.ts` label maps.
- **SW handler.** `push` → `event.waitUntil(Promise.all([showNotification(title, { body, icon,
badge, tag, data: { url } }), self.navigator.setAppBadge?.(badgeCount)]))`. Every push must show
  a notification, because a silent push gets the subscription revoked on iOS. `badge` is the
  monochrome Android status-bar icon, which does not exist yet; `icon-192.png` is colour. `tag`
  collapses repeat notifications, and `renotify` needs a `tag`. `notificationclick` → close, then
  focus an existing client on `data.url` or `clients.openWindow(data.url)`.
- **Call sites for the PAYOUT trigger.** These are post-commit, inside the existing `after()`:
  - `settlePayoutsAction`: `src/lib/actions/settle-payouts.ts:37-125`, `after` at `:119`.
  - `createBulkTransferAction`: `src/lib/actions/transfers.ts:105-212`, `after` at `:206`. The
    transfer dialog's single PAYOUT goes through here.
  - `createTransferAction` (`transfers.ts:42-86`) does not restrict the type at the schema level.
    The plan should confirm whether a PAYOUT can arrive that way.
  - Per project rule, the push call goes in these actions, not in a new `afterChange` hook. The
    cleaner seam is wherever EX-1042 sets `status = 'pending'`: "a wypłata awaiting confirmation"
    is exactly the push condition, so one call there covers both booking paths.

### Badge count

- `fetchUnreadCounts` (`src/lib/queries/unread-counts.ts:23-40`) returns `NONE` for every
  non-management role (`:25`). It is uncached, and the shell reads it once per full load
  (`(frontend)/layout.tsx:78`, which feeds `UnreadCountsProvider` → `components/nav/unread-badge.tsx`).
- The worker count is a **queue stream**, like `countPendingReports`
  (`src/lib/db/worker-reports.ts:472`) or `countPendingExpenseDrafts`
  (`src/lib/db/worker-expense-drafts.ts:262`): `count(*)` of the worker's own non-cancelled PAYOUTs
  with `status = 'pending'`. It is not a read cursor (`notification_reads`,
  `src/lib/db/notifications.ts`). It goes to zero only by a decision.
- The same count feeds two places: `badgeCount` in every push payload, and the open-time
  `AppBadgeSync`. Sending the absolute number, never "+1", keeps the two from drifting.
- After the worker accepts or rejects in the app, the client re-sets the badge from the new count.

## Code References

- `public/sw.js:27-47` — the SW lifecycle and fetch handler; push handlers go here
- `src/components/pwa/service-worker-registration.tsx:9-15` — production-only registration at scope `/`
- `src/app/(frontend)/layout.tsx:61, 78, 84, 108` — SW mount, unread counts, shell hosts
- `src/components/pwa/install-app-button.tsx:15-27` — `readPlatform` standalone/iOS detection
- `src/lib/pwa/install-state.ts:13-32` — install state machine, iOS detection
- `src/app/(frontend)/pracownicy/[id]/page.tsx:139-145` — own-page button row (install button)
- `src/components/nav/mobile-nav.tsx:129-147` — mobile menu footer
- `src/proxy.ts:40` — matcher; `sw.js`, `.png`, `/api` exempt
- `src/lib/env/schema.ts:8-11, 66, 105-114, 132-151` — client schema, server schema, prod-only secret pattern
- `src/lib/env/index.ts:6-10` — static client env keys
- `src/lib/actions/run-action.ts:75-95` — `protectedAction` / `sessionAction`
- `src/lib/actions/settle-payouts.ts:95-119` — PAYOUT create + `after()`
- `src/lib/actions/transfers.ts:105-212` — bulk booking + `after()`
- `src/lib/db/user-sessions.ts:12-44` — `deleteUserSessions`, `isSessionAlive` account filter
- `src/lib/actions/toggle-active.ts:75-78`, `src/lib/workers/trash-worker.ts:43` — lockout paths
- `src/lib/actions/auth.ts:35-43` — logout
- `src/lib/queries/unread-counts.ts:23-40` — management-only counts
- `src/lib/i18n/translations.ts:36-60`, `src/lib/db/user-language.ts:5-11` — server-side translation + locale
- `src/migrations/20261005_3_add_worker_expense_drafts.ts` — raw-table migration template
- `context/reference/outgoing-effects-isolation.md` — gate table to extend

## Architecture Insights

- **This is the Observer pattern across a process boundary.** The browser _subscribes_: it hands
  the server an endpoint plus keys. The server _notifies_ without knowing anything about the
  device. The push service (FCM, APNs, Mozilla autopush) is the broker. The design rule follows
  from that: the server holds no device state beyond the subscription row, and the payload carries
  the **absolute** state (the badge count), because the SW has no reliable memory between pushes.
  Compare with a pub/sub queue, where the consumer keeps an offset. Here the "consumer" may be
  asleep for weeks, so idempotent absolute state beats deltas.
- **This is a credential gate, not a flag.** That keeps the repo's isolation doctrine consistent:
  Sheets uses two service accounts, Blob uses a store-bound token, SMTP uses `disabled.invalid`,
  and push uses a key-bound subscription. Each is refused by the provider, off-machine.
- **Generic sender, specific triggers.** These events would all reuse
  `sendPushToUser(userId, message)` later: report accepted/rejected
  (`accept-worker-report.ts:58, 86`), expense draft decided (`decideExpenseDraft`,
  `worker-expense-drafts.ts:342`; `rejectExpenseDraftAction` `:114`), and equipment handed over
  (`equipment.ts:40, 102`). Only the wypłata trigger is in scope now.

## Historical Context (from prior changes)

- `context/archive/2026-10-07-worker-pwa-install-and-long-session/change.md:14` — the install
  button, iOS guide and 90-day sliding token. Workers open the app every 2–4 weeks. Push is not
  mentioned and nothing was deferred.
- `context/foundation/lessons.md:2575-2580` — the home-screen install is its own client. Assets
  bypass the cookie gate, and on iOS the installed app starts logged out (owner ruling: don't
  "fix" it).
- `context/foundation/lessons.md:2495-2503` — lockout writes must expire `CACHE_TAGS.users`, and a
  session row can outlive its lockout, so readers join the account state.
- `context/archive/2026-09-30-worker-work-reports/change.md:40` — EX-947 ruled "notification = an
  in-app badge only … no mail" for worker reports. That was management-side, but it is the only
  prior ruling on how workers' events are announced.
- `context/changes/2026-10-11-worker-payout-confirmation/research.md:150-162, 205-220` — the
  proposed status columns for EX-1042 and its open owner questions. Q2 ("who gets asked?") is
  also the push recipient rule.

## Related Research

- `context/changes/2026-10-11-worker-payout-confirmation/research.md` — EX-1042 (blocks this change)

## Decisions (user, 2026-10-11)

1. **Build the push infrastructure now**, test-pushed by hand. The wypłata trigger and the badge
   count are wired once EX-1042's status column exists.
2. **Every role may subscribe.** The sender is role-agnostic.
3. **Android's dot is accepted.** No number on Android.
4. **The enable button is on the own `/pracownicy/[id]` and in the mobile menu.**
5. **Generate a monochrome `badge` PNG** for the Android status bar.
6. **VAPID keys exist in Vercel Production only.** There is no dev pair: localhost, preview and
   the E2E DB carry neither key, so subscribe is unavailable there and the sender is a no-op. The
   public key is absent too, so the enable button does not render outside production. The
   production pair must never go into `.env`. Doing so would turn every dump's subscriptions into
   real pushes from a laptop. **Consequence: push is verifiable on production only.** Everything up
   to `sendNotification` is covered by unit specs with `web-push` mocked.

## Open Questions

> All six are answered under **Decisions**.

1. **Sequencing against EX-1042.** Build the push infrastructure now, test-pushed by hand: the
   table, subscribe button, SW handlers, sender, lockout cleanup and env gate. Then wire the
   trigger and the badge count once EX-1042's status column exists. Or wait for EX-1042 to land
   first?
2. **Who may subscribe.** EMPLOYEE only, or every role? Management would gain from push later
   (a worker sent a report or a draft), and the sender is role-agnostic.
3. **Android's badge is a dot, not a number.** Accept it, or does the owner expect a number on
   Android, where it is not possible?
4. **Where the enable button lives.** The own `/pracownicy/[id]` next to „Zainstaluj aplikację"
   only, or also the mobile menu? On iOS it can appear only inside the installed app.
5. **A `badge` icon** (monochrome PNG for the Android status bar) does not exist. Generate one from
   `public/wykonczymy-app-icon.png`, or skip it (Chrome then shows a generic icon)?
6. **Local and preview testing.** Give each a dev VAPID pair in `.env` / Vercel Preview, so push
   is testable there against subscriptions made there? Or production-only, with the sender a pure
   no-op elsewhere?
