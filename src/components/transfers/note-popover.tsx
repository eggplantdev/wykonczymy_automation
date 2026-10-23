'use client'

import { Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTranslation } from '@/hooks/use-translation'
import { Button } from '@/components/ui/button'
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
      <PopoverTrigger asChild>
        <Button
          variant={isLabelled ? 'outline' : 'ghost'}
          size={isLabelled ? 'xs' : 'icon'}
          className={isLabelled ? undefined : 'text-muted-foreground'}
          aria-label={t('showNote')}
        >
          <Info />
          {isLabelled && t('noteShort')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-80 w-80 overflow-y-auto">
        <p className="text-sm wrap-break-word whitespace-pre-line">{note}</p>
      </PopoverContent>
    </Popover>
  )
}
