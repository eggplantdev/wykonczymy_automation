import type { CollectionBeforeValidateHook } from 'payload'
import type { Transaction } from '@/payload-types'
import {
  needsSourceRegister,
  requiresInvestment,
  needsWorker,
  needsTargetRegister,
  needsOtherCategory,
} from '@/lib/constants/transfers'

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

  const errors: string[] = []

  // sourceRegister — required for all types except EMPLOYEE_EXPENSE
  if (needsSourceRegister(type) && !d.sourceRegister) {
    errors.push('Cash register is required for this transfer type.')
  }

  // Auto-clear sourceRegister for EMPLOYEE_EXPENSE (prevent stale data)
  if (!needsSourceRegister(type)) {
    d.sourceRegister = null
  }

  // investment — required for INVESTOR_DEPOSIT, INVESTMENT_EXPENSE
  if (requiresInvestment(type) && !d.investment) {
    errors.push('Investment is required for this transfer type.')
  }

  // worker — required for ACCOUNT_FUNDING, EMPLOYEE_EXPENSE
  if (needsWorker(type) && !d.worker) {
    errors.push('Worker is required for this transfer type.')
  }

  // targetRegister — required for REGISTER_TRANSFER, must differ from source
  if (needsTargetRegister(type)) {
    if (!d.targetRegister) {
      errors.push('Target register is required for register transfers.')
    } else if (d.sourceRegister && d.targetRegister === d.sourceRegister) {
      errors.push('Target register must be different from source register.')
    }
  }

  // otherCategory — required for OTHER (EMPLOYEE_EXPENSE has its own check below)
  if (type !== 'EMPLOYEE_EXPENSE' && needsOtherCategory(type) && !d.otherCategory) {
    errors.push('Category is required for OTHER transfers.')
  }

  // EMPLOYEE_EXPENSE: requires either investment OR (otherCategory + otherDescription)
  if (type === 'EMPLOYEE_EXPENSE') {
    const hasInvestment = !!d.investment
    const hasCategory = !!d.otherCategory
    if (!hasInvestment && !hasCategory) {
      errors.push('Employee expense requires either an investment or a category.')
    }
    if (hasInvestment && hasCategory) {
      // Investment takes precedence — auto-clear category
      d.otherCategory = null
      d.otherDescription = null
    }
  }

  if (errors.length > 0) {
    console.log('[validateTransfer] Validation failed:', errors)
    throw new Error(errors.join(' '))
  }

  console.log('[validateTransfer] Passed')
  return d
}
