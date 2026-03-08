'use client'

import * as React from 'react'
import * as RechartsPrimitive from 'recharts'

import { cn } from '@/lib/cn'

// ── Container ────────────────────────────────────────────────────────────

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

// ── Tooltip ──────────────────────────────────────────────────────────────

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
      {payload.map((item) => {
        const color = item.payload?.fill || item.color

        return (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: color }}
            />
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

// ── Legend ────────────────────────────────────────────────────────────────

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
  className,
  payload,
  verticalAlign = 'bottom',
}: React.ComponentProps<'div'> & Pick<RechartsPrimitive.LegendProps, 'payload' | 'verticalAlign'>) {
  if (!payload?.length) return null

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-4',
        verticalAlign === 'top' ? 'pb-3' : 'pt-3',
        className,
      )}
    >
      {payload.map((item) => (
        <div key={item.value} className="flex items-center gap-1.5">
          <div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
          {item.value}
        </div>
      ))}
    </div>
  )
}

// ── Exports ──────────────────────────────────────────────────────────────

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent }
