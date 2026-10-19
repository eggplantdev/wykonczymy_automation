'use client'

import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { Label } from '@/components/ui/label'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Textarea } from '@/components/ui/textarea'
import { SaveAsDefaultButton } from '@/components/orders/save-as-default-button'
import { setDefaultSupplierAction } from '@/lib/actions/order-settings'
import { composeOrderSms } from '@/lib/orders/compose-order-sms'
import type { OrderPickT } from '@/components/orders/order-pick-step'
import type { SiteAddressT } from '@/lib/investments/format-address'
import type { OrderSettingsT } from '@/types/order-settings'

type OrderSmsStepPropsT = {
  pick: OrderPickT
  address: SiteAddressT
  orderSettings: OrderSettingsT
  onClose: () => void
}

const SUPPLIER_LABELS = {
  isDefault: 'Dostawca domyślny',
  save: 'Zapisz jako domyślnego dostawcę',
  saved: 'Domyślny dostawca zapisany',
}

export function OrderSmsStep({ pick, address, orderSettings, onClose }: OrderSmsStepPropsT) {
  const { suppliers, defaultSupplierId } = orderSettings
  const [supplierId, setSupplierId] = useState(
    () =>
      suppliers.find((supplier) => supplier.id === defaultSupplierId)?.id ?? suppliers[0]?.id ?? '',
  )
  const [message, setMessage] = useState(() => composeOrderSms({ ...pick, address }))

  const phone = suppliers.find((supplier) => supplier.id === supplierId)?.phone ?? ''
  const smsHref = `sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(message)}`

  return (
    <div className="grid gap-4">
      {suppliers.length > 0 && (
        <div className="grid gap-2">
          <Label>Dostawca</Label>
          <SimpleSelect
            value={supplierId}
            onValueChange={setSupplierId}
            options={suppliers.map((supplier) => ({
              value: supplier.id,
              label: `${supplier.name} · ${supplier.phone}`,
            }))}
          />
          <SaveAsDefaultButton
            selectedId={supplierId}
            defaultId={defaultSupplierId}
            onSave={setDefaultSupplierAction}
            labels={SUPPLIER_LABELS}
          />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="order-sms-message">Wiadomość</Label>
        <Textarea
          id="order-sms-message"
          rows={12}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>
      {suppliers.length === 0 && (
        <Description tone="error" withIcon={false}>
          Lista dostawców jest pusta — wpisz numer w telefonie.
        </Description>
      )}
      <div className="flex items-center gap-2">
        <Button asChild>
          <a href={smsHref}>
            <MessageSquare />
            Wyślij SMS
          </a>
        </Button>
        <Button variant="outline" onClick={onClose}>
          Zamknij
        </Button>
      </div>
    </div>
  )
}
