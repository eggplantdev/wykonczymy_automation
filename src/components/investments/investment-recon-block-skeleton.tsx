import { Separator } from '@/components/ui/separator'
import { Description } from '@/components/ui/description'
import { GradientSpinner } from '@/components/ui/gradient-spinner'

// Suspense fallback for InvestmentReconBlock. Deliberately neutral — a spinner, never a „zgodne"/green
// cue: this block can scream a mismatch, so a reassuring-looking placeholder would flash "all good"
// and then flip to red. Keeps the heading + a loading row so the layout doesn't jump when it resolves.
export function InvestmentReconBlockSkeleton() {
  return (
    <>
      <Separator orientation="horizontal" className="mt-3" />
      <div className="text-muted-foreground space-y-1 text-sm">
        <Description>z kosztorysu (netto)</Description>
        <div className="flex items-center gap-2">
          <GradientSpinner />
          <span>Wczytywanie z kosztorysu…</span>
        </div>
      </div>
    </>
  )
}
