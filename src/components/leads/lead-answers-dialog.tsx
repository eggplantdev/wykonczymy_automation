'use client'

import { Dialog, DialogTrigger, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { LeadAnswerT } from '@/types/leads'

type LeadAnswersDialogPropsT = {
  name: string
  formName: string
  answers: LeadAnswerT[]
}

export function LeadAnswersDialog({ name, formName, answers }: LeadAnswersDialogPropsT) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={answers.length === 0}>
          Szczegóły
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader
          title={name || 'Zgłoszenie'}
          description={formName || 'Odpowiedzi z formularza'}
        />
        <dl className="divide-border divide-y text-sm">
          {answers.map((answer, index) => (
            <div key={index} className="grid grid-cols-[1fr_1.5fr] gap-3 py-2">
              <dt className="text-muted-foreground break-words">{answer.label}</dt>
              <dd className="text-foreground break-words">{answer.value}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
