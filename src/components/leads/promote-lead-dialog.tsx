'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/ui/form-dialog'
import { InvestmentForm } from '@/components/forms/investment-form/investment-form'
import { promoteLeadAction } from '@/lib/actions/promote-lead'
import type { InvestmentFormValuesT } from '@/components/forms/investment-form/investment-schema'
import type { LeadRowT } from '@/types/leads'

/**
 * What the visitor typed that has no column on an inwestycja — folded into „Notatki" rather than
 * dropped, because the zgłoszenie stops being the place anyone looks once it has an inwestycja.
 * „Wiadomość" is not a `LeadRowT` column; it lives among the answers.
 */
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

export function PromoteLeadDialog({ lead }: { lead: LeadRowT }) {
  if (lead.investmentId !== null) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/inwestycje/${lead.investmentId}`}>
          Inwestycja
          <ArrowRight />
        </Link>
      </Button>
    )
  }

  const defaults: InvestmentFormValuesT = {
    // An inwestycja is named for the job, not the person — the existing ones read „Jakub Korczak
    // Zupnicza 14/31". Seeding it from `lead.name` alone just repeated „Osoba kontaktowa" below.
    name: [lead.name, lead.address].filter(Boolean).join(' '),
    address: lead.address,
    phone: lead.phone,
    email: lead.email,
    contactPerson: lead.name,
    notes: buildNotes(lead),
    review: '',
    status: 'active',
    presetId: '',
  }

  const formId = `promote-lead-${lead.id}`

  return (
    <FormDialog
      formId={formId}
      trigger={
        <Button variant="outline" size="sm">
          Utwórz inwestycję
        </Button>
      }
      title="Nowa inwestycja ze zgłoszenia"
      description={
        lead.assets.length > 0
          ? `Pliki ze zgłoszenia (${lead.assets.length}) przejdą do inwestycji.`
          : undefined
      }
      showKeepOpen={false}
    >
      {(onSubmitSuccess, keepOpen) => (
        <InvestmentForm
          formId={formId}
          defaultValues={defaults}
          // The files come from the lead's own relation, so the form never collects them here.
          action={(data) => promoteLeadAction(lead.id, data)}
          successMessage="Inwestycja utworzona"
          submitLabel="Utwórz"
          submittingLabel="Tworzenie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          persistDraft={false}
        />
      )}
    </FormDialog>
  )
}
