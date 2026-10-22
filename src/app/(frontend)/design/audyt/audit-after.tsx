import type { ReactNode } from 'react'
import { Panel } from '@/components/ui/panel'
import { EYEBROW_CLASS } from '@/components/ui/section-header'

export type AuditChangeT = { letters: string; effect: ReactNode }

type AuditAfterPropsT = {
  rules: ReactNode[]
  changes: AuditChangeT[]
  lines: string
  children: ReactNode
}

export function AuditAfter({ rules, changes, lines, children }: AuditAfterPropsT) {
  return (
    <Panel className="border-primary flex flex-col gap-4 p-3">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">Po</span>
        <span className="text-sm">propozycja do decyzji</span>
      </div>
      <ol className="ml-4 list-decimal text-sm">
        {rules.map((rule, index) => (
          <li key={index}>{rule}</li>
        ))}
      </ol>
      <div className="bg-background flex min-h-12 flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
        {children}
      </div>
      <div className="flex flex-col gap-1">
        <h4 className={EYEBROW_CLASS}>Co się zmieni</h4>
        <ul className="flex flex-col gap-1 text-sm">
          {changes.map((change) => (
            <li key={change.letters} className="flex gap-2">
              <span className="w-14 shrink-0 font-semibold">{change.letters}</span>
              <span>{change.effect}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm">
        <span className={EYEBROW_CLASS}>Linie</span> {lines}
      </p>
    </Panel>
  )
}
