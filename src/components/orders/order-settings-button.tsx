'use client'

import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { OrderSettingsForm } from '@/components/forms/order-settings-form/order-settings-form'
import type { OrderSettingsT } from '@/types/order-settings'

const TITLE = 'Ustawienia zamówień'
const FORM_ID = 'order-settings'

export function OrderSettingsButton({ settings }: { settings: OrderSettingsT }) {
  return (
    <FormDialog
      formId={FORM_ID}
      title={TITLE}
      description="Dostawcy dostają SMS z zamówieniem; ceny wypełniają kwotę wydatku."
      showKeepOpen={false}
      trigger={
        <Button type="button" variant="ghost" size="iconLg" aria-label={TITLE}>
          <Settings />
        </Button>
      }
    >
      {(onSubmitSuccess) => (
        <OrderSettingsForm formId={FORM_ID} settings={settings} onSubmitSuccess={onSubmitSuccess} />
      )}
    </FormDialog>
  )
}
