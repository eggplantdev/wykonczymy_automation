import { cn } from '@/lib/utils/cn'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

const SAMPLE = 'Zażółć gęślą jaźń 1 234,56 zł'

const FAMILIES = [
  { name: 'font-sans (stos systemowy — brak załadowanego fontu)', className: 'font-sans' },
  { name: 'font-mono (Space Mono 400)', className: 'font-mono' },
] as const

const SIZES = [
  { name: 'text-3xs', className: 'text-3xs' },
  { name: 'text-2xs', className: 'text-2xs' },
  { name: 'text-xs', className: 'text-xs' },
  { name: 'text-sm', className: 'text-sm' },
  { name: 'text-base', className: 'text-base' },
  { name: 'text-lg', className: 'text-lg' },
  { name: 'text-xl', className: 'text-xl' },
  { name: 'text-2xl', className: 'text-2xl' },
  { name: 'text-3xl', className: 'text-3xl' },
  { name: 'grid-cell-text', className: 'grid-cell-text' },
  { name: 'grid-band-text', className: 'grid-band-text' },
] as const

const WEIGHTS = [
  { name: 'font-normal', className: 'font-normal' },
  { name: 'font-medium', className: 'font-medium' },
  { name: 'font-semibold', className: 'font-semibold' },
  { name: 'font-bold', className: 'font-bold' },
] as const

const TONES = [
  { name: 'text-foreground', className: 'text-foreground' },
  { name: 'text-muted-foreground', className: 'text-muted-foreground' },
  { name: 'text-destructive', className: 'text-destructive' },
  { name: 'text-primary', className: 'text-primary' },
] as const

export function TypographySection() {
  return (
    <ShowcaseSection id="typography">
      <ShowcaseRow title="Rodziny" source="fonts/index.ts, styles/globals.css --font-mono" className="flex-col items-start">
        {FAMILIES.map((family) => (
          <p key={family.name} className={family.className}>
            <code className="text-muted-foreground mr-3 font-mono text-xs">{family.name}</code>
            {SAMPLE}
          </p>
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="Rozmiary" source="styles/globals.css --text-2xs, --text-3xs, @utility grid-*" className="flex-col items-start">
        {SIZES.map((size) => (
          <p key={size.name} className="flex items-baseline gap-3">
            <code className="text-muted-foreground w-28 shrink-0 text-xs">{size.name}</code>
            <span className={size.className}>{SAMPLE}</span>
          </p>
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="Grubości" source="Tailwind" className="flex-col items-start">
        {WEIGHTS.map((weight) => (
          <p key={weight.name} className="flex items-baseline gap-3">
            <code className="text-muted-foreground w-28 shrink-0 text-xs">{weight.name}</code>
            <span className={cn('text-sm', weight.className)}>{SAMPLE}</span>
          </p>
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="Kolory tekstu" source="styles/globals.css" className="flex-col items-start">
        {TONES.map((tone) => (
          <p key={tone.name} className="flex items-baseline gap-3">
            <code className="text-muted-foreground w-40 shrink-0 text-xs">{tone.name}</code>
            <span className={cn('text-sm', tone.className)}>{SAMPLE}</span>
          </p>
        ))}
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
