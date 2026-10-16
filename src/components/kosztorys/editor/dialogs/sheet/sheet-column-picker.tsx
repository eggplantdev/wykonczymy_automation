'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { SimpleSelect } from '@/components/ui/simple-select'
import { toColumnOptions } from '@/components/kosztorys/editor/dialogs/sheet/sheet-column-picker-options'
import { clearSheetColumnMappingAction, saveSheetColumnMappingAction } from '@/lib/actions/sheets'
import { FIELD_LABELS, type ColumnFieldT } from '@/lib/kosztorys/sheet-import/columns'
import type { CandidateColumnT } from '@/lib/kosztorys/sheet-import/resolve-columns'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investmentId: number
  missing: ColumnFieldT[]
  pointed: ColumnFieldT[]
  candidates: CandidateColumnT[]
  onSaved: () => void
}

export function SheetColumnPicker({ investmentId, missing, pointed, candidates, onSaved }: PropsT) {
  const [pending, startTransition] = useTransition()
  const options = toColumnOptions(candidates)

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await settleAction(action)
      if (!result.success) {
        toastMessage(result.error ?? 'Nie udało się zapisać wskazania kolumny', 'error', 6000)
        return
      }
      onSaved()
    })
  }

  return (
    <>
      {options.length > 0 &&
        missing.map((field) => (
          <div key={field} className="flex flex-wrap items-center gap-2 text-xs">
            <span>Wskaż kolumnę „{FIELD_LABELS[field]}" w arkuszu Google:</span>
            <SimpleSelect
              value=""
              onValueChange={(value) =>
                run(() => saveSheetColumnMappingAction(investmentId, field, Number(value)))
              }
              options={options}
              placeholder="wybierz kolumnę"
              disabled={pending}
              variant="toolbarSm"
              className="w-fit"
            />
          </div>
        ))}
      {pointed.map((field) => (
        <p key={field} className="text-muted-foreground text-xs">
          Kolumnę „{FIELD_LABELS[field]}" wskazałeś ręcznie.{' '}
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            disabled={pending}
            onClick={() => run(() => clearSheetColumnMappingAction(investmentId, field))}
          >
            Usuń wskazanie
          </Button>
        </p>
      ))}
    </>
  )
}
