'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SimpleSelect } from '@/components/ui/simple-select'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { SaveAsDefaultButton } from '@/components/orders/save-as-default-button'
import { setInvestmentSiteManagerAction } from '@/lib/actions/investments'
import { ORDER_ITEMS, ORDER_ITEM_KINDS, type OrderItemT } from '@/lib/constants/orders'
import { formatPLN } from '@/lib/utils/format-currency'
import { isActiveRef } from '@/lib/utils/is-active-ref'
import { roundToCents } from '@/lib/utils/round-to-cents'
import type { OrderContactT } from '@/lib/orders/compose-order-sms'
import type { OrderSettingsT } from '@/types/order-settings'
import type { WorkerRefT } from '@/types/reference-data'

export type OrderPickT = {
  kind: OrderItemT
  quantity: number
  unitPrice: number
  contact: OrderContactT | undefined
}

type OrderPickStepPropsT = {
  prices: Pick<OrderSettingsT, 'bigBagPrice' | 'containerPrice'>
  investmentId: number
  workers: WorkerRefT[]
  siteManagerId: number | undefined
  settings?: React.ReactNode
  onNext: (pick: OrderPickT) => void
}

// Radix Select refuses an empty-string item value.
const NONE = 'none'

const SITE_MANAGER_LABELS = {
  isDefault: 'Kierownik budowy',
  save: 'Ustaw jako kierownika budowy',
  saved: 'Kierownik budowy zapisany',
}

const KIND_OPTIONS = ORDER_ITEM_KINDS.map((kind) => ({
  value: kind,
  label: ORDER_ITEMS[kind].label,
}))

export function OrderPickStep({
  prices,
  investmentId,
  workers,
  siteManagerId,
  settings,
  onNext,
}: OrderPickStepPropsT) {
  const contacts = workers.filter(
    (worker): worker is WorkerRefT & { phone: string } => isActiveRef(worker) && !!worker.phone,
  )

  const [kind, setKind] = useState<OrderItemT>('bigBag')
  const [quantityText, setQuantityText] = useState('1')
  const [priceText, setPriceText] = useState(String(prices[ORDER_ITEMS.bigBag.priceKey]))
  const [contactId, setContactId] = useState(() =>
    contacts.some((worker) => worker.id === siteManagerId) ? String(siteManagerId) : NONE,
  )

  const quantity = Number(quantityText)
  const unitPrice = Number(priceText)
  const isQuantityValid = Number.isInteger(quantity) && quantity >= 1
  const isPriceValid = priceText !== '' && Number.isFinite(unitPrice) && unitPrice > 0
  const contactWorker = contacts.find((worker) => String(worker.id) === contactId)
  const contact = contactWorker && { name: contactWorker.name, phone: contactWorker.phone }

  function handleKindChange(next: OrderItemT) {
    setKind(next)
    setPriceText(String(prices[ORDER_ITEMS[next].priceKey]))
  }

  return (
    <div className="grid gap-4">
      <ToggleGroup
        aria-label="Co zamawiasz"
        options={KIND_OPTIONS}
        value={kind}
        onChange={handleKindChange}
        size="md"
        isEqualWidth
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="order-quantity">Ilość</Label>
          <Input
            id="order-quantity"
            inputMode="numeric"
            value={quantityText}
            onChange={(event) => setQuantityText(event.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="order-unit-price">Cena za sztukę (zł)</Label>
          <Input
            id="order-unit-price"
            inputMode="decimal"
            value={priceText}
            onChange={(event) =>
              setPriceText(event.target.value.replace(/\s/g, '').replace(',', '.'))
            }
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Kontakt na miejscu</Label>
        {contacts.length === 0 ? (
          <Description withIcon={false}>
            Tutaj pojawią się pracownicy z zapisanymi numerami telefonów.
          </Description>
        ) : (
          <SimpleSelect
            value={contactId}
            onValueChange={setContactId}
            options={[
              { value: NONE, label: '— brak —' },
              ...contacts.map((worker) => ({
                value: String(worker.id),
                label: `${worker.name} · ${worker.phone}`,
              })),
            ]}
          />
        )}
        {contact && (
          <SaveAsDefaultButton
            selectedId={contactId}
            defaultId={siteManagerId === undefined ? undefined : String(siteManagerId)}
            onSave={(id) => setInvestmentSiteManagerAction(investmentId, Number(id))}
            labels={SITE_MANAGER_LABELS}
          />
        )}
      </div>
      <p className="text-sm">
        Kwota:{' '}
        {!isQuantityValid
          ? 'podaj ilość (liczba całkowita, co najmniej 1)'
          : !isPriceValid
            ? 'podaj cenę większą od zera'
            : `${quantity} × ${formatPLN(unitPrice)} = ${formatPLN(roundToCents(quantity * unitPrice))}`}
      </p>
      <div className="flex items-center justify-between gap-2">
        <Button
          disabled={!isQuantityValid || !isPriceValid}
          onClick={() => onNext({ kind, quantity, unitPrice, contact })}
        >
          Dalej
        </Button>
        {settings}
      </div>
    </div>
  )
}
