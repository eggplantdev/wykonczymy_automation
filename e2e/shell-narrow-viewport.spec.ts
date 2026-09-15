import { execFileSync } from 'node:child_process'
import { test, expect } from '@playwright/test'

// AGENTS.md's layout contract: the page body never scrolls horizontally — a wide table scrolls
// inside its own container instead. The kosztorys grid is the widest surface in the app (~2300px
// of columns), so if any shell wrapper has lost its `min-w-0` the grid pushes the whole column
// wider than the viewport and the sticky top bar slides off with it. That is invisible above the
// 768px mobile line, which is why it shipped once already.
test.use({ storageState: 'e2e/.auth/user.json' })

let investment: number

test.beforeAll(() => {
  const testDbUrl = process.env.DB_POSTGRES_URL_TEST
  if (!testDbUrl) throw new Error('[shell-spec] DB_POSTGRES_URL_TEST is not set — refusing to seed')
  const out = execFileSync('pnpm', ['seed:kosztorys-bands'], {
    encoding: 'utf8',
    env: { ...process.env, DB_POSTGRES_URL: testDbUrl },
  })
  const line = out.split('\n').find((l) => l.startsWith('BANDS_SEED='))
  if (!line) throw new Error(`[shell-spec] seed emitted no BANDS_SEED line:\n${out}`)
  investment = JSON.parse(line.slice('BANDS_SEED='.length)).investment
})

test('the kosztorys editor does not widen the page body at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto(`/inwestycje/${investment}/kosztorys_v2`)
  await page.locator('.dsg-container').first().waitFor()

  const shell = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
    gridScrollWidth: document.querySelector('.dsg-container')?.scrollWidth ?? 0,
    gridClientWidth: document.querySelector('.dsg-container')?.clientWidth ?? 0,
  }))

  expect(shell.bodyScrollWidth).toBeLessThanOrEqual(shell.innerWidth)
  // Guards the other half: the body could also stay narrow because the grid was clipped rather than
  // made scrollable, which would hide columns instead of fixing the overflow.
  expect(shell.gridScrollWidth).toBeGreaterThan(shell.gridClientWidth)
})
