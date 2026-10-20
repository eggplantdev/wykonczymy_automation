'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import * as Collapsible from '@/components/ui/collapsible'
import { GradientSpinner } from '@/components/ui/gradient-spinner'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

const DIALOG_WIDTHS = [
  { name: 'max-w-dialog-sm', className: 'max-w-dialog-sm', value: 'min(90vw, 26.25rem)' },
  { name: 'max-w-dialog', className: 'max-w-dialog', value: 'min(90vw, 37.5rem)' },
  { name: 'max-w-dialog-md', className: 'max-w-dialog-md', value: 'min(90vw, 46.875rem)' },
  { name: 'max-w-dialog-lg', className: 'max-w-dialog-lg', value: 'min(90vw, 56.25rem)' },
  { name: 'max-w-dialog-xl', className: 'max-w-dialog-xl', value: 'min(80vw, 75rem)' },
  { name: 'max-w-dialog-2xl', className: 'max-w-dialog-2xl', value: 'min(95vw, 87.5rem)' },
  { name: 'max-w-dialog-3xl', className: 'max-w-dialog-3xl', value: 'min(95vw, 112.5rem)' },
] as const

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

const SPACING_TOKENS = [
  {
    name: 'h-below-top-nav',
    value: 'calc(100dvh - 3.5rem)',
    caption: 'Wysokość ekranu pod TopNav (h-14) — pełnoekranowe widoki.',
  },
  {
    name: 'max-h-dialog-scroll',
    value: '55vh',
    caption: 'Wysokość przewijanego obszaru w dialogu.',
  },
] as const

const DURATIONS = [
  { name: 'duration-150', className: 'duration-150', uses: 1 },
  { name: 'duration-200', className: 'duration-200', uses: 8 },
  { name: 'duration-300', className: 'duration-300', uses: 5 },
] as const

const EFFECTS = [
  { name: 'gradient-border', className: 'gradient-border' },
  { name: 'gradient-border-comet', className: 'gradient-border-comet' },
  { name: 'neon-glow-duo', className: 'gradient-border neon-glow-duo' },
  { name: 'neon-glow-duo-hit', className: 'gradient-border neon-glow-duo-hit' },
  {
    name: 'gradient-border-comet neon-glow-duo-breathe',
    className: 'gradient-border-comet neon-glow-duo neon-glow-duo-breathe',
  },
] as const

const OPACITIES = [
  { name: 'opacity-40', className: 'opacity-40', caption: 'przygaszenie' },
  { name: 'opacity-50', className: 'opacity-50', caption: 'disabled' },
  { name: 'opacity-60', className: 'opacity-60', caption: 'przygaszenie' },
  { name: 'opacity-70', className: 'opacity-70', caption: 'hover badge' },
  { name: 'opacity-80', className: 'opacity-80', caption: 'hover' },
] as const

const Z_LAYERS = [
  { value: 'z-10', owner: 'PageLoading, ToggleGroup, Calendar, uchwyty zmiany rozmiaru w arkuszu' },
  { value: 'z-30', owner: 'LongTextCell — rozwinięta komórka arkusza' },
  { value: 'z-50', owner: 'strzałka Tooltip (wewnątrz treści)' },
  { value: 'z-10000', owner: 'Dialog (overlay + treść), EnvBadge' },
  {
    value: 'z-10001',
    owner: 'AlertDialog, Popover, Select, DropdownMenu (+ podmenu), Tooltip',
  },
  { value: 'z-10002', owner: 'Sheet (overlay + treść)' },
  { value: 'z-100000000', owner: 'Loader, SubmitPill' },
] as const

function TokenCaption({ children }: { children: string }) {
  return <code className="text-muted-foreground text-2xs">{children}</code>
}

export function TokensSection() {
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(true)
  const [isFaded, setIsFaded] = useState(false)
  const [rowInKey, setRowInKey] = useState(0)

  return (
    <ShowcaseSection id="tokens">
      <ShowcaseRow
        title="Breakpointy"
        source="styles/globals.css --breakpoint-* (sm: to jedyny próg telefon → desktop)"
        className="flex-col items-start"
      >
        {BREAKPOINTS.map((breakpoint) => (
          <div key={breakpoint.name} className="flex items-baseline gap-2">
            <TokenCaption>
              {`${breakpoint.name}: — ${breakpoint.value}, domyślnie w Tailwind ${breakpoint.tailwindDefault}`}
            </TokenCaption>
            <span className={cn('text-xs font-medium', breakpoint.activeClassName)}>aktywny</span>
          </div>
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="Szerokości dialogów"
        source="styles/globals.css --container-dialog-*"
        className="flex-col items-stretch"
      >
        {DIALOG_WIDTHS.map((width) => (
          <div key={width.name} className="flex flex-col gap-1">
            <div className={cn('bg-muted h-6 w-full rounded-md border', width.className)} />
            <TokenCaption>{`${width.name} — ${width.value}`}</TokenCaption>
          </div>
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="Odstępy i wysokości"
        source="styles/globals.css --spacing-*"
        className="flex-col items-start"
      >
        {SPACING_TOKENS.map((token) => (
          <div key={token.name} className="flex flex-col gap-0.5">
            <TokenCaption>{`${token.name} — ${token.value}`}</TokenCaption>
            <span className="text-sm">{token.caption}</span>
          </div>
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="Ruch — rozwijanie"
        source="styles/globals.css animate-collapse-down / animate-collapse-up (200ms ease-out)"
        className="flex-col items-start"
      >
        <Collapsible.Root open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen}>
          <Collapsible.Trigger asChild>
            <Button variant="outline" size="sm">
              {isCollapsibleOpen ? 'Zwiń' : 'Rozwiń'}
            </Button>
          </Collapsible.Trigger>
          <Collapsible.Content>
            <div className="bg-muted mt-2 w-64 rounded-md p-4 text-sm">Treść rozwijana</div>
          </Collapsible.Content>
        </Collapsible.Root>
      </ShowcaseRow>
      <ShowcaseRow
        title="Ruch — czasy przejść"
        source="Tailwind duration-* (liczba użyć w src/)"
        className="gap-4"
      >
        <Button variant="outline" size="sm" onClick={() => setIsFaded((previous) => !previous)}>
          Przełącz
        </Button>
        {DURATIONS.map((duration) => (
          <div key={duration.name} className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'bg-primary size-12 rounded-md transition-opacity',
                duration.className,
                isFaded && 'opacity-20',
              )}
            />
            <TokenCaption>{`${duration.name} ×${duration.uses}`}</TokenCaption>
          </div>
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="Ruch — nowy wiersz arkusza"
        source="styles/globals.css @keyframes kosztorys-row-in (500ms, wyłączone przy prefers-reduced-motion)"
        className="gap-4"
      >
        <Button variant="outline" size="sm" onClick={() => setRowInKey((previous) => previous + 1)}>
          Odtwórz
        </Button>
        <div
          key={rowInKey}
          className="bg-muted animate-[kosztorys-row-in_500ms_ease-out] rounded-md px-4 py-2 text-sm"
        >
          Nowa pozycja
        </div>
      </ShowcaseRow>
      <ShowcaseRow title="Efekty AI" source="styles/globals.css @utility" className="gap-6">
        {EFFECTS.map((effect) => (
          <div key={effect.name} className="flex flex-col items-center gap-2">
            <div className={cn('h-10 w-32 rounded-md', effect.className)} />
            <TokenCaption>{effect.name}</TokenCaption>
          </div>
        ))}
        <div className="flex flex-col items-center gap-2">
          <div className="bg-chart-turquoise progress-glow h-2 w-32 rounded-full" />
          <TokenCaption>progress-glow</TokenCaption>
        </div>
        <div className="flex flex-col items-center gap-2">
          <GradientSpinner className="size-6" />
          <TokenCaption>gradient-spinner</TokenCaption>
        </div>
      </ShowcaseRow>
      <ShowcaseRow
        title="Stany — fokus i disabled"
        source="ui/button.tsx, ui/input.tsx"
        className="gap-4"
      >
        <div className="flex flex-col items-center gap-1">
          <Button variant="outline" size="sm" className="ring-ring/50 ring-3">
            Fokus (wymuszony)
          </Button>
          <TokenCaption>focus-visible:ring-3 ring-ring/50</TokenCaption>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Button variant="outline" size="sm" disabled>
            Disabled
          </Button>
          <TokenCaption>disabled:opacity-50</TokenCaption>
        </div>
      </ShowcaseRow>
      <ShowcaseRow title="Przezroczystości w użyciu" source="Tailwind opacity-*" className="gap-4">
        {OPACITIES.map((opacity) => (
          <div key={opacity.name} className="flex flex-col items-center gap-1">
            <div className={cn('bg-foreground size-12 rounded-md', opacity.className)} />
            <TokenCaption>{opacity.name}</TokenCaption>
            <span className="text-muted-foreground text-2xs">{opacity.caption}</span>
          </div>
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="Warstwy (z-index)"
        source="src/components/ui/** — stan obecny, bez zdefiniowanej skali"
        className="flex-col items-stretch"
      >
        <table className="w-full max-w-2xl text-sm">
          <tbody>
            {Z_LAYERS.map((layer) => (
              <tr key={layer.value} className="border-b last:border-b-0">
                <td className="w-36 py-1.5 pr-4 align-top">
                  <code className="text-xs">{layer.value}</code>
                </td>
                <td className="py-1.5">{layer.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ShowcaseRow>
      <ShowcaseRow
        title="Narzędzia"
        source="styles/globals.css @utility / @custom-variant"
        className="gap-6"
      >
        <div className="flex max-w-56 flex-col gap-1">
          <Input placeholder="typing-surface" />
          <TokenCaption>typing-surface</TokenCaption>
          <span className="text-muted-foreground text-2xs">
            Min. 16px na telefonie — iOS nie przybliża strony przy fokusie.
          </span>
        </div>
        <div className="flex max-w-56 flex-col gap-1">
          <span className="inline-block h-24">
            <span className="vertical-text">Etap 1</span>
          </span>
          <TokenCaption>vertical-text</TokenCaption>
          <span className="text-muted-foreground text-2xs">
            Pionowe nagłówki kolumn; na inline-block w komórce, nie na th.
          </span>
        </div>
        <div className="flex max-w-56 flex-col gap-1">
          <span className="standalone:bg-primary standalone:text-primary-foreground bg-muted w-fit rounded-md px-3 py-1 text-sm">
            standalone:
          </span>
          <TokenCaption>standalone:</TokenCaption>
          <span className="text-muted-foreground text-2xs">
            Tylko w aplikacji zainstalowanej na ekranie (PWA) — tu podświetli się na ciemno.
          </span>
        </div>
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
