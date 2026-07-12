import { WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getOpenRouterBalance } from '@/lib/ai/openrouter-balance'

const usd = (n: number) => `$${n.toFixed(2)}`

// Renders nothing unless a balance resolves — a flaky or unreachable OpenRouter shows no chip,
// never a broken/error state.
export async function NavOpenRouterBalance({ className }: { className?: string }) {
  const balance = await getOpenRouterBalance()

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
