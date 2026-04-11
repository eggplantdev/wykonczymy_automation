import { useRef, useState } from 'react'
import { toastMessage } from '@/components/toasts'
import { getRegisterSaldo } from '@/lib/queries/register-saldo'

export function useSaldo() {
  const [saldo, setSaldo] = useState<number | null>(null)
  const [isSaldoLoading, setIsSaldoLoading] = useState(false)
  const requestRef = useRef(0)

  async function fetchSaldo(registerId: string) {
    setSaldo(null)
    if (!registerId) return

    const requestId = ++requestRef.current
    setIsSaldoLoading(true)
    try {
      const result = await getRegisterSaldo(Number(registerId))
      if (requestRef.current === requestId) setSaldo(result.saldo)
    } catch {
      toastMessage('Nie udało się pobrać salda', 'error')
    } finally {
      if (requestRef.current === requestId) setIsSaldoLoading(false)
    }
  }

  function resetSaldo() {
    setSaldo(null)
  }

  return { saldo, isSaldoLoading, fetchSaldo, resetSaldo }
}
