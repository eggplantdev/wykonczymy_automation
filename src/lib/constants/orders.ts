export const ORDER_STATUSES = ['awaiting', 'delivered'] as const
export type OrderStatusT = (typeof ORDER_STATUSES)[number]

// `label` is the fragment the other-category is found by.
export const ORDER_ITEMS = {
  bigBag: {
    label: 'big bag',
    priceKey: 'bigBagPrice',
    defaultSupplierKey: 'defaultBigBagSupplierId',
  },
  container: {
    label: 'kontener',
    priceKey: 'containerPrice',
    defaultSupplierKey: 'defaultContainerSupplierId',
  },
} as const

export type OrderItemT = keyof typeof ORDER_ITEMS
export const ORDER_ITEM_KINDS = Object.keys(ORDER_ITEMS) as OrderItemT[]

export const ORDER_ACTION_LABEL = 'Zamów big bag / kontener'
