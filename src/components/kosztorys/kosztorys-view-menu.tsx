'use client'

import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/use-kosztorys-editor-context'
import {
  LAYERS,
  LAYER_PAIR_CONFIG,
  MONEY_AXES,
  MONEY_PAIR_CONFIG,
  PROGRESS_DISPLAYS,
} from '@/components/kosztorys/kosztorys-toolbar-options'
import { derivePairChecks, togglePairAxis } from '@/lib/kosztorys/axis-checkboxes'
import type { ProgressDisplayT } from '@/lib/kosztorys/progress-display'

// preventDefault keeps the menu open so several axes / columns can be flipped in one visit
// (the same trick the shared ColumnToggleMenu uses).
const keepOpen = (event: Event) => event.preventDefault()

// One popover replacing four toolbar toggles + the Kolumny picker. Each section keeps the control
// type that fits its semantics: Etapy is single-select (radio); Kwoty / Warstwy are union filters
// skinned as checkbox pairs over the tri-state axes (both checked = the old „Bez filtra").
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
  } = useKosztorysEditorContext()

  const moneyChecks = derivePairChecks(moneyAxis, MONEY_PAIR_CONFIG)
  const layerChecks = derivePairChecks(layer, LAYER_PAIR_CONFIG)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="size-4" />
          Widok
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Etapy</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={progressDisplay}
          onValueChange={(value) => setProgressDisplay(value as ProgressDisplayT)}
        >
          {PROGRESS_DISPLAYS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} onSelect={keepOpen}>
              {option.icon}
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Kwoty</DropdownMenuLabel>
        {MONEY_AXES.map((option) => {
          const box = option.value === MONEY_PAIR_CONFIG.a ? 'a' : 'b'
          return (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={moneyChecks[box]}
              onSelect={keepOpen}
              onCheckedChange={() =>
                setMoneyAxis(togglePairAxis(moneyAxis, box, MONEY_PAIR_CONFIG))
              }
            >
              {option.icon}
              {option.label}
            </DropdownMenuCheckboxItem>
          )
        })}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Warstwy</DropdownMenuLabel>
        {LAYERS.map((option) => {
          const box = option.value === LAYER_PAIR_CONFIG.a ? 'a' : 'b'
          return (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={layerChecks[box]}
              onSelect={keepOpen}
              onCheckedChange={() => setLayer(togglePairAxis(layer, box, LAYER_PAIR_CONFIG))}
            >
              {option.icon}
              {option.label}
            </DropdownMenuCheckboxItem>
          )
        })}

        {columnToggleItems.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Kolumny</DropdownMenuLabel>
            {columnToggleItems.map((item) => (
              <DropdownMenuCheckboxItem
                key={item.id}
                checked={item.visible}
                onSelect={keepOpen}
                onCheckedChange={() => toggleColumn(item.id)}
              >
                {item.label}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
