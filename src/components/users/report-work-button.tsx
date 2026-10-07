import { HardHat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog'
import type { WorkerInvestmentLinkT } from '@/components/users/worker-investments-section'

export type ReportTargetT = Required<WorkerInvestmentLinkT>

type PropsT = {
  targets: ReportTargetT[]
  label: string
  pickerTitle: string
  className?: string
}

export function ReportWorkButton({ targets, label, pickerTitle, className }: PropsT) {
  const [onlyTarget] = targets
  if (targets.length === 1 && onlyTarget) {
    return (
      <Button asChild className={className}>
        <a href={onlyTarget.reportUrl}>
          <HardHat />
          {label}
        </a>
      </Button>
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className={className}>
          <HardHat />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader title={pickerTitle} />
        <div className="flex flex-col gap-2">
          {targets.map((target) => (
            <Button
              key={target.investmentId}
              asChild
              variant="outline"
              size="lg"
              align="start"
              className="h-auto min-h-12 py-3 whitespace-normal"
            >
              <a href={target.reportUrl}>{target.name}</a>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
