import { CircleCheck, TriangleAlert } from 'lucide-react'

export type ReportStatusT = 'ok' | 'warn'

export function SheetReportBlock({
  title,
  status,
  verdict,
  children,
}: {
  title: string
  status?: ReportStatusT
  verdict?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      {status === 'ok' && <CircleCheck className="text-chart-green mt-0.5 size-4 shrink-0" />}
      {status === 'warn' && <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{title}</p>
        {verdict && <p>{verdict}</p>}
        {children}
      </div>
    </div>
  )
}
