import type { OrderItemT } from '@/lib/constants/orders'
import { formatAddress, type SiteAddressT } from '@/lib/investments/format-address'
import { orderLine } from '@/lib/orders/order-line'

export type OrderContactT = { name: string; phone: string }

type OrderSmsT = {
  kind: OrderItemT
  quantity: number
  address: SiteAddressT
  contact: OrderContactT | undefined
}

export function composeOrderSms({ kind, quantity, address, contact }: OrderSmsT): string {
  const lines = [
    'Dzień dobry,',
    '',
    'Prosimy o zamówienie:',
    orderLine(kind, quantity),
    `Adres: ${formatAddress({ ...address, country: '' })}`,
  ]
  if (contact) lines.push('', `Kontakt na miejscu: ${contact.name}, ${contact.phone}`)
  lines.push('', 'Będę wdzięczny za potwierdzenie.', '', 'Dzięki,', 'Zespół Wykończymy')
  return lines.join('\n')
}
