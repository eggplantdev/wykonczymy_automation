'use client'

import { useState, type ComponentProps } from 'react'
import { Bar, BarChart, XAxis } from 'recharts'
import { BalanceCell } from '@/components/ui/balance-cell'
import { SignedMoneyDisplay } from '@/components/ui/signed-money-display'
import { DecisionProgressBadge, type DecisionStatusT } from '@/components/ui/decision-progress-badge'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { SlicePie } from '@/components/ui/slice-pie'
import { PieSliceLegend, type PieSliceT } from '@/components/ui/pie-legend'
import Icon from '@/components/ui/icons/icon'
import ArrowIcon from '@/components/ui/icons/arrow-icon'
import DropdownIcon from '@/components/ui/icons/dropdown-icon'
import MenuDotsIcon from '@/components/ui/icons/menu-dots-icon'
import { formatPercent } from '@/lib/kosztorys/format'
import { formatPLN } from '@/lib/utils/format-currency'
import { toggleInSet } from '@/lib/utils/toggle-in-set'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

type IconPropsT = ComponentProps<typeof Icon>
type IconNameT = IconPropsT['iconName']
type IconSizeT = NonNullable<IconPropsT['size']>
type ArrowDirectionT = ComponentProps<typeof ArrowIcon>['direction']
type DropdownDirectionT = ComponentProps<typeof DropdownIcon>['direction']

const ICON_NAMES = Object.keys({
  arrowLeft: true,
  arrowRight: true,
  dropdownDown: true,
  menuDots: true,
} satisfies Record<IconNameT, true>) as IconNameT[]

const ICON_SIZES = Object.keys({
  xxs: true,
  xs: true,
  sm: true,
  md: true,
  lg: true,
} satisfies Record<IconSizeT, true>) as IconSizeT[]

const ARROW_DIRECTIONS = Object.keys({
  up: true,
  right: true,
  down: true,
  left: true,
} satisfies Record<ArrowDirectionT, true>) as ArrowDirectionT[]

const DROPDOWN_DIRECTIONS = Object.keys({
  down: true,
  up: true,
} satisfies Record<DropdownDirectionT, true>) as DropdownDirectionT[]

const BALANCES = [12500, 0, -830.5]

const SLICES: PieSliceT[] = [
  { id: 'labor', name: 'Robocizna', value: 42000, fill: 'var(--color-chart-blue)' },
  { id: 'materials', name: 'Materiały', value: 27500, fill: 'var(--color-chart-orange)' },
  { id: 'equipment', name: 'Sprzęt', value: 6200, fill: 'var(--color-chart-teal)' },
  { id: 'other', name: 'Inne', value: 1800, fill: 'var(--color-chart-purple)' },
]

const BAR_DATA = [
  { month: 'Sty', value: 18000 },
  { month: 'Lut', value: 24500 },
  { month: 'Mar', value: 21000 },
  { month: 'Kwi', value: 30200 },
]

export function DataDisplaySection() {
  const [hiddenStatuses, setHiddenStatuses] = useState<ReadonlySet<DecisionStatusT>>(() => new Set())

  return (
    <ShowcaseSection id="data-display">
      <ShowcaseRow title="Kwoty" source="ui/balance-cell.tsx, ui/signed-money-display.tsx">
        {BALANCES.map((value) => (
          <BalanceCell key={value} value={value} />
        ))}
        <SignedMoneyDisplay amount={12500} label="Saldo" />
        <SignedMoneyDisplay amount={-830.5} label="Saldo" tooltip="Suma zaznaczonych" />
        <SignedMoneyDisplay amount={4200} label="Zaznaczone" selectionCount={{ selected: 3, total: 12 }} />
      </ShowcaseRow>
      <ShowcaseRow title="DecisionProgressBadge" source="ui/decision-progress-badge.tsx">
        <DecisionProgressBadge accepted={7} rejected={2} pending={4} />
        <DecisionProgressBadge
          accepted={7}
          rejected={2}
          pending={4}
          hidden={hiddenStatuses}
          onToggle={(status) => setHiddenStatuses((previous) => toggleInSet(previous, status))}
        />
      </ShowcaseRow>
      <ShowcaseRow title="Wykresy" source="ui/chart.tsx, ui/slice-pie.tsx, ui/pie-legend.tsx" className="grid sm:grid-cols-3">
        <ChartContainer className="h-48">
          <BarChart data={BAR_DATA}>
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent valueFormatter={(value) => formatPLN(Number(value))} />} />
            <Bar dataKey="value" name="Obrót" fill="var(--color-chart-blue)" radius={4} />
          </BarChart>
        </ChartContainer>
        <SlicePie slices={SLICES} formatShare={formatPercent} formatValue={formatPLN} caption="Koszty inwestycji" />
        <PieSliceLegend slices={SLICES} formatShare={formatPercent} />
      </ShowcaseRow>
      <ShowcaseRow title="Icon — nazwa × rozmiar" source="ui/icons/icon.tsx" className="flex-col items-start">
        {ICON_NAMES.map((iconName) => (
          <div key={iconName} className="flex items-center gap-3">
            <code className="text-muted-foreground w-28 text-xs">{iconName}</code>
            {ICON_SIZES.map((size) => (
              <Icon key={size} iconName={iconName} size={size} />
            ))}
          </div>
        ))}
      </ShowcaseRow>
      <ShowcaseRow title="Ikony kierunkowe" source="ui/icons/arrow-icon.tsx, ui/icons/dropdown-icon.tsx, ui/icons/menu-dots-icon.tsx">
        {ARROW_DIRECTIONS.map((direction) => (
          <ArrowIcon key={direction} direction={direction} />
        ))}
        {DROPDOWN_DIRECTIONS.map((direction) => (
          <DropdownIcon key={direction} direction={direction} />
        ))}
        <MenuDotsIcon />
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
