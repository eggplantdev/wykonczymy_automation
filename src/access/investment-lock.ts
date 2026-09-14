import type { Access } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { getDb } from '@/lib/db/get-db'
import { isRelatedInvestmentLocked, isInvestmentLocked } from '@/lib/db/investment-lock'
import { resolveId } from '@/lib/utils/resolve-id'
import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'

// Closes `/admin` as a way around the lock. The app's own writes are gated in the action layer
// (`investmentAction`), which the panel never goes through — a MANAGER reaches `/admin` and every
// kosztorys collection grants it the full CRUD, so without this the panel edits a settled
// investment's rozpiska freely.
//
// `read` deliberately stays open: a locked kosztorys is read-only, not hidden.

// `stage-progress` carries no investment of its own, so it reaches the status through its pozycja.
type LockPathT = 'investment.status' | 'item.investment.status'

// The relationship on the incoming `data` that names the target investment for a create. `item`
// reaches the investment one hop further out, through the pozycja it belongs to.
type CreateOwnerT = 'investment' | 'item'

export function unlessInvestmentLocked(path: LockPathT): Access {
  return (args) => {
    const allowed = isAdminOrOwnerOrManager(args)
    if (allowed !== true) return allowed
    return { [path]: { not_equals: LOCKED_INVESTMENT_STATUS } }
  }
}

export function createUnlessInvestmentLocked(owner: CreateOwnerT): Access {
  return async (args) => {
    const allowed = isAdminOrOwnerOrManager(args)
    if (allowed !== true) return allowed

    const data = args.data as Record<string, unknown> | undefined
    const ownerId = resolveId(data?.[owner])
    // No owner in the payload means the create fails validation anyway (both relationships are
    // required) — refusing here would just replace that message with a misleading one.
    if (ownerId === undefined) return true

    const payload = args.req.payload
    const db = await getDb(payload, args.req)
    if (owner === 'item') {
      // `req` on purpose: without it the lookup reads outside the caller's transaction and cannot
      // see a parent created moments ago in the same one. A missing parent is not this gate's
      // error to raise either — the required-relationship check says it better.
      const item = await payload
        .findByID({
          collection: 'kosztorys-items',
          id: ownerId,
          depth: 0,
          overrideAccess: true,
          req: args.req,
        })
        .catch(() => undefined)
      return !(await isRelatedInvestmentLocked(db, item?.investment))
    }
    return !(await isInvestmentLocked(db, ownerId))
  }
}
