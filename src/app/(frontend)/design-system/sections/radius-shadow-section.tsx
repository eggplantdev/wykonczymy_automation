import { cn } from '@/lib/utils/cn'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

const RADII = [
  { name: 'rounded-none', className: 'rounded-none' },
  { name: 'rounded-xs', className: 'rounded-xs' },
  { name: 'rounded-sm', className: 'rounded-sm' },
  { name: 'rounded', className: 'rounded' },
  { name: 'rounded-md', className: 'rounded-md' },
  { name: 'rounded-lg', className: 'rounded-lg' },
  { name: 'rounded-xl', className: 'rounded-xl' },
  { name: 'rounded-2xl', className: 'rounded-2xl' },
  { name: 'rounded-full', className: 'rounded-full' },
] as const

const SHADOWS = [
  { name: 'shadow-xs', className: 'shadow-xs' },
  { name: 'shadow-sm', className: 'shadow-sm' },
  { name: 'shadow', className: 'shadow' },
  { name: 'shadow-md', className: 'shadow-md' },
  { name: 'shadow-lg', className: 'shadow-lg' },
  { name: 'shadow-xl', className: 'shadow-xl' },
  { name: 'shadow-panel', className: 'shadow-panel' },
] as const

export function RadiusShadowSection() {
  return (
    <ShowcaseSection id="radius-shadow">
      <ShowcaseRow title="Zaokrąglenia" source="styles/globals.css --radius: 0.625rem" className="gap-4">
        {RADII.map((radius) => (
          <div key={radius.name} className="flex flex-col items-center gap-1">
            <div className={cn('bg-muted size-16 border-2', radius.className)} />
            <code className="text-muted-foreground text-2xs">{radius.name}</code>
          </div>
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="Cienie" source="styles/globals.css --shadow-panel + Tailwind" className="gap-6">
        {SHADOWS.map((shadow) => (
          <div key={shadow.name} className="flex flex-col items-center gap-2">
            <div className={cn('bg-card size-16 rounded-md', shadow.className)} />
            <code className="text-muted-foreground text-2xs">{shadow.name}</code>
          </div>
        ))}
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
