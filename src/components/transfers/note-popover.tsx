'use client'

import { Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTranslation } from '@/hooks/use-translation'
import { buttonVariants } from '@/components/ui/button'
import { useRowActionLabels } from '@/components/ui/row-actions/row-action-labels'

type NotePopoverPropsT = {
  note: string | null
}

export function NotePopover({ note }: NotePopoverPropsT) {
  const { t } = useTranslation('transfers')
  const isLabelled = useRowActionLabels()
  if (!note) return null

  return (
    <Popover>
      <PopoverTrigger
        aria-label={t('showNote')}
        // Match InvoiceCell's ghost icon-button footprint so the adjacent Faktura/Notatka icons align.
        className={
          isLabelled
            ? buttonVariants({ variant: 'outline', size: 'xs' })
            : 'text-muted-foreground hover:bg-accent hover:text-foreground inline-flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors outline-none'
        }
      >
        <Info />
        {isLabelled && t('noteShort')}
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-80 w-80 overflow-y-auto">
        <p className="text-sm wrap-break-word whitespace-pre-line">{note}</p>
      </PopoverContent>
    </Popover>
  )
}
