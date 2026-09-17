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
 * The templates workbench — a hidden investment the szablon editor works over. It is NOT locked
 * (its kosztorys is the whole point of it being editable); it simply is not a real investment, so
 * no money may be booked against it.
 */
export const TEMPLATE_INVESTMENT_STATUS = 'szablon'

/**
 * The pickers' courtesy filter — the real gate is the collection hook; this just spares an
 * avoidable refusal. Deliberately asks ONE question: the workbench is excluded upstream by
 * fetchReferenceData, not here, so folding "is a real investment" into this check can't silently
 * leak into a caller that only meant to ask "is bookable".
 */
export const isBookableInvestment = (investment: { status: string }): boolean =>
  !isLockedStatus(investment.status)
