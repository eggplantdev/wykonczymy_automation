'use client'

import type { ReactNode } from 'react'
import { CheckIcon, Eye, EyeOff, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils/cn'
import { useKosztorysEditorContext } from '@/components/kosztorys/use-kosztorys-editor-context'
import {
  KOLUMNY_HINT,
  LAYERS,
  LAYER_PAIR_CONFIG,
  MONEY_AXES,
  MONEY_PAIR_CONFIG,
  PROGRESS_DISPLAYS,
  PROGRESS_PAIR_CONFIG,
} from '@/components/kosztorys/kosztorys-toolbar-options'
import {
  derivePairChecks,
  togglePairAxis,
  type PairAxisConfigT,
} from '@/lib/kosztorys/axis-checkboxes'

// preventDefault keeps the menu open so several axes / columns can be flipped in one visit
// (the same trick the shared ColumnToggleMenu uses).
const keepOpen = (event: Event) => event.preventDefault()

// Below this the list fits on screen and a search box is just noise; above it (stages push the
// column count toward ~50) filtering earns its place.
const COLUMN_SEARCH_THRESHOLD = 8

// One axis (Kwoty / Warstwy / Etapy) as a labelled checkbox pair over its four-state union: each box
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
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={checks[box]}
            onSelect={keepOpen}
            onCheckedChange={() => onChange(togglePairAxis(value, box, config))}
          >
            {option.label}
            {option.icon && <span className="ml-auto">{option.icon}</span>}
          </DropdownMenuCheckboxItem>
        )
      })}
    </>
  )
}

// One popover replacing four toolbar toggles + the Kolumny picker. Kwoty / Warstwy / Etapy are
// union filters skinned as checkbox pairs (both checked = show all, both unchecked = hide the axis).
export function KosztorysViewMenu() {
  const {
    moneyAxis,
    setMoneyAxis,
    progressDisplay,
    setProgressDisplay,
    layer,
    setLayer,
    columnToggleItems,
    toggleColumn,
    setAllColumns,
  } = useKosztorysEditorContext()

  const allColumnsVisible = columnToggleItems.every((item) => item.visible)
  const showColumnSearch = columnToggleItems.length > COLUMN_SEARCH_THRESHOLD

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal />
          Widok
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <AxisSection
          label="Kwoty"
          options={MONEY_AXES}
          value={moneyAxis}
          config={MONEY_PAIR_CONFIG}
          onChange={setMoneyAxis}
        />

        <DropdownMenuSeparator />
        <AxisSection
          label="Warstwy"
          options={LAYERS}
          value={layer}
          config={LAYER_PAIR_CONFIG}
          onChange={setLayer}
        />

        <DropdownMenuSeparator />
        <AxisSection
          label="Etapy"
          options={PROGRESS_DISPLAYS}
          value={progressDisplay}
          config={PROGRESS_PAIR_CONFIG}
          onChange={setProgressDisplay}
        />

        {columnToggleItems.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center justify-between gap-2">
              Kolumny
              <InfoTooltip content={KOLUMNY_HINT} className="shrink-0" />
            </DropdownMenuLabel>
            {/* cmdk owns the search + arrow-nav for the column list; stop keydowns from reaching the
                Radix menu so its typeahead/focus-roving doesn't fight cmdk. Escape still passes so
                the menu stays Escape-closable. */}
            <div
              onKeyDown={(event) => {
                if (event.key !== 'Escape') event.stopPropagation()
              }}
            >
              <Command>
                {showColumnSearch && (
                  <CommandInput placeholder="Szukaj kolumny..." className="h-8" />
                )}
                <CommandList>
                  {/* forceMount keeps the show/hide-all action visible under any search — it's a
                      command, not a filterable column. Riding cmdk's selection model (not a Radix
                      item) also means exactly one row is ever highlighted. */}
                  <CommandItem
                    forceMount
                    onSelect={() =>
                      setAllColumns(
                        columnToggleItems.map((item) => item.id),
                        allColumnsVisible,
                      )
                    }
                  >
                    {allColumnsVisible ? <EyeOff /> : <Eye />}
                    {allColumnsVisible ? 'Ukryj wszystkie' : 'Pokaż wszystkie'}
                  </CommandItem>
                  <CommandEmpty>Brak kolumn</CommandEmpty>
                  {columnToggleItems.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.label}
                      onSelect={() => toggleColumn(item.id)}
                    >
                      <CheckIcon className={cn(!item.visible && 'opacity-0')} />
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
