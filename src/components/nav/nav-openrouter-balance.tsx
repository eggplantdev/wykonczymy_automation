import { WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getOpenRouterBalance } from '@/lib/ai/openrouter-balance'

const usd = (n: number) => `$${n.toFixed(2)}`

export async function NavOpenRouterBalance({ className }: { className?: string }) {
  const balance = await getOpenRouterBalance()

  if (!balance) return null

  return (
    // `title` sits on the wrapper: `disabled` pulls `pointer-events-none` in, so a tooltip on the
    // button itself never fires.
    <span
      className="block"
      title={`Saldo OpenRouter: ${usd(balance.remaining)} z ${usd(balance.total)}`}
    >
      <Button
        disabled
        type="button"
        variant="ai"
        size="sm"
        className={`w-full ${className ?? ''}`}
        data-testid="nav-openrouter-balance"
      >
        <WandSparkles className="text-neon-cyan" />
        <span className="text-neon-cyan font-semibold tabular-nums">
          Saldo {usd(balance.remaining)}
        </span>
      </Button>
    </span>
  )
}
