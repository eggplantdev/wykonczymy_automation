import type { CollectionBeforeValidateHook } from 'payload'
import type { Transaction } from '@/payload-types'
import {
  needsSourceRegister,
  requiresInvestment,
  showsInvestment,
  needsTargetRegister,
  needsOtherCategory,
  needsWorker,
  needsExpenseCategory,
  canBeSettled,
  isDepositType,
} from '@/lib/constants/transfers'
import { getAmountError } from '@/lib/utils/validation'

type TransferData = Partial<Transaction>

/**
 * Cross-field validation for Transactions.
 * Enforces required relationships based on transaction type
 * and auto-clears inapplicable fields.
 */
export const validateTransfer: CollectionBeforeValidateHook = ({ data, req, operation }) => {
  const d = data as TransferData
  console.log('[validateTransfer] Start', { operation, type: d.type, amount: d.amount })

  // Auto-set createdBy on create
  if (operation === 'create' && req.user) {
    d.createdBy = req.user.id
  }

  const type = d.type ?? ''

  // CANCELLATION rows skip all normal validation — relational fields are null
  if (type === 'CANCELLATION') {
    if (!d.cancelledTransaction) {
      throw new Error('Cancelled transaction reference is required.')
    }
    return d
  }

  // Marking as cancelled — no field re-validation needed
  if (operation === 'update' && d.cancelled) {
    return d
  }

  const errors: string[] = []

  // Amount validation — CORRECTION allows negative (invoice corrections), others must be positive
  if (d.amount !== undefined && d.amount !== null) {
    const amountErr = getAmountError(d.amount, type)
    if (amountErr) errors.push(amountErr)
  }

  // sourceRegister — required for all types except LABOR_COST
  if (needsSourceRegister(type) && !d.sourceRegister) {
    errors.push('Cash register is required for this transfer type.')
  }

  // Auto-clear sourceRegister for types that don't need it
  if (!needsSourceRegister(type)) {
    d.sourceRegister = null
  }

  // investment — required for INVESTOR_DEPOSIT, INVESTMENT_EXPENSE, LABOR_COST
  if (requiresInvestment(type) && !d.investment) {
    errors.push('Investment is required for this transfer type.')
  }

  // Auto-clear investment for types that never carry one. deriveFinancials buckets by
  // type, so an investment-linked OTHER lands in no bucket — invisible to marża and
  // bilans while still leaving the register. The form hides the field (showsInvestment),
  // so only the API or a script can plant one; this is the server-side counterpart.
  if (!showsInvestment(type)) {
    d.investment = null
  }

  // targetRegister — required for REGISTER_TRANSFER, must differ from source
  if (needsTargetRegister(type)) {
    if (!d.targetRegister) {
      errors.push('Target register is required for register transfers.')
    } else if (d.sourceRegister && d.targetRegister === d.sourceRegister) {
      errors.push('Target register must be different from source register.')
    }
  }

  // otherCategory — required for OTHER
  if (needsOtherCategory(type) && !d.otherCategory) {
    errors.push('Category is required for OTHER transfers.')
  }

  // worker — required for PAYOUT
  if (needsWorker(type) && !d.worker) {
    errors.push('Worker is required for payout transfers.')
  }

  // Auto-clear worker for types that don't need it
  if (!needsWorker(type)) {
    d.worker = null
  }

  // kosztorysStage (zaliczka etap tag) only applies to deposit types. The schema + form gate it,
  // so only the admin panel / REST can plant one on another type; clear it here so the reporting
  // layer never sees an etap tag on a non-zaliczka row.
  if (!isDepositType(type)) {
    d.kosztorysStage = null
  }

  // settled (wliczone w robociznę) only applies to material expenses and their
  // corrections — clear it for any other type so the admin panel / API can't persist
  // a stray flag that the reporting layer would mis-bucket.
  if (!canBeSettled(type)) {
    d.settled = false
  }

  // expenseCategory — required for INVESTMENT_EXPENSE, and for CORRECTION once it has an investment
  if (needsExpenseCategory(type, !!d.investment) && !d.expenseCategory) {
    errors.push('Expense category is required for investment-related expenses.')
  }

  if (errors.length > 0) {
    console.log('[validateTransfer] Validation failed:', errors)
    throw new Error(errors.join(' '))
  }

  console.log('[validateTransfer] Passed')
  return d
}
