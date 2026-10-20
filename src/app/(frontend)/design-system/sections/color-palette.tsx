import { cn } from '@/lib/utils/cn'
import { COLOR_TOKENS, COLOR_TOKEN_CLASSES } from '@/styles/color-tokens'
import { ShowcaseRow } from '../showcase-row'
import { ColorSwatch } from './color-swatch'

const SEMANTIC_COLORS = [
  { name: 'background', className: 'bg-background' },
  { name: 'foreground', className: 'bg-foreground' },
  { name: 'card', className: 'bg-card' },
  { name: 'popover', className: 'bg-popover' },
  { name: 'popover-foreground', className: 'bg-popover-foreground' },
  { name: 'primary', className: 'bg-primary' },
  { name: 'primary-foreground', className: 'bg-primary-foreground' },
  { name: 'secondary', className: 'bg-secondary' },
  { name: 'secondary-foreground', className: 'bg-secondary-foreground' },
  { name: 'muted', className: 'bg-muted' },
  { name: 'muted-foreground', className: 'bg-muted-foreground' },
  { name: 'accent', className: 'bg-accent' },
  { name: 'accent-foreground', className: 'bg-accent-foreground' },
  { name: 'destructive', className: 'bg-destructive' },
  { name: 'border', className: 'bg-border' },
  { name: 'input', className: 'bg-input' },
  { name: 'ring', className: 'bg-ring' },
] as const

const TEXT_PAIRS = [
  { name: 'foreground / background', className: 'bg-background text-foreground' },
  { name: 'card', className: 'bg-card text-foreground' },
  { name: 'popover', className: 'bg-popover text-popover-foreground' },
  { name: 'primary', className: 'bg-primary text-primary-foreground' },
  { name: 'secondary', className: 'bg-secondary text-secondary-foreground' },
  { name: 'muted', className: 'bg-muted text-muted-foreground' },
  { name: 'accent', className: 'bg-accent text-accent-foreground' },
  { name: 'destructive', className: 'bg-background text-destructive' },
] as const

const CHART_COLORS = [
  { name: 'chart-blue', className: 'bg-chart-blue' },
  { name: 'chart-orange', className: 'bg-chart-orange' },
  { name: 'chart-red', className: 'bg-chart-red' },
  { name: 'chart-green', className: 'bg-chart-green' },
  { name: 'chart-pink', className: 'bg-chart-pink' },
  { name: 'chart-turquoise', className: 'bg-chart-turquoise' },
  { name: 'chart-yellow', className: 'bg-chart-yellow' },
  { name: 'chart-teal', className: 'bg-chart-teal' },
  { name: 'chart-purple', className: 'bg-chart-purple' },
] as const

const EFFECT_COLORS = [
  { name: 'neon-fuchsia', className: 'bg-neon-fuchsia' },
  { name: 'neon-cyan', className: 'bg-neon-cyan' },
  { name: 'report-accent', className: 'bg-report-accent' },
] as const

export function ColorPalette() {
  return (
    <>
      <ShowcaseRow title="Semantyczne (shadcn)" source="styles/globals.css @theme + .dark">
        {SEMANTIC_COLORS.map((color) => (
          <ColorSwatch key={color.name} name={color.name} className={color.className} />
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="Pary tekst / tło" source="styles/globals.css">
        {TEXT_PAIRS.map((pair) => (
          <div key={pair.name} className={cn('rounded-md border px-3 py-2 text-sm', pair.className)}>
            {pair.name}
          </div>
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="Wykresy" source="styles/globals.css --color-chart-*">
        {CHART_COLORS.map((color) => (
          <ColorSwatch key={color.name} name={color.name} className={color.className} />
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="Sekcje i przelewy" source="styles/color-tokens.ts COLOR_TOKENS">
        {COLOR_TOKENS.map((token) => (
          <ColorSwatch key={token} name={token} className={COLOR_TOKEN_CLASSES[token].dot} />
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="Neon i raport" source="styles/globals.css">
        {EFFECT_COLORS.map((color) => (
          <ColorSwatch key={color.name} name={color.name} className={color.className} />
        ))}
      </ShowcaseRow>
    </>
  )
}
