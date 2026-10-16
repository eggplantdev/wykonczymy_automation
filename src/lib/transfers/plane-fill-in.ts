import {
  canFillVatPlane,
  planeFor,
  type PaymentMethodT,
  type VatPlaneT,
} from '@/lib/constants/transfers'
import type { TransferRowT } from '@/types/transfers'

// A select cannot offer an empty option (Radix reserves `value=""`), so the unanswered state gets a
// name.
export const UNANSWERED_PAYMENT_METHOD = 'UNANSWERED'

export type PlaneFillInT = {
  paymentMethod?: PaymentMethodT
  vatPlane?: VatPlaneT
  netAmount?: number
}

/**
 * The row gets exactly one chance, so a save that did not ASK the question must not answer it.
 */
export function planeFillIn(
  row: Pick<TransferRowT, 'type' | 'vatPlane'>,
  answer: string,
  netAmount: string,
): PlaneFillInT {
  if (!canFillVatPlane(row) || answer === UNANSWERED_PAYMENT_METHOD) {
    // An unchanged value still counts as a write, and the collection hook nulls a method on every
    // type that does not carry one, so an edit about something else would wipe what a legacy row was
    // booked with.
    return {}
  }

  const vatPlane = planeFor(row.type, answer)
  return {
    paymentMethod: answer as PaymentMethodT,
    vatPlane,
    ...(vatPlane === 'GROSS' && netAmount ? { netAmount: Number(netAmount) } : {}),
  }
}
