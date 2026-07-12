'use client'

import { useEffect, useState } from 'react'
import { WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getOpenRouterBalanceAction } from '@/lib/actions/openrouter-balance'
import type { OpenRouterBalanceT } from '@/lib/ai/openrouter-balance'

const usd = (n: number) => `$${n.toFixed(2)}`

// Fetches the shared OpenRouter wallet on mount via a server action (TopNav is a client component,
// so it can't read the server-only key directly). Renders nothing until/unless a balance resolves —
// a flaky or unreachable OpenRouter simply shows no chip, never a broken state.
export function NavOpenRouterBalance({ className }: { className?: string }) {
  const [balance, setBalance] = useState<OpenRouterBalanceT | null>(null)

  useEffect(() => {
    let active = true
    getOpenRouterBalanceAction().then((res) => {
      if (active && res.success && res.data) setBalance(res.data)
    })
    return () => {
      active = false
    }
  }, [])

  if (!balance) return null

  return (
    <Button
      type="button"
      variant="ai"
      size="sm"
      className={className}
      title={`Saldo OpenRouter: ${usd(balance.remaining)} z ${usd(balance.total)}`}
      data-testid="nav-openrouter-balance"
    >
      <WandSparkles className="text-neon-cyan" />
      <span className="text-neon-cyan font-semibold tabular-nums">
        Saldo {usd(balance.remaining)}
      </span>
    </Button>
  )
}
