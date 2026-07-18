'use client' // Error components must be Client Components

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { logError } from '@/lib/utils/log-error'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logError('[ROUTE_ERROR]', error)
  }, [error])

  return (
    <EmptyState title="Coś poszło nie tak">
      <Button variant="outline" onClick={() => reset()}>
        Spróbuj ponownie
      </Button>
    </EmptyState>
  )
}
