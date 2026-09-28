import { APIError } from 'payload'
import type {
  CollectionBeforeDeleteHook,
  CollectionSlug,
  Payload,
  PayloadRequest,
  Where,
} from 'payload'

/**
 * Narrow a `transactions` probe to rows that still mean something.
 *
 * A cancelled transaction is read by no figure — every sum in `lib/db` filters `cancelled IS NOT
 * TRUE` — so orphaning one moves no money. Nor does it erase the audit trail: the dashboard's
 * transaction list is scoped to nothing, so `?cancelledTransactionAudit=1` still reaches the row,
 * and its CANCELLATION stays paired through `cancelledTransaction`, which names no investment,
 * kasa or person. What the row loses is a pointer to a record being deleted anyway.
 *
 * `not_equals` compiles to `IS NULL OR <> true` (Payload's drizzle adapter), so the nullable
 * `cancelled` column cannot let a live row slip past unblocked.
 *
 * Only for `transactions` — no other probed collection has the column.
 */
export function excludingCancelled(where: Where): Where {
  return { and: [where, { cancelled: { not_equals: true } }] }
}

type DeleteProbeT = {
  collection: CollectionSlug
  where: (id: string | number) => Where
  /** Names the referencing data in the refusal, e.g. „transakcje" → „(transakcje: 5)". */
  label: string
}

/**
 * The sentence refusing a hard delete while another collection still references the row, or
 * `undefined` when nothing does.
 *
 * The FKs pointing at these collections are `ON DELETE SET NULL`, so the delete would NOT fail — it
 * would strip the reference and leave a row nothing can be traced back to. A `NOT NULL` FK is the
 * other half of the same problem: there the delete fails, but with a raw `23502` instead of a
 * sentence anyone can act on. This turns both into one refusal that names the counts.
 *
 * Callable outside the hook so an action that must refuse on the same condition (moving an
 * investment to the trash) asks the one definition instead of a copy of it.
 */
export function makeDeleteBlocker({
  probes,
  message,
}: {
  probes: readonly DeleteProbeT[]
  message: (blockers: string[]) => string
}): (payload: Payload, id: string | number, req: PayloadRequest) => Promise<string | undefined> {
  return async (payload, id, req) => {
    // `req` is forwarded so each count joins the caller's transaction: a caller that clears the
    // referencing rows and this one in a single transaction must not be refused on pre-delete state.
    const blockers = (
      await Promise.all(
        probes.map(async ({ collection, where, label }) => {
          const { totalDocs } = await payload.count({ collection, where: where(id), req })

          return totalDocs > 0 ? `${label}: ${totalDocs}` : null
        }),
      )
    ).filter((entry) => entry !== null)

    return blockers.length > 0 ? message(blockers) : undefined
  }
}

export function refuseDeleteWhen(
  blocker: ReturnType<typeof makeDeleteBlocker>,
): CollectionBeforeDeleteHook {
  return async ({ id, req }) => {
    const refusal = await blocker(req.payload, id, req)
    // APIError, not Error: routeError swaps the message of anything it can't prove public for
    // „Something went wrong.", and a status other than 500 is what proves it.
    if (refusal) throw new APIError(refusal, 400)
  }
}

export function makePreventDelete(spec: Parameters<typeof makeDeleteBlocker>[0]) {
  return refuseDeleteWhen(makeDeleteBlocker(spec))
}
