'use client'

import { useEffect } from 'react'

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
    console.error('[GLOBAL_ERROR]', { message: error.message, digest: error.digest })
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
