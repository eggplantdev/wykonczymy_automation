'use client'

import { Eye, Info, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SimpleTooltip } from '@/components/ui/tooltip'
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
import { derivePairChecks, togglePairAxis } from '@/lib/kosztorys/axis-checkboxes'

// preventDefault keeps the menu open so several axes / columns can be flipped in one visit
// (the same trick the shared ColumnToggleMenu uses).
const keepOpen = (event: Event) => event.preventDefault()

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
    showAllColumns,
  } = useKosztorysEditorContext()

  const moneyChecks = derivePairChecks(moneyAxis, MONEY_PAIR_CONFIG)
  const layerChecks = derivePairChecks(layer, LAYER_PAIR_CONFIG)
  const progressChecks = derivePairChecks(progressDisplay, PROGRESS_PAIR_CONFIG)
  const allColumnsVisible = columnToggleItems.every((item) => item.visible)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="size-4" />
          Widok
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
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
              {option.label}
              {option.icon && <span className="ml-auto">{option.icon}</span>}
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
              {option.label}
              {option.icon && <span className="ml-auto">{option.icon}</span>}
            </DropdownMenuCheckboxItem>
          )
        })}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Etapy</DropdownMenuLabel>
        {PROGRESS_DISPLAYS.map((option) => {
          const box = option.value === PROGRESS_PAIR_CONFIG.a ? 'a' : 'b'
          return (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={progressChecks[box]}
              onSelect={keepOpen}
              onCheckedChange={() =>
                setProgressDisplay(togglePairAxis(progressDisplay, box, PROGRESS_PAIR_CONFIG))
              }
            >
              {option.label}
              {option.icon && <span className="ml-auto">{option.icon}</span>}
            </DropdownMenuCheckboxItem>
          )
        })}

        {columnToggleItems.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center justify-between gap-2">
              Kolumny
              <SimpleTooltip
                content={KOLUMNY_HINT}
                delayDuration={300}
                className="max-w-xs whitespace-pre-line"
              >
                <Info className="text-muted-foreground size-3.5 shrink-0" />
              </SimpleTooltip>
            </DropdownMenuLabel>
            <DropdownMenuItem
              disabled={allColumnsVisible}
              onSelect={(event) => {
                event.preventDefault()
                showAllColumns(columnToggleItems.map((item) => item.id))
              }}
            >
              <Eye className="size-4" />
              Pokaż wszystkie
            </DropdownMenuItem>
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
