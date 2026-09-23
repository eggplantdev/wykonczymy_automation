import { test, expect, type Page } from '@playwright/test'
import { settleWrite, waitForHydration } from './support/wait'
import { collapseSummaryPanel, editorCell } from './drivers/kosztorys-grid'

// EX-769 — the zamek on a zakończona inwestycja. Every gate it is made of is already unit-tested on
// its own: the kosztorys action wrapper (`kosztorys-lock.test.ts` even asserts the rows are left
// untouched after each refusal), the transakcje collection hook (twelve cases), the role gate on
// unlocking, and the column build under `readOnly`. What none of them can see is the fact the lock
// actually depends on: the status is read off `fetchReferenceData`, and EVERY surface — the editor
// page, the wydatek picker, the URL prefill — reads it from that one cache. A status write that
// fails to invalidate it leaves a closed investment fully writable while every unit test stays
// green.
//
// So this spec buys exactly that: one status flip through the real dialog, then the three surfaces,
// then the flip back. It deliberately does NOT re-assert the refusals themselves — the server's „no"
// is cheaper to prove below the browser, and proving it here would only be re-testing it slower.
test.use({ storageState: 'e2e/.auth/user.json' })

// A long-standing dump investment with a kosztorys (310 pozycji) and a linked Google sheet — the
// sheet is what makes „the Arkusz Google section disappears" a real assertion rather than a vacuous
// one, since that section is gated on `hasSheet` as well as on the lock. No other spec books
// against it, and this one always hands it back active.
const LOCKED_INVESTMENT = { id: 124, name: 'Agnieszka żochowska ul. Człuchowska' }

// Set the status through the real „Edytuj inwestycję" dialog — the one route that invalidates the
// reference-data cache the whole lock is read from. Idempotent: the state each test needs is stated,
// never inherited.
async function setStatus(page: Page, status: string): Promise<void> {
  await page.goto(`/inwestycje/${LOCKED_INVESTMENT.id}`)
  const edit = page.getByRole('button', { name: 'Edytuj inwestycję' })
  await edit.waitFor()
  await waitForHydration(edit)
  await edit.click()

  const dialog = page.getByRole('dialog').filter({ hasText: 'Edytuj inwestycję' })
  await dialog.waitFor()
  const select = dialog.getByLabel('Status')
  if (((await select.textContent()) ?? '').includes(status)) {
    await page.keyboard.press('Escape')
    return
  }
  await select.click()
  await page.getByRole('option', { name: status, exact: true }).click()
  const save = dialog.getByRole('button', { name: 'Zapisz', exact: true })

  // Closing is a one-way door for everyone but właściciel/admin, so it is staged behind a warning —
  // and the warning is part of the contract: the person is told what they give up BEFORE the write,
  // not by a refusal afterwards. Whichever button ends up firing it, the write is awaited to its
  // response: the submit is fire-and-forget over an optimistic store, so the caller's next `goto`
  // would abort the very status change it is about to read back.
  if (status === 'Zakończona') {
    await save.click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toContainText('tylko do odczytu')
    await settleWrite(page, () => confirm.getByRole('button', { name: 'Zakończ' }).click())
  } else {
    await settleWrite(page, () => save.click())
  }
  await expect(dialog).toBeHidden()
}

async function openEditor(page: Page): Promise<void> {
  await page.goto(`/inwestycje/${LOCKED_INVESTMENT.id}/kosztorys_v2`)
  await collapseSummaryPanel(page)
}

const optionsMenu = (page: Page) => page.getByRole('button', { name: 'Opcje', exact: true })

// Whatever the run did, the investment goes back on the shelf active — a spec that leaves a fixture
// locked would fail every later spec that books against it, with a message about the wrong thing.
test.afterAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: 'e2e/.auth/user.json' })
  try {
    await setStatus(page, 'Aktywna')
  } finally {
    await page.close()
  }
})

// The read-only banner, reloaded until it agrees — in BOTH directions, which is why this is one
// helper and not two polls: the status rides on `fetchReferenceData`, whose invalidated entry is
// still served once (see the route's own note), so exactly one stale render is expected on locking
// AND on unlocking, and neither is the regression.
//
// The reload is bounded because `expect.poll` cannot abort a call already in flight: one left on the
// 90 s `navigationTimeout` would hold the poll well past its own deadline.
async function reloadUntilBanner(page: Page, want: 'present' | 'gone'): Promise<void> {
  const banner = page.getByRole('status').filter({ hasText: 'tylko do odczytu' })
  const agrees = async () => (await banner.count()) > 0 === (want === 'present')
  await expect
    .poll(async () => {
      if (await agrees()) return true
      await page.reload({ timeout: 15_000 })
      return agrees()
    })
    .toBe(true)
}

test('closing an investment locks the editor and the pickers, and reopening it gives them back', async ({
  page,
}) => {
  await setStatus(page, 'Aktywna')
  await openEditor(page)
  await expect(page.getByRole('button', { name: 'Dodaj' })).toBeVisible()

  await setStatus(page, 'Zakończona')

  // 1. The editor. No „Odśwież dane" anywhere, so what is proved is that the write invalidated the
  // cache the page reads the status from. Reloaded until it lands rather than asserted on the first
  // paint: the status rides on `fetchReferenceData`, whose invalidated entry is still served once
  // (see the route's own note), so exactly one stale render is expected and is not the regression.
  await openEditor(page)
  await reloadUntilBanner(page, 'present')
  await expect(page.getByRole('button', { name: 'Dodaj' })).toHaveCount(0)

  // Clicking a cell opens no editor. The column set stays the owner's own, which is what separates a
  // locked kosztorys from a client's share link: same document, nothing writable.
  const cell = await editorCell(page, 'Przedmiar')
  await cell.click()
  await expect(cell.locator('input')).toHaveCount(0)

  // 2. „Opcje" keeps what only READS and drops what writes — asserted as that asymmetry, because
  // „the menu is empty" would also pass if the whole menu had broken.
  await optionsMenu(page).click()
  await expect(page.getByRole('menuitem', { name: /Zapisz jako nowy szablon/ })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Wyczyść kosztorys/ })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: /Wczytaj szablon/ })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: /Pobierz z arkusza Google/ })).toHaveCount(0)
  await page.keyboard.press('Escape')

  // 3. Money. Opened from the locked investment's OWN page, where the form would normally seed the
  // investment from the URL — the seeding skips the picker, so it has to repeat the picker's filter
  // or the one investment that may not be booked against is the one that comes prefilled.
  await page.goto(`/inwestycje/${LOCKED_INVESTMENT.id}`)
  const wydatek = page.getByRole('button', { name: /Wydatek/ }).first()
  await waitForHydration(wydatek)
  await wydatek.click()
  await page.getByText('Nowy wydatek').first().waitFor()
  const investmentField = page.getByLabel('Inwestycja')
  await expect(investmentField).not.toContainText(LOCKED_INVESTMENT.name)
  await investmentField.click()
  await expect(page.getByRole('option', { name: LOCKED_INVESTMENT.name, exact: true })).toHaveCount(
    0,
  )
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  // 4. The kartoteka stays editable for everyone — the lock is on the money and the kosztorys, not
  // on the client's phone number. That is part of the contract, and the cheapest place it can break
  // is a blanket „disable everything on a closed investment".
  await page.goto(`/inwestycje/${LOCKED_INVESTMENT.id}`)
  const edit = page.getByRole('button', { name: 'Edytuj inwestycję' })
  await waitForHydration(edit)
  await edit.click()
  await expect(page.getByLabel('Nazwa')).toBeEditable()
  await page.keyboard.press('Escape')

  // 5. And back. The unlock is the same crossing in reverse, and the half that actually rots: a
  // status write that revalidates nothing leaves the editor read-only until the cache ages out.
  await setStatus(page, 'Aktywna')
  await openEditor(page)
  await reloadUntilBanner(page, 'gone')
  await expect(page.getByRole('button', { name: 'Dodaj' })).toBeVisible()
  const reopened = await editorCell(page, 'Przedmiar')
  await reopened.click()
  await expect(reopened.locator('input')).toHaveCount(1)
})
