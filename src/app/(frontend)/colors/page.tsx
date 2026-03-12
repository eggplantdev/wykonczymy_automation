const CHART_COLORS = [
  { name: 'chart-red', var: 'var(--color-chart-red)' },
  { name: 'chart-green', var: 'var(--color-chart-green)' },
  { name: 'chart-blue', var: 'var(--color-chart-blue)' },
  { name: 'chart-orange', var: 'var(--color-chart-orange)' },
  { name: 'chart-yellow', var: 'var(--color-chart-yellow)' },
  { name: 'chart-pink', var: 'var(--color-chart-pink)' },
  { name: 'chart-turquoise', var: 'var(--color-chart-turquoise)' },
  { name: 'chart-teal', var: 'var(--color-chart-teal)' },
  { name: 'chart-purple', var: 'var(--color-chart-purple)' },
  { name: 'chart-gray', var: 'var(--color-chart-gray)' },
] as const

export default function ColorsPage() {
  return (
    <div className="mx-auto max-w-md space-y-4 p-8">
      <h1 className="text-xl font-bold">Chart Colors</h1>
      <div className="space-y-3">
        {CHART_COLORS.map((color) => (
          <div key={color.name} className="flex items-center gap-3">
            <div className="size-10 rounded-full border" style={{ backgroundColor: color.var }} />
            <span className="text-sm font-medium">{color.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
