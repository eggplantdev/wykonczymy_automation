export const CACHE_TAGS = {
  transfers: 'collection:transactions',
  cashRegisters: 'collection:cash-registers',
  investments: 'collection:investments',
  users: 'collection:users',
  otherCategories: 'collection:other-categories',
  expenseCategories: 'collection:expense-categories',
  media: 'collection:media',
  kosztoryses: 'collection:kosztoryses',
  kosztorysSections: 'collection:kosztorys-sections',
  kosztorysItems: 'collection:kosztorys-items',
  kosztorysStages: 'collection:kosztorys-stages',
  stageProgress: 'collection:stage-progress',
  leads: 'collection:leads',
  presets: 'collection:kosztorys-presets',
  vehicles: 'collection:vehicles',
  vehicleInspections: 'collection:vehicle-inspections',
  workCatalogue: 'collection:work-catalogue-items',
  equipment: 'collection:equipment',
  equipmentEvents: 'collection:equipment-events',
  warehouses: 'collection:warehouses',
} as const

export const entityTag = (collection: string, id: number | string) => `${collection}:${id}` as const

// Its own const rather than a `CACHE_TAGS` entry: that map is keyed by collection slug and
// `revalidateCollections` iterates it, and this is a global — there is no collection to name.
export const NOTIFICATION_RECIPIENTS_TAG = 'global:notification-recipients'

// Every tag a whole-tree kosztorys replacement invalidates. Settings may be copied rather than
// changed, but `restoreKosztorys` rewrites the investment row regardless, so `investments` goes with
// the four tree tags. Shared so the three replacement paths — snapshot restore, sheet import, preset
// reload — can never bump different lists.
export const KOSZTORYS_TREE_TAGS = [
  'kosztorysSections',
  'kosztorysItems',
  'kosztorysStages',
  'stageProgress',
  'investments',
] as const satisfies readonly (keyof typeof CACHE_TAGS)[]

/**
 * The second argument every `revalidateTag` call outside a Server Action must pass.
 *
 * That argument is a cacheLife profile, and a NAMED one does not hard-expire anything: the
 * filesystem handler drops an `unstable_cache` entry only when the tag's stored `expired` stamp is
 * already past (`areTagsExpired`), and a named profile sets it to `now + profile.expire` —
 * 0xfffffffe seconds for `default`, a year for `max`. What it does set is `stale`, and
 * `unstable_cache` honours that: it serves the stale value and queues a background recompute. So
 * `'default'` degraded the invalidation to stale-while-revalidate — the read right after the write
 * saw pre-write rows, the one after that was fresh.
 *
 * On most of the hook sites that was invisible, because the Server Action that triggered the write
 * had already called `updateTag` on the same tags in the same request; the hook's call was
 * redundant. It bit where no action runs: `/api/upload-file` is a Route Handler whose only
 * invalidation is the `media` afterChange hook, so an uploaded faktura's first read-back still
 * rendered „Dodaj fakturę".
 *
 * `{ expire: 0 }` is the form that expires on the spot — the same stamp `updateTag` writes, minus
 * its Server-Action-only restriction. Verified against Next 16.1.7's bundled `FileSystemCache`;
 * `durations.expire === 0` is the documented immediate-expire contract on the cache-handler
 * interface, so Vercel's own handler should agree, but that half is assumed until it deploys.
 *
 * Do NOT use this inside a Server Action that wants to skip its own re-render — see `EXPIRE_NEXT`.
 */
export const EXPIRE_NOW = { expire: 0 } as const

/**
 * The deferred twin: expires the tag without re-rendering the calling route.
 *
 * `revalidate()` ends with `if (!profile || cacheLife?.expire === 0) store.pathWasRevalidated = …`,
 * and that flag is what makes a Server Action stream a fresh render of its own route back in the
 * action response. So `EXPIRE_NOW` inside an action is observationally identical to `updateTag` —
 * including the 90-193 ms per debounced save that EX-597 removed from the editor's autosaves. Any
 * non-zero `expire` leaves the flag unset, and one second is past by the time the next request for
 * another route arrives, so the entry is a hard miss rather than a stale-while-revalidate hit.
 */
export const EXPIRE_NEXT = { expire: 1 } as const
