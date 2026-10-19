'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SELECT_NONE, SimpleSelect } from '@/components/ui/simple-select'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { SaveAsDefaultButton } from '@/components/ui/save-as-default-button'
import { setInvestmentSiteManagerAction } from '@/lib/actions/investments'
import { setDefaultSupplierAction } from '@/lib/actions/order-settings'
import { ORDER_ITEMS, ORDER_ITEM_KINDS, type OrderItemT } from '@/lib/constants/orders'
import { isOrderPrice } from '@/lib/orders/order-price'
import { formatPLN } from '@/lib/utils/format-currency'
import { isActiveRef } from '@/lib/utils/is-active-ref'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { sanitizeNumericInput } from '@/lib/utils/sanitize-numeric-input'
import type { OrderContactT } from '@/lib/orders/compose-order-sms'
import type { OrderSettingsT } from '@/types/order-settings'
import type { WorkerRefT } from '@/types/reference-data'

export type OrderPickT = {
  kind: OrderItemT
  quantity: number
  unitPrice: number
  contact: OrderContactT | undefined
  supplierPhone: string
}

type OrderPickStepPropsT = {
  orderSettings: OrderSettingsT
  investmentId: number
  workers: WorkerRefT[]
  siteManagerId: number | undefined
  settingsButton?: React.ReactNode
  onNext: (pick: OrderPickT) => void
}

const SITE_MANAGER_LABELS = {
  isDefault: 'Kierownik budowy',
  save: 'Ustaw jako kierownika budowy',
  saved: 'Kierownik budowy zapisany',
}

const SUPPLIER_LABELS = {
  isDefault: 'Dostawca domyślny',
  save: 'Zapisz jako domyślnego dostawcę',
  saved: 'Domyślny dostawca zapisany',
}

const KIND_OPTIONS = ORDER_ITEM_KINDS.map((kind) => ({
  value: kind,
  label: ORDER_ITEMS[kind].label,
}))

export function OrderPickStep({
  orderSettings,
  investmentId,
  workers,
  siteManagerId,
  settingsButton,
  onNext,
}: OrderPickStepPropsT) {
  const { suppliers, defaultSupplierId } = orderSettings
  const contacts = workers.filter(
    (worker): worker is WorkerRefT & { phone: string } => isActiveRef(worker) && !!worker.phone,
  )

  const [kind, setKind] = useState<OrderItemT>('bigBag')
  const [quantityText, setQuantityText] = useState('1')
  const defaultPrice = String(orderSettings[ORDER_ITEMS[kind].priceKey])
  const [priceText, setPriceText] = useState(defaultPrice)
  const [shownDefaultPrice, setShownDefaultPrice] = useState(defaultPrice)
  const [contactId, setContactId] = useState(() =>
    contacts.some((worker) => worker.id === siteManagerId) ? String(siteManagerId) : SELECT_NONE,
  )
  const [supplierId, setSupplierId] = useState(defaultSupplierId)

  // A price saved from the gear replaces the field.
  if (shownDefaultPrice !== defaultPrice) {
    setShownDefaultPrice(defaultPrice)
    setPriceText(defaultPrice)
  }

  const quantity = Number(quantityText)
  const unitPrice = Number(priceText)
  const isQuantityValid = Number.isInteger(quantity) && quantity >= 1
  const isPriceValid = isOrderPrice(priceText)
  const contactWorker = contacts.find((worker) => String(worker.id) === contactId)
  const contact = contactWorker && { name: contactWorker.name, phone: contactWorker.phone }
  // Resolved on every render: the gear can delete the picked supplier while this step is open.
  const supplier =
    suppliers.find((candidate) => candidate.id === supplierId) ??
    suppliers.find((candidate) => candidate.id === defaultSupplierId) ??
    suppliers[0]

  function handleKindChange(next: OrderItemT) {
    setKind(next)
    setPriceText(String(orderSettings[ORDER_ITEMS[next].priceKey]))
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
            onChange={(event) => setPriceText(sanitizeNumericInput(event.target.value))}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="order-supplier">Dostawca</Label>
        {supplier ? (
          <>
            <SimpleSelect
              id="order-supplier"
              value={supplier.id}
              onValueChange={setSupplierId}
              options={suppliers.map((candidate) => ({
                value: candidate.id,
                label: `${candidate.name} · ${candidate.phone}`,
              }))}
            />
            <SaveAsDefaultButton
              selectedId={supplier.id}
              defaultId={defaultSupplierId}
              onSave={setDefaultSupplierAction}
              labels={SUPPLIER_LABELS}
            />
          </>
        ) : (
          <Description tone="error" withIcon={false}>
            Lista dostawców jest pusta — numer wpiszesz w telefonie.
          </Description>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="order-contact">Kontakt na miejscu</Label>
        {contacts.length === 0 ? (
          <Description withIcon={false}>
            Tutaj pojawią się pracownicy z zapisanymi numerami telefonów.
          </Description>
        ) : (
          <SimpleSelect
            id="order-contact"
            value={contactWorker ? contactId : SELECT_NONE}
            onValueChange={setContactId}
            options={[
              { value: SELECT_NONE, label: '— brak —' },
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
          onClick={() =>
            onNext({ kind, quantity, unitPrice, contact, supplierPhone: supplier?.phone ?? '' })
          }
        >
          Dalej
        </Button>
        {settingsButton}
      </div>
    </div>
  )
}
