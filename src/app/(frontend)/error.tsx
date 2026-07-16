'use client' // Error components must be Client Components

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <EmptyState title="Coś poszło nie tak">
      <Button variant="outline" onClick={() => reset()}>
        Spróbuj ponownie
      </Button>
    </EmptyState>
  )
}
