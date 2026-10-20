'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { ExtraWorkRows } from '@/components/kosztorys/worker-report/extra-work-rows'
import { blankExtra, extraState } from '@/components/kosztorys/worker-report/extra-state'
import type { ExtraWorkT } from '@/components/kosztorys/worker-report/types'
import { useTranslation } from '@/hooks/use-translation'

type PropsT = {
  extras: ExtraWorkT[]
  commonUnits: string[]
  onSave: (extra: ExtraWorkT) => void
  onRemove: (key: string) => void
}

export function ExtraWorksDialogButton({ extras, commonUnits, onSave, onRemove }: PropsT) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCloseRefused, setIsCloseRefused] = useState(false)
  const { t } = useTranslation('report')
  const hasInvalid = extras.some((extra) => extraState(extra) === 'invalid')

  const open = () => {
    if (extras.length === 0) onSave(blankExtra())
    setIsOpen(true)
  }

  // Every way out — „Gotowe”, Esc, a click outside — so a half-filled row cannot hide behind the
  // closed dialog and surface only as a blocked „Wyślij”.
  const close = () => {
    if (hasInvalid) return setIsCloseRefused(true)
    setIsCloseRefused(false)
    setIsOpen(false)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={open}>
        <Plus />
        {t('newWork')}
        {extras.length > 0 && ` (${extras.length})`}
      </Button>
      <Dialog open={isOpen} onOpenChange={(next) => (next ? setIsOpen(true) : close())}>
        <DialogContent className="sm:max-w-dialog-lg">
          <DialogHeader title={t('extrasTitle')} description={t('extrasDescription')} />
          <div className="max-h-dialog-scroll overflow-y-auto">
            <ExtraWorkRows
              extras={extras}
              commonUnits={commonUnits}
              onSave={onSave}
              onRemove={onRemove}
              showsMissing={isCloseRefused}
            />
          </div>
          <DialogFooter className="sm:items-center sm:gap-3">
            {isCloseRefused && hasInvalid && (
              <Description tone="error" withIcon={false}>
                {t('extrasFixErrors')}
              </Description>
            )}
            <Button onClick={close}>{t('done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
