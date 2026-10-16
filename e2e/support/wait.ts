import { expect, type Locator, type Page, type Request, type Response } from '@playwright/test'

// The poll runs on the DRIVER, because an in-page timer cannot
// bound itself: `evaluate`'s own timeout covers resolving the locator, not awaiting a promise the
// page function returns.
const HYDRATION_TIMEOUT_MS = 20_000
const HYDRATION_POLL_MS = 50

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

export async function refreshData(page: Page): Promise<void> {
  const refresh = page.getByRole('button', { name: 'Odśwież dane' })
  await waitForHydration(refresh, 5_000)
  await refresh.click({ timeout: 5_000 })
  await expect(page.getByText('Dane odświeżone')).toBeVisible({ timeout: 10_000 })
}

/**
 * `check` must carry its own short timeout — `toPass` cannot abort a call already in flight, so an
 * inner assertion left on the 45 s default would spend the whole budget on one attempt.
 */
export async function refreshUntil(page: Page, check: () => Promise<void>): Promise<void> {
  await expect(async () => {
    await refreshData(page)
    await check()
  }).toPass({ timeout: 90_000, intervals: [500, 2_000, 5_000] })
}

// The wait is registered BEFORE `write` runs, which is what lets it cover a
// debounced autosave that has not been sent yet.
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
    // by then.
    settled.catch(() => {})
    throw error
  }
  const response = await settled
  // Some actions leave their RSC stream open long
  // after the write landed (the client never drains it), and an unbounded `finished()` then eats the
  // whole test budget.
  const bail = page.waitForTimeout(3_000)
  await Promise.race([response.finished().catch(() => {}), bail])
  bail.catch(() => {})
}

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
