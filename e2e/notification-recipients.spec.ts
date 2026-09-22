import { test, expect, type Locator, type Page } from '@playwright/test'
import { refreshUntil, waitForHydration } from './helpers'

// EX-741 — who receives each notification stream. The stake is not a form: it is mail going to the
// real employee addresses that `db:import` spreads into every environment, so a list that silently
// loses a row stops a person hearing about a problem, and a list that silently gains one mails
// somebody who never asked.
//
// The action and the senders are already guarded below the browser (owner-only, dedupe, an empty
// list refused, a throw rather than mailing the void). What no cheaper layer reaches is the fact
// this spec exists for: `saveRecipientListAction` does a READ-MODIFY-WRITE, because `updateGlobal`
// writes the whole document — saving one list with only its own field in `data` would leave the
// other three absent, and `required` then rejects the owner's edit naming a list they never touched.
// Proving that means editing one list and reading the other three off their own pages, which is
// four route renders and a server action: the browser is the only instrument.
test.use({ storageState: 'e2e/.auth/user.json' })

// Every stream and the page its card lives on — the placement is deliberate (the list is shown where
// its notifications come from, not on a settings page), so a card that moved is a real change here.
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

async function readList(page: Page, stream: StreamT, timeout?: number): Promise<string[]> {
  const { path, title } = CARDS[stream]
  // `timeout` bounds the navigation too, not just the wait: callers pass it because they run inside
  // a retry loop, and a `goto` left on the 90 s `navigationTimeout` would blow that loop's budget on
  // one attempt regardless of how short the wait below is.
  await page.goto(path, { timeout })
  const section = card(page, title)
  await section.waitFor({ timeout })
  return (await section.locator('li').allTextContents()).map((text) => text.trim())
}

// Opens the card's dialog and returns it. Assumes the page is already on the card's route.
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
  await dialog.getByRole('button', { name: 'Zapisz', exact: true }).click()
  // The dialog closes only on a successful action, so this is the submit's own verdict — a refused
  // write leaves it open with the error, and the reload assertions below would then report a
  // confusing "nothing changed" instead of "the save failed".
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

const uniqueAddress = (prefix: string) => `${prefix}-${Date.now()}@wykonczymy.test`

// Every read that follows a save goes through here. The action expires the list's cache tag, but a
// render already in flight can refill that entry with pre-write rows and stamp it with its own
// finish time — which is later than the expiry, so the entry looks fresh and a plain „navigate and
// read" is served the old list indefinitely. `refreshUntil` re-expires until the read agrees.
const expectList = (page: Page, stream: StreamT, expected: string[]) =>
  // `readList` is bounded so the retry actually retries: a read left on the default 45 s
  // `actionTimeout` would burn `refreshUntil`'s whole 90 s budget on two attempts.
  refreshUntil(page, async () => expect(await readList(page, stream, 5_000)).toEqual(expected))

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

  // Read after a full reload rather than off the optimistic re-render: what matters is that the
  // address was PERSISTED, and an optimistic list would show it either way.
  await expectList(page, 'fleetDigest', [...fleetBefore, address])

  // The read-modify-write, stated as three readings. Without these the test would pass just as
  // green on a save that wiped the other three lists.
  expect(await readList(page, 'equipmentDigest')).toEqual(equipmentBefore)
  expect(await readList(page, 'newLead')).toEqual(newLeadBefore)
  expect(await readList(page, 'opsAlerts')).toEqual(opsAlertsBefore)

  // Removing is the other half of the same risk — and it puts the fixture back, so a re-run starts
  // from the list this one found.
  await page.goto(CARDS.fleetDigest.path)
  const removeDialog = await openEditor(page, 'fleetDigest')
  const rows = removeDialog.locator('input[type="email"]')
  await expect(rows.last()).toHaveValue(address)
  await removeDialog.getByRole('button', { name: 'Usuń odbiorcę' }).last().click()
  await save(page, removeDialog)

  await expectList(page, 'fleetDigest', fleetBefore)
})

test('the same address typed twice is stored once', async ({ page }) => {
  // One delivery per person is what the dedupe buys, and it is the card — keyed by address — that
  // would otherwise render two identical rows and invite somebody to „fix" it by deleting one.
  const address = uniqueAddress('e2e-ops')

  const opsAlertsBefore = await readList(page, 'opsAlerts')
  const newLeadBefore = await readList(page, 'newLead')

  await page.goto(CARDS.opsAlerts.path)
  const dialog = await openEditor(page, 'opsAlerts')
  for (let i = 0; i < 2; i++) {
    await dialog.getByRole('button', { name: 'Dodaj odbiorcę' }).click()
    await dialog.locator('input[type="email"]').last().fill(address)
  }
  await save(page, dialog)

  await expectList(page, 'opsAlerts', [...opsAlertsBefore, address])
  // Two cards sit on this one page and are saved by the same action — the sibling is the nearest
  // thing a bad write would take with it.
  expect(await readList(page, 'newLead')).toEqual(newLeadBefore)

  await page.goto(CARDS.opsAlerts.path)
  const cleanup = await openEditor(page, 'opsAlerts')
  await cleanup.getByRole('button', { name: 'Usuń odbiorcę' }).last().click()
  await save(page, cleanup)
  await expectList(page, 'opsAlerts', opsAlertsBefore)
})
