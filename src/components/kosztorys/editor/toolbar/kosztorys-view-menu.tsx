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
  CREWS,
  CREW_PAIR_CONFIG,
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
    crewAxis,
    setCrewAxis,
    columnToggleItems,
    revealedColumnIds,
    toggleColumn,
    setAllColumns,
    columnRanks,
    columnBaseRanks,
    setColumnRank,
    resetColumnOrder,
  } = useKosztorysEditorContext()

  // Both axis controls belong to „Inwestor" alone, for two different reasons: subcontractors are paid
  // without VAT (EX-558), so netto/brutto is meaningless in their views, and a subcontractor view IS
  // the crew choice (`effectiveCrewAxis` pins it) — ticks there would be a control that cannot move.
  const isClientView = view === 'client'

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
          {isClientView && (
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
          {isClientView && (
            <>
              <AxisSection
                label="Stawki wykonawców"
                options={CREWS}
                value={crewAxis}
                config={CREW_PAIR_CONFIG}
                onChange={setCrewAxis}
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
