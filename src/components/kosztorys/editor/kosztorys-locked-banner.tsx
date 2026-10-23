import { Lock } from 'lucide-react'
import type { InvestmentLockT } from '@/lib/constants/investment-lock'
import { Description } from '@/components/ui/description'

const LOCK_COPY: Record<InvestmentLockT, string> = {
  completed:
    'Inwestycja jest zakończona — kosztorys jest tylko do odczytu. Aby go zmienić, właściciel lub administrator musi ustawić status inwestycji z powrotem na „Aktywna".',
  trashed:
    'Inwestycja jest w koszu — kosztorys jest tylko do odczytu. Aby go zmienić, przywróć ją z Kosza.',
}

export function KosztorysLockedBanner({ lock }: { lock: InvestmentLockT }) {
  return (
    <Description
      role="status"
      icon={Lock}
      size="xs"
      className="bg-muted/50 border-border shrink-0 items-center gap-2 border-b px-4 py-2"
    >
      {LOCK_COPY[lock]}
    </Description>
  )
}
