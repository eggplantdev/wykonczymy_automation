'use client'

import { Dialog, DialogTrigger, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MediaStrip } from '@/components/media/media-strip'
import { ASSET_PREVIEW_LABELS } from '@/components/media/preview-labels'
import type { LeadAnswerT } from '@/types/leads'
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
        <Button variant="outline" size="sm" disabled={answers.length === 0 && assets.length === 0}>
          Szczegóły
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
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

        {assets.length > 0 && (
          <section className="mt-4 space-y-2">
            <h3 className="text-muted-foreground text-sm font-medium">Załączniki</h3>
            {/* No `onRemove`: the files are what the visitor sent, and deleting one here would strip
                it from the inwestycja the zgłoszenie was promoted into. */}
            <MediaStrip
              files={assets}
              labels={ASSET_PREVIEW_LABELS}
              sizes="(max-width: 767.98px) 31vw, (max-width: 1023.98px) 110px, 75px"
              emptyText="Brak załączników."
            />
          </section>
        )}
      </DialogContent>
    </Dialog>
  )
}
