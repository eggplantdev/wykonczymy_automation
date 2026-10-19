'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { ORDER_ITEMS, ORDER_ITEM_KINDS, type OrderItemT } from '@/lib/constants/orders'
import { formatPLN } from '@/lib/utils/format-currency'
import type { OrderSettingsT } from '@/types/order-settings'

export type OrderPickT = { kind: OrderItemT; quantity: number }

type OrderPickStepPropsT = {
  prices: Pick<OrderSettingsT, 'bigBagPrice' | 'containerPrice'>
  onNext: (pick: OrderPickT) => void
}

const KIND_OPTIONS = ORDER_ITEM_KINDS.map((kind) => ({ value: kind, label: ORDER_ITEMS[kind].label }))

export function OrderPickStep({ prices, onNext }: OrderPickStepPropsT) {
  const [kind, setKind] = useState<OrderItemT>('bigBag')
  const [quantityText, setQuantityText] = useState('1')

  const quantity = Number(quantityText)
  const isValid = Number.isInteger(quantity) && quantity >= 1
  const price = prices[ORDER_ITEMS[kind].priceKey]

  return (
    <div className="grid gap-4">
      <ToggleGroup
        aria-label="Co zamawiasz"
        options={KIND_OPTIONS}
        value={kind}
        onChange={setKind}
        isEqualWidth
      />
      <div className="grid gap-2">
        <Label htmlFor="order-quantity">Ilość</Label>
        <Input
          id="order-quantity"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          className="w-24"
          value={quantityText}
          onChange={(event) => setQuantityText(event.target.value)}
        />
      </div>
      <p className="text-sm">
        Kwota:{' '}
        {isValid
          ? `${quantity} × ${formatPLN(price)} = ${formatPLN(quantity * price)}`
          : 'podaj ilość (liczba całkowita, co najmniej 1)'}
      </p>
      <Button className="justify-self-start" disabled={!isValid} onClick={() => onNext({ kind, quantity })}>
        Dalej
      </Button>
    </div>
  )
}
