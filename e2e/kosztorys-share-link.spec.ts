import { test, expect } from '@playwright/test'
import { DEFAULT_COEFFS } from '@/lib/kosztorys/constants'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { refreshReferenceData, runSeedScript } from './support/seeds'
import { waitForHydration } from './support/wait'
import { editorCell } from './drivers/kosztorys-grid'
import { anonymousVisit, mintShareToken } from './drivers/share-link'

test.use({ storageState: 'e2e/.auth/user.json' })

type BandsSeed = {
  investment: number
  clientPrice: number
  sections: { name: string; net: number; itemCount: number }[]
}

let seed: BandsSeed

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
    // It does NOT catch the render throw this spec exists for: the server still answered 200, because
    // Next had already begun streaming and the failure lands in the client error boundary.
    expect(status).toBe(200)

    const anchor = visitor.getByText(seed.sections[0].name).first()
    await expect(anchor).toBeVisible()
    await waitForHydration(anchor)
    await expect(visitor.getByRole('radio', { name: 'Podsumowanie' })).toBeVisible()

    // The share page is a leaf: every route it could link to sits behind the login the visitor does not have.
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

  // „Cena j.m." prints the stored number as typed (`decimalText`), not as a 2-decimal figure — a
  // `formatNet` reading would look for „100,00" in a cell that says „100" and prove nothing.
  const priceText = (value: number) => String(roundToCents(value)).replace('.', ',')
  const clientPrice = priceText(seed.clientPrice)
  const subcontractorPrice = priceText(seed.clientPrice * DEFAULT_COEFFS.wTools)
  expect(subcontractorPrice, 'fixture gives the two planes the same figure').not.toBe(clientPrice)

  const { page: visitor, close } = await anonymousVisit(browser, baseURL, token, async (fresh) => {
    await fresh.addInitScript((key) => window.localStorage.setItem(key, 'w_tools'), storageKey)
  })
  try {
    // Visible is not enough: the markup the server sent is on screen long before React re-reads `localStorage`.
    const anchor = visitor.getByText(seed.sections[0].name).first()
    await expect(anchor).toBeVisible()
    await waitForHydration(anchor)
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
