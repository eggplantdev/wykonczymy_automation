import { expect, type Locator } from '@playwright/test'
import { formatPLN } from '@/lib/utils/format-currency'

// Parse a formatPLN string ("224 642,24 zł", spaces are non-breaking) into a number. Keeps a
// leading minus for a negative balance; strips the thousands spaces and the "zł" suffix.
export function parsePln(text: string): number {
  return Number(text.replace(/[^\d,-]/g, '').replace(',', '.'))
}

// Strip every space a formatter may have put in — pl-PL groups thousands with a non-breaking space
// and Intl's PLN uses a narrow one, neither of which a spec should have to reproduce to compare.
export const bare = (text: string) => text.replace(/[\s\u00a0\u202f]/g, '')

// A rendered money figure, compared stripped of every kind of space (see `bare`). `toContain` rather
// than equality: a cell often carries a label or a second plane's figure beside the one under test.
export async function expectMoney(locator: Locator, amount: number, why: string): Promise<void> {
  expect(bare((await locator.textContent()) ?? ''), why).toContain(bare(formatPLN(amount)))
}

// 100,00–999,99: under a thousand pl-PL groups nothing, so the rendered figure carries no
// non-breaking space and compares as typed. Random per run because the test DB is never reset and
// every run leaves its rows behind — what a spec reads back has to be its own booking.
export function uniqueAmount(): number {
  return (10_000 + Math.floor(Math.random() * 89_999)) / 100
}
