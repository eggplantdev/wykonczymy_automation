import { useState } from 'react'
import { useLatestRequest } from '@/hooks/use-latest-request'
import { toastMessage } from '@/lib/utils/toast'
import { getRegisterBalance } from '@/lib/queries/register-balance'

export function useRegisterBalance(initialBalance?: number) {
  const [registerBalance, setRegisterBalance] = useState<number | null>(initialBalance ?? null)
  const [isRegisterBalanceLoading, setIsRegisterBalanceLoading] = useState(false)
  const request = useLatestRequest()

  async function fetchRegisterBalance(registerId: string) {
    if (!registerId) return resetRegisterBalance()

    const isCurrent = request.start()
    setRegisterBalance(null)
    setIsRegisterBalanceLoading(true)
    try {
      const result = await getRegisterBalance(Number(registerId))
      if (isCurrent()) setRegisterBalance(result.registerBalance)
    } catch {
      if (isCurrent()) toastMessage('Nie udało się pobrać salda', 'error')
    } finally {
      if (isCurrent()) setIsRegisterBalanceLoading(false)
    }
  }

  function resetRegisterBalance() {
    // Disowning the in-flight fetch also makes its own `finally` a no-op, so the reset has to clear
    // the loading flag itself or it pins forever.
    request.disown()
    setRegisterBalance(null)
    setIsRegisterBalanceLoading(false)
  }

  return { registerBalance, isRegisterBalanceLoading, fetchRegisterBalance, resetRegisterBalance }
}
