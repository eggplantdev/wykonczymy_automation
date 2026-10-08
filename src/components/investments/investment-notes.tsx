'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import { updateInvestmentAction } from '@/lib/actions/investments'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { InvestmentRefT } from '@/types/reference-data'

type PropsT = {
  investment: InvestmentRefT
  readOnly?: boolean
}

export function InvestmentNotes({ investment, readOnly }: PropsT) {
  const [draft, setDraft] = useState<string | undefined>(undefined)
  const [isSaving, startSaving] = useTransition()
  const isEditing = draft !== undefined

  function save() {
    startSaving(async () => {
      // The update action writes the whole record, so the note rides on the rest as this page last
      // rendered it — an edit saved elsewhere since then is written back over.
      const result = await settleAction(() =>
        updateInvestmentAction(investment.id, {
          name: investment.name,
          address: investment.address,
          phone: investment.phone,
          email: investment.email,
          contactPerson: investment.contactPerson,
          notes: draft,
          reviewRequested: investment.reviewRequested,
          status: investment.status,
          presetId: '',
        }),
      )
      if (!result.success) {
        toastMessage(result.error, 'error')
        return
      }
      toastMessage('Notatka zapisana', 'success')
      setDraft(undefined)
    })
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <span className="text-muted-foreground font-medium">Notatki</span>
        {!readOnly && !isEditing && (
          <EditButton
            label="Edytuj notatkę"
            text="Edytuj notatkę"
            showLabel
            onClick={() => setDraft(investment.notes)}
          />
        )}
      </div>
      {isEditing ? (
        <>
          <Textarea
            aria-label="Notatki"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-20"
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={isSaving}>
              {isSaving ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDraft(undefined)}
              disabled={isSaving}
            >
              Anuluj
            </Button>
          </div>
        </>
      ) : (
        <div className="whitespace-pre-line">{investment.notes || '—'}</div>
      )}
    </div>
  )
}
