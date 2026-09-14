'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectItem } from '@/components/ui/select'
import { createWarehouseAction } from '@/lib/actions/warehouses'
import { toastMessage } from '@/lib/utils/toast'
import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'
import type { WarehouseOptionT } from '@/lib/equipment/types'

type WarehouseFieldPropsT = {
  form: FormWithFieldT<'warehouse'>
  warehouses: WarehouseOptionT[]
}

/**
 * „Magazyn", plus the button that creates one without leaving the form.
 *
 * The new warehouse is appended to LOCAL state as well as saved: the option list arrives as a prop
 * from the server page, which will not re-render while this dialog is open, so without the local
 * copy the magazyn you just created would be missing from the list you created it for.
 */
export function WarehouseField({ form, warehouses }: WarehouseFieldPropsT) {
  const [options, setOptions] = useState(warehouses)
  const [draftName, setDraftName] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()

  const save = () => {
    const name = draftName?.trim()
    if (!name || saving) return

    startSaving(async () => {
      const result = await createWarehouseAction(name)
      if (!result.success) {
        toastMessage(result.error, 'error')
        return
      }
      setOptions((current) => [...current, result.data])
      form.setFieldValue('warehouse', String(result.data.id))
      setDraftName(null)
    })
  }

  return (
    <>
      <form.AppField name="warehouse">
        {(field) => (
          <field.Select
            label="Magazyn"
            placeholder="Wybierz magazyn"
            showError
            labelExtra={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDraftName('')}
                disabled={draftName !== null}
              >
                <Plus className="size-4" />
                Nowy magazyn
              </Button>
            }
          >
            {options.map((warehouse) => (
              <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                {warehouse.name}
              </SelectItem>
            ))}
          </field.Select>
        )}
      </form.AppField>

      {draftName !== null && (
        <div className="flex items-end gap-2">
          <Input
            autoFocus
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Nazwa magazynu"
            // Enter inside a form submits the form, which here would save the sprzęt rather than the
            // magazyn the user is in the middle of typing.
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              save()
            }}
          />
          <Button type="button" size="sm" onClick={save} disabled={saving || !draftName.trim()}>
            {saving ? 'Zapisywanie...' : 'Zapisz'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setDraftName(null)}>
            Anuluj
          </Button>
        </div>
      )}
    </>
  )
}
