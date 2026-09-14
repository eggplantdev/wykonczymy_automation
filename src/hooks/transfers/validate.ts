import { APIError, type CollectionBeforeValidateHook } from 'payload'
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
  carriesNetAmount,
  carriesVatPlane,
  carriesPaymentMethod,
} from '@/lib/constants/transfers'
import { getAmountError, getNetAmountError } from '@/lib/utils/validation'
import { getDb } from '@/lib/db/get-db'
import { isInvestmentLocked } from '@/lib/db/investment-lock'
import { INVESTMENT_LOCKED_MESSAGE } from '@/lib/constants/investment-lock'
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

  // Fall back to the stored row throughout: a partial update (PATCH of one field) carries no
  // `type`, and an empty one would route a netto row down the else-branch below and null its
  // netAmount. The same holds for every relational field the required-checks read — an
  // invoice-only PATCH would otherwise be rejected for fields the row has carried all along.
  // Keyed on PRESENCE, not on truthiness: an explicit `null` is a CLEAR — the admin panel saves the
  // whole document, so that is how a wiped relationship arrives — and it must reach the
  // required-checks as the empty value it is, not silently read the old link off the stored row.
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

  // A settled investment moves no more money, so the gate sits here — above BOTH early returns, or
  // anulowanie leaks through the second one. Transactions have no raw-SQL writer, so unlike the
  // kosztorys this hook IS the complete gate, covering the admin panel and the API alike.
  // Both sides of a move: booking ONTO a locked investment and lifting a row OFF one.
  const target = resolveId(resolved('investment'))
  const previous = resolveId(original?.investment)
  // The one write that stays open: attaching or detaching a scan of the faktura. Keyed on the
  // VALUES that differ from the stored row — an empty array is a legitimate removal of every page.
  const invoiceOnly = isInvoiceOnlyPatch(d, original)
  if (!invoiceOnly) {
    const db = await getDb(req.payload, req)
    for (const id of previous === target ? [target] : [target, previous]) {
      // APIError, not Error: routeError rewrites the message of anything it can't prove public, so
      // a bare throw reaches `/admin` and REST as „Something went wrong" with a 500.
      if (id !== undefined && (await isInvestmentLocked(db, id))) {
        throw new APIError(INVESTMENT_LOCKED_MESSAGE, 403)
      }
    }
  }

  // CANCELLATION rows skip all normal validation — relational fields are null
  if (type === 'CANCELLATION') {
    if (!d.cancelledTransaction) {
      throw new Error('Cancelled transaction reference is required.')
    }
    // The one field the early return may NOT wave through: sumRegisterBalance has no
    // CANCELLATION arm, so a register smuggled in here (REST / Local API — the admin
    // panel no longer offers the picker) lands in `ELSE -amount` and drains it forever.
    d.sourceRegister = null
    return d
  }

  if (operation === 'update' && d.cancelled) {
    return d
  }

  const errors: string[] = []

  // Write-once, and this is the rule's home. Moving a booked plane or netto rewrites a bilans the
  // client has already seen — that correction is anuluj i zaksięguj na nowo. null → value stays
  // open: a legacy row rewrites nothing, its figure is merely still missing.
  // Here rather than at the fields' `access.update`, which a Local API write skips — hooks it
  // cannot, so this is the only altitude covering every write path. Read BEFORE the normalisation
  // below: that nulls both fields after a type change, and it is the hook tidying up, not a caller.
  if (operation === 'update') {
    for (const field of ['vatPlane', 'netAmount'] as const) {
      const booked = original?.[field]
      if (booked != null && field in d && d[field] !== booked) {
        errors.push(`${FROZEN_FIELD_LABELS[field]} zaksięgowanej transakcji nie można zmienić.`)
      }
    }
  }

  // CORRECTION allows negative (invoice credits); every other type must be positive.
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

  // Auto-clear investment for types that never carry one — two distinct reasons, one rule.
  // For OTHER / REGISTER_TRANSFER the investment is invisible: deriveFinancials buckets by
  // type, so the row lands in no bucket while still leaving the register. For the two
  // company deposits it is worse than invisible — they DO bucket as income, so an
  // investment would silently raise that investment's bilans with company-level cash
  // (EX-557). The forms hide the field, so only the API or a script can plant one; this is
  // the server-side counterpart.
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
    errors.push('Worker is required for payout transfers.')
  }

  if (!needsWorker(type)) {
    d.worker = null
  }

  // settled (wliczone w robociznę) only applies to material expenses and their
  // corrections — clear it for any other type so the admin panel / API can't persist
  // a stray flag that the reporting layer would mis-bucket.
  if (!canBeSettled(type)) {
    d.settled = false
  }

  // The netto figure is load-bearing on exactly the rows that carry one — the type billed at netto
  // and a wpłata brutto — and meaningless anywhere else, so every other row stores null. This hook
  // is the server-side authority; the rule itself lives once in getNetAmountError.
  // The numerics stay on `??` rather than `resolved()`: unlike a relationship, a money field has no
  // "cleared" state — an explicit null on a required amount is the absence the stored row must fill,
  // not an erasure to validate against.
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

  // Nulled here so the transfers filter can be trusted whatever wrote the row (admin panel, REST, a
  // script). Gated on presence, unlike every strip above it, because this is the one stripped field
  // whose legacy rows legitimately hold a value the rule now forbids — the migration deliberately
  // did not backfill them — so an unconditional null would rewrite history on an unrelated edit.
  // The others have no such history and stay unconditional.
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
    throw new Error(errors.join(' '))
  }

  console.log('[validateTransfer] Passed')
  return d
}
