'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.log('global-error.tsx:10 -', error)
  return (
    <html>
      <body>
        <h2>Coś poszło nie tak!</h2>
        <button onClick={() => reset()}>Spróbuj ponownie</button>
      </body>
    </html>
  )
}
