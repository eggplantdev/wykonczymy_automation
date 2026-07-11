'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { InvestmentForm } from '@/components/forms/investment-form/investment-form'
import { createInvestmentAction } from '@/lib/actions/investments'
import { listPresetsAction } from '@/lib/actions/kosztorys-presets'
import type { InvestmentFormValuesT } from '@/components/forms/investment-form/investment-schema'
import type { PresetMetaT } from '@/lib/db/presets'

const EMPTY_DEFAULTS: InvestmentFormValuesT = {
  name: '',
  address: '',
  phone: '',
  email: '',
  contactPerson: '',
  notes: '',
  review: '',
  status: 'active',
  presetId: '',
}

export function AddInvestmentDialog() {
  const [presets, setPresets] = useState<PresetMetaT[]>([])

  // Load the preset library once so the create form can offer a "seed from preset" picker. A failed
  // fetch just leaves the picker hidden — investment-create must never depend on presets existing.
  useEffect(() => {
    let active = true
    listPresetsAction()
      .then((res) => {
        if (active && res.success) setPresets(res.data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return (
    <FormDialog
      formId="add-investment"
      trigger={
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Dodaj
        </Button>
      }
      title="Nowa inwestycja"
    >
      {(onSubmitSuccess, keepOpen) => (
        <InvestmentForm
          formId="add-investment"
          defaultValues={EMPTY_DEFAULTS}
          action={createInvestmentAction}
          successMessage="Inwestycja dodana"
          submitLabel="Dodaj"
          submittingLabel="Dodawanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          presetOptions={presets}
        />
      )}
    </FormDialog>
  )
}
