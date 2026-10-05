'use client' // Error components must be Client Components

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useTranslation } from '@/hooks/use-translation'
import { logError } from '@/lib/utils/log-error'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useTranslation('shell')

  useEffect(() => {
    logError('[ROUTE_ERROR]', error)
  }, [error])

  return (
    <EmptyState title={t('errorTitle')}>
      <Button variant="outline" onClick={() => reset()}>
        {t('retry')}
      </Button>
    </EmptyState>
  )
}
