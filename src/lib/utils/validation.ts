import { z } from 'zod'
import { carriesNetAmount } from '@/lib/constants/transfers'
import { dayBound } from '@/lib/utils/date-range'
import { normalizeNip } from '@/lib/utils/nip'

export function getAmountError(amount: number, type: string): string | undefined {
  if (type === 'CORRECTION') {
    return amount >= 0 ? 'Korekta musi mieć ujemną kwotę' : undefined
  }
  return amount <= 0 ? 'Kwota musi być większa niż 0' : undefined
}

export function getNetAmountError(
  netAmount: number | null | undefined,
  amount: number | null | undefined,
  type: string,
  vatPlane?: string | null,
): string | undefined {
  if (!carriesNetAmount(type, vatPlane)) return undefined
  if (netAmount == null || Number.isNaN(netAmount)) return 'Kwota netto jest wymagana'
  if (netAmount <= 0) return 'Kwota netto musi być większa niż 0'
  if (amount != null && !Number.isNaN(amount) && netAmount > amount) {
    return 'Kwota netto nie może przekraczać kwoty brutto'
  }
  return undefined
}

// `path` names the field the message hangs under: a wpłata brutto validates the same `amount`, but
// the netto input is not on screen, so an issue parked there would block the submit invisibly.
export function refineAmount(
  data: { amount: string; type?: string },
  ctx: z.RefinementCtx,
  path: string = 'amount',
) {
  if (!data.amount) {
    ctx.addIssue({
      code: 'custom',
      message: 'Kwota musi być większa niż 0',
      path: [path],
    })
    return
  }
  const error = getAmountError(Number(data.amount), data.type ?? '')
  if (error) {
    ctx.addIssue({
      code: 'custom',
      message: error,
      path: [path],
    })
  }
}

export function refineDate(data: { date: string }, ctx: z.RefinementCtx) {
  if (!data.date) {
    ctx.addIssue({
      code: 'custom',
      message: 'Data jest wymagana',
      path: ['date'],
    })
  }
}

export const optionalNonNegativeAmount = (message: string) =>
  z.string().refine((value) => value === '' || Number(value) >= 0, message)

/**
 * The shape is checked because the server action parses the same schema, and a value that isn't a
 * day lands in Postgres as an Invalid Date.
 */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const optionalDay = () =>
  z.string().refine((value) => value === '' || DAY_PATTERN.test(value), 'Nieprawidłowa data')

function getSellerNipError(value: string | undefined): string | undefined {
  return value && normalizeNip(value) === undefined ? 'NIP musi mieć 10 cyfr' : undefined
}

function getDocumentDateError(value: string | undefined): string | undefined {
  return value && dayBound(value) === undefined ? 'Nieprawidłowa data' : undefined
}

export function refineDocumentIdentity(
  item: { sellerNip?: string; documentDate?: string },
  ctx: z.RefinementCtx,
  path: (string | number)[] = [],
) {
  const nipError = getSellerNipError(item.sellerNip)
  if (nipError) ctx.addIssue({ code: 'custom', message: nipError, path: [...path, 'sellerNip'] })
  const dateError = getDocumentDateError(item.documentDate)
  if (dateError) {
    ctx.addIssue({ code: 'custom', message: dateError, path: [...path, 'documentDate'] })
  }
}

export const requiredDay = (message: string) =>
  z.string().min(1, message).regex(DAY_PATTERN, 'Nieprawidłowa data')
