// Its own module rather than a constant on `investment-action.ts`, which is `server-only`: the
// transfers gate is a COLLECTION HOOK, so it is pulled into the Payload CLI graph, where
// `server-only` throws under `payload generate:types`. Both planes refuse in the same sentence.
export const INVESTMENT_LOCKED_MESSAGE =
  'Inwestycja jest zakończona i tylko do odczytu. Aby ją zmienić, ustaw jej status na „Aktywna".'

/**
 * „Zakończona" IS the lock — the whole feature is this one comparison, spelled once. Six layers ask
 * it (the panel's access rules, both gates, the editor page, the form's confirmation), so a second
 * locking status would otherwise mean finding six literals.
 */
export const LOCKED_INVESTMENT_STATUS = 'completed'

export const isLockedStatus = (status: string | null | undefined): boolean =>
  status === LOCKED_INVESTMENT_STATUS

/**
 * The pickers' courtesy filter — a zakończona inwestycja is not offered for a new booking. The gate
 * is the collection hook; this only spares the user a refusal they could have seen coming.
 */
export const isBookableInvestment = (investment: { status: string }): boolean =>
  !isLockedStatus(investment.status)
