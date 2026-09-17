'use client'

import { type ReactNode } from 'react'
import {
  DropdownMenuCheckboxRow,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ColumnToggleMenu } from '@/components/ui/column-toggle-menu'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import {
  KOLUMNY_HINT,
  LAYERS,
  LAYER_PAIR_CONFIG,
  MONEY_AXES,
  MONEY_PAIR_CONFIG,
} from '@/components/kosztorys/editor/toolbar/kosztorys-view-axis-options'
import {
  derivePairChecks,
  togglePairAxis,
  type PairAxisConfigT,
} from '@/lib/kosztorys/axis-checkboxes'

// preventDefault keeps the menu open so several axes can be flipped in one visit.
const keepOpen = (event: Event) => event.preventDefault()

// One axis (Kwoty / Warstwy) as a labelled checkbox pair over its four-state union: each box
// flips its side via togglePairAxis, both checked = show all, both unchecked = hide the axis.
function AxisSection<T extends string>({
  label,
  options,
  value,
  config,
  onChange,
}: {
  label: string
  options: { value: T; label: string; icon?: ReactNode }[]
  value: T
  config: PairAxisConfigT<T>
  onChange: (next: T) => void
}) {
  const checks = derivePairChecks(value, config)
  return (
    <>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      {options.map((option) => {
        const box = option.value === config.a ? 'a' : 'b'
        return (
          <DropdownMenuCheckboxRow
            key={option.value}
            checked={checks[box]}
            onSelect={keepOpen}
            onCheckedChange={() => onChange(togglePairAxis(value, box, config))}
            label={option.label}
            trailing={option.icon}
          />
        )
      })}
    </>
  )
}

export function KosztorysViewMenu() {
  const {
    view,
    moneyAxis,
    setMoneyAxis,
    layer,
    setLayer,
    columnToggleItems,
    revealedColumnIds,
    toggleColumn,
    setAllColumns,
    columnRanks,
    columnBaseRanks,
    setColumnRank,
    resetColumnOrder,
  } = useKosztorysEditorContext()

  // Subcontractors are paid without VAT (EX-558), so the netto/brutto axis is meaningless in the
  // Z/Bez narzędzi views — hide the Kwoty control there.
  const showMoneyAxis = view === 'client'

  // A hidden column is the one piece of „co widzę" that leaves no trace on the grid — a filter at
  // least shortens it, while a column that is gone looks exactly like a column that never existed.
  // A column an engaged problem reveals is on screen whatever its tick says, so it is not hidden and
  // must not be counted: the number has to answer „czego nie widzę", not „co odznaczyłem".
  const hiddenCount = columnToggleItems.filter(
    (item) => !item.visible && !revealedColumnIds.has(item.id),
  ).length

  return (
    <ColumnToggleMenu
      align="start"
      items={columnToggleItems}
      hiddenCount={hiddenCount}
      onToggle={toggleColumn}
      onToggleAll={(visible) =>
        setAllColumns(
          columnToggleItems.map((item) => item.id),
          !visible,
        )
      }
      hint={<InfoTooltip content={KOLUMNY_HINT} className="shrink-0" />}
      order={{
        description:
          'Przeciągnij pozycję, żeby przestawić kolumny w tabeli. Ustawienie zapamiętuje ta przeglądarka i działa we wszystkich kosztorysach.',
        ranks: columnRanks,
        baseRanks: columnBaseRanks,
        onSetRank: setColumnRank,
        onReset: resetColumnOrder,
      }}
      sections={
        <>
          {showMoneyAxis && (
            <>
              <AxisSection
                label="Kwoty"
                options={MONEY_AXES}
                value={moneyAxis}
                config={MONEY_PAIR_CONFIG}
                onChange={setMoneyAxis}
              />
              <DropdownMenuSeparator />
            </>
          )}
          <AxisSection
            label="Warstwy"
            options={LAYERS}
            value={layer}
            config={LAYER_PAIR_CONFIG}
            onChange={setLayer}
          />
        </>
      }
    />
  )
}
