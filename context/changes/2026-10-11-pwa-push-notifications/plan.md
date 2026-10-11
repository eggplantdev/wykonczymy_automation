# PWA Push Notifications Implementation Plan

## Overview

Add Web Push notifications and an app-icon badge to the installed PWA (EX-1040). Phases 1–3 build the
whole pipeline: storage, a production-only key gate, the sender, the service-worker handlers and an
on/off toggle. An ADMIN can test it end to end on production with a self-push. Phase 4 wires the first
real trigger, "a wypłata awaits your confirmation", plus the badge count. That trigger is **blocked on
EX-1042** (`worker-payout-confirmation`), because both read the wypłata status column that change
introduces.

## Current State Analysis

- Nothing push-related exists: no `PushManager`, `setAppBadge`, `showNotification`, `web-push` or VAPID
  anywhere in `src/`, `public/` or `package.json`.
- The PWA groundwork is in place:
  - `public/sw.js` is registered at scope `/` in production only
    (`src/components/pwa/service-worker-registration.tsx:9-15`, mounted at `(frontend)/layout.tsx:61`).
  - The manifest is `src/app/manifest.ts`, with icons in `public/icons/`.
  - Standalone and iOS detection is `readPlatform` (`src/components/pwa/install-app-button.tsx:15-21`).
  - The install button sits on the own `/pracownicy/[id]` (`page.tsx:139-145`).
- The server patterns exist and are reused:
  - `sessionAction` (`src/lib/actions/run-action.ts:88-95`)
  - raw-table migrations (`src/migrations/20261005_3_add_worker_expense_drafts.ts`)
  - the production-only secret (`GOOGLE_SERVICE_ACCOUNT_WRITE_JSON`, `src/lib/env/schema.ts:105-114, 132-151`)
  - `translate()` + `selectUserLanguage`
  - `logError` + `// TODO(EX-449) SENTRY-REQUIRED:`
- `transactions` has no wypłata status yet. EX-1042 adds it. Until it lands, nothing can count
  "pending wypłaty" and nothing can fire the trigger.

## Desired End State

- An ADMIN, OWNER, MANAGER or EMPLOYEE on the installed production app turns „Powiadomienia" on from
  their own `/pracownicy/[id]` or from the mobile menu.
  - The device's subscription is stored against their account.
  - Turning it off, logging out, being deactivated or being trashed removes it.
- On production, an ADMIN opening `/api/test-push` gets a real notification on every device they have
  subscribed.
- Outside production (localhost, preview, the E2E DB), the toggle does not render and the sender does
  nothing. Prod subscriptions carried by a dump are unreachable, because the push service refuses any
  other key pair.
- After Phase 4: when a wypłata is booked that awaits a worker's confirmation, the worker gets a push in
  their own language. The app icon shows the number of wypłaty awaiting confirmation (iOS, desktop) or
  a dot (Android). The badge is re-synced every time the app opens.

### Key Discoveries:

- **The VAPID pair is the isolation gate, and the push service enforces it.** A subscription is bound to
  the public key it was created with (RFC 8292 §4.2). A push signed with any other pair gets a 403
  (Apple: `VapidPkHashMismatch`; FCM: 403; Mozilla: possibly 401). With the keys only in Vercel
  Production, a laptop cannot reach a dumped subscription. Hence **delete only on 404/410, never on
  401/403**: otherwise a run against a dump would wipe production's subscriptions on the next import.
- `isSessionAlive` (`src/lib/db/user-sessions.ts:26-44`) filters on
  `active IS NOT FALSE AND trashed_at IS NULL`. The sender needs the same filter, because
  `updateWorkerAction` (`lib/actions/workers.ts:43-61`) flips `active` without deleting sessions or
  subscriptions.
- `deleteUserSessions` must run after any `payload.update` of the same user (`user-sessions.ts:5-11`).
  Subscription deletes are raw SQL on another table, so the ordering does not apply to them. They sit
  next to the session delete only for locality.
- A client-visible key takes two edits: `clientSchema` (`schema.ts:8-11`) and the static key in
  `env/index.ts:6-10`.
- `proxy.ts:40` already exempts `sw.js`, `.png` and `/api`, so neither the badge PNG nor the test route
  needs a matcher change.
- Every iOS push must show a notification, or the subscription gets revoked. iOS also has no
  `pushsubscriptionchange` event and silently drops subscriptions (WebKit 273063). The client therefore
  re-checks on every app open.
- `pushManager.subscribe` must be called directly inside the click handler: Apple requires a user
  gesture, and Chrome's quiet-permission UI penalises a call on page load.

## What We're NOT Doing

- No dev or preview VAPID pair, and no local push testing. Push is verifiable on production only.
  Everything up to `sendNotification` is covered by unit specs with `web-push` mocked.
- No other triggers: report accepted/rejected, expense draft decided and equipment handed over are all
  out. The sender is generic, so each later trigger is one call.
- No per-event preferences and no quiet hours. There is a single on/off switch per device.
- No numeric badge on Android (no Badging API; the launcher shows a dot). This is accepted.
- No automatic re-subscribe when the stored key differs or the subscription vanished. The toggle shows
  "off" and the user turns it on again. A silent `subscribe` without a gesture fails on iOS.
- No `Cache-Control` or CSP headers for `/sw.js`.
- Nothing in EX-1042's files: the status column, the confirmation UI, `accept-worker-report.ts`,
  `worker-gate.ts` and `kosztorys.ts` all belong to the other change.
- No E2E. Playwright cannot receive a real push, and the browser-level risk (permission prompt,
  delivery) is production-only. The toggle's states are covered at the DOM layer.

## Implementation Approach

The work follows the data flow: table → gate → sender → client.

- The keys are optional in the env schema and required only when `VERCEL_ENV === 'production'`. Their
  absence anywhere else **is** the gate. The sender no-ops without the private key, and the toggle does
  not render without the public key.
- One generic `sendPushToUser(userId, build)` resolves the recipient's language, selects their live
  subscriptions and sends to each one. Each failure is classified independently.
- The ADMIN self-push route replaces the "admin-only script" answer. A laptop script would need the
  production private key on the laptop, which the prod-only decision forbids. A route running on
  production keeps the key in Vercel and mirrors `/api/test-email`.
- The trigger goes in a server action at EX-1042's pending seam, not in a Payload hook (project rule).

## Critical Implementation Details

- **Logout ordering.** The client must `getSubscription()` → `unsubscribe()` → call
  `unsubscribePushAction(endpoint)` **before** `logoutAction`, because the delete action needs a live
  session. A failure in any push step must not block the logout: log it and continue.
- **Payload size.** Keep the JSON payload well under ~3.9 KB (the encrypted limit is 4096 B). It carries
  only `{ title, body, url, tag, badgeCount? }`.

## Phase 1: Data + env gate

### Overview

Add the subscription table, its data-access helpers, the production-only key pair and the `web-push`
dependency. No behaviour changes yet.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20261011_1_add_push_subscriptions.ts` (+ register in `src/migrations/index.ts`)

**Intent**: Store one row per subscribed device, owned by one user, removed when the user is hard-deleted.

**Contract**: The table `push_subscriptions`:

| Column         | Type        | Constraint                                       |
| -------------- | ----------- | ------------------------------------------------ |
| `id`           | serial      | PK                                               |
| `user_id`      | int         | NOT NULL, REFERENCES users(id) ON DELETE CASCADE |
| `endpoint`     | text        | NOT NULL UNIQUE                                  |
| `p256dh`       | text        | NOT NULL                                         |
| `auth`         | text        | NOT NULL                                         |
| `user_agent`   | text        | NULL                                             |
| `created_at`   | timestamptz | NOT NULL DEFAULT now()                           |
| `last_seen_at` | timestamptz | NOT NULL DEFAULT now()                           |

It also gets an index on `user_id`. `down()` is `DROP TABLE IF EXISTS`. Hand-write it from the
template; it is additive, so it migrates to prod before deploy.

#### 2. Data access

**File**: `src/lib/db/push-subscriptions.ts`

**Intent**: Hold one statement plus its mapper per operation, following the `lib/db` rule.

**Contract**:

- `upsertPushSubscription(db, userId, { endpoint, p256dh, auth, userAgent })`
  - `INSERT … ON CONFLICT (endpoint) DO UPDATE` sets `user_id`, the keys, `user_agent` and
    `last_seen_at = now()`.
  - A shared phone moves to whoever enabled it last.
- `deletePushSubscription(db, userId, endpoint)`: scoped to both columns.
- `deletePushSubscriptions(db, userId)`: all of the user's devices.
- `deletePushSubscriptionByEndpoint(db, endpoint)`: used by the sender on 404/410.
- `selectLivePushSubscriptions(db, userId)`: joins `users` with
  `active IS NOT FALSE AND trashed_at IS NULL`.

#### 3. Env

**Files**: `src/lib/env/schema.ts`, `src/lib/env/index.ts`, `.env.example` (if it lists vars)

**Intent**: Make the key pair exist on production only, and fail production's boot if either half is
missing.

**Contract**:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` goes in `clientSchema` (`.optional()`) and in the static key list.
- `VAPID_PRIVATE_KEY` goes in `serverSchema` (`.optional()`).
- `superRefine` requires both when `VERCEL_ENV === 'production'`, mirroring
  `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON`.
- The VAPID subject is `NEXT_PUBLIC_FRONTEND_URL` (an `https:` URL on production), so no third var is
  needed.

#### 4. Dependency

**File**: `package.json`

**Intent**: Add `web-push` (3.6.7) and `@types/web-push` (3.6.4) by hand-editing, then run
`pnpm install`. Check that `node_modules/lightningcss-darwin-arm64` survives
(`context/foundation/lessons.md`).

**Contract**: Dependency entries only.

### Success Criteria:

#### Automated Verification:

- Migration applies to the local DB: `pnpm payload migrate` (after `git status src/migrations` shows only this change's file as new)
- Env spec covers the gate: `pnpm exec vitest run src/__tests__/lib/env/schema.test.ts`. Production without either key fails. Non-production without both passes.
- Data-access spec: `pnpm exec vitest run src/__tests__/lib/db/push-subscriptions.test.ts`. It covers the upsert reassigning the endpoint to another user and the live select excluding inactive and trashed accounts.

#### Manual Verification:

- After a human runs `pnpm db:migrate:prod`, `\d push_subscriptions` on prod shows the table. Owed only when the change ships.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Sender + server actions + lockout

### Overview

Add the server half: send, subscribe and unsubscribe; cleanup on lockout; the ADMIN test route; and the
isolation doc row.

### Changes Required:

#### 1. Sender

**File**: `src/lib/push/send-push.ts`

**Intent**: Send one message to every live device of one user, in that user's language, and keep the
table honest without ever deleting on an auth refusal.

**Contract**:

```ts
type PushMessageT = { title: string; body: string; url: string; tag: string; badgeCount?: number }
sendPushToUser(userId: number, build: (locale: LanguageT) => PushMessageT): Promise<void>
```

- With no `VAPID_PRIVATE_KEY` or no public key, return immediately.
- Otherwise:
  - Call `setVapidDetails(FRONTEND_URL, pub, priv)`.
  - Resolve the locale with `selectUserLanguage` (`null` → `'pl'`).
  - For each live subscription, call `sendNotification(sub, JSON.stringify(msg), { TTL: 86400, urgency: 'high', topic: tag })`.
- Error handling per subscription:
  - `statusCode` 404 or 410 → `deletePushSubscriptionByEndpoint`.
  - Any other status → `logError` with `// TODO(EX-449) SENTRY-REQUIRED:`; keep the row.
- The function never throws to its caller, because it runs inside `after()`.

`topic` must be ≤32 URL-safe characters. Keep `tag` values short (`payout-pending`).

#### 2. Subscribe and unsubscribe actions

**File**: `src/lib/actions/push.ts`

**Intent**: Let any logged-in role register or remove _this device_, always scoped to `ctx.user`.

**Contract**:

- `subscribePushAction({ endpoint, keys: { p256dh, auth } })` → `sessionAction`.
  - zod validates: `endpoint` is an `https:` URL, and the keys are non-empty strings.
  - `userAgent` comes from `headers()`.
  - The action calls `upsertPushSubscription`.
- `unsubscribePushAction({ endpoint })` → `sessionAction` → `deletePushSubscription(ctx.user.id, endpoint)`.
- Neither revalidates a cache tag: no cached reader exists.

#### 3. Lockout cleanup

**Files**: `src/lib/actions/toggle-active.ts:75-78`, `src/lib/workers/trash-worker.ts:43`

**Intent**: A locked-out account's phones stop receiving pushes at once. The sender's account filter
covers `updateWorkerAction`, and the FK cascade covers the hard delete.

**Contract**: Call `deletePushSubscriptions(db, id)` beside each `deleteUserSessions` call.

#### 4. ADMIN self-push route

**File**: `src/app/(frontend)/api/test-push/route.ts`

**Intent**: Run a production end-to-end check without the private key ever leaving Vercel. This
implements the "admin-only script" decision.

**Contract**:

- `GET`, ADMIN-only via `getCurrentUserJwt()`; anyone else gets 401. This mirrors
  `api/test-email/route.ts`.
- It calls `sendPushToUser(admin.id, …)` with a translated test title and body, `url: '/'` and
  `tag: 'test'`, and no `badgeCount`.
- It returns `{ sent: <live subscription count>, configured: <bool> }`, so a 0 or a missing key is
  visible instead of silent.
- No `userId` parameter. It only ever pushes to the caller.

#### 5. Isolation doc

**File**: `context/reference/outgoing-effects-isolation.md`

**Intent**: Record the new outgoing effect and its gate.

**Contract**:

- A `Web Push | **jest** | …` row in the table.
- A short `## Web Push` section: the key-bound subscription, keys only in Production, never in `.env`,
  delete only on 404/410, and why there is no reverse refusal (no dev pair exists, and putting the
  prod pair in `.env` is a deliberate act).
- Written in Polish, like the rest of the doc.

### Success Criteria:

#### Automated Verification:

- Sender spec with `web-push` mocked: `pnpm exec vitest run src/__tests__/lib/push/send-push.test.ts`. It covers:
  - the no-op without keys
  - a 410 deleting the row
  - a 403 and a 401 keeping it
  - one failing device not stopping the others
  - text built in the user's language
- Action spec: `pnpm exec vitest run src/__tests__/lib/actions/push.test.ts`. It covers the scoping to `ctx.user` (another user's endpoint is never deleted) and the rejection of a non-https endpoint.
- Lockout specs extended: `src/__tests__/lib/actions/toggle-active.db.test.ts` and `src/__tests__/lib/actions/worker-trash.db.test.ts` (run via `pnpm test:integration` discovery, or `DB_POSTGRES_URL=$DB_POSTGRES_URL_TEST pnpm exec vitest run <file>`). Deactivation and trashing leave zero rows in `push_subscriptions` for that user (persisted state, not the return value).

#### Manual Verification:

- On production, an ADMIN with a subscribed device opens `/api/test-push` and receives „Powiadomienie testowe"; the JSON shows `sent ≥ 1`.
- On localhost, `/api/test-push` returns `configured: false` and sends nothing.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Service worker + client toggle

### Overview

Show the notification, open the right page on tap, give every role an on/off switch in two places,
re-check on app open and unsubscribe on logout.

### Changes Required:

#### 1. Service worker handlers

**File**: `public/sw.js`

**Intent**: Every push shows a notification (an iOS requirement), and a tap focuses or opens the target
URL.

**Contract**:

- `push` handler: `event.waitUntil(Promise.all([showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', tag, renotify: true, data: { url } }), badgeCount is a number ? navigator.setAppBadge?.(badgeCount) : undefined]))`.
  - `badgeCount === 0` → `clearAppBadge?.()`.
  - A payload that fails to parse still shows a generic notification.
- `notificationclick` handler: close the notification, then focus an existing same-origin client
  navigated to `data.url`, else `clients.openWindow(data.url)`.
- No `pushsubscriptionchange` handler. Re-subscribing there would need the public key inside the SW,
  and the open-time check covers it.

#### 2. Badge icon

**File**: `public/icons/badge-96.png`

**Intent**: Provide Android's monochrome status-bar icon.

**Contract**: 96×96, white silhouette of the app mark on a transparent background, generated once from
`public/icons/icon-512.png` with `magick` (or `sharp`). Committed as a static asset.

#### 3. Push toggle

**File**: `src/components/pwa/push-toggle.tsx`

**Intent**: Provide one switch with honest states, rendered only where push can work.

**Contract**:

- It renders nothing when:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is absent;
  - `'PushManager' in window` is false;
  - the platform is iOS but not standalone (`readPlatform`).
- States:
  - **off**: no subscription.
  - **on**: a subscription exists.
  - **blocked**: `Notification.permission === 'denied'`. Show a disabled control with a hint to change
    it in system settings.
- Turning it on: directly in the click handler, call
  `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, then `subscribePushAction`.
- Turning it off: call `unsubscribe()`, then `unsubscribePushAction`.
- Feedback uses the existing toast and notice helpers.
- Strings live in the `workerPage` namespace, beside the install keys.
- Placement:
  - `pracownicy/[id]/page.tsx`, next to `{isOwnPage && <InstallAppButton />}`;
  - `components/nav/mobile-nav.tsx` footer, before `LogoutButton`.
- `readPlatform`, if reused, moves to `src/lib/pwa/` or `src/components/pwa/` as a shared export
  (two consumers in one directory are still colocated).

#### 4. Open-time re-check

**File**: `src/components/pwa/push-subscription-sync.tsx` (mounted in `(frontend)/layout.tsx` beside `ReviewPromptHost`)

**Intent**: Keep the server's row alive and owned by the current user, because iOS drops subscriptions
silently.

**Contract**:

- It runs once per mount, only when the public key is present, permission is `granted` and the SW is
  ready.
- When `getSubscription()` returns a subscription whose `options.applicationServerKey` matches the
  current key → `subscribePushAction(sub)`. The upsert touches `last_seen_at` and reassigns the owner.
- On a mismatch → `unsubscribe()` and nothing more; the toggle then shows off.
- It renders null.

#### 5. Logout unsubscribes

**File**: `src/components/nav/logout-button.tsx`

**Intent**: A logged-out device must not keep receiving the previous user's pushes.

**Contract**:

- Before `settleAction(logoutAction)`: run the best-effort `getSubscription()` → `unsubscribe()` →
  `unsubscribePushAction(endpoint)`.
- Every failure is caught and logged, and never blocks the logout.
- A small helper in `src/lib/pwa/push-client.ts` is shared with the toggle's off path.

#### 6. Translations

**Files**: `src/lib/i18n/dictionaries/{pl,uk,ru}.ts`

**Intent**: Provide the toggle's labels and states, the blocked hint, and the test-push title and body,
in all three languages. `uk`/`ru` are typed `typeof pl`, so the typecheck enforces completeness.

**Contract**: New keys in `workerPage`.

### Success Criteria:

#### Automated Verification:

- Toggle DOM spec: `pnpm exec vitest run src/__tests__/components/pwa/push-toggle.test.tsx`. It covers:
  - hidden without a key and on iOS-not-standalone;
  - the off → on path calling `subscribe` and the (mocked) action;
  - the blocked state rendered disabled.
- Push-client helper spec: `pnpm exec vitest run src/__tests__/lib/pwa/push-client.test.ts`. It covers the unsubscribe-then-action order and a throwing `unsubscribe()` still resolving.

#### Manual Verification:

- Production, Android Chrome installed app:
  - Turn the toggle on from the mobile menu, then hit `/api/test-push` as ADMIN → the notification shows with the monochrome status-bar icon.
  - Tapping it opens the app.
- Production, iPhone home-screen app (iOS 16.4+):
  - The toggle is visible in the app and absent in a Safari tab.
  - Turn it on → the permission prompt appears → the test push arrives.
- Log out on the phone, then hit `/api/test-push` → no notification on that phone.
- The toggle at 390px on `/pracownicy/[id]` (own page) and in the mobile menu: no layout break.
- On localhost and preview, the toggle is not rendered anywhere.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Wypłata trigger + badge count (BLOCKED on EX-1042)

### Overview

Push the worker when a wypłata awaits their confirmation, and keep the icon badge equal to the number
of wypłaty awaiting it. **Start only once EX-1042's status column and its pending seam are merged.**
Re-read that change's plan first. The names below are placeholders for whatever it ships.

### Changes Required:

#### 1. Pending count

**File**: `src/lib/db/` (beside EX-1042's status helpers, or `push-subscriptions.ts` if none fit)

**Intent**: Count one queue stream, like `countPendingReports`.

**Contract**: `countPendingPayouts(db, workerId): Promise<number>` returns the `count(*)` of the
worker's own non-cancelled PAYOUTs whose status is EX-1042's "pending".

#### 2. Trigger

**File**: wherever EX-1042 sets a wypłata to pending (a server action, inside its existing post-commit `after()`)

**Intent**: Fire one push per affected worker per booking, carrying the absolute badge count.

**Contract**:

- `sendPushToUser(workerId, (locale) => ({ title, body, url, tag: 'payout-pending', badgeCount }))`.
  - `title` and `body` are translated and include the amount.
  - `url` is the worker's confirmation screen per EX-1042.
  - `badgeCount` is `countPendingPayouts` taken after commit.
- One call per distinct worker in a bulk booking.
- Recipient rule: EX-1042's answer to "who gets asked". The account filter in the sender drops
  inactive and trashed accounts on its own.

#### 3. Badge sync

**Files**: `src/components/pwa/push-subscription-sync.tsx` (extend), a `'use server'` read in `src/lib/queries/pending-payouts.ts`

**Intent**: Make the icon right after every open, and after the worker confirms in the app.

**Contract**:

- On mount, when `'setAppBadge' in navigator`, call the read, then `setAppBadge(n)` or
  `clearAppBadge()` for 0.
- EX-1042's confirm/reject client path re-runs the same sync.
- The read is scoped to the session user. It returns 0 for a role with nothing to confirm.

### Success Criteria:

#### Automated Verification:

- Count spec: `pnpm exec vitest run src/__tests__/lib/db/<count-file>.test.ts`. A pending wypłata counts; a cancelled one and an accepted one do not.
- Trigger spec: the EX-1042 action's spec extended with `sendPushToUser` mocked. A booking of two wypłaty for one worker sends one push with `badgeCount: 2`. A booking for two workers sends two.

#### Manual Verification:

- Production, iPhone home-screen app with notifications on:
  - A manager books a wypłata for that worker → a push arrives and the icon shows 1.
  - After the worker confirms in the app → the icon clears.
- Production, Android: the push arrives and the launcher shows a dot while the notification sits in the tray.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit Tests:

- **Sender:** the gate no-op, the 404/410 vs 401/403 classification, per-device isolation of failures,
  locale resolution.
- **Data access:** endpoint reassignment on upsert; the live-account filter.
- **Actions:** `ctx.user` scoping; endpoint validation; lockout leaves zero rows.
- **Env:** production requires both keys; elsewhere both are optional.

### Integration Tests:

The `lib/db` specs run against the 5435 test DB through `pnpm test:integration`'s discovery. They
create their own users and clean up after themselves (shared-DB rules).

### Manual Testing Steps:

The steps are listed per phase. All real delivery checks are production-only, by decision. They need
the prod migration and the keys in Vercel Production first.

## Performance Considerations

- The sender runs in `after()`, so a booking never waits on a push service.
- At about 40 accounts with a few devices each, sequential sends per user are fine. A bulk booking for
  N workers is N independent sends in a `Promise.allSettled`.

## Migration Notes

- The migration is additive and unread until Phase 2's code ships.
- A human runs `pnpm db:migrate:prod` before the push that deploys it, then adds both keys to Vercel
  Production. Generate them with `pnpm exec web-push generate-vapid-keys`, on a machine where they are
  pasted straight into Vercel, never into `.env`.
- Because of `superRefine`, the production deploy fails its boot if the keys are added after the code.
  So the keys go in first.

## Whole-tree Gate

Run **once**, after the final phase (and once after Phase 3, since Phase 4 is blocked and may land in a
later session):

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Integration specs pass: `pnpm test:integration`
- Build succeeds: `pnpm build`

## References

- Research: `context/changes/2026-10-11-pwa-push-notifications/research.md`
- Blocking change: `context/changes/2026-10-11-worker-payout-confirmation/` (EX-1042)
- Admin-only route precedent: `src/app/(frontend)/api/test-email/route.ts`
- Prod-only secret precedent: `src/lib/env/schema.ts:105-114, 132-151`
- Account filter precedent: `src/lib/db/user-sessions.ts:26-44`
- Isolation doctrine: `context/reference/outgoing-effects-isolation.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data + env gate

#### Automated

- [x] 1.1 Migration applies to the local DB — e87180242
- [x] 1.2 Env spec covers the gate — e87180242
- [x] 1.3 Data-access spec — e87180242

### Phase 2: Sender + server actions + lockout

#### Automated

- [x] 2.1 Sender spec with `web-push` mocked — a0f487593
- [x] 2.2 Action spec — a0f487593
- [x] 2.3 Lockout specs extended — a0f487593

### Phase 3: Service worker + client toggle

#### Automated

- [x] 3.1 Toggle DOM spec
- [x] 3.2 Push-client helper spec

### Phase 4: Wypłata trigger + badge count (BLOCKED on EX-1042)

#### Automated

- [ ] 4.1 Count spec
- [ ] 4.2 Trigger spec
