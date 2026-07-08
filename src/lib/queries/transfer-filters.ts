import type { Where } from 'payload'
import { TRANSFER_TYPES, PAYMENT_METHODS } from '@/lib/constants/transfers'

type SearchParamsT = Record<string, string | string[] | undefined>

type UserContextT = {
  id: number
  onlyOwnTransfers?: boolean
}

function getStringParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function parseNumericIds(param: string | undefined): number[] {
  if (!param) return []
  return param.split(',').map(Number).filter(Boolean)
}

/**
 * Canonicalize an amount search term to the text form the DB stores.
 * `amount` is unscaled `numeric` fed from JS numbers, so its `::text` form has no
 * trailing zeros (18.00 → "18", 72.40 → "72.4"). Accept the Polish comma separator
 * and round-trip through Number so a typed "18,00"/"18.00" prefix-matches an 18 row.
 * Assumes normal money magnitudes: astronomically large terms would stringify to
 * exponential form and stop matching, but no amount reaches that range.
 * Returns null for non-numeric input (filter skipped). EX-408.
 */
function normalizeAmountSearch(raw: string | undefined): string | null {
  if (!raw) return null
  const dotted = raw.replace(',', '.')
  if (!/^\d+\.?\d*$/.test(dotted)) return null
  const n = Number(dotted)
  return Number.isFinite(n) ? String(n) : null
}

export function buildTransferFilters(
  searchParams: SearchParamsT,
  userContext: UserContextT,
): Where {
  // Impossible condition — forces Payload to return zero results
  const NO_RESULTS = { equals: -1 } as const
  const where: Where = {}

  // Manager scoped to own transactions (dashboard only)
  if (userContext.onlyOwnTransfers) {
    where.createdBy = { equals: userContext.id }
  }

  // Audit mode — show only CANCELLATION rows for the period; originals are merged in by the caller
  const cancelledTransactionAudit = getStringParam(searchParams.cancelledTransactionAudit) === '1'

  // Hide cancelled transfers by default (cancelled originals + CANCELLATION type)
  const showCancelled =
    getStringParam(searchParams.showCancelled) === '1' || cancelledTransactionAudit

  if (cancelledTransactionAudit) {
    where.type = { in: ['CANCELLATION'] }
  } else {
    // Type filter (supports comma-separated multi-select)
    const typeParam = getStringParam(searchParams.type)
    if (typeParam) {
      let types = typeParam
        .split(',')
        .filter((t) => (TRANSFER_TYPES as readonly string[]).includes(t))
      if (!showCancelled) types = types.filter((t) => t !== 'CANCELLATION')
      if (types.length > 0) where.type = { in: types }
      else where.id = NO_RESULTS // No valid types → return no results
    } else if (!showCancelled) {
      where.type = { not_in: ['CANCELLATION'] }
    }
  }

  if (!showCancelled) {
    where.cancelled = { not_equals: true }
  }

  // Cash register filter — matches source OR target register
  const sourceRegisterParam = getStringParam(searchParams.sourceRegister)
  const sourceRegisterIds = parseNumericIds(sourceRegisterParam)
  if (sourceRegisterIds.length > 0) {
    where.or = [
      { sourceRegister: { in: sourceRegisterIds } },
      { targetRegister: { in: sourceRegisterIds } },
    ]
  } else if (sourceRegisterParam) where.id = NO_RESULTS

  // Investment filter (supports comma-separated multi-select)
  const investmentParam = getStringParam(searchParams.investment)
  const investmentIds = parseNumericIds(investmentParam)
  if (investmentIds.length > 0) where.investment = { in: investmentIds }
  else if (investmentParam) where.id = NO_RESULTS

  // Created by filter — skip when onlyOwnTransfers is active (security: don't override role scope)
  if (!userContext.onlyOwnTransfers) {
    const createdByParam = getStringParam(searchParams.createdBy)
    const createdByIds = parseNumericIds(createdByParam)
    if (createdByIds.length > 0) where.createdBy = { in: createdByIds }
    else if (createdByParam) where.id = NO_RESULTS
  }

  // Payment method filter (validates against known methods)
  const paymentMethodParam = getStringParam(searchParams.paymentMethod)
  if (paymentMethodParam) {
    const methods = paymentMethodParam
      .split(',')
      .filter((m) => (PAYMENT_METHODS as readonly string[]).includes(m))
    if (methods.length > 0) where.paymentMethod = { in: methods }
    else where.id = NO_RESULTS
  }

  // Expense category filter (investment expense type)
  const expenseCategoryParam = getStringParam(searchParams.expenseCategory)
  const expenseCategoryIds = parseNumericIds(expenseCategoryParam)
  if (expenseCategoryIds.length > 0) where.expenseCategory = { in: expenseCategoryIds }
  else if (expenseCategoryParam) where.id = NO_RESULTS

  // Other category filter
  const otherCategoryParam = getStringParam(searchParams.otherCategory)
  const otherCategoryIds = parseNumericIds(otherCategoryParam)
  if (otherCategoryIds.length > 0) where.otherCategory = { in: otherCategoryIds }
  else if (otherCategoryParam) where.id = NO_RESULTS

  // Amount search — prefix LIKE on the numeric field (resolved via raw SQL downstream)
  const amountLike = normalizeAmountSearch(getStringParam(searchParams.amount))
  if (amountLike !== null) where.amount = { like: amountLike }

  // ID search — exact match. Defers to NO_RESULTS if another filter already short-circuited.
  const idParam = getStringParam(searchParams.id)
  if (idParam && /^\d+$/.test(idParam) && !where.id) {
    where.id = { equals: Number(idParam) }
  }

  // Date range
  const fromParam = getStringParam(searchParams.from)
  const toParam = getStringParam(searchParams.to)
  if (fromParam || toParam) {
    where.date = {}
    if (fromParam) (where.date as Record<string, string>).greater_than_equal = fromParam
    if (toParam) (where.date as Record<string, string>).less_than_equal = toParam
  }

  return where
}

/** Strip cancelled-related conditions from a Where object (for stats queries that handle it in SQL). */
export function stripCancelledFilters(where: Where): Where {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cancelled, type, ...rest } = where
  const result: Where = { ...rest }
  // Keep type filter only if it's a user-selected inclusion filter, not the default not_in exclusion
  if (type && typeof type === 'object' && 'in' in type) {
    result.type = type
  }
  return result
}
