import { TriangleAlert } from 'lucide-react'
import { HintTooltip } from '@/components/ui/tooltip'

// The reconciliation scream, shared by both verification surfaces (editor Podsumowanie +
// investment page). The two are designed to read identically, so the icon, size, and — most
// importantly — the `aria-label` the E2E asserts on live here once and can't drift between them.
export function ReconMismatchBadge({ content }: { content: string }) {
  return (
    <HintTooltip content={content} className="text-destructive">
      <TriangleAlert className="size-3.5" aria-label="Niezgodność z transakcjami" />
    </HintTooltip>
  )
}
