import { test, expect, type Locator, type Page } from '@playwright/test'
import { settleWrite, waitForHydration } from './support/wait'

const CARDS = {
  fleetDigest: { path: '/flota', title: 'Powiadomienia' },
  equipmentDigest: { path: '/sprzet', title: 'Powiadomienia' },
  newLead: { path: '/zgloszenia', title: 'Powiadomienia o nowych zgłoszeniach' },
  opsAlerts: { path: '/zgloszenia', title: 'Alerty techniczne' },
} as const

type StreamT = keyof typeof CARDS

// `PageWrapper` is a `<section>` too and contains the heading, so it matches the same filter; the
// card is the innermost match, which in document order is the last one.
function card(page: Page, title: string) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    .last()
}

async function readList(page: Page, stream: StreamT): Promise<string[]> {
  const { path, title } = CARDS[stream]
  await page.goto(path)
  const section = card(page, title)
  await section.waitFor()
  return (await section.locator('li').allTextContents()).map((text) => text.trim())
}

async function openEditor(page: Page, stream: StreamT) {
  const { title } = CARDS[stream]
  const editButton = page.getByRole('button', { name: `Edytuj listę: ${title}` })
  await editButton.waitFor()
  await waitForHydration(editButton)
  await editButton.click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  return dialog
}

async function save(page: Page, dialog: Locator): Promise<void> {
  await settleWrite(page, () => dialog.getByRole('button', { name: 'Zapisz', exact: true }).click())
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

const uniqueAddress = (prefix: string) => `${prefix}-${Date.now()}@wykonczymy.test`

const expectList = async (page: Page, stream: StreamT, expected: string[]) =>
  expect(await readList(page, stream)).toEqual(expected)

test('adding and removing one recipient leaves the other three streams untouched', async ({
  page,
}) => {
  const address = uniqueAddress('e2e-flota')

  const fleetBefore = await readList(page, 'fleetDigest')
  const equipmentBefore = await readList(page, 'equipmentDigest')
  const newLeadBefore = await readList(page, 'newLead')
  const opsAlertsBefore = await readList(page, 'opsAlerts')

  await page.goto(CARDS.fleetDigest.path)
  const addDialog = await openEditor(page, 'fleetDigest')
  await addDialog.getByRole('button', { name: 'Dodaj odbiorcę' }).click()
  await addDialog.locator('input[type="email"]').last().fill(address)
  await save(page, addDialog)

  await expectList(page, 'fleetDigest', [...fleetBefore, address])

  expect(await readList(page, 'equipmentDigest')).toEqual(equipmentBefore)
  expect(await readList(page, 'newLead')).toEqual(newLeadBefore)
  expect(await readList(page, 'opsAlerts')).toEqual(opsAlertsBefore)

  await page.goto(CARDS.fleetDigest.path)
  const removeDialog = await openEditor(page, 'fleetDigest')
  const rows = removeDialog.locator('input[type="email"]')
  await expect(rows.last()).toHaveValue(address)
  await removeDialog.getByRole('button', { name: 'Usuń odbiorcę' }).last().click()
  await save(page, removeDialog)

  await expectList(page, 'fleetDigest', fleetBefore)
})
