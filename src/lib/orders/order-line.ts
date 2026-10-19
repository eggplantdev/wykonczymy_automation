import { ORDER_ITEMS, type OrderItemT } from '@/lib/constants/orders'

export const orderLine = (kind: OrderItemT, quantity: number) =>
  `${quantity} × ${ORDER_ITEMS[kind].label}`
