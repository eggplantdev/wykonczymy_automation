export const CACHE_TAGS = {
  transfers: 'collection:transactions',
  cashRegisters: 'collection:cash-registers',
  investments: 'collection:investments',
  users: 'collection:users',
  otherCategories: 'collection:other-categories',
  expenseCategories: 'collection:expense-categories',
} as const

export type CacheTagT = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS]

export const entityTag = (collection: string, id: number | string) => `${collection}:${id}` as const
