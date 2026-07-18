'use client'

import { useEffect } from 'react'
import { logError } from '@/lib/utils/log-error'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surfaces the root-layout crash in Vercel logs; `digest` correlates with the
    // server-side stack Next redacts from the client.
    logError('[GLOBAL_ERROR]', error, { digest: error.digest })
  }, [error])

  return (
    <html>
      <body>
        <h2>Coś poszło nie tak!</h2>
        <button onClick={() => reset()}>Spróbuj ponownie</button>
      </body>
    </html>
  )
}
