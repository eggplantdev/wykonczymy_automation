'use client'

import { Trash2 } from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'
import { RowActionButton, type RowActionButtonPropsT } from './row-action-button'

export type DeleteButtonPropsT = Omit<RowActionButtonPropsT, 'icon' | 'tone' | 'label'> & {
  label?: string
}

// The confirm dialog carries the warning, so the button stays a quiet ghost until hovered rather than
// shouting red from every row.
export function DeleteButton({ label, text, ...props }: DeleteButtonPropsT) {
  const { t } = useTranslation('common')
  return (
    <RowActionButton
      icon={Trash2}
      label={label ?? t('delete')}
      text={text ?? t('delete')}
      tone="destructive"
      {...props}
    />
  )
}
