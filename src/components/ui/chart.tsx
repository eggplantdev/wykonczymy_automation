'use client'

import * as React from 'react'
import * as RechartsPrimitive from 'recharts'

import { cn } from '@/lib/utils/cn'

function ChartContainer({
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children']
}) {
  return (
    <div
      data-slot="chart"
      className={cn(
        'flex justify-center text-xs [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke="#fff"]]:stroke-transparent [&_.recharts-surface]:outline-hidden',
        className,
      )}
      {...props}
    >
      <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
    </div>
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
  className,
  valueFormatter,
}: Pick<React.ComponentProps<typeof RechartsPrimitive.Tooltip>, 'active' | 'payload'> &
  React.ComponentProps<'div'> & {
    valueFormatter?: (value: unknown) => React.ReactNode
  }) {
  if (!active || !payload?.length) return null

  return (
    <div
      className={cn(
        'border-border/50 bg-background grid min-w-32 gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl',
        className,
      )}
    >
      {payload.map((item, index) => {
        const color = item.payload?.fill || item.color

        return (
          <div key={index} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-xs" style={{ backgroundColor: color }} />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="text-foreground ml-auto font-mono font-medium tabular-nums">
              {valueFormatter ? valueFormatter(item.value) : item.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }
