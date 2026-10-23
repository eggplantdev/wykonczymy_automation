'use client'

import { Dialog, DialogTrigger, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MediaStrip } from '@/components/media/media-strip'
import { SUBSECTION_TITLE_CLASS } from '@/components/ui/section-header'
import { ASSET_PREVIEW_LABELS } from '@/lib/media/wording'
import type { LeadAnswerT } from '@/lib/leads/types'
import type { MediaFileT } from '@/types/media'

type LeadAnswersDialogPropsT = {
  name: string
  formName: string
  answers: LeadAnswerT[]
  assets: MediaFileT[]
}

export function LeadAnswersDialog({ name, formName, answers, assets }: LeadAnswersDialogPropsT) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="xs" disabled={answers.length === 0 && assets.length === 0}>
          Szczegóły
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-dialog-lg">
        <DialogHeader
          title={name || 'Zgłoszenie'}
          description={formName || 'Odpowiedzi z formularza'}
        />
        <dl className="divide-border divide-y text-sm">
          {answers.map((answer, index) => (
            <div key={index} className="grid gap-1 py-2 sm:grid-cols-[12rem_1fr] sm:gap-4">
              <dt className="text-muted-foreground break-words">{answer.label}</dt>
              <dd className="text-foreground break-words whitespace-pre-line">{answer.value}</dd>
            </div>
          ))}
        </dl>

        {assets.length > 0 && (
          <section className="mt-4 space-y-2">
            <h3 className={`${SUBSECTION_TITLE_CLASS} text-muted-foreground`}>Załączniki</h3>
            <MediaStrip
              files={assets}
              labels={ASSET_PREVIEW_LABELS}
              sizes="(max-width: 767.98px) 31vw, (max-width: 1023.98px) 215px, 140px"
            />
          </section>
        )}
      </DialogContent>
    </Dialog>
  )
}
