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
