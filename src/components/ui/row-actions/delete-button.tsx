'use client'

import { Trash2 } from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'
import { RowActionButton, type RowActionButtonPropsT } from './row-action-button'

export type DeleteButtonPropsT = Omit<RowActionButtonPropsT, 'icon' | 'tone' | 'label'> & {
  label?: string
}

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
