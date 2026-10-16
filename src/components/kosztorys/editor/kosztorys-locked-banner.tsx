import { Lock } from 'lucide-react'
import type { InvestmentLockT } from '@/lib/constants/investment-lock'

const LOCK_COPY: Record<InvestmentLockT, string> = {
  completed:
    'Inwestycja jest zakończona — kosztorys jest tylko do odczytu. Aby go zmienić, właściciel lub administrator musi ustawić status inwestycji z powrotem na „Aktywna".',
  trashed:
    'Inwestycja jest w koszu — kosztorys jest tylko do odczytu. Aby go zmienić, przywróć ją z Kosza.',
}

export function KosztorysLockedBanner({ lock }: { lock: InvestmentLockT }) {
  return (
    <p
      role="status"
      className="text-muted-foreground bg-muted/50 border-border flex shrink-0 items-center gap-2 border-b px-4 py-2 text-xs"
    >
      <Lock className="size-3.5 shrink-0" aria-hidden />
      <span>{LOCK_COPY[lock]}</span>
    </p>
  )
}
