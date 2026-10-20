'use client'

import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { TextLink } from '@/components/ui/text-link'
import { useTranslation } from '@/hooks/use-translation'

export default function NotFound() {
  const { t } = useTranslation('shell')
  return (
    <EmptyState title={t('notFoundTitle')} description={t('notFoundDescription')}>
      <TextLink asChild>
        <Link href="/">{t('backHome')}</Link>
      </TextLink>
    </EmptyState>
  )
}
