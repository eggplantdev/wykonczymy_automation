'use client'

import { useEffect, useState } from 'react'
import { WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getOpenRouterCreditsAction } from '@/lib/actions/openrouter-credits'
import type { OpenRouterCreditsT } from '@/lib/ai/openrouter-credits'

const usd = (n: number) => `$${n.toFixed(2)}`

// Fetches the shared OpenRouter wallet on mount via a server action (TopNav is a client component,
// so it can't read the server-only key directly). Renders nothing until/unless a balance resolves —
// a flaky or unreachable OpenRouter simply shows no chip, never a broken state.
export function NavCredits({ className }: { className?: string }) {
  const [credits, setCredits] = useState<OpenRouterCreditsT | null>(null)

  useEffect(() => {
    let active = true
    getOpenRouterCreditsAction().then((res) => {
      if (active && res.success && res.data) setCredits(res.data)
    })
    return () => {
      active = false
    }
  }, [])

  if (!credits) return null

  return (
    <Button
      type="button"
      variant="ai"
      size="sm"
      className={className}
      title={`Saldo OpenRouter: ${usd(credits.remaining)} z ${usd(credits.total)}`}
      data-testid="nav-openrouter-credits"
    >
      <WandSparkles className="text-neon-cyan" />
      <span className="text-neon-cyan font-semibold tabular-nums">
        Saldo {usd(credits.remaining)}
      </span>
    </Button>
  )
}
