import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { RECEIPT_PHOTO_CASES } from '@/__tests__/fixtures/receipt-photos'
import { sniffMime } from '@/lib/media/sniff-mime'

// Calls the paid model, so it runs only from `pnpm test:receipts-ai`, never from `pnpm test`.
vi.mock('server-only', () => ({}))

const PHOTO_DIR = join(process.cwd(), 'dumps/receipt-eval')
const IS_ENABLED = process.env.RECEIPT_EVAL === '1' && existsSync(PHOTO_DIR)

const sorted = (amounts: number[]) => [...amounts].sort((a, b) => a - b)

describe.skipIf(!IS_ENABLED)('extractReceipts on real photos (live model)', () => {
  it.each(RECEIPT_PHOTO_CASES)(
    '$note',
    async ({ file, amounts, sellerNip }) => {
      const { extractReceipts } = await import('@/lib/ai/openrouter')
      const bytes = readFileSync(join(PHOTO_DIR, file))
      const receipts = await extractReceipts(
        [{ bytes, mediaType: sniffMime(bytes) ?? '', filename: file }],
        [],
      )
      // An entry with no total is a blank row the manager fills or deletes, so only totals count.
      const totalled = receipts.flatMap((receipt) =>
        receipt.amount === null ? [] : [{ ...receipt, amount: receipt.amount }],
      )
      expect(sorted(totalled.map((receipt) => receipt.amount))).toEqual(sorted(amounts))
      if (sellerNip !== undefined)
        expect(totalled.map((receipt) => receipt.sellerNip)).toEqual(amounts.map(() => sellerNip))
    },
    120_000,
  )
})
