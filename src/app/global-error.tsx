'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <h2>Coś poszło nie tak!</h2>
        <button onClick={() => reset()}>Spróbuj ponownie</button>
      </body>
    </html>
  )
}
