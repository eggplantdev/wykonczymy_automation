import { cn } from '@/lib/utils/cn'
import { formatNet, formatPercent } from '@/lib/kosztorys/format'
import type { ClientSectionShareT } from '@/lib/kosztorys/types'

// Paired literals, not a name list mapped into `bg-chart-${name}` — Tailwind cannot scan a template
// string, so the swatch class has to appear verbatim. The gradient needs the raw var (a conic stop
// is data-driven, so no utility can express it) and the swatch needs the utility; keeping the two
// halves adjacent is what stops them drifting to different hues.
const SLICE_COLORS = [
  { var: 'var(--color-chart-blue)', swatch: 'bg-chart-blue' },
  { var: 'var(--color-chart-orange)', swatch: 'bg-chart-orange' },
  { var: 'var(--color-chart-green)', swatch: 'bg-chart-green' },
  { var: 'var(--color-chart-purple)', swatch: 'bg-chart-purple' },
  { var: 'var(--color-chart-turquoise)', swatch: 'bg-chart-turquoise' },
  { var: 'var(--color-chart-pink)', swatch: 'bg-chart-pink' },
  { var: 'var(--color-chart-yellow)', swatch: 'bg-chart-yellow' },
  { var: 'var(--color-chart-red)', swatch: 'bg-chart-red' },
  { var: 'var(--color-chart-teal)', swatch: 'bg-chart-teal' },
] as const

const colorAt = (index: number) => SLICE_COLORS[index % SLICE_COLORS.length]

/**
 * Sections as a share-of-work pie (sheet Podsumowanie).
 *
 * A conic-gradient rather than a charting library: the whole chart is one element's background, so it
 * costs no dependency, no client bundle and no hydration — this renders on the server like the rest
 * of the footer. `share` is server-computed at the client price, so the slices are the same figures
 * the table beside them lists; nothing is re-derived here.
 */
export function SectionPie({ sections }: { sections: ClientSectionShareT[] }) {
  // Running cumulative angle, computed with a reduce so nothing is reassigned after render — React
  // Compiler forbids the plain `let cursor` accumulator a for-loop would use here.
  const stops = sections.reduce<{ deg: number; stops: string[] }>(
    (acc, section, index) => {
      const to = acc.deg + section.share * 360
      acc.stops.push(`${colorAt(index).var} ${acc.deg}deg ${to}deg`)
      return { deg: to, stops: acc.stops }
    },
    { deg: 0, stops: [] },
  ).stops

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div
        className="border-border size-40 shrink-0 rounded-full border"
        style={{ background: `conic-gradient(${stops.join(', ')})` }}
        role="img"
        aria-label="Udział sekcji w wartości wykonanych prac"
      />
      <ul className="flex flex-col gap-1 text-sm">
        {sections.map((section, index) => (
          <li key={section.sectionId} className="flex items-center gap-2">
            <span className={cn('size-3 shrink-0 rounded-xs', colorAt(index).swatch)} />
            <span className="truncate">{section.sectionName}</span>
            <span className="text-muted-foreground ml-auto pl-4 tabular-nums">
              {formatPercent(section.share)}
            </span>
            <span className="tabular-nums">{formatNet(section.net)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
