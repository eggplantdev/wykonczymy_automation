'use client'

import type { ComponentProps } from 'react'
import {
  ArrowLeftRight,
  ArrowUpDown,
  Ban,
  Banknote,
  Building,
  Calendar,
  Car,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDot,
  ClipboardPen,
  Coins,
  Copy,
  CreditCard,
  Download,
  Ellipsis,
  Eye,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FileUser,
  GripVertical,
  Hammer,
  HardHat,
  History,
  Info,
  Landmark,
  Languages,
  LayoutTemplate,
  ListChecks,
  ListFilter,
  Lock,
  MapPin,
  Paperclip,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Redo2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Search,
  Settings,
  Settings2,
  Share,
  Share2,
  Star,
  Table2,
  Tags,
  Trash2,
  TriangleAlert,
  Truck,
  Undo2,
  Unlink,
  User,
  UserRound,
  Users,
  Wallet,
  WandSparkles,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import Icon from '@/components/ui/icons/icon'
import ArrowIcon from '@/components/ui/icons/arrow-icon'
import DropdownIcon from '@/components/ui/icons/dropdown-icon'
import MenuDotsIcon from '@/components/ui/icons/menu-dots-icon'
import { iconVariants } from '@/components/ui/icons/icon-variants'
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

type IconEntryT = {
  icon: LucideIcon
  name: string
  meaning: string
}

type IconGroupT = {
  title: string
  icons: IconEntryT[]
}

const ICON_GROUPS: IconGroupT[] = [
  {
    title: 'Akcje',
    icons: [
      { icon: Plus, name: 'Plus', meaning: 'dodaj' },
      { icon: Pencil, name: 'Pencil', meaning: 'edytuj' },
      { icon: Trash2, name: 'Trash2', meaning: 'usuń' },
      { icon: X, name: 'X', meaning: 'zamknij / wyczyść' },
      { icon: Copy, name: 'Copy', meaning: 'kopiuj' },
      { icon: Download, name: 'Download', meaning: 'pobierz' },
      { icon: Printer, name: 'Printer', meaning: 'drukuj' },
      { icon: Search, name: 'Search', meaning: 'szukaj' },
      { icon: Undo2, name: 'Undo2', meaning: 'cofnij' },
      { icon: Redo2, name: 'Redo2', meaning: 'ponów' },
      { icon: Eye, name: 'Eye', meaning: 'podgląd' },
      { icon: WandSparkles, name: 'WandSparkles', meaning: 'AI' },
    ],
  },
  {
    title: 'Rozwijanie i porządek',
    icons: [
      { icon: ChevronDown, name: 'ChevronDown', meaning: 'rozwiń' },
      { icon: ChevronRight, name: 'ChevronRight', meaning: 'dalej / podmenu' },
      { icon: ChevronLeft, name: 'ChevronLeft', meaning: 'wstecz' },
      { icon: ArrowUpDown, name: 'ArrowUpDown', meaning: 'kolejność' },
      { icon: GripVertical, name: 'GripVertical', meaning: 'przeciągnij' },
      { icon: ListFilter, name: 'ListFilter', meaning: 'filtry' },
      { icon: Settings2, name: 'Settings2', meaning: 'kolumny / widok' },
    ],
  },
  {
    title: 'Statusy',
    icons: [
      { icon: Check, name: 'Check', meaning: 'zaznaczone' },
      { icon: CheckCheck, name: 'CheckCheck', meaning: 'zaznacz wszystko' },
      { icon: CircleCheck, name: 'CircleCheck', meaning: 'gotowe' },
      { icon: TriangleAlert, name: 'TriangleAlert', meaning: 'ostrzeżenie / błąd' },
      { icon: Info, name: 'Info', meaning: 'informacja' },
      { icon: Ban, name: 'Ban', meaning: 'anulowane' },
      { icon: Lock, name: 'Lock', meaning: 'zablokowane' },
      { icon: CircleDot, name: 'CircleDot', meaning: 'status (filtr)' },
      { icon: Star, name: 'Star', meaning: 'domyślne / do przeglądu' },
    ],
  },
  {
    title: 'Pieniądze',
    icons: [
      { icon: Banknote, name: 'Banknote', meaning: 'brutto / gotówka' },
      { icon: Coins, name: 'Coins', meaning: 'netto' },
      { icon: Wallet, name: 'Wallet', meaning: 'kasy' },
      { icon: Landmark, name: 'Landmark', meaning: 'inwestycja (filtr)' },
      { icon: CreditCard, name: 'CreditCard', meaning: 'płatność (filtr)' },
      { icon: Receipt, name: 'Receipt', meaning: 'typ transakcji' },
      { icon: ArrowLeftRight, name: 'ArrowLeftRight', meaning: 'transakcje' },
    ],
  },
  {
    title: 'Ludzie',
    icons: [
      { icon: User, name: 'User', meaning: 'osoba' },
      { icon: UserRound, name: 'UserRound', meaning: 'klient (umowa)' },
      { icon: Users, name: 'Users', meaning: 'pracownicy' },
      { icon: HardHat, name: 'HardHat', meaning: 'pracownik / zgłoś pracę' },
      { icon: FileUser, name: 'FileUser', meaning: 'raporty pracowników' },
    ],
  },
  {
    title: 'Dokumenty',
    icons: [
      { icon: FileText, name: 'FileText', meaning: 'dokument' },
      { icon: FileSpreadsheet, name: 'FileSpreadsheet', meaning: 'kosztorys / arkusz' },
      { icon: FileArchive, name: 'FileArchive', meaning: 'faktury (zip)' },
      { icon: Paperclip, name: 'Paperclip', meaning: 'załącznik' },
      { icon: ClipboardPen, name: 'ClipboardPen', meaning: 'dla pracownika' },
      { icon: Table2, name: 'Table2', meaning: 'widok tabeli' },
      { icon: ListChecks, name: 'ListChecks', meaning: 'katalog prac' },
      { icon: LayoutTemplate, name: 'LayoutTemplate', meaning: 'szablon' },
      { icon: History, name: 'History', meaning: 'historia' },
      { icon: Calendar, name: 'Calendar', meaning: 'data' },
    ],
  },
  {
    title: 'Obiekty',
    icons: [
      { icon: Building, name: 'Building', meaning: 'inwestycje' },
      { icon: MapPin, name: 'MapPin', meaning: 'lokalizacja' },
      { icon: Car, name: 'Car', meaning: 'flota' },
      { icon: Truck, name: 'Truck', meaning: 'zamówienia' },
      { icon: Wrench, name: 'Wrench', meaning: 'sprzęt / robocizna' },
      { icon: Hammer, name: 'Hammer', meaning: 'pozycje prac' },
      { icon: Tags, name: 'Tags', meaning: 'kategorie' },
      { icon: Languages, name: 'Languages', meaning: 'tłumaczenia' },
      { icon: Unlink, name: 'Unlink', meaning: 'odłącz' },
    ],
  },
]

const ICON_CONFLICTS: IconGroupT[] = [
  {
    title: 'Ustawienia',
    icons: [
      { icon: Settings, name: 'Settings', meaning: 'zamówienia, akcje kosztorysu' },
      { icon: Settings2, name: 'Settings2', meaning: 'kolumny, akcje inwestora' },
    ],
  },
  {
    title: 'Odśwież / reset',
    icons: [
      { icon: RotateCcw, name: 'RotateCcw', meaning: 'wyczyść formularz' },
      { icon: RotateCw, name: 'RotateCw', meaning: 'skanuj ponownie' },
      { icon: RefreshCw, name: 'RefreshCw', meaning: 'odśwież dane' },
    ],
  },
  {
    title: 'Udostępnij',
    icons: [
      { icon: Share, name: 'Share', meaning: 'udostępnij' },
      { icon: Share2, name: 'Share2', meaning: 'link dla inwestora' },
    ],
  },
]

function IconTile({ icon: LucideGlyph, name, meaning }: IconEntryT) {
  return (
    <div className="flex w-28 flex-col items-center gap-1 rounded-md border p-2 text-center">
      <LucideGlyph className={iconVariants({ size: 'md' })} />
      <code className="text-xs">{name}</code>
      <span className="text-muted-foreground text-3xs">{meaning}</span>
    </div>
  )
}

export function IconsSection() {
  return (
    <ShowcaseSection id="icons">
      <ShowcaseRow
        title="Skala rozmiarów — iconVariants"
        source="ui/icons/icon-variants.ts"
        className="items-end gap-6"
      >
        {ICON_SIZES.map((size) => (
          <div key={size} className="flex flex-col items-center gap-1">
            <Plus className={iconVariants({ size })} />
            <code className="text-muted-foreground text-xs">{size}</code>
          </div>
        ))}
        <div className="flex flex-col items-center gap-1">
          <Plus className="size-3.5" />
          <code className="text-destructive text-xs">size-3.5 (poza skalą)</code>
        </div>
      </ShowcaseRow>
      <ShowcaseRow
        title="Icon — nazwa × rozmiar"
        source="ui/icons/icon.tsx"
        className="flex-col items-start"
      >
        {ICON_NAMES.map((iconName) => (
          <div key={iconName} className="flex items-center gap-3">
            <code className="text-muted-foreground w-28 text-xs">{iconName}</code>
            {ICON_SIZES.map((size) => (
              <Icon key={size} iconName={iconName} size={size} />
            ))}
          </div>
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="Ikony własne"
        source="ui/icons/arrow-icon.tsx, ui/icons/dropdown-icon.tsx, ui/icons/menu-dots-icon.tsx"
      >
        {ARROW_DIRECTIONS.map((direction) => (
          <ArrowIcon key={direction} direction={direction} />
        ))}
        {DROPDOWN_DIRECTIONS.map((direction) => (
          <DropdownIcon key={direction} direction={direction} />
        ))}
        <MenuDotsIcon />
      </ShowcaseRow>
      {ICON_GROUPS.map((group) => (
        <ShowcaseRow key={group.title} title={`Lucide — ${group.title}`} source="lucide-react">
          {group.icons.map((entry) => (
            <IconTile key={entry.name} {...entry} />
          ))}
        </ShowcaseRow>
      ))}
      <ShowcaseRow
        title="Rozbieżności — jedno znaczenie, różne ikony"
        source="lucide-react, ui/icons"
        className="flex-col items-start gap-4"
      >
        {ICON_CONFLICTS.map((group) => (
          <div key={group.title} className="flex flex-col gap-2">
            <span className="text-sm font-medium">{group.title}</span>
            <div className="flex flex-wrap gap-2">
              {group.icons.map((entry) => (
                <IconTile key={entry.name} {...entry} />
              ))}
            </div>
          </div>
        ))}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Więcej / menu</span>
          <div className="flex flex-wrap items-center gap-2">
            <IconTile icon={Ellipsis} name="Ellipsis" meaning="podgląd mediów, komórka arkusza" />
            <div className="flex w-28 flex-col items-center gap-1 rounded-md border p-2 text-center">
              <MenuDotsIcon />
              <code className="text-xs">MenuDotsIcon</code>
              <span className="text-muted-foreground text-3xs">ui/icons</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Rozwijanie</span>
          <div className="flex flex-wrap items-center gap-2">
            <IconTile icon={ChevronDown} name="ChevronDown" meaning="select, collapsible" />
            <div className="flex w-28 flex-col items-center gap-1 rounded-md border p-2 text-center">
              <DropdownIcon direction="down" />
              <code className="text-xs">DropdownIcon</code>
              <span className="text-muted-foreground text-3xs">search-select</span>
            </div>
          </div>
        </div>
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
