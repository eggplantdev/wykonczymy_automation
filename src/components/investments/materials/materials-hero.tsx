import { Panel } from '@/components/ui/panel'
import { EYEBROW_CLASS } from '@/components/ui/section-header'

type StatT = { label: string; value: string }

type PropsT = {
  eyebrow: string
  title: string
  lead: string
  stats: StatT[]
}

export function MaterialsHero({ eyebrow, title, lead, stats }: PropsT) {
  return (
    <Panel
      as="section"
      className="from-chart-blue/15 via-background to-chart-green/15 relative isolate overflow-hidden rounded-xl bg-linear-to-br p-6 sm:p-10"
    >
      <div
        aria-hidden
        className="bg-chart-blue/25 absolute -top-24 -left-24 -z-10 size-72 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="bg-chart-green/25 absolute -right-24 -bottom-24 -z-10 size-72 rounded-full blur-3xl"
      />
      <div className="grid gap-5">
        <span className={EYEBROW_CLASS}>{eyebrow}</span>
        <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
        <p className="text-muted-foreground max-w-prose leading-relaxed">{lead}</p>
        <dl className="border-border/60 grid grid-cols-2 gap-6 border-t pt-5 sm:grid-cols-4">
          {stats.map(({ label, value }) => (
            <div key={label} className="grid min-w-0 gap-1">
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums sm:text-3xl">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  )
}
