import { test, expect } from '@playwright/test'
import { DEFAULT_COEFFS } from '@/lib/kosztorys/constants'
import { COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { refreshReferenceData, runSeedScript } from './seeds'
import { waitForHydration } from './support/wait'
import { editorCell } from './drivers/kosztorys-grid'
import { anonymousVisit, mintShareToken } from './share-link'

// The share link is the one entrance with no session behind it: `(share)/layout.tsx` deliberately
// mounts no CurrentUserProvider, because the token IS the credential. `useCurrentUser` throws on a
// null context, and the totals panel below the grid is `forceMount`ed — so a session read added
// anywhere under KosztorysEditorBody → KosztorysTotalsPanel → SummaryPanelContent turns every
// investor link into a 500 while the authed app stays green (typecheck, units and every other spec
// run inside the provider). Nothing short of an anonymous browser hitting the real route sees it.
//
// EX-550 — the other half of that route is a DISCLOSURE boundary, and it is enforced by two
// independent halves that only work as a pair: the column allowlist (`PREVIEW_VISIBLE_COLUMNS`) and
// the price-plane pin (`view = preview ? 'client' : …` in `use-kosztorys-view-state.ts`). The pin is
// what stops a reader who sets `localStorage['kosztorys-view:<id>']` from repricing the whole tree at
// the subcontractor's cost basis — the public page ships the full tree, coefficients included, so an
// unpinned plane would simply render it. That attack is a browser-only fact: no unit test can set a
// localStorage key for an anonymous origin and watch a server-rendered tree come back repriced.
test.use({ storageState: 'e2e/.auth/user.json' })

type BandsSeed = {
  investment: number
  clientPrice: number
  sections: { name: string; net: number; itemCount: number }[]
}

let seed: BandsSeed

// The bands seed, reused rather than given its own: this spec needs any investment with a non-empty
// tree, and that is exactly what that one builds.
test.beforeAll(async ({ browser }) => {
  seed = runSeedScript<BandsSeed>('seed:kosztorys-bands', 'BANDS_SEED')
  await refreshReferenceData(browser)
})

test('a generated share link renders the kosztorys for a visitor with no session', async ({
  page,
  browser,
  baseURL,
}) => {
  const token = await mintShareToken(page, seed.investment)
  const { page: visitor, status, close } = await anonymousVisit(browser, baseURL, token)
  try {
    // Catches a 404 from a token the route refuses. It does NOT catch the render throw this spec
    // exists for: verified by breaking it on purpose (a `useCurrentUser()` inside SummaryPanelContent)
    // — the server logged the throw and still answered 200, because Next had already begun streaming
    // and the failure lands in the client error boundary. The content assertions below are what went
    // red, so they are the load-bearing ones; keep them, and never trade them for a status check.
    expect(status).toBe(200)

    // Visible is not enough, and the whole negative below hangs on the difference: the markup the
    // server sent is on screen long before React re-reads `localStorage`. A leak that only appears
    // once the client has read the poisoned key would render into a page this snapshot already
    // finished reading.
    const anchor = visitor.getByText(seed.sections[0].name).first()
    await expect(anchor).toBeVisible()
    await waitForHydration(anchor)
    // The panel defaults to open, so its content is both mounted and visible on a fresh context —
    // the subtree the risk lives in, proven present rather than assumed.
    await expect(visitor.getByRole('radio', { name: 'Podsumowanie' })).toBeVisible()

    // EX-550 Ryzyko 3. The share page is a leaf: every route it could link to sits behind the login
    // the visitor does not have, so an anchor here is either a dead end for them or — worse — a path
    // someone added without noticing who reads this page. Zero is the only honest number, and it is
    // asserted after the content above so it can never pass on an empty render.
    expect(await visitor.locator('a[href]').count()).toBe(0)
  } finally {
    await close()
  }
})

test('a poisoned price-plane key cannot reprice the shared kosztorys at the subcontractor basis', async ({
  page,
  browser,
  baseURL,
}) => {
  const token = await mintShareToken(page, seed.investment)
  const storageKey = `kosztorys-view:${seed.investment}`

  // „Cena j.m." is the cell the plane actually switches (`viewPrice`), and it is on the allowlist, so
  // it is the figure to watch. The seed leaves the investment's współczynnik at the collection
  // default, so „z narzędziami" quotes every row at 65% of the client price — a number that exists in
  // the shipped tree and would render the moment the plane stopped being pinned.
  // „Cena j.m." prints the stored number as typed (`decimalText`), not as a 2-decimal figure — a
  // `formatNet` reading would look for „100,00" in a cell that says „100" and prove nothing.
  const priceText = (value: number) => String(roundToCents(value)).replace('.', ',')
  const clientPrice = priceText(seed.clientPrice)
  const subcontractorPrice = priceText(seed.clientPrice * DEFAULT_COEFFS.wTools)
  expect(subcontractorPrice, 'fixture gives the two planes the same figure').not.toBe(clientPrice)

  const { page: visitor, close } = await anonymousVisit(browser, baseURL, token, async (fresh) => {
    // Runs after the document for the origin exists, so `localStorage` is reachable — exactly what a
    // reader with devtools can do before reloading the link they were sent.
    await fresh.addInitScript((key) => window.localStorage.setItem(key, 'w_tools'), storageKey)
  })
  try {
    // Visible is not enough, and the whole negative below hangs on the difference: the markup the
    // server sent is on screen long before React re-reads `localStorage`. A leak that only appears
    // once the client has read the poisoned key would render into a page this snapshot already
    // finished reading.
    const anchor = visitor.getByText(seed.sections[0].name).first()
    await expect(anchor).toBeVisible()
    await waitForHydration(anchor)
    // The poison landed. Without this the test would pass just as green on a typo in the key, having
    // proven nothing.
    expect(await visitor.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBe(
      'w_tools',
    )

    // Read the price COLUMN, not the whole body: „65" is a substring of half the figures on the
    // page, so a body-wide negative would go green on a real leak.
    const priceCell = await editorCell(visitor, COLUMN_LABELS.price)
    await expect(
      priceCell,
      'the client figure stopped rendering — the negative below proves nothing',
    ).toHaveText(clientPrice)
    expect(
      await visitor.locator('.dsg-row .dsg-cell').allTextContents(),
      'the subcontractor cost basis reached the public page',
    ).not.toContain(subcontractorPrice)
  } finally {
    await close()
  }
})
