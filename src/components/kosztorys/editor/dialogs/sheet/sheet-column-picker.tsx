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
  // Fields with no column, offered a pick here. The two windows split required and optional across
  // different blocks, so the caller says which ones this instance owns.
  missing: ColumnFieldT[]
  // Fields whose column came from an earlier pick — the only ones that can be taken back.
  pointed: ColumnFieldT[]
  candidates: CandidateColumnT[]
  onSaved: () => void
}

/**
 * Pointing a field at a column of the owner's own sheet. Both windows use this: „Pobierz" and
 * „Porównaj" read the same stored pointing, so two copies would have drifted the moment either
 * one changed.
 *
 * Saves on the pick rather than behind a confirm button — the pointing is not part of the import, it
 * is a fact about the sheet that outlives the window. The parent re-reads afterwards, which is what
 * makes the pick visible; the control stays disabled until it does.
 */
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
