import type { ReactNode } from 'react'
import { Panel } from '@/components/ui/panel'
import { Description } from '@/components/ui/description'

type AuditVariantPropsT = {
  letter: string
  label: string
  sources: string[]
  children: ReactNode
}

export function AuditVariant({ letter, label, sources, children }: AuditVariantPropsT) {
  return (
    <Panel className="flex flex-col gap-3 p-3">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">{letter}</span>
        <span className="text-sm">{label}</span>
      </div>
      <div className="bg-background flex min-h-12 flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
        {children}
      </div>
      <div className="flex flex-col gap-0.5">
        <Description size="xs" withIcon={false}>
          {sources.length} {sources.length === 1 ? 'miejsce' : 'miejsc'}
        </Description>
        <ul className="flex flex-col">
          {sources.map((source) => (
            <li key={source}>
              <code className="text-muted-foreground text-xs break-all">{source}</code>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
