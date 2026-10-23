# Review-gate ledger — ai-stage-push · 2026-10-23

Scope: `761c6f864^..aedb70184` (commits 761c6f864, 185fcdab8, 80ebae1ea, aedb70184) + `../wykonczymy-ai-cases` fdc3a53.
Verification pass (0.5) skipped: push is sent only from production, so a local browser pass can't observe it.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `scripts/ai-kosztorys/load-draft-sql-prod.ts` · the „recenzenci powiadomieni" log line claimed a push that doesn't happen when the stage was already Przeanalizowana or the actor is a reviewer — log and ai-cases README now say the push goes only on an actual change
      test: no automated test · — log/runbook text only
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/push/notify-ai-stage.ts:38` · the Sentry-bound „no live recipient" error fired when the actor was the list's only member (admin moving a pipeline stage) — emptiness is now checked before dropping the actor
      test: test-driven-debugging · unit — `stays quiet when the only recipient made the change`, red before the fix, green after
- [x] 🔵 OBSERVATION · dismissed · code-review + impl-review · `src/migrations/20261023_0_ai_stage_recipients.ts:30` · seed hardcodes `_parent_id` 1 — `20260826_0` creates global row 1 on every environment, and a mismatch fails loudly on the FK
- [x] 🔵 OBSERVATION · dropped · impl-review · `src/lib/actions/investments.ts` · read-before-update race could double- or skip-notify on two simultaneous stage changes — a handful of managers set this by hand; worst case one extra/missing push
- [x] fixed · comment-noise · `src/migrations/20261023_0_ai_stage_recipients.ts:3` · header trimmed to the one load-bearing sentence (why the lists are seeded)
- [x] dismissed · comment-noise · loader header + three `SENTRY-REQUIRED` markers · each says what breaks without it — kept
- [x] fixed · simplify · `src/lib/push/notify-ai-stage.ts` · per-recipient try/catch was dead (`sendPushToUser` never throws) — removed, along with the spec that could only exercise it
- [x] fixed · simplify · `src/lib/push/notify-ai-stage.ts:11` · `as const satisfies` map forced an `in` guard + cast — annotated as `Partial<Record<…, MessageKeyT<'aiStagePush'>>>`, lookup replaces the guard
- [x] fixed · simplify · `src/lib/push/notify-ai-stage.ts:27` · notifier took `payload` + `db`, so a `getDb` rejection in `after()` escaped its logging — now takes `payload` and resolves `db` inside its try, like `notifyCreatedReceipts`
- [x] fixed · simplify · `src/lib/actions/investments.ts` · `const stage` alias and the now-unused `getDb` import removed
- [x] fixed · simplify · `src/__tests__/lib/push/notify-ai-stage.test.ts` · typed `vi.fn<typeof sendPushToUser>` drops the casts in `recipients` / `messageTo`
- [x] fixed · simplify · `src/__tests__/lib/actions/investment-ai-stage.db.test.ts` · hand-indexed `mock.calls[0][2]` → `toHaveBeenCalledWith`
- [x] dropped · simplify · `src/lib/push/notify-ai-stage.ts` · shared `sendPushToUsers` with `notifyPendingReceipts` — with the dead catch gone the loop is one `Promise.all(map(sendPushToUser))`; nothing left to share
- [x] dropped · simplify · `src/__tests__/lib/push/notify-ai-stage.test.ts:47` · `messageTo` copies the receipts spec's helper — second copy; extract at the third
- [x] dropped · simplify · `src/lib/actions/investments.ts` · early return on a same-stage save to skip `payload.update` — one PK update on a rare manual re-save
- [x] dismissed · simplify · `readRecipientLists` loads all lists for one; `sendPushToUser` does 2 queries per recipient — sub-millisecond at 1–2 recipients
- [x] skipped · simplify · `src/globals/notification-recipients.ts` · push lists stored as e-mails matched back to accounts; a users relationship would drop `users-by-email.ts` — reusing the recipients global was a plan decision; a different recipient model is its own change
- [x] skipped · simplify · `src/migrations/20261023_0_ai_stage_recipients.ts` · seed exists only because every list is `required` + `minRows: 1`; dropping that would remove the seed — changes validation of the existing e-mail lists; plan chose to seed
- [x] dismissed · reuse-scan · no UI in the diff (UI-drift leg N/A); reinvention covered by the simplify reuse agent

## Simplify pass

Ran /simplify — 6 applied, 0 proposed, 6 dismissed/dropped/skipped; each folded into ## Findings (tagged simplify). `primitive-reuse-scan`: no UI files in scope, reuse leg covered by the simplify reuse agent. Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.fYCJEqC1YU.md`.

## Tests & suite

- `notify-ai-stage.test.ts` (unit): 11 passed (the regression spec for the actor-only case red → green; the dead-catch spec removed)
- `investment-ai-stage.db.test.ts` + `users-by-email.db.test.ts` via `pnpm test:integration`: 15 passed
- `pnpm typecheck`: clean after the simplify pass; eslint on the touched files: 0 errors
- `pnpm lint` (0 errors) and `pnpm build` (OK) ran at the end of implementation, before the gate's fixes
- Full `pnpm test` / E2E: not run — not asked; the change has no browser surface (push is sent only from production)
