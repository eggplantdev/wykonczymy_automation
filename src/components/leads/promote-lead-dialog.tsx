'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormDialog } from '@/components/ui/form-dialog'
import { InvestmentForm } from '@/components/forms/investment-form/investment-form'
import { MediaStrip } from '@/components/media/media-strip'
import { ASSET_PREVIEW_LABELS } from '@/lib/media/wording'
import { useMediaRemoval } from '@/hooks/use-media-removal'
import { removeLeadAssetAction } from '@/lib/actions/lead-assets'
import {
  LEAD_ASSET_REMOVAL_LABELS,
  LEAD_ASSET_STRIP_GRID,
  LEAD_ASSET_STRIP_SIZES,
} from './lead-asset-labels'
import { promoteLeadAction } from '@/lib/actions/promote-lead'
import type { InvestmentFormValuesT } from '@/components/forms/investment-form/investment-schema'
import type { LeadRowT } from '@/types/leads'

function buildNotes(lead: LeadRowT): string {
  return [
    ['Zakres prac', lead.scope],
    ['Metraż', lead.area],
    ['Wiadomość', lead.answers.find((answer) => answer.label === 'Wiadomość')?.value],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n')
}

const PICK_LABEL = 'Dodaj to zdjęcie do inwestycji'

export function PromoteLeadDialog({ lead }: { lead: LeadRowT }) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(lead.assets.map((file) => file.id)),
  )

  const { visibleFiles, handleRemove, isRemoving, removalConfirm } = useMediaRemoval({
    files: lead.assets,
    removeOne: (mediaId) => removeLeadAssetAction(lead.id, mediaId),
    labels: LEAD_ASSET_REMOVAL_LABELS,
  })

  if (lead.investmentId !== null) {
    return (
      <Link href={`/inwestycje/${lead.investmentId}`} className="text-primary hover:underline">
        {lead.investmentName ?? 'Inwestycja'}
      </Link>
    )
  }

  const chosenIds = visibleFiles.map((file) => file.id).filter((id) => selectedIds.has(id))

  function togglePicked(mediaId: number) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (!next.delete(mediaId)) next.add(mediaId)
      return next
    })
  }

  const defaults: InvestmentFormValuesT = {
    name: [lead.name, lead.address].filter(Boolean).join(' '),
    address: lead.address,
    phone: lead.phone,
    email: lead.email,
    contactPerson: lead.name,
    notes: buildNotes(lead),
    reviewRequested: false,
    // Nobody has agreed to do this work yet — „aktywna" would put it among the jobs actually running.
    status: 'quote',
    presetId: '',
  }

  const formId = `promote-lead-${lead.id}`

  return (
    <FormDialog
      formId={formId}
      trigger={
        <Button variant="outline" size="xs">
          Dodaj
        </Button>
      }
      title="Nowa inwestycja ze zgłoszenia"
      description={
        visibleFiles.length > 0 ? 'Wybierz, które pliki przejdą do inwestycji.' : undefined
      }
      showKeepOpen={false}
    >
      {(onSubmitSuccess, keepOpen) => (
        <>
          {visibleFiles.length > 0 && (
            <section className="mb-6 space-y-2">
              <p className="text-muted-foreground text-sm">
                Przejdą do inwestycji: {chosenIds.length} z {visibleFiles.length}
              </p>
              <MediaStrip
                files={visibleFiles}
                labels={ASSET_PREVIEW_LABELS}
                sizes={LEAD_ASSET_STRIP_SIZES}
                gridClassName={LEAD_ASSET_STRIP_GRID}
                pick={{
                  selectedIds,
                  onToggle: (file) => togglePicked(file.id),
                  label: PICK_LABEL,
                }}
                onRemove={isRemoving ? undefined : handleRemove}
              />
            </section>
          )}

          <InvestmentForm
            formId={formId}
            defaultValues={defaults}
            action={(data) => promoteLeadAction(lead.id, data, chosenIds)}
            successMessage="Inwestycja utworzona"
            submitLabel="Utwórz"
            submittingLabel="Tworzenie..."
            onSubmitSuccess={onSubmitSuccess}
            keepOpen={keepOpen}
            persistDraft={false}
          />

          <ConfirmDialog {...removalConfirm} />
        </>
      )}
    </FormDialog>
  )
}
