import { Lock } from 'lucide-react'

// Not WarningBanner: nothing is wrong here. A closed investment is a normal end state, so the strip
// explains the missing controls rather than screaming about them — and it names the one way out,
// because that is the question the person reading it is about to ask.
export function KosztorysLockedBanner() {
  return (
    <p
      role="status"
      className="text-muted-foreground bg-muted/50 border-border flex shrink-0 items-center gap-2 border-b px-4 py-2 text-xs"
    >
      <Lock className="size-3.5 shrink-0" aria-hidden />
      <span>
        Inwestycja jest zakończona — kosztorys jest tylko do odczytu. Aby go zmienić, właściciel lub
        administrator musi ustawić status inwestycji z powrotem na „Aktywna".
      </span>
    </p>
  )
}
