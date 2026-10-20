'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HintTooltip, SimpleTooltip } from '@/components/ui/tooltip'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuCheckboxRow,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { DropdownCheckGroups, type DropdownCheckItemT } from '@/components/ui/dropdown-check-groups'
import { ColumnToggleMenu } from '@/components/ui/column-toggle-menu'
import type { ColumnToggleItemT } from '@/components/ui/column-order-dialog'
import type { ColumnRanksT } from '@/lib/table/column-order'
import { toggleInSet } from '@/lib/utils/toggle-in-set'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

const CHECK_GROUP_ITEMS = [
  { id: 'a', label: 'Mokotów', groupLabel: 'Inwestycje' },
  { id: 'b', label: 'Wilanów', groupLabel: 'Inwestycje' },
  { id: 'c', label: 'Jan Kowalski', groupLabel: 'Pracownicy' },
] as const

const COLUMNS = [
  { id: 'date', label: 'Data' },
  { id: 'amount', label: 'Kwota' },
  { id: 'type', label: 'Typ' },
  { id: 'note', label: 'Opis' },
] as const

export function OverlaysSection() {
  const [isChecked, setIsChecked] = useState(true)
  const [radio, setRadio] = useState('netto')
  const [activeIds, setActiveIds] = useState<Set<string>>(() => new Set(['a']))
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => new Set(['note']))
  const [ranks, setRanks] = useState<ColumnRanksT>({})

  const checkItems: DropdownCheckItemT[] = CHECK_GROUP_ITEMS.map((item) => ({
    ...item,
    active: activeIds.has(item.id),
  }))
  const columnItems: ColumnToggleItemT[] = COLUMNS.map((column) => ({
    ...column,
    visible: !hiddenColumns.has(column.id),
  }))

  return (
    <ShowcaseSection id="overlays">
      <ShowcaseRow title="Tooltip — trzymany otwarty" source="ui/tooltip.tsx SimpleTooltip open" className="pt-10">
        <SimpleTooltip content="SimpleTooltip (open)" open>
          <Button variant="outline" size="sm">
            Zawsze otwarty
          </Button>
        </SimpleTooltip>
      </ShowcaseRow>
      <ShowcaseRow title="Tooltip — na najechanie" source="ui/tooltip.tsx, ui/info-tooltip.tsx">
        <SimpleTooltip content="SimpleTooltip">
          <Button variant="outline" size="sm">
            SimpleTooltip
          </Button>
        </SimpleTooltip>
        <HintTooltip content="HintTooltip">
          <span className="text-sm underline decoration-dotted">HintTooltip</span>
        </HintTooltip>
        <span className="flex items-center gap-1 text-sm">
          InfoTooltip
          <InfoTooltip content="Kliknij lub najedź" />
        </span>
      </ShowcaseRow>
      <ShowcaseRow title="Popover" source="ui/popover.tsx">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Otwórz popover
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <PopoverHeader>
              <PopoverTitle>Tytuł</PopoverTitle>
              <PopoverDescription>Opis zawartości popovera.</PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
      </ShowcaseRow>
      <ShowcaseRow title="DropdownMenu" source="ui/dropdown-menu.tsx, ui/menu-item-body.tsx, ui/dropdown-check-groups.tsx">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Wszystkie typy pozycji
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <DropdownMenuLabel>Akcje</DropdownMenuLabel>
            <DropdownMenuItem>
              <Pencil />
              Edytuj
              <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive">
              <Trash2 />
              Usuń
            </DropdownMenuItem>
            <DropdownMenuItem disabled>Disabled</DropdownMenuItem>
            <DropdownMenuItem>
              <MenuItemBody label="Z opisem" description="MenuItemBody pod etykietą" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={isChecked} onCheckedChange={setIsChecked}>
              CheckboxItem
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxRow
              checked={isChecked}
              onCheckedChange={setIsChecked}
              label="CheckboxRow"
              trailing="12"
            />
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={radio} onValueChange={setRadio}>
              <DropdownMenuRadioItem value="netto">Netto</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="brutto">Brutto</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Podmenu</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Pozycja</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              DropdownCheckGroups
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownCheckGroups
              items={checkItems}
              onSelect={(id) => setActiveIds((previous) => toggleInSet(previous, id))}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </ShowcaseRow>
      <ShowcaseRow title="ColumnToggleMenu (+ ColumnOrderDialog)" source="ui/column-toggle-menu.tsx">
        <ColumnToggleMenu
          items={columnItems}
          onToggle={(id) => setHiddenColumns((previous) => toggleInSet(previous, id))}
          onToggleAll={(visible) => setHiddenColumns(new Set(visible ? [] : COLUMNS.map((column) => column.id)))}
          align="start"
          order={{
            description: 'Przeciągnij, aby zmienić kolejność kolumn.',
            ranks,
            baseRanks: {},
            onSetRank: (key, rank) => setRanks((previous) => ({ ...previous, [key]: rank })),
            onReset: () => setRanks({}),
          }}
        />
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
