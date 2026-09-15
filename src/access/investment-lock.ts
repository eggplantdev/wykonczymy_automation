import type { Access } from 'payload'
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

// The relationship on the incoming `data` that names the target investment. `stage-progress` carries
// no investment of its own, so it reaches one hop further out, through the pozycja it belongs to.
type CreateOwnerT = 'investment' | 'item'

// The `Where` path follows from the owner, so it is derived rather than passed: given both, a caller
// could pair `'item'` with `'investment.status'` and get a gate that guards the wrong hop — access
// control failing open with nothing to typecheck against.
const LOCK_PATHS = {
  investment: 'investment.status',
  item: 'item.investment.status',
} as const satisfies Record<CreateOwnerT, string>

// The role rule is a parameter with no default on purpose: the collections do not agree on it.
// `kosztoryses` keeps deletion at ADMIN/OWNER, so a wired-in `isAdminOrOwnerOrManager` would have
// handed MANAGER a delete right as a side effect of adding a lock.
export function unlessInvestmentLocked(base: Access, owner: CreateOwnerT): Access {
  return async (args) => {
    const allowed = await base(args)
    if (allowed !== true) return allowed
    return { [LOCK_PATHS[owner]]: { not_equals: LOCKED_INVESTMENT_STATUS } }
  }
}

// An update is gated in BOTH directions, because a `Where` can only speak about the row as it is
// STORED. Alone it stops edits to a locked investment's sheet but waves through the opposite move —
// pointing an open sheet AT a locked investment — after which nothing can detach it: the panel then
// sees a locked row and the action layer refuses too, so undoing it takes SQL.
// Only `kosztoryses` is wired to it. The four EX-748 collections have the same hole and keep the
// stored-row gate for now — a deliberate hold, not a property of those collections: widening what
// `/admin` may no longer do is the owner's call, not a review finding's.
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
