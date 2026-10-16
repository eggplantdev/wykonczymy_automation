import { APIError, type CollectionBeforeValidateHook } from 'payload'
import type { Transaction } from '@/payload-types'
import {
  needsSourceRegister,
  requiresInvestment,
  showsInvestment,
  needsTargetRegister,
  needsOtherCategory,
  needsWorker,
  showsWorker,
  needsExpenseCategory,
  canBeSettled,
  carriesNetAmount,
  carriesVatPlane,
  carriesPaymentMethod,
  carriesPayoutStatus,
} from '@/lib/constants/transfers'
import { getAmountError, getNetAmountError } from '@/lib/utils/validation'
import { getDb } from '@/lib/db/get-db'
import { investmentLockMessage } from '@/lib/db/investment-gate'
import { trashedRegisterMessage } from '@/lib/db/cash-register-gate'
import { trashedWorkerMessage } from '@/lib/db/worker-gate'
import { resolveId } from '@/lib/utils/resolve-id'
import { isInvoiceOnlyPatch } from '@/hooks/transfers/invoice-only-patch'

type TransferData = Partial<Transaction>

const FROZEN_FIELD_LABELS = {
  vatPlane: 'Rozliczenia netto/brutto',
  netAmount: 'Kwoty netto',
} as const

export const validateTransfer: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  const d = data as TransferData
  console.log('[validateTransfer] Start', { operation, type: d.type, amount: d.amount })

  if (operation === 'create' && req.user) {
    d.createdBy = req.user.id
  }

  const original = originalDoc as TransferData | undefined

  // Falls back to the stored row: a PATCH of one field carries no `type`, and an empty one would
  // route a netto row down the else-branch and null its netAmount.
  const resolved = <K extends keyof TransferData>(field: K) =>
    field in d ? d[field] : original?.[field]

  const type = resolved('type') ?? ''
  const sourceRegister = resolved('sourceRegister')
  const investment = resolved('investment')
  const targetRegister = resolved('targetRegister')
  const otherCategory = resolved('otherCategory')
  const worker = resolved('worker')
  const expenseCategory = resolved('expenseCategory')
  const vatPlane = resolved('vatPlane')
  const paymentMethod = resolved('paymentMethod')

  // A Local API update runs with overrideAccess and
  // skips the fields' `access.update`, so an edit carrying the stored doc back must not reach them.
  if (operation === 'create') {
    d.payoutStatus = carriesPayoutStatus(type) ? 'pending' : null
    d.payoutDecidedAt = null
    d.payoutRejectionReason = null
  } else {
    delete d.payoutStatus
    delete d.payoutDecidedAt
    delete d.payoutRejectionReason
  }

  // Above BOTH early returns, or anulowanie leaks through the second one.
  const target = resolveId(resolved('investment'))
  const previous = resolveId(original?.investment)
  const invoiceOnly = isInvoiceOnlyPatch(d, original)
  if (!invoiceOnly) {
    const db = await getDb(req.payload, req)
    for (const id of previous === target ? [target] : [target, previous]) {
      const lockMessage = id === undefined ? undefined : await investmentLockMessage(db, id)
      if (lockMessage) throw new APIError(lockMessage, 403)
    }
  }

  if (type === 'CANCELLATION') {
    // a REST PATCH on an EXISTING anulowanie carries only
    // the keys it changes, and reading this one off `d` would refuse the write for a field the row
    // has carried since it was created.
    if (!resolved('cancelledTransaction')) {
      throw new APIError('Cancelled transaction reference is required.', 400)
    }
    // sumRegisterBalance has no
    // CANCELLATION arm, so a register smuggled in here lands in `ELSE -amount` and drains it forever.
    d.sourceRegister = null
    return d
  }

  if (operation === 'update' && d.cancelled) {
    return d
  }

  const newlyNamed = (next: unknown, stored: unknown): number[] => {
    const id = resolveId(next)
    return id !== undefined && (operation === 'create' || id !== resolveId(stored)) ? [id] : []
  }
  const db = await getDb(req.payload, req)
  const trashedMessage =
    (await trashedRegisterMessage(db, [
      ...newlyNamed(sourceRegister, original?.sourceRegister),
      ...newlyNamed(targetRegister, original?.targetRegister),
    ])) ?? (await trashedWorkerMessage(db, newlyNamed(worker, original?.worker)))
  if (trashedMessage) throw new APIError(trashedMessage, 403)

  const errors: string[] = []

  if (operation === 'update') {
    for (const field of ['vatPlane', 'netAmount'] as const) {
      const booked = original?.[field]
      if (booked != null && field in d && d[field] !== booked) {
        errors.push(`${FROZEN_FIELD_LABELS[field]} zaksięgowanej transakcji nie można zmienić.`)
      }
    }
  }

  if (d.amount !== undefined && d.amount !== null) {
    const amountErr = getAmountError(d.amount, type)
    if (amountErr) errors.push(amountErr)
  }

  if (needsSourceRegister(type) && !sourceRegister) {
    errors.push('Cash register is required for this transfer type.')
  }

  if (!needsSourceRegister(type)) {
    d.sourceRegister = null
  }

  if (requiresInvestment(type) && !investment) {
    errors.push('Investment is required for this transfer type.')
  }

  if (!showsInvestment(type)) {
    d.investment = null
  }

  if (needsTargetRegister(type)) {
    if (!targetRegister) {
      errors.push('Target register is required for register transfers.')
    } else if (sourceRegister && targetRegister === sourceRegister) {
      errors.push('Target register must be different from source register.')
    }
  }

  if (needsOtherCategory(type) && !otherCategory) {
    errors.push('Category is required for OTHER transfers.')
  }

  if (needsWorker(type) && !worker) {
    errors.push('Worker is required for this transfer type.')
  }

  if (!showsWorker(type)) {
    d.worker = null
  }

  if (!canBeSettled(type)) {
    d.settled = false
  }

  // The numerics stay on `??` rather than
  // `resolved()`: a money field has no "cleared" state, so an explicit null is an absence the stored
  // row must fill, not an erasure to validate against.
  if (carriesNetAmount(type, vatPlane)) {
    const netErr = getNetAmountError(
      d.netAmount ?? original?.netAmount,
      d.amount ?? original?.amount,
      type,
      vatPlane,
    )
    if (netErr) errors.push(netErr)
  } else {
    d.netAmount = null
  }

  if (!carriesVatPlane(type)) {
    d.vatPlane = null
  }

  // Gated on presence because legacy rows legitimately hold a value the rule now forbids (the
  // migration did not backfill them) and an unconditional null would rewrite history.
  if (carriesPaymentMethod(type)) {
    if (!paymentMethod) errors.push('Payment method is required for this transfer type.')
  } else if ('paymentMethod' in d) {
    d.paymentMethod = null
  }

  if (needsExpenseCategory(type, !!investment) && !expenseCategory) {
    errors.push('Expense category is required for investment-related expenses.')
  }

  if (errors.length > 0) {
    console.log('[validateTransfer] Validation failed:', errors)
    throw new APIError(errors.join(' '), 400)
  }

  console.log('[validateTransfer] Passed')
  return d
}
