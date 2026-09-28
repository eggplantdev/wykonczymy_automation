import { APIError } from 'payload'
import type { CollectionBeforeDeleteHook } from 'payload'
import { makeDeleteBlocker, type DeleteBlockerT } from '@/lib/db/delete-blocker'

export function refuseDeleteWhen(blocker: DeleteBlockerT): CollectionBeforeDeleteHook {
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
