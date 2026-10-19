'use client'

import { Star, Truck } from 'lucide-react'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import { Description } from '@/components/ui/description'
import { SettingsCard } from '@/components/ui/settings-card'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { OrderSettingsForm } from '@/components/forms/order-settings-form/order-settings-form'
import { formatPLN } from '@/lib/utils/format-currency'
import type { OrderSettingsT } from '@/types/order-settings'

const TITLE = 'Zamówienia big bag / kontener'
const FORM_ID = 'order-settings'

type PropsT = {
  settings: OrderSettingsT
  canEdit: boolean
}

export function OrderSettingsCard({ settings, canEdit }: PropsT) {
  return (
    <SettingsCard
      icon={Truck}
      title={TITLE}
      action={
        canEdit && (
          <FormDialog
            formId={FORM_ID}
            title={TITLE}
            description="Dostawcy dostają SMS z zamówieniem; ceny wypełniają kwotę wydatku."
            showKeepOpen={false}
            trigger={<EditButton type="button" label={`Edytuj: ${TITLE}`} showLabel />}
          >
            {(onSubmitSuccess) => (
              <OrderSettingsForm
                formId={FORM_ID}
                settings={settings}
                onSubmitSuccess={onSubmitSuccess}
              />
            )}
          </FormDialog>
        )
      }
    >
      <p className="text-muted-foreground mt-2 text-sm">
        Big bag: {formatPLN(settings.bigBagPrice)} · Kontener: {formatPLN(settings.containerPrice)}
      </p>
      {settings.suppliers.length === 0 ? (
        <Description tone="error" size="xs" className="mt-2">
          Brak dostawców — SMS z zamówieniem otworzy się bez odbiorcy.
        </Description>
      ) : (
        <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
          {settings.suppliers.map((supplier) => (
            <li key={supplier.id} className="flex items-center gap-1.5">
              {supplier.id === settings.defaultSupplierId && (
                <Star className="size-3.5 fill-current text-amber-500" aria-label="Domyślny" />
              )}
              {supplier.name}, {supplier.phone}
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  )
}
