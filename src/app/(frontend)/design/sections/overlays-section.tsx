'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
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
  DropdownMenuGroup,
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
import { OpenPreview } from '../open-preview'

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

function SampleSheetContent() {
  return (
    <SheetContent>
      <div className="flex flex-col gap-2 p-4 pr-16">
        <SheetTitle>Nawigacja</SheetTitle>
        <SheetDescription>Panel wsuwany z lewej, Esc zamyka.</SheetDescription>
      </div>
    </SheetContent>
  )
}

function SamplePopoverContent() {
  return (
    <PopoverContent>
      <PopoverHeader>
        <PopoverTitle>Tytuł</PopoverTitle>
        <PopoverDescription>Opis zawartości popovera.</PopoverDescription>
      </PopoverHeader>
    </PopoverContent>
  )
}

type SampleActionsMenuPropsT = {
  isChecked: boolean
  onCheckedChange: (checked: boolean) => void
  radio: string
  onRadioChange: (value: string) => void
}

function SampleActionsMenu({
  isChecked,
  onCheckedChange,
  radio,
  onRadioChange,
}: SampleActionsMenuPropsT) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Wszystkie typy pozycji
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Akcje (DropdownMenuGroup)</DropdownMenuLabel>
          <DropdownMenuItem>
            <Pencil />
            Edytuj
            <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive">
            <Trash2 />
            Usuń
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel inset>Label inset</DropdownMenuLabel>
        <DropdownMenuItem inset>Pozycja inset</DropdownMenuItem>
        <DropdownMenuItem disabled>Disabled</DropdownMenuItem>
        <DropdownMenuItem>
          <MenuItemBody label="Z opisem" description="MenuItemBody pod etykietą" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={isChecked} onCheckedChange={onCheckedChange}>
          CheckboxItem
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxRow
          checked={isChecked}
          onCheckedChange={onCheckedChange}
          label="CheckboxRow"
          trailing="12"
        />
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={radio} onValueChange={onRadioChange}>
          <DropdownMenuRadioItem value="net">Netto</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="gross">Brutto</DropdownMenuRadioItem>
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
  )
}

type SampleCheckGroupsMenuPropsT = {
  items: DropdownCheckItemT[]
  onSelect: (id: string) => void
}

function SampleCheckGroupsMenu({ items, onSelect }: SampleCheckGroupsMenuPropsT) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          DropdownCheckGroups
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownCheckGroups items={items} onSelect={onSelect} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function OverlaysSection() {
  const [isChecked, setIsChecked] = useState(true)
  const [radio, setRadio] = useState('net')
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

  const actionsMenuProps = {
    isChecked,
    onCheckedChange: setIsChecked,
    radio,
    onRadioChange: setRadio,
  }
  const checkGroupsMenuProps = {
    items: checkItems,
    onSelect: (id: string) => setActiveIds((previous) => toggleInSet(previous, id)),
  }
  const columnToggleProps = {
    items: columnItems,
    onToggle: (id: string) => setHiddenColumns((previous) => toggleInSet(previous, id)),
    onToggleAll: (visible: boolean) =>
      setHiddenColumns(new Set(visible ? [] : COLUMNS.map((column) => column.id))),
    align: 'start' as const,
    order: {
      description: 'Przeciągnij, aby zmienić kolejność kolumn.',
      ranks,
      baseRanks: {},
      onSetRank: (key: string, rank: number) =>
        setRanks((previous) => ({ ...previous, [key]: rank })),
      onReset: () => setRanks({}),
    },
  }

  return (
    <ShowcaseSection id="overlays">
      <ShowcaseRow
        title="Tooltip — trzymany otwarty"
        source="ui/tooltip.tsx SimpleTooltip open"
        className="pt-10"
      >
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
      <ShowcaseRow title="Sheet" source="ui/sheet.tsx">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              Otwórz Sheet
            </Button>
          </SheetTrigger>
          <SampleSheetContent />
        </Sheet>
        <OpenPreview className="justify-start p-0">
          <Sheet>
            <SampleSheetContent />
          </Sheet>
        </OpenPreview>
      </ShowcaseRow>
      <ShowcaseRow title="Popover" source="ui/popover.tsx">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Otwórz popover
            </Button>
          </PopoverTrigger>
          <SamplePopoverContent />
        </Popover>
        <OpenPreview backdrop={false}>
          <SamplePopoverContent />
        </OpenPreview>
      </ShowcaseRow>
      <ShowcaseRow
        title="DropdownMenu"
        source="ui/dropdown-menu.tsx, ui/menu-item-body.tsx, ui/dropdown-check-groups.tsx"
      >
        <SampleActionsMenu {...actionsMenuProps} />
        <SampleCheckGroupsMenu {...checkGroupsMenuProps} />
        <OpenPreview backdrop={false} className="h-152 justify-start gap-x-32">
          <SampleActionsMenu {...actionsMenuProps} />
          <SampleCheckGroupsMenu {...checkGroupsMenuProps} />
        </OpenPreview>
      </ShowcaseRow>
      <ShowcaseRow
        title="ColumnToggleMenu (+ ColumnOrderDialog), hiddenCount"
        source="ui/column-toggle-menu.tsx"
      >
        <ColumnToggleMenu {...columnToggleProps} />
        <ColumnToggleMenu {...columnToggleProps} hiddenCount={3} />
        <OpenPreview backdrop={false} className="h-96 justify-start">
          <ColumnToggleMenu {...columnToggleProps} order={undefined} />
        </OpenPreview>
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
