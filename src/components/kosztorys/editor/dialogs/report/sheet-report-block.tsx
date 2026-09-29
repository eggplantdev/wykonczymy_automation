import { CircleCheck, TriangleAlert } from 'lucide-react'

export type ReportStatusT = 'ok' | 'warn'

// One labelled section of a sheet report. Shared by the import preview and the live comparison so
// the two dialogs read as one report rather than two visual dialects of the same thing.
export function SheetReportBlock({
  title,
  status,
  verdict,
  children,
}: {
  title: string
  // Omitted by the import preview, which describes a sheet nobody has judged yet. The comparison
  // always sets it — a block with no verdict is a block the reader has to score themselves.
  status?: ReportStatusT
  verdict?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      {status === 'ok' && <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-600" />}
      {status === 'warn' && <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{title}</p>
        {verdict && <p>{verdict}</p>}
        {children}
      </div>
    </div>
  )
}
