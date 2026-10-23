'use client'

import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from 'recharts'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Description } from '@/components/ui/description'
import type { MaterialPricePointT } from '@/lib/materials/types'
import { formatPLN } from '@/lib/utils/format-currency'
import { cn } from '@/lib/utils/cn'
import { MaterialPriceTooltip } from './material-price-tooltip'
import { shopColor } from './material-shop-colors'

const AXIS_TICK = { fill: 'var(--color-muted-foreground)' }
const DATE_FORMAT = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' })

type PropsT = {
  shops: string[]
  points: MaterialPricePointT[]
}

export function MaterialPriceChart({ shops, points }: PropsT) {
  return (
    <div className="grid gap-4">
      <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-xs">
        {shops.map((shop, rank) => (
          <li key={shop} className="flex items-center gap-2">
            <span className={cn('size-2.5 rounded-full', shopColor(rank).swatch)} />
            {shop}
          </li>
        ))}
      </ul>
      <ChartContainer className="h-72 w-full">
        <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="time"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tick={AXIS_TICK}
            tickFormatter={(time: number) => DATE_FORMAT.format(time)}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            type="number"
            dataKey="net"
            tick={AXIS_TICK}
            tickFormatter={(net: number) => formatPLN(net)}
            tickLine={false}
            axisLine={false}
            width={88}
            domain={['auto', 'auto']}
          />
          <ZAxis range={[72, 72]} />
          <ChartTooltip cursor={false} content={<MaterialPriceTooltip />} />
          {shops.map((shop, rank) => (
            <Scatter
              key={shop}
              data={points.filter((point) => point.shop === shop)}
              fill={shopColor(rank).color}
              stroke="var(--color-background)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </ScatterChart>
      </ChartContainer>
      <Description size="xs" withIcon={false}>
        Każda kropka to jeden zakup: cena netto za opakowanie. Najedź, żeby zobaczyć fakturę.
      </Description>
    </div>
  )
}
