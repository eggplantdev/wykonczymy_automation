# PWA Push Notifications — Plan Brief

> Full plan: `context/changes/2026-10-11-pwa-push-notifications/plan.md`
> Research: `context/changes/2026-10-11-pwa-push-notifications/research.md`

## What & Why

The installed app should be able to tell a person that something needs them, even when the app is
closed. It does this with a phone notification and a number on the app icon. The first case is a
worker being told that a wypłata awaits their confirmation (EX-1042). The pipeline is generic, so later
events become one call each.

## Starting Point

The PWA is installable: it has a service worker at `/`, a manifest, iOS/standalone detection and an
install button on the user's own page. Nothing push-related exists. The wypłata status that the
trigger and the badge count depend on arrives with EX-1042, which another agent is building in parallel.

## Desired End State

Any role can switch „Powiadomienia" on or off for their device on the installed production app, from
their own page or from the mobile menu. An ADMIN can test delivery on production with a self-push.
Once EX-1042 lands, a worker gets a push in their own language when a wypłata awaits them, and the icon
shows how many are waiting: a number on iOS and desktop, a dot on Android.

## Key Decisions Made

| Decision          | Choice                                                                                   | Why                                                                                              | Source   |
| ----------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| Scope now         | Build the infra now; trigger and badge come last, blocked on EX-1042                     | Everything except the count can be built and tested without the status column                    | Research |
| Who may subscribe | Every role                                                                               | The sender is role-agnostic; later triggers target management too                                | Research |
| Android badge     | Dot only                                                                                 | No Badging API on Android                                                                        | Research |
| Toggle placement  | Own `/pracownicy/[id]` + mobile menu                                                     | This is where workers open the app on site                                                       | Research |
| Status-bar icon   | Generate a monochrome `badge-96.png`                                                     | Android masks colour icons to a blob                                                             | Research |
| Key isolation     | VAPID pair in Vercel Production only, no dev pair                                        | The push service refuses any other key, so a dump's subscriptions are unreachable off production | Research |
| Self-test         | ADMIN-only `/api/test-push` on production (self-push)                                    | An "admin script" would need the prod key on a laptop                                            | Plan     |
| Turning it off    | An in-app toggle that unsubscribes the device and deletes its row                        | One honest state per device                                                                      | Plan     |
| Failed sends      | Delete on 404/410 only; keep on 401/403                                                  | A dev run against a dump must never wipe prod subscriptions                                      | Plan     |
| Lockout           | Delete rows on deactivate/trash, FK cascade on hard delete, account filter in the sender | `updateWorkerAction` can flip `active` without deleting rows                                     | Plan     |
| Logout            | Unsubscribe the device before the session ends                                           | A shared phone must not get the previous user's pushes                                           | Plan     |

## Scope

**In scope:**

- The `push_subscriptions` table
- The env gate
- `sendPushToUser`
- The subscribe/unsubscribe actions
- Lockout and logout cleanup
- The test route
- The SW `push`/`notificationclick` handlers
- The toggle in two places
- The open-time re-check
- pl/uk/ru strings
- The badge PNG
- The isolation doc row
- The wypłata trigger and badge count (blocked)

**Out of scope:**

- Other triggers (reports, expense drafts, equipment)
- Per-event preferences
- A dev VAPID pair or local push testing
- A numeric badge on Android
- Automatic silent re-subscribe
- E2E
- Any of EX-1042's files

## Architecture / Approach

This is the Observer pattern across a process boundary:

1. The device subscribes and hands the server an endpoint plus keys, stored per user.
2. The server action books the wypłata.
3. `after()` calls `sendPushToUser`.
4. The sender signs with the VAPID pair and posts to the push service (FCM, APNs or Mozilla).
5. The push service wakes the service worker.
6. The service worker shows the notification and sets the icon badge.

Each payload carries the absolute badge count, never "+1", and the app re-syncs the badge on every open.

## Phases at a Glance

| Phase                                | What it delivers                                                                                   | Key risk                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Data + env gate                   | Table, `lib/db` helpers, prod-only keys, `web-push` dep                                            | `pnpm install` swapping the lightningcss binary             |
| 2. Sender + actions + lockout        | `sendPushToUser`, subscribe/unsubscribe, lockout cleanup, `/api/test-push`, isolation doc          | Wrongly deleting subscriptions on an auth refusal           |
| 3. SW + client toggle                | Notifications shown, tap opens the app, toggle in two places, re-check on open, logout unsubscribe | iOS gesture/standalone rules; verifiable only on production |
| 4. Wypłata trigger + badge (blocked) | A push on a pending wypłata, the icon count, re-sync on open                                       | Depends on EX-1042's final names and recipient rule         |

**Prerequisites:**

- Phases 1–3: none.
- Shipping: a human runs `pnpm db:migrate:prod` and adds both VAPID keys to Vercel Production **before**
  the deploy.
- Phase 4: EX-1042 merged.

**Estimated effort:** about 2 sessions for Phases 1–3, plus 1 short session for Phase 4 after EX-1042.

## Open Risks & Assumptions

- Real delivery can only be checked on production. Until the first production test, only the mocked
  unit specs vouch for it.
- iOS silently drops subscriptions. The open-time re-check repairs the server row, but a dropped
  subscription needs the user to turn the toggle on again.
- Phase 4's file paths are placeholders until EX-1042 ships.

## Success Criteria (Summary)

- A worker with notifications on gets a push in their language when a wypłata awaits them. The icon
  shows the count and clears after they confirm.
- No push can reach a real phone from localhost, preview or the E2E DB.
- Turning it off, logging out, deactivation or trashing stops pushes to that device.
