export const CACHE_TAGS = {
  transfers: 'collection:transactions',
  cashRegisters: 'collection:cash-registers',
  investments: 'collection:investments',
  users: 'collection:users',
  otherCategories: 'collection:other-categories',
  expenseCategories: 'collection:expense-categories',
  kosztoryses: 'collection:kosztoryses',
  kosztorysSections: 'collection:kosztorys-sections',
  kosztorysItems: 'collection:kosztorys-items',
  leads: 'collection:leads',
} as const

export const entityTag = (collection: string, id: number | string) => `${collection}:${id}` as const
