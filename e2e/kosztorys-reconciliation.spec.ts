import { execFileSync } from 'node:child_process'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { formatNet } from '@/lib/kosztorys/format'
import { parsePln, waitForHydration } from './helpers'

// Proves the WIRED surfaces agree with the seeded ledger — the layer the unit/parity suite can't
// reach. Seeds two fresh investments (mismatch + match) into the isolated 5435 test DB, then asserts
// the reconciliation scream on BOTH the editor Podsumowanie and the investment page. Catches the
// "two planes, both green, still disagreeing" prop-plumbing failure: a surface fed the active-view
// total instead of the client-view executed net, or the two surfaces reading different planes.
test.use({ storageState: 'e2e/.auth/user.json' })

const MISMATCH_LABEL = 'Niezgodność z transakcjami'

type ReconSeed = { mismatch: number; match: number; sumaPracNet: number }

let seed: ReconSeed

// Seed via subprocess, not a direct import: importing the Payload config graph pulls next/cache,
// which Playwright's module loader can't resolve (same reason as global-setup). Override
// DB_POSTGRES_URL to the test DB so the seed lands where the webServer reads (5435), not the dev DB.
// Then bust the reference-data cache: the investment DETAIL page (unlike the editor) resolves the
// investment from fetchReferenceData's unstable_cache, which global-setup's login already warmed —
// before this seed existed. The seed can't invalidate a cache living in the server process, so a
// fresh investment would 404 on the detail page. „Odśwież dane" (revalidatePath('/','layout')) is the
// app's own remedy; drive it once so both surfaces see the seeded rows.
test.beforeAll(async ({ browser }) => {
  const testDbUrl = process.env.DB_POSTGRES_URL_TEST
  if (!testDbUrl) throw new Error('[recon-spec] DB_POSTGRES_URL_TEST is not set — refusing to seed')
  const out = execFileSync('pnpm', ['seed:kosztorys-recon'], {
    encoding: 'utf8',
    env: { ...process.env, DB_POSTGRES_URL: testDbUrl },
  })
  const line = out.split('\n').find((l) => l.startsWith('RECON_SEED='))
  if (!line) throw new Error(`[recon-spec] seed emitted no RECON_SEED line:\n${out}`)
  seed = JSON.parse(line.slice('RECON_SEED='.length))

  const page = await browser.newPage({ storageState: 'e2e/.auth/user.json' })
  try {
    await page.goto('/')
    // On a cold prod server the button renders before React hydrates its onClick; clicking then is a
    // silent no-op and the toast never fires. Wait for the fiber before clicking.
    const refresh = page.getByRole('button', { name: 'Odśwież dane' })
    await waitForHydration(refresh)
    await refresh.click()
    await page.getByText('Dane odświeżone').waitFor()
  } finally {
    await page.close()
  }
})

// The kosztorys editor for an investment. Its Podsumowanie panel (a Collapsible defaulting open)
// carries the „Suma prac wykonanych" / „Rabat" rows that scream.
async function gotoEditor(page: Page, investmentId: number): Promise<void> {
  await page.goto(`/inwestycje/${investmentId}/kosztorys_v2`)
  const suma = page.getByText('Suma prac wykonanych')
  // On a fresh browser the panel defaults open, but if a prior run left it collapsed in
  // localStorage, click the trigger to expand it before asserting on its contents.
  if (!(await suma.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Podsumowanie' }).click()
  }
  await suma.waitFor()
}

// The „z kosztorysu (netto)" block on the investment page — the innermost div wrapping the label
// „p" and its „Robocizna" / „Rabat" rows. Scoped so those generic labels don't collide with the
// page's other financial stats.
function reconBlock(page: Page): Locator {
  return page.locator('div', { hasText: 'z kosztorysu' }).last()
}

test('mismatch: both surfaces scream', async ({ page }) => {
  await gotoEditor(page, seed.mismatch)
  await expect(page.getByLabel(MISMATCH_LABEL).first()).toBeVisible()

  await page.goto(`/inwestycje/${seed.mismatch}`)
  await expect(reconBlock(page).getByLabel(MISMATCH_LABEL).first()).toBeVisible()
})

test('match: neither surface screams', async ({ page }) => {
  await gotoEditor(page, seed.match)
  await expect(page.getByLabel(MISMATCH_LABEL)).toHaveCount(0)

  await page.goto(`/inwestycje/${seed.match}`)
  // The block still renders (kosztorys has rows) — it just carries no scream.
  await expect(reconBlock(page).getByText('Robocizna', { exact: true })).toBeVisible()
  await expect(reconBlock(page).getByLabel(MISMATCH_LABEL)).toHaveCount(0)
})

test('cross-surface parity: kosztorys robocizna equals the seed on both surfaces', async ({
  page,
}) => {
  await page.goto(`/inwestycje/${seed.match}`)
  const pageValue = await reconBlock(page)
    .getByText('Robocizna', { exact: true })
    .locator('xpath=following-sibling::span[1]')
    .textContent()
  expect(parsePln(pageValue ?? '')).toBe(seed.sumaPracNet)

  // The editor shows the same client-view executed net (formatNet, no „zł"). On the match
  // investment Suma prac / Łącznie / Do zapłaty all equal it, so its presence proves the editor
  // reads the same plane as the page — the parity the prop-plumbing risk would break.
  await gotoEditor(page, seed.match)
  await expect(page.getByText(formatNet(seed.sumaPracNet)).first()).toBeVisible()
})

test('mismatch scream shows only in the client price view (EX-541)', async ({ page }) => {
  await gotoEditor(page, seed.mismatch)
  // Default view is „Klient" — the scream compares client-view nets, so it renders here.
  await expect(page.getByLabel(MISMATCH_LABEL).first()).toBeVisible()

  // Switching to the subcontractor „Z narzędziami" price reprices the displayed „Suma prac"/„Rabat"
  // figure; the client-view-fixed scream would then sit next to a number it isn't comparing, so it
  // is suppressed. The view control is a ToggleGroup (Radix single = radiogroup); its icon-only items
  // carry the option label as their accessible name.
  await page.getByRole('radio', { name: 'Z narzędziami' }).click()
  await expect(page.getByLabel(MISMATCH_LABEL)).toHaveCount(0)

  // Back in the client view it returns — the verdict itself never changed, only its visibility.
  await page.getByRole('radio', { name: 'Klient' }).click()
  await expect(page.getByLabel(MISMATCH_LABEL).first()).toBeVisible()
})
