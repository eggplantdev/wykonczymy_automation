export const ORDER_STATUSES = ['awaiting', 'delivered'] as const
export type OrderStatusT = (typeof ORDER_STATUSES)[number]

export const isOrderStatus = (value: unknown): value is OrderStatusT =>
  (ORDER_STATUSES as readonly unknown[]).includes(value)

// `label` is what the SMS and the transfer description say, and the fragment the other-category is
// found by.
export const ORDER_ITEMS = {
  bigBag: { label: 'big bag', priceKey: 'bigBagPrice' },
  container: { label: 'kontener', priceKey: 'containerPrice' },
} as const

export type OrderItemT = keyof typeof ORDER_ITEMS
export const ORDER_ITEM_KINDS = Object.keys(ORDER_ITEMS) as OrderItemT[]

export const ORDER_ACTION_LABEL = 'Zamów big bag / kontener'
