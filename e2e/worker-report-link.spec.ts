import { test, expect } from '@playwright/test'
import { commitCellValue, gridRow } from './drivers/kosztorys-grid'
import { readSeed } from './support/seeds'
import { waitForHydration } from './support/wait'

// „Wyślij" is a Server Action POST on the share path, which the proxy must let through on the token
// alone.
test('a worker sends a zgłoszenie from his /z/ link with no session and it reaches the queue', async ({
  page,
  browser,
  baseURL,
}) => {
  test.slow()
  const report = readSeed('workerReport')

  const visitorContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    baseURL,
  })
  const visitor = await visitorContext.newPage()
  try {
    await visitor.goto(`/z/-/-/${report.token}`)
    const quantity = gridRow(visitor, report.itemDescription).locator('.kosztorys-report-column')
    await waitForHydration(quantity)
    await commitCellValue(quantity, '2')

    await visitor.getByRole('button', { name: 'Wyślij (1)' }).click()
    await visitor
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Wyślij', exact: true })
      .click()
    await expect(visitor.getByRole('heading', { name: 'Wysłano do weryfikacji' })).toBeVisible()
  } finally {
    await visitorContext.close()
  }

  await page.goto(`/zgloszenia-prac?investment=${report.investment}`)
  const row = page
    .getByRole('row')
    .filter({ hasText: report.investmentName })
    .filter({ hasText: report.workerName })
  const preview = row.getByRole('button', { name: 'Podgląd' })
  await waitForHydration(preview)
  await preview.click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Zgłoszenie wykonanych prac' })
  await expect(dialog.getByRole('row').filter({ hasText: report.itemDescription })).toContainText(
    '2 m2',
  )
})
