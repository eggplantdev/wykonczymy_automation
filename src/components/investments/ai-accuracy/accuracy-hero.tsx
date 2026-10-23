import { TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Panel } from '@/components/ui/panel'
import { EYEBROW_CLASS } from '@/components/ui/section-header'
import type { AiAccuracyCaseScoreT, AiAccuracyWindowT } from '@/lib/kosztorys/ai-accuracy'
import { cn } from '@/lib/utils/cn'
import { accuracyBand } from './accuracy-bands'
import { AccuracyGauge } from './accuracy-gauge'
import { formatWholePercent } from './format'

type PropsT = {
  all: AiAccuracyWindowT
  last: AiAccuracyWindowT
  latest: AiAccuracyCaseScoreT | undefined
}

export function AccuracyHero({ all, last, latest }: PropsT) {
  const lastCount = last.count
  const delta = last.rightPercent - all.rightPercent
  const TrendIcon = delta >= 0 ? TrendingUp : TrendingDown
  const stats = [
    { label: `Wszystkie przypadki (${all.count})`, percent: all.rightPercent },
    ...(latest ? [{ label: `Najnowszy: ${latest.label}`, percent: latest.rightPercent }] : []),
  ]

  return (
    <Panel
      as="section"
      className="from-chart-blue/15 via-background to-chart-purple/15 relative isolate overflow-hidden rounded-xl bg-linear-to-br p-6 sm:p-10"
    >
      <div
        aria-hidden
        className="bg-chart-blue/25 absolute -top-24 -left-24 -z-10 size-72 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="bg-chart-purple/25 absolute -right-24 -bottom-24 -z-10 size-72 rounded-full blur-3xl"
      />
      <div className="grid items-center gap-8 sm:grid-cols-[auto_1fr] sm:gap-12">
        <AccuracyGauge percent={last.rightPercent} caption={`ostatnie ${lastCount}`} />
        <div className="grid gap-5">
          <span className={EYEBROW_CLASS}>Ostatnie przypadki ({lastCount})</span>
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            AI ma dobrze {formatWholePercent(last.rightPercent)} kosztorysu
          </h2>
          <p className="text-muted-foreground max-w-prose leading-relaxed">
            Na każde 100 zł w kosztorysie AI myli się o około{' '}
            <b className="text-foreground">{last.wrongPer100} zł</b>, które właściciel musi
            poprawić.
          </p>
          {lastCount < all.count && (
            <Badge
              tone={delta >= 0 ? 'positive' : 'negative'}
              shape="pill"
              className="w-fit gap-1.5 px-3 py-1 text-sm"
            >
              <TrendIcon className="size-4" aria-hidden />
              {delta > 0 ? `+${delta}` : delta} pp względem wszystkich przypadków
            </Badge>
          )}
          <dl className="border-border/60 grid grid-cols-2 gap-6 border-t pt-5">
            {stats.map(({ label, percent }) => (
              <div key={label} className="grid min-w-0 gap-1">
                <dt className="text-muted-foreground text-xs">{label}</dt>
                <dd
                  className={cn('text-3xl font-semibold tabular-nums', accuracyBand(percent).text)}
                >
                  {formatWholePercent(percent)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Panel>
  )
}
