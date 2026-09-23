import { expect, type Locator, type Page, type Request, type Response } from '@playwright/test'

// Give React a chance to hydrate `locator`'s element before the spec clicks or types into it.
// Before hydration a click is a no-op (or a native GET submit that never reaches its handler), and
// a controlled input is reset to empty. Crossing Next.js root layouts — (auth) /zaloguj →
// (frontend) / — is a full document load that re-hydrates from scratch, so waiting matters.
//
// This is a PRECONDITION, never a verdict: React stamping a `__reactFiber$…` key on a host node is
// an internal, and it has been observed missing on elements that click perfectly well a moment
// later. A test that failed here blamed the framework's bookkeeping instead of the interaction it
// exists to prove, so the timeout warns and returns — the click or fill that follows is what fails,
// with a message about the thing the spec is actually about.
//
// The poll runs on the DRIVER, one short-lived evaluate per tick, because an in-page timer cannot
// bound itself: `evaluate`'s own timeout covers resolving the locator, not awaiting a promise the
// page function returns, so a page whose timers never fire made this call eat the whole test budget
// and then blame the locator. Re-resolving each tick also survives React replacing the node.
const HYDRATION_TIMEOUT_MS = 20_000
// 50, not the 250 this was written with: that figure was tuned when hydration took 20 s under a
// translated renderer (`e2e/chrome-arm64.sh`). Native it takes ~300 ms, so a 250 ms tick overshot by
// up to a full tick on every one of ~33 call sites.
const HYDRATION_POLL_MS = 50

/**
 * Nudge a control until the state it drives agrees — retry the NUDGE, never just wait longer.
 *
 * Four helpers had grown their own copy of this loop, each with its own 30 s literal and its own
 * paragraph explaining the bound below. The bound is the whole point and it is not obvious:
 * `toPass` cannot abort a callback that is still running when the deadline passes — it waits for it
 * to return. So ONE inner call left on the global 45 s `actionTimeout` turns the retry loop into a
 * single attempt, and the retry it exists for never runs. Every call inside `nudge`/`settled` is
 * therefore bounded at `RETRY_STEP_MS`, far below `RETRY_BUDGET_MS`.
 *
 * Retrying the nudge rather than the wait is the other half: the failures this replaced were clicks
 * React dropped mid-remount — a dialog still tearing down, a toolbar re-rendering under an autosave's
 * `router.refresh()`. Playwright reports „click action done", nothing opens, and no amount of waiting
 * brings back a menu that already closed. `nudge` owns its own „am I already there" guard, so a
 * control that settled on the first look is not clicked twice.
 */
export const RETRY_STEP_MS = 2_000
const RETRY_BUDGET_MS = 30_000

export async function nudgeUntil(
  nudge: () => Promise<unknown>,
  settled: () => Promise<unknown>,
): Promise<void> {
  await expect(async () => {
    await nudge()
    await settled()
  }).toPass({ timeout: RETRY_BUDGET_MS })
}

export async function waitForHydration(
  locator: Locator,
  timeout = HYDRATION_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const hydrated = await locator
      .evaluate((element) => Object.keys(element).some((key) => key.startsWith('__reactFiber$')))
      .catch(() => false)
    if (hydrated) return
    await new Promise((resolve) => setTimeout(resolve, HYDRATION_POLL_MS))
  }
  console.warn(
    `waitForHydration: no __reactFiber$ key after ${HYDRATION_TIMEOUT_MS}ms — proceeding, the next interaction decides`,
  )
}

/**
 * The app's own „Odśwież dane" — `revalidatePath('/', 'layout')`, the one thing that clears every
 * `unstable_cache` entry at once, and the only honest way for a spec to read what a write actually
 * persisted.
 *
 * A write's own `router.refresh()` is not: the list query is an `unstable_cache` entry, and a link
 * prefetch whose render began BEFORE the write lands its stale rows in that entry AFTER the action
 * expired the tag. The refresh then re-reads a poisoned entry and the row keeps its pre-write face
 * until something else invalidates it. Measured in a full-suite run: `transactions_rels` held the
 * new invoice and the refresh payload still carried `invoices: []` for that row.
 */
export async function refreshData(page: Page): Promise<void> {
  const refresh = page.getByRole('button', { name: 'Odśwież dane' })
  // Every call here is bounded for the reason `nudgeUntil` documents: this runs inside
  // `refreshUntil`'s `toPass`, so one call left on the 20 s hydration budget or the 45 s
  // `actionTimeout` would spend the loop's entire 90 s on a single attempt — and the retry the loop
  // exists to provide would never run twice.
  await waitForHydration(refresh, 5_000)
  await refresh.click({ timeout: 5_000 })
  await expect(page.getByText('Dane odświeżone')).toBeVisible({ timeout: 10_000 })
}

/**
 * One „Odśwież dane" is not always enough, and re-reading without one is never enough.
 *
 * The poisoning itself is a production defect, not a test artifact — tracked as EX-808. Until it is
 * fixed the harness has to work around it, and this is that workaround.
 *
 * A poisoned `unstable_cache` entry is not stale in the framework's eyes — the render that filled it
 * stamped it with ITS OWN finish time, which is later than the tag's expiry — so it stays valid
 * until something expires that tag again. Navigating, reloading and retrying the assertion all read
 * the same poisoned entry forever; only another `revalidatePath` can dislodge it. The app's own
 * sidebar prefetch storm — ~20 routes re-requested after every navigation — can lose the race a
 * second time, so the refresh is the thing that retries, not the read.
 *
 * `check` must carry its own short timeout — `toPass` cannot abort a call already in flight, so an
 * inner assertion left on the 45 s default would spend the whole budget on one attempt.
 */
export async function refreshUntil(page: Page, check: () => Promise<void>): Promise<void> {
  await expect(async () => {
    await refreshData(page)
    await check()
  }).toPass({ timeout: 90_000, intervals: [500, 2_000, 5_000] })
}

// A write awaited to its END, not to its paint.
//
// The kosztorys editor is optimistic twice over: the grid removes a deleted row at once, and a typed
// cell is committed to the visible state while its autosave is still 500 ms of debounce away from
// being sent. So „the row is gone" / „the cell says 150" is true about the user's intent and nothing
// about Postgres. A `page.reload()` taken on that signal does two harmful things at once — it ABORTS
// the server action's request mid-flight, and it renders the new document from a read that raced the
// write, which the grid then keeps forever because it seeds its rows into `useState` at mount. The
// suite only ever passed this because the browser ran under Rosetta and was slower than the write.
//
// Next marks every server-action POST with a `next-action` header — the only request-side evidence a
// write is in flight — and the wait is registered BEFORE `write` runs, which is what lets it cover a
// debounced autosave that has not been sent yet. The RESPONSE is the proof, not the request: Next
// flushes an action's headers only once the action function has returned, so a response that arrived
// is a write that committed, and a response that never arrives is the abort this helper exists to
// prevent.
function isServerAction(request: Request): boolean {
  return request.method() === 'POST' && !!request.headers()['next-action']
}

export async function settleWrite(page: Page, write: () => Promise<void>): Promise<void> {
  const settled = page.waitForResponse((response) => isServerAction(response.request()), {
    timeout: 60_000,
  })
  try {
    await write()
  } catch (error) {
    // A `write()` that throws leaves `settled` pending with nobody awaiting it; 60 s later it
    // rejects as an UNHANDLED rejection, which Playwright attributes to whatever test is running
    // by then — not to this one. Swallow that leg so the real error is the one reported.
    settled.catch(() => {})
    throw error
  }
  const response = await settled
  // The tail of the body is awaited, but bounded: some actions leave their RSC stream open long
  // after the write landed (the client never drains it), and an unbounded `finished()` then eats the
  // whole test budget — two specs spent 5 and 6 minutes there before dying with nothing to show.
  // The losing leg is swallowed too: a `waitForTimeout` still pending when the test ends rejects
  // with „Target page closed", again against an unrelated test.
  const bail = page.waitForTimeout(3_000)
  await Promise.race([response.finished().catch(() => {}), bail])
  bail.catch(() => {})
}

/**
 * `settleWrite` for a BURST of writes that must not be serialised — a run of cell edits whose 500 ms
 * autosave debounces are meant to overlap, which is the coalescing such a spec exists to measure.
 *
 * `settleWrite` cannot express that: it resolves on the FIRST action response it sees, and in a burst
 * that is an earlier cell's save. The trace of the failure: three cells typed, ONE POST — the first
 * cell's — the reload taken 100 ms after its response, and the two debounces still pending killed by
 * the unmount, so two of the three values never reached Postgres.
 */
export async function settleWrites(
  page: Page,
  count: number,
  writes: () => Promise<void>,
): Promise<void> {
  let landed = 0
  const onResponse = (response: Response) => {
    const request = response.request()
    if (isServerAction(request)) landed += 1
  }
  page.on('response', onResponse)
  try {
    await writes()
    await expect(() => expect(landed).toBeGreaterThanOrEqual(count)).toPass({ timeout: 30_000 })
  } finally {
    page.off('response', onResponse)
  }
}

export function clickAndSettle(target: Locator): Promise<void> {
  return settleWrite(target.page(), () => target.click())
}
