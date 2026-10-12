'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CollapsibleSection, OPEN_STATES } from '@/components/ui/collapsible-section'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import { usePersistedFlag } from '@/hooks/use-persisted-value'
import { updateInvestmentAction } from '@/lib/actions/investments'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { InvestmentRefT } from '@/types/reference-data'

// One key for every investment: collapsing a long note is a reading preference, not a per-record one.
const NOTES_STORAGE_KEY = 'investment:notes'

type PropsT = {
  investment: InvestmentRefT
  readOnly?: boolean
}

export function InvestmentNotes({ investment, readOnly }: PropsT) {
  const [draft, setDraft] = useState<string | undefined>(undefined)
  const [isSaving, startSaving] = useTransition()
  const isEditing = draft !== undefined
  const [, setIsOpen] = usePersistedFlag(NOTES_STORAGE_KEY, OPEN_STATES, true)

  function startEditing() {
    setIsOpen(true)
    setDraft(investment.notes)
  }

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
    <CollapsibleSection
      title="Notatki"
      storageKey={NOTES_STORAGE_KEY}
      size="sm"
      withSeparator={false}
      className="text-sm"
      action={
        !readOnly &&
        !isEditing && (
          <EditButton
            label="Edytuj notatkę"
            text="Edytuj notatkę"
            showLabel
            onClick={startEditing}
          />
        )
      }
    >
      {isEditing ? (
        <div className="flex flex-col gap-2">
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
        </div>
      ) : (
        <div className="whitespace-pre-line">{investment.notes || '—'}</div>
      )}
    </CollapsibleSection>
  )
}
