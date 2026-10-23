const SHOP_COLORS = [
  { color: 'var(--color-chart-blue)', swatch: 'bg-chart-blue' },
  { color: 'var(--color-chart-orange)', swatch: 'bg-chart-orange' },
  { color: 'var(--color-chart-purple)', swatch: 'bg-chart-purple' },
  { color: 'var(--color-chart-green)', swatch: 'bg-chart-green' },
  { color: 'var(--color-chart-pink)', swatch: 'bg-chart-pink' },
] as const

const OTHER_SHOP_COLOR = { color: 'var(--color-muted-foreground)', swatch: 'bg-muted-foreground' }

// By the shop's rank in the material's own shop list, so the table swatch and the chart dot agree.
export const shopColor = (rank: number) => SHOP_COLORS[rank] ?? OTHER_SHOP_COLOR
