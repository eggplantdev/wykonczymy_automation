import { cn } from '@/lib/utils/cn'
import { ShowcaseRow } from '../showcase-row'

const BREAKPOINTS = [
  {
    name: 'sm',
    value: '48rem (768px)',
    tailwindDefault: '640px',
    activeClassName: 'hidden sm:inline',
  },
  {
    name: 'md',
    value: '64rem (1024px)',
    tailwindDefault: '768px',
    activeClassName: 'hidden md:inline',
  },
  {
    name: 'lg',
    value: '80rem (1280px)',
    tailwindDefault: '1024px',
    activeClassName: 'hidden lg:inline',
  },
  {
    name: 'xl',
    value: '90rem (1440px)',
    tailwindDefault: '1280px',
    activeClassName: 'hidden xl:inline',
  },
  {
    name: '2xl',
    value: '120rem (1920px)',
    tailwindDefault: '1536px',
    activeClassName: 'hidden 2xl:inline',
  },
] as const

export function BreakpointsRow() {
  return (
    <ShowcaseRow
      title="Breakpointy"
      source="styles/globals.css --breakpoint-* (sm: to jedyny próg telefon → desktop)"
      className="flex-col items-start"
    >
      {BREAKPOINTS.map((breakpoint) => (
        <div key={breakpoint.name} className="flex items-baseline gap-2">
          <code className="text-muted-foreground text-2xs">
            {`${breakpoint.name}: — ${breakpoint.value}, domyślnie w Tailwind ${breakpoint.tailwindDefault}`}
          </code>
          <span className={cn('text-xs font-medium', breakpoint.activeClassName)}>aktywny</span>
        </div>
      ))}
    </ShowcaseRow>
  )
}
