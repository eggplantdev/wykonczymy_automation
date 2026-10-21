'use client'

import {
  Ban,
  Banknote,
  BookOpenCheck,
  Calendar,
  CalendarIcon,
  Check,
  CheckIcon,
  CircleDot,
  HardHat,
  Landmark,
  ListFilter,
  Plus,
  Ruler,
  Search,
  Settings2,
  Tags,
  TriangleAlert,
  User,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { ControlGrid } from '@/components/ui/control-grid'
import { DropdownCheckGroups, type DropdownCheckItemT } from '@/components/ui/dropdown-check-groups'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { SECTION_TITLE_CLASS } from '@/components/ui/section-header'
import { StatButton } from '@/components/ui/stat-button'
import { OpenPreview } from '@/app/(frontend)/design/open-preview'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const noop = () => {}

const GRID_TRIGGER = 'sm:w-fit sm:min-w-0'
const TOOLBAR_TRIGGER = 'w-fit sm:min-w-0'
const SEARCH_WIDTH = 'w-full sm:w-56 lg:w-72'

type TriggerOptionsT = {
  active?: boolean
  tone?: 'default' | 'destructive'
  className?: string
  disabled?: boolean
}

function filterTrigger(label: string, Icon?: LucideIcon, options: TriggerOptionsT = {}) {
  const { active = false, tone = 'default', className, disabled } = options
  const variant =
    tone === 'destructive'
      ? active
        ? 'destructive'
        : 'destructiveOutline'
      : active
        ? 'greenOutline'
        : 'outline'
  return (
    <Button
      variant={variant}
      size="sm"
      align="start"
      disabled={disabled}
      className={cn('overflow-hidden sm:min-w-40', className)}
    >
      {Icon && <Icon />}
      <span className="truncate">{label}</span>
    </Button>
  )
}

function searchBox(placeholder = 'Szukaj...', className = cn('col-span-2', SEARCH_WIDTH)) {
  return (
    <div className={cn('relative', className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
      <Input value="" onChange={noop} placeholder={placeholder} className="h-8 pl-8" />
    </div>
  )
}

const columnsButton = (
  <Button variant="outline" size="sm">
    <Settings2 />
    Kolumny
  </Button>
)

function addButton(label: string) {
  return (
    <Button variant="outline" size="sm">
      <Plus />
      {label}
    </Button>
  )
}

const dateRange = (
  <ControlGrid>
    {filterTrigger('Rok', Calendar)}
    {filterTrigger('Miesiąc', Calendar)}
    {filterTrigger('Od', CalendarIcon)}
    {filterTrigger('Do', CalendarIcon)}
    {filterTrigger('Wyczyść daty', X, { disabled: true })}
  </ControlGrid>
)

const PROBLEM_ITEMS: DropdownCheckItemT[] = [
  { id: 'no-price', label: 'Prace bez ceny (3)', groupLabel: 'Ceny', active: true },
  { id: 'zero-rate', label: 'Prace ze stawką 0 zł (1)', groupLabel: 'Ceny', active: false },
  { id: 'no-unit', label: 'Prace bez j.m. (2)', groupLabel: 'Opis', active: false },
]

const STATUSES = [
  { label: 'Wycena', isSelected: false },
  { label: 'Planowana', isSelected: true },
  { label: 'Aktywna', isSelected: true },
  { label: 'Zakończona', isSelected: false },
  { label: 'Odrzucona', isSelected: false },
]

const CHIPS = [
  { label: 'Kategoria: Łazienka', count: 24 },
  { label: 'j.m.: m²', count: 11 },
]

export function A36FilterBarGroup() {
  return (
    <AuditGroup
      id="A36"
      title="Pasek filtrów listy"
      count="18 wystąpień w 21 plikach · 9 wersji"
      drift={[
        'Dwie rodziny pasków: DataTableToolbar ze stanem lokalnym (wyzwalacze GRID_FILTER_TRIGGER_CLASS, bez „Wyczyść filtry”) vs gołe ControlGrid na parametrach URL (wyzwalacze min-w-40, ClearButton „Wyczyść filtry” i osobny wiersz dat pod spodem).',
        'Filtr tak/nie: ActiveFilterButton z ptaszkiem (kasy, zgłoszenia, weryfikacja zgłoszenia) vs pozycja-przełącznik w FilterMultiSelect (Anulowane w transakcjach, „Filtry” w pracownikach, kolejki).',
        'Aktywne filtry jako chipy (ActiveFiltersBar) tylko w katalogu prac; nigdzie indziej nie widać, co jest odfiltrowane, poza licznikiem w wyzwalaczu.',
        'Transakcje: filtry schowane w zwiniętym CollapsibleSection nad tabelą, a pasek tabeli ma tytuł i akcje bez wyszukiwarki; reszta list ma wyszukiwarkę w pasku.',
        'Menu z ptaszkami: ręczne DropdownMenu + CheckIcon (status, w-48, „Wyczyść” w menu) vs DropdownCheckGroups (problemy, w-80 z GRID_ vs w-112 z TOOLBAR_FILTER_TRIGGER_CLASS).',
        'Paski z hooka useStatusInvestmentFilters nie mają „Wyczyść filtry” ani dat, choć to te same listy zgłoszeń/wydatków co kolejki z QueueFilters.',
      ]}
      proposal={
        <>
          Jeden <code>FilterBar</code> (props: <code>search?</code>, <code>filters</code>,{' '}
          <code>onClearAll?</code>, <code>dates?</code>, <code>chips?</code>, <code>actions?</code>)
          z jedną klasą wyzwalacza, zawsze z „Wyczyść filtry” i chipami, gdy coś jest aktywne; filtr
          tak/nie zawsze jako <code>ActiveFilterButton</code>, a menu z ptaszkami zawsze przez{' '}
          <code>DropdownCheckGroups</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="DataTableToolbar: wyszukiwarka + FilterMultiSelect z GRID_FILTER_TRIGGER_CLASS (+ ActiveFilterButton w kasach), Kolumny i akcja po prawej (tu: kasy)"
        sources={[
          'src/components/cash-registers/cash-registers-table.tsx:82',
          'src/components/users/user-data-table.tsx:71',
          'src/components/equipment/equipment-data-table.tsx:71',
          'src/components/investments/investment-data-table.tsx:93',
          'src/components/leads/leads-data-table.tsx:80',
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:358',
        ]}
      >
        <div className="flex w-full flex-wrap items-center gap-2">
          <ControlGrid className="sm:w-auto sm:flex-initial sm:items-center">
            {searchBox()}
            {filterTrigger('Typ', Tags, { className: GRID_TRIGGER })}
            {filterTrigger('Właściciel (2)', User, { active: true, className: GRID_TRIGGER })}
            {filterTrigger('Aktywne', Check, { active: true, className: GRID_TRIGGER })}
          </ControlGrid>
          <ControlGrid className="sm:ml-auto sm:w-auto sm:flex-initial sm:items-center">
            {addButton('Dodaj kasę')}
            {columnsButton}
          </ControlGrid>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="DataTableToolbar: sama wyszukiwarka (bez placeholdera → „Szukaj...”) + Kolumny i akcje, bez filtrów (tu: kosztorysy)"
        sources={[
          'src/components/sheets/kosztorys-data-table.tsx:33',
          'src/components/sheets/investments-without-sheet-table.tsx:26',
          'src/components/fleet/fleet-data-table.tsx:37',
        ]}
      >
        <div className="flex w-full flex-wrap items-center gap-2">
          <ControlGrid className="sm:w-auto sm:flex-initial sm:items-center">
            {searchBox()}
          </ControlGrid>
          <ControlGrid className="sm:ml-auto sm:w-auto sm:flex-initial sm:items-center">
            {addButton('Nowy kosztorys')}
            {columnsButton}
          </ControlGrid>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="QueueFilters: ControlGrid na URL — Status / Inwestycja / Pracownik bez klasy wyzwalacza (min-w-40) + ClearButton, pod spodem wiersz dat; div flex-col gap-3"
        sources={[
          'src/components/filters/queue-filters.tsx:40',
          'src/components/worker-reports/worker-reports-data-table.tsx:56',
          'src/components/worker-expenses/expense-drafts-data-table.tsx:77',
        ]}
      >
        <div className="flex w-full flex-col gap-3">
          <ControlGrid>
            {filterTrigger('Status (1)', CircleDot, { active: true })}
            {filterTrigger('Inwestycja', Landmark)}
            {filterTrigger('Pracownik', HardHat)}
            {filterTrigger('Wyczyść filtry', X)}
          </ControlGrid>
          {dateRange}
        </div>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="useStatusInvestmentFilters: ControlGrid ze stanem lokalnym — Status / Inwestycja, bez „Wyczyść filtry” i bez dat"
        sources={[
          'src/hooks/use-status-investment-filters.tsx:48',
          'src/components/worker-reports/worker-report-history-table.tsx:56',
          'src/components/worker-expenses/worker-expense-drafts-table.tsx:67',
        ]}
      >
        <div className="w-full">
          <ControlGrid>
            {filterTrigger('Status', CircleDot)}
            {filterTrigger('Inwestycja (1)', Landmark, { active: true })}
          </ControlGrid>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="transakcje: filtry w CollapsibleSection w-fit sm (zwinięte domyślnie, tu rozwinięte) — dwa ControlGrid (encje; kwota/id + Anulowane + Wyczyść), daty, StatButton sumy; pod spodem DataTableToolbar mt-8 z tytułem i akcjami, bez wyszukiwarki"
        sources={[
          'src/components/transfers/transfer-data-table.tsx:75',
          'src/components/transfers/transfer-filters.tsx:159',
          'src/components/transfers/transfer-data-table.tsx:103',
        ]}
      >
        <div className="w-full">
          <CollapsibleSection className="w-fit" title="Filtry" size="sm" defaultOpen>
            <div className="flex flex-col gap-3 pt-3">
              <ControlGrid>
                {filterTrigger('Typ', Tags)}
                {filterTrigger('Kasa', Banknote)}
                {filterTrigger('Inwestycja (1)', Landmark, { active: true })}
                {filterTrigger('Pracownik', HardHat)}
              </ControlGrid>
              <ControlGrid>
                {searchBox('Szukaj po kwocie', SEARCH_WIDTH)}
                {searchBox('Szukaj po id', SEARCH_WIDTH)}
                {filterTrigger('Anulowane', Ban)}
                {filterTrigger('Wyczyść filtry', X)}
              </ControlGrid>
              {dateRange}
              <StatButton
                label="Suma wybranych transakcji"
                value="12 345,67 zł"
                className="border-chart-blue"
              />
            </div>
          </CollapsibleSection>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <h2 className={cn('text-foreground w-full', SECTION_TITLE_CLASS)}>Transakcje</h2>
            <ControlGrid className="sm:ml-auto sm:w-auto sm:flex-initial sm:items-center">
              {columnsButton}
            </ControlGrid>
          </div>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="katalog prac: DataTableToolbar z filterChips — lewa strona owinięta w div flex-col, pod filtrami ActiveFiltersBar (chipy + „Wyczyść filtry” ghost 2xs); menu Filtry i Problemy jako wyzwalacze"
        sources={['src/components/work-catalogue/work-catalogue-data-table.tsx:189']}
      >
        <div className="flex w-full flex-wrap items-center gap-2">
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <ControlGrid className="sm:w-auto sm:flex-initial sm:items-center">
              {searchBox('Szukaj pracy...')}
              {filterTrigger('Kategoria (1)', Tags, { active: true, className: GRID_TRIGGER })}
              {filterTrigger('j.m. (1)', Ruler, { active: true, className: GRID_TRIGGER })}
              {filterTrigger('Filtry', ListFilter, { className: GRID_TRIGGER })}
              {filterTrigger('Problemy', TriangleAlert, {
                tone: 'destructive',
                className: GRID_TRIGGER,
              })}
            </ControlGrid>
            <div className="flex flex-wrap items-center gap-2">
              {CHIPS.map((chip) => (
                <Badge
                  key={chip.label}
                  appearance="outline"
                  shape="pill"
                  onRemove={noop}
                  removeLabel={`Usuń filtr ${chip.label}`}
                  className="border-input bg-background text-foreground max-w-full shrink-0 font-normal"
                >
                  <span className="truncate">{chip.label}</span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    ({chip.count})
                  </span>
                </Badge>
              ))}
              <Button variant="ghost" size="2xs" className="text-muted-foreground shrink-0">
                Wyczyść filtry
              </Button>
            </div>
          </div>
          <ControlGrid className="sm:ml-auto sm:w-auto sm:flex-initial sm:items-center">
            {addButton('Dodaj pracę')}
            {columnsButton}
          </ControlGrid>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="filtr statusu inwestycji: ręczne DropdownMenu, treść align start w-48, etykieta + „Wyczyść” + pozycje z CheckIcon (bez tooltipu „Filtr statusu” z wyzwalacza)"
        sources={['src/components/investments/status-filter.tsx:42']}
      >
        <OpenPreview backdrop={false} className="h-80 justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {filterTrigger('Status (2)', ListFilter, { active: true, className: GRID_TRIGGER })}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Widoczne statusy</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <X />
                Wyczyść
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {STATUSES.map((status) => (
                <DropdownMenuItem key={status.label}>
                  <CheckIcon className={cn(!status.isSelected && 'opacity-0')} />
                  {status.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="problemy katalogu: wyzwalacz tone destructive z GRID_FILTER_TRIGGER_CLASS, treść align end w-80, DropdownCheckGroups"
        sources={['src/components/work-catalogue/catalogue-problems-menu.tsx:27']}
      >
        <OpenPreview backdrop={false} className="h-64 justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {filterTrigger('Problemy', TriangleAlert, {
                active: true,
                tone: 'destructive',
                className: GRID_TRIGGER,
              })}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownCheckGroups items={PROBLEM_ITEMS} onSelect={noop} />
            </DropdownMenuContent>
          </DropdownMenu>
        </OpenPreview>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="problemy kosztorysu: wyzwalacz z TOOLBAR_FILTER_TRIGGER_CLASS, treść align end w-112, DropdownCheckGroups + separator + „Porównaj z katalogiem…”"
        sources={['src/components/kosztorys/editor/toolbar/menus/kosztorys-problems-menu.tsx:40']}
      >
        <OpenPreview backdrop={false} className="h-80 justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {filterTrigger('Problemy', TriangleAlert, {
                tone: 'destructive',
                className: TOOLBAR_TRIGGER,
              })}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-112">
              <DropdownCheckGroups items={PROBLEM_ITEMS} onSelect={noop} />
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <BookOpenCheck />
                <MenuItemBody
                  label="Porównaj z katalogiem…"
                  description="Sprawdź, gdzie ceny i stawki tego kosztorysu odbiegają od katalogu prac."
                />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </OpenPreview>
      </AuditVariant>
    </AuditGroup>
  )
}
