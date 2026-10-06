'use client'

import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { useTranslation } from '@/hooks/use-translation'

export default function NotFound() {
  const { t } = useTranslation('shell')
  return (
    <EmptyState title={t('notFoundTitle')} description={t('notFoundDescription')}>
      <Link href="/" className="text-primary text-sm underline underline-offset-4 hover:opacity-80">
        {t('backHome')}
      </Link>
    </EmptyState>
  )
}
