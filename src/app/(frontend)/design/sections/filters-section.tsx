'use client'

import { useState } from 'react'
import { CircleDot, HardHat, Landmark, ListFilter, SlidersHorizontal } from 'lucide-react'
import { ActiveFilterButton } from '@/components/filters/active-filter-button'
import { ActiveFilterLabel } from '@/components/filters/active-filter-label'
import {
  ActiveFiltersBar,
  type ActiveFiltersBarChipT,
} from '@/components/filters/active-filters-bar'
import { ClearButton } from '@/components/filters/clear-button'
import { DateFilterButton } from '@/components/filters/date-filter-button'
import { DateFilters } from '@/components/filters/date-filters'
import { DateRangePicker } from '@/components/filters/date-range-picker'
import { FilterChip } from '@/components/filters/filter-chip'
import { FilterMultiSelect, type FilterOptionT } from '@/components/filters/filter-multi-select'
import { FilterSelect } from '@/components/filters/filter-select'
import { FilterTriggerButton } from '@/components/filters/filter-trigger-button'
import { QueueFilters } from '@/components/filters/queue-filters'
import { SearchFilterInput } from '@/components/filters/search-filter-input'
import { StatusFilter } from '@/components/investments/status-filter'
import { CatalogueFiltersMenu } from '@/components/work-catalogue/catalogue-filters-menu'
import { TransferFilters } from '@/components/transfers/transfer-filters'
import type { DropdownCheckItemT } from '@/components/ui/dropdown-check-groups'
import type { InvestmentStatusT } from '@/lib/constants/investment-status'
import { TRANSFER_TYPES } from '@/lib/constants/transfers'
import { ALL_TIME, type DateRangeT } from '@/lib/utils/date-range'
import { toggleInSet } from '@/lib/utils/toggle-in-set'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'
import { OpenPreview } from '../open-preview'

const INVESTMENTS = [
  { id: 1, name: 'Mokotów — łazienka' },
  { id: 2, name: 'Wilanów — kuchnia' },
  { id: 3, name: 'Ursus — całe mieszkanie' },
]

const WORKERS = [
  { id: 11, name: 'Jan Testowy' },
  { id: 12, name: 'Anna Przykładowa' },
]

const CASH_REGISTERS = [
  { id: 21, name: 'Kasa główna' },
  { id: 22, name: 'Kasa firmowa' },
]

const CATEGORIES = [
  { id: 31, name: 'Materiały' },
  { id: 32, name: 'Narzędzia' },
]

const INVESTMENT_OPTIONS: FilterOptionT[] = INVESTMENTS.map((investment, index) => ({
  value: String(investment.id),
  label: investment.name,
  count: (index + 1) * 4,
}))

const SORT_OPTIONS = [
  { value: 'newest', label: 'Najnowsze' },
  { value: 'oldest', label: 'Najstarsze' },
  { value: 'amount', label: 'Kwota' },
]

const QUEUE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Do sprawdzenia' },
  { value: 'accepted', label: 'Przyjęte' },
  { value: 'rejected', label: 'Odrzucone' },
]

const QUEUE_TOGGLE_MENU = {
  label: 'Więcej',
  icon: SlidersHorizontal,
  toggles: [{ param: 'withPhotos', label: 'Tylko ze zdjęciami' }],
}

const CATALOGUE_TOGGLES = [
  { id: 'hasRate', label: 'Ze stawką', groupLabel: 'Stawka' },
  { id: 'noRate', label: 'Bez stawki', groupLabel: 'Stawka' },
  { id: 'archived', label: 'Archiwalne', groupLabel: 'Widoczność' },
] as const

const INITIAL_CHIPS: ActiveFiltersBarChipT[] = [
  { id: 'investment', label: 'Mokotów — łazienka', removeLabel: 'Usuń filtr inwestycji' },
  { id: 'worker', label: 'Pracownicy', count: 2, removeLabel: 'Usuń filtr pracowników' },
  { id: 'type', label: 'Wydatek', removeLabel: 'Usuń filtr typu' },
]

export function FiltersSection() {
  const [investmentValues, setInvestmentValues] = useState<string[]>(['1'])
  const [sortValue, setSortValue] = useState('newest')
  const [day, setDay] = useState('2026-10-20')
  const [range, setRange] = useState<DateRangeT>(ALL_TIME)
  const [search, setSearch] = useState('')
  const [isActiveOnly, setIsActiveOnly] = useState(true)
  const [chips, setChips] = useState(INITIAL_CHIPS)
  const [statuses, setStatuses] = useState<Set<InvestmentStatusT>>(() => new Set())
  const [catalogueActive, setCatalogueActive] = useState<Set<string>>(() => new Set(['hasRate']))
  const [isPhotosOnly, setIsPhotosOnly] = useState(false)

  const multiSelectProps = {
    label: 'Inwestycje',
    icon: Landmark,
    options: INVESTMENT_OPTIONS,
    values: investmentValues,
    onValuesChange: setInvestmentValues,
    searchable: true,
  }
  const multiSelectWithTogglesProps = {
    ...multiSelectProps,
    label: 'Filtry',
    icon: ListFilter,
    optionsHeading: 'Inwestycje',
    actionsHeading: 'Opcje',
    toggles: [
      {
        id: 'photos',
        label: 'Tylko ze zdjęciami',
        description: 'Opis przełącznika',
        active: isPhotosOnly,
        onToggle: () => setIsPhotosOnly((previous) => !previous),
      },
    ],
    onClearToggles: () => setIsPhotosOnly(false),
  }
  const sortSelectProps = {
    value: sortValue,
    onValueChange: setSortValue,
    options: SORT_OPTIONS,
    icon: CircleDot,
  }
  const statusFilterProps = {
    selectedStatuses: statuses,
    onToggle: (status: InvestmentStatusT) =>
      setStatuses((previous) => toggleInSet(previous, status)),
    onClear: () => setStatuses(new Set()),
  }
  const catalogueToggles: DropdownCheckItemT[] = CATALOGUE_TOGGLES.map((toggle) => ({
    ...toggle,
    active: catalogueActive.has(toggle.id),
  }))
  const catalogueMenuProps = {
    toggles: catalogueToggles,
    onToggle: (id: string) => setCatalogueActive((previous) => toggleInSet(previous, id)),
    onClear: () => setCatalogueActive(new Set()),
  }

  return (
    <ShowcaseSection id="filters">
      <h3 className="mt-4 text-xs font-semibold tracking-wide uppercase">
        A. Prymitywy filtrów (components/filters)
      </h3>
      <ShowcaseRow title="FilterTriggerButton — stany" source="filters/filter-trigger-button.tsx">
        <FilterTriggerButton active={false} icon={Landmark}>
          Nieaktywny
        </FilterTriggerButton>
        <FilterTriggerButton active icon={Landmark}>
          Aktywny
        </FilterTriggerButton>
        <FilterTriggerButton active tone="destructive" icon={HardHat}>
          Destrukcyjny
        </FilterTriggerButton>
        <FilterTriggerButton active={false} icon={ListFilter} title="Tylko ikona" />
      </ShowcaseRow>
      <ShowcaseRow
        title="FilterMultiSelect — liczniki, wyszukiwanie, ikona, przełączniki"
        source="filters/filter-multi-select.tsx"
      >
        <FilterMultiSelect {...multiSelectProps} />
        <FilterMultiSelect {...multiSelectProps} iconOnly title="Inwestycje" />
        <FilterMultiSelect {...multiSelectWithTogglesProps} />
        <OpenPreview backdrop={false} className="h-96 justify-start gap-x-8">
          <FilterMultiSelect {...multiSelectProps} />
          <FilterMultiSelect {...multiSelectWithTogglesProps} />
        </OpenPreview>
      </ShowcaseRow>
      <ShowcaseRow title="FilterSelect" source="filters/filter-select.tsx">
        <FilterSelect {...sortSelectProps} />
        <OpenPreview backdrop={false} className="h-56 justify-start">
          <FilterSelect {...sortSelectProps} />
        </OpenPreview>
      </ShowcaseRow>
      <ShowcaseRow title="DateFilterButton" source="filters/date-filter-button.tsx">
        <DateFilterButton label="Data" value={day} onChange={setDay} />
        <DateFilterButton label="Data od" value="" onChange={setDay} />
        <OpenPreview backdrop={false} className="h-96 justify-start">
          <DateFilterButton label="Data" value={day} onChange={setDay} />
        </OpenPreview>
      </ShowcaseRow>
      <ShowcaseRow title="DateRangePicker — wiersz / stos" source="filters/date-range-picker.tsx">
        <DateRangePicker value={range} onChange={setRange} />
        <DateRangePicker value={range} onChange={setRange} stacked />
      </ShowcaseRow>
      <ShowcaseRow title="SearchFilterInput" source="filters/search-filter-input.tsx">
        <SearchFilterInput value={search} onChange={setSearch} placeholder="Szukaj…" />
      </ShowcaseRow>
      <ShowcaseRow
        title="ActiveFilterButton / ActiveFilterLabel"
        source="filters/active-filter-button.tsx, active-filter-label.tsx"
      >
        <ActiveFilterButton
          isActive={isActiveOnly}
          onChange={setIsActiveOnly}
          activeLabel="Aktywne"
          allLabel="Wszystkie"
        />
        <ActiveFilterLabel activeOnly={isActiveOnly} onToggle={setIsActiveOnly} />
      </ShowcaseRow>
      <ShowcaseRow
        title="FilterChip / ActiveFiltersBar / ClearButton"
        source="filters/filter-chip.tsx, active-filters-bar.tsx, clear-button.tsx"
      >
        <FilterChip label="Pojedynczy chip" removeLabel="Usuń filtr" onRemove={() => {}} />
        <FilterChip label="Z licznikiem" count={3} removeLabel="Usuń filtr" onRemove={() => {}} />
        <ActiveFiltersBar
          chips={chips}
          onRemove={(chip) => setChips((previous) => previous.filter(({ id }) => id !== chip.id))}
          onClearAll={() => setChips([])}
        />
        <ClearButton onClick={() => setChips(INITIAL_CHIPS)} disabled={chips.length > 0}>
          Przywróć chipy
        </ClearButton>
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">
        B. Menu filtrów domenowych
      </h3>
      <ShowcaseRow title="StatusFilter (statusy inwestycji)" source="investments/status-filter.tsx">
        <StatusFilter {...statusFilterProps} />
        <OpenPreview backdrop={false} className="h-80 justify-start">
          <StatusFilter {...statusFilterProps} />
        </OpenPreview>
      </ShowcaseRow>
      <ShowcaseRow
        title="CatalogueFiltersMenu (FilterMultiSelect z samymi przełącznikami)"
        source="work-catalogue/catalogue-filters-menu.tsx"
      >
        <CatalogueFiltersMenu {...catalogueMenuProps} />
        <OpenPreview backdrop={false} className="h-72 justify-start">
          <CatalogueFiltersMenu {...catalogueMenuProps} />
        </OpenPreview>
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">
        C. Paski filtrów w URL (zmieniają adres tej strony)
      </h3>
      <ShowcaseRow title="DateFilters" source="filters/date-filters.tsx" className="grid">
        <DateFilters baseUrl="/design" />
      </ShowcaseRow>
      <ShowcaseRow title="QueueFilters" source="filters/queue-filters.tsx" className="grid">
        <QueueFilters
          baseUrl="/design"
          statusOptions={QUEUE_STATUS_OPTIONS}
          investments={INVESTMENTS}
          workers={WORKERS}
          toggleMenu={QUEUE_TOGGLE_MENU}
        />
      </ShowcaseRow>
      <ShowcaseRow
        title="TransferFilters (wszystkie wymiary)"
        source="transfers/transfer-filters.tsx"
        className="grid"
      >
        <TransferFilters
          baseUrl="/design"
          cashRegisters={CASH_REGISTERS}
          investments={INVESTMENTS}
          users={WORKERS}
          workers={WORKERS}
          otherCategories={CATEGORIES}
          expenseCategories={CATEGORIES}
          transferTypes={TRANSFER_TYPES}
          showPaymentMethodFilter
          showPayoutStatusFilter
          showCancelledFilter
          showSearchFilters
          showWorkerDraftsFilter
          totalFilteredAmount={18450.75}
        />
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
