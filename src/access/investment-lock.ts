import type { Access } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { isRelatedInvestmentLocked, isInvestmentLocked } from '@/lib/db/investment-lock'
import { resolveId } from '@/lib/utils/resolve-id'
import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'

// Closes `/admin` as a way around the lock: the app's writes are gated in `investmentAction`, which
// `/admin` never goes through, so a MANAGER there could otherwise edit a settled rozpiska freely.
// `read` stays open — a locked kosztorys is read-only, not hidden.

// The relationship on the incoming `data` that names the target investment. `stage-progress` carries
// no investment of its own, so it reaches one hop further out, through the pozycja it belongs to.
type CreateOwnerT = 'investment' | 'item'

// The `Where` path is derived from the owner, not passed separately — a caller could otherwise pair
// `'item'` with `'investment.status'` and get a gate guarding the wrong hop.
const LOCK_PATHS = {
  investment: 'investment.status',
  item: 'item.investment.status',
} as const satisfies Record<CreateOwnerT, string>

// Role rule has no default on purpose — collections disagree on it (`kosztoryses` keeps deletion at
// ADMIN/OWNER), so a wired-in default would hand MANAGER a delete right as a side effect.
export function unlessInvestmentLocked(base: Access, owner: CreateOwnerT): Access {
  return async (args) => {
    const allowed = await base(args)
    if (allowed !== true) return allowed
    return { [LOCK_PATHS[owner]]: { not_equals: LOCKED_INVESTMENT_STATUS } }
  }
}

// Gated in BOTH directions: a stored-row `Where` alone can't stop pointing an open sheet AT a locked
// investment, only editing an already-locked one — after which nothing can detach it without SQL.
// Only `kosztoryses` is wired; the EX-748 collections keep the stored-row-only gate (owner's hold).
export function updateUnlessInvestmentLocked(base: Access, owner: CreateOwnerT): Access {
  return unlessInvestmentLocked(createUnlessInvestmentLocked(base, owner), owner)
}

export function createUnlessInvestmentLocked(base: Access, owner: CreateOwnerT): Access {
  return async (args) => {
    const allowed = await base(args)
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
