# Review-gate ledger — pwa-push-notifications (EX-1040) · 2026-10-11

Scope: `14b36b922...HEAD` on `pwa-push-notifications` (Phases 1–3); Phase 4 landed on `staging` after EX-1042 merged — see § Phase 4.
Step 0.5 verification pass skipped: every surface is gated off without the production-only VAPID
key, so localhost has nothing to exercise; the device checks live in `manual-checks.md`.

## Findings

_Trimmed at archive (2026-10-12): 22 fixed findings removed; their record is the commits. Dismissed / dropped / filed kept._

- [x] 🔵 OBSERVATION · skipped · code-review · `src/lib/actions/push.ts:11` · no allowlist of push-service hosts — a hard-coded list can refuse a legitimate service; impact is a blind POST of an encrypted payload from a logged-in account
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/push/push-client.ts:17` · null `applicationServerKey` treated as foreign — our subscribe always passes a key and current browsers report it
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/migrations/20261011_2_add_push_subscriptions.ts` · preview DB needs the migration — known merge step (`pnpm db:migrate:preview`), carried in the close-out
- [x] dismissed · comment-noise-audit · `public/sw.js:58` · comment inside an empty catch — required by `no-empty`, and says where control goes
- [x] dropped · code-review · `toggle-active.ts` / `trash-worker.ts` · repeated `deleteUserSessions` + `deletePushSubscriptions` pair — a helper's params equal its body, no win
- [x] dropped · code-review · `src/lib/env/schema.ts` · `.trim()` on VAPID keys for a pasted trailing newline — Vercel strips it; not worth the churn
- [x] dropped · code-review · `src/stores/push-subscription-store.ts` · store stays „subscribed" after an offline logout — the page is torn down by the redirect
- [x] dropped · code-review · `src/lib/pwa/install-state.ts` · `PlatformT` naming nit
- [x] dismissed · tailwind-v4-audit · — 0 findings
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

## Phase 4

Wired after EX-1042 merged into `staging`: all three PAYOUT booking paths (`createTransferAction`,
`createBulkTransferAction`, `settlePayoutsAction`) call `notifyPendingPayouts` in `after()` — one
push per worker with the summed amount and the post-commit `countPendingPayouts`. The app re-syncs
the badge on open and after „Potwierdzam” / „Odrzuć”. No separate gate fan-out: the diff reuses the
gated sender unchanged. Specs: `notify-pending-payouts.test.ts` (4), `countPendingPayouts` DB case,
`settle-payouts.test.ts` trigger asserts, `syncAppBadge` (3) — green; typecheck clean.
