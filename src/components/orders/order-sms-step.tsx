'use client'

import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Textarea } from '@/components/ui/textarea'
import { DefaultSupplierButton } from '@/components/orders/default-supplier-button'
import { composeOrderSms, type OrderContactT } from '@/lib/orders/compose-order-sms'
import type { OrderPickT } from '@/components/orders/order-pick-step'
import type { OrderSettingsT } from '@/types/order-settings'

export type OrderAddressT = { street: string; postalCode: string; city: string }

type OrderSmsStepPropsT = {
  pick: OrderPickT
  address: OrderAddressT
  siteManager: { name: string; phone?: string } | undefined
  orderSettings: OrderSettingsT
  onClose: () => void
}

export function OrderSmsStep({
  pick,
  address,
  siteManager,
  orderSettings,
  onClose,
}: OrderSmsStepPropsT) {
  const { suppliers, defaultSupplierId } = orderSettings
  const contact: OrderContactT | undefined =
    siteManager?.phone ? { name: siteManager.name, phone: siteManager.phone } : undefined

  const [supplierId, setSupplierId] = useState(
    () => suppliers.find((supplier) => supplier.id === defaultSupplierId)?.id ?? suppliers[0]?.id ?? '',
  )
  const [message, setMessage] = useState(() => composeOrderSms({ ...pick, address, contact }))

  const phone = suppliers.find((supplier) => supplier.id === supplierId)?.phone ?? ''
  const smsHref = `sms:${phone.replace(/\s/g, '')}?&body=${encodeURIComponent(message)}`

  const warnings = [
    !siteManager && 'Inwestycja nie ma kierownika budowy — ustaw go na stronie inwestycji.',
    siteManager && !siteManager.phone && 'Kierownik budowy nie ma numeru telefonu.',
    suppliers.length === 0 && 'Lista dostawców jest pusta — wpisz numer w telefonie.',
  ].filter((warning): warning is string => !!warning)

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
          <DefaultSupplierButton selectedId={supplierId} defaultSupplierId={defaultSupplierId} />
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
      {warnings.map((warning) => (
        <p key={warning} className="text-destructive text-sm">
          {warning}
        </p>
      ))}
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
