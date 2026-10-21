import type { ReactNode } from 'react'
import { ArrowUpDown, Plus, Search, Settings2, Tags, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ControlGrid } from '@/components/ui/control-grid'
import { Description } from '@/components/ui/description'
import { Input } from '@/components/ui/input'
import { BORDERED_LIST_CLASS } from '@/components/ui/panel'
import { SECTION_TITLE_CLASS, SUBSECTION_TITLE_CLASS } from '@/components/ui/section-header'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const PRE = 'w-full overflow-x-auto text-xs'

const BODY_SM = 'text-sm max-sm:text-xs'
const BODY_XS = 'text-xs'

const ROW = 'border-border border-b last:border-b-0'
const TD = 'text-foreground px-3 py-2'
const TH = 'text-muted-foreground px-3 py-2 text-left font-medium'

const SUMMARY_TABLE = 'w-auto min-w-64 max-sm:text-xs'
const SUMMARY_CELL = 'py-1.5 pl-7 first:pl-0'
const SUMMARY_LABEL = cn(SUMMARY_CELL, 'text-muted-foreground text-left')
const SUMMARY_VALUE = cn(SUMMARY_CELL, 'text-right font-medium whitespace-nowrap tabular-nums')
const SUMMARY_HEAD = 'border-border text-muted-foreground border-b text-xs [&>td]:font-normal'
const SUMMARY_GRAND =
  'border-foreground border-t text-base max-sm:text-sm [&>td]:pt-2.5 [&>td]:font-semibold'

type SampleTablePropsT = {
  className?: string
  mutedRowClassName?: string
  textSize?: 'sm' | 'xs'
  toolbar?: ReactNode
}

function SampleTable({
  className,
  mutedRowClassName,
  textSize = 'sm',
  toolbar,
}: SampleTablePropsT) {
  return (
    <div className="w-full">
      <div className={cn('space-y-2 max-sm:space-y-6', className)}>
        {toolbar}
        <div className={cn(BORDERED_LIST_CLASS, 'overflow-x-auto rounded-lg')}>
          <table className={cn('w-full', textSize === 'xs' ? BODY_XS : BODY_SM)}>
            <thead>
              <tr className="border-border bg-muted/50 border-b">
                <th className={cn(TH, textSize === 'xs' ? 'text-xs' : 'text-sm')}>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    Nazwa
                    <ArrowUpDown className="size-3.5 opacity-40" />
                  </span>
                </th>
                <th className={cn(TH, textSize === 'xs' ? 'text-xs' : 'text-sm', 'text-right')}>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">Saldo</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className={ROW}>
                <td className={TD}>Kasa główna</td>
                <td className={cn(TD, 'text-right')}>12 345,67 zł</td>
              </tr>
              <tr className={cn(ROW, mutedRowClassName)}>
                <td className={TD}>Kasa Jana Kowalskiego</td>
                <td className={cn(TD, 'text-right')}>88,00 zł</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const SEARCH = (
  <div className="relative col-span-2 w-full sm:w-56 lg:w-72">
    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
    <Input placeholder="Szukaj..." className="h-8 pl-8" />
  </div>
)

const COLUMNS_BUTTON = (
  <Button variant="outline" size="sm">
    <Settings2 />
    Kolumny
  </Button>
)

const LEFT_GRID = 'sm:w-auto sm:flex-initial sm:items-center'
const RIGHT_GRID = 'sm:ml-auto sm:w-auto sm:flex-initial sm:items-center'

export function A31TableCallSiteGroup() {
  return (
    <AuditGroup
      id="A31"
      title="Tabela — oprawa wokół DataTable"
      count="32 wystąpienia w 30 plikach · 19 wersji"
      drift={[
        'Toolbar: 17 tabel nie ma toolbara wcale, z czego 8 ma storageKey bez ColumnToggle, którym dałoby się te ustawienia zmienić.',
        'Szukajka: searchTerm z useState vs parametr URL (searchParams.get + updateParam + debounceMs); licznik „Widoczne … n / m” raz w aboveToolbar, raz jako <Description> nad <DataTable>.',
        "Wygaszenie nieaktywnego wiersza: opacity-50 (kasy, pracownicy, inwestycje) vs opacity-60 (wypłaty, sprzęt, flota) vs [&_td]:text-muted-foreground (+ line-through) w przelewach; raz warunek ? 'opacity-…' : '', raz odwrócony ? '' : 'opacity-60'.",
        'className na wywołaniu: w-full / mt-4 w-full / hack obramowań [&_td+td]:border-l w review-lines-table; defaultTextSize="xs" w dwóch miejscach.',
        'Wirtualizacja: wiersz 36 / 44 / 52 px, kontener 400 / min(n×44+41+41, 400) / domyślne 600 nadpisane klasą max-h-dialog-scroll.',
        'Dwie tabele omijają DataTable całkiem: worker-summary (3 × <table> z <tr>/<td> zamiast <thead>/<th>, lokalne stałe TABLE/CELL/HEAD/GRAND) i ReportTable (py-1, border-border/60, nagłówek text-xs font-normal).',
      ]}
      proposal={
        <>
          <code>DataTable</code> przejmuje resztę oprawy: domyślny <code>ColumnToggle</code> zawsze,
          gdy jest <code>storageKey</code>, prop <code>visibleCount</code> oraz{' '}
          <code>isRowMuted={'(row) => boolean'}</code> z jednym wygaszeniem (opacity-60) i wariantem{' '}
          <code>bordered</code> zamiast hacka klas; raport pracownika i ReportTable przechodzą na{' '}
          <code>SummaryTable</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="toolbar · brak toolbara i storageKey — gołe <DataTable data columns />"
        sources={[
          'src/components/telmak-check/telmak-check-dialog.tsx:211',
          'src/components/transfers/duplicate-finder-dialog.tsx:150',
          'src/components/transfers/duplicate-finder-dialog.tsx:168',
          'src/components/worker-expenses/expense-draft-duplicate-hints.tsx:120',
          'src/components/kosztorys/editor/history/history-changes-table.tsx:38',
          'src/components/kosztorys/editor/dialogs/catalogue/catalogue-picker-table.tsx:45',
          'src/components/kosztorys/summary/tables/subcontractor-payouts-table.tsx:74',
          'src/components/kosztorys/summary/tables/materials-transactions-table.tsx:214',
          'src/components/forms/settle-payouts-form/settle-payouts-table.tsx:219',
          'src/components/forms/settle-payouts-form/settle-payouts-table.tsx:220',
        ]}
      >
        <SampleTable />
        <pre className={PRE}>{`<DataTable data={checkRows} columns={checkColumns} />`}</pre>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="toolbar · storageKey bez toolbara — zapisane ustawienia kolumn, ale brak ColumnToggle"
        sources={[
          'src/components/worker-expenses/worker-expense-drafts-table.tsx:68',
          'src/components/worker-expenses/pending-expense-drafts.tsx:120',
          'src/components/worker-expenses/expense-drafts-data-table.tsx:94',
          'src/components/worker-reports/worker-report-history-table.tsx:57',
          'src/components/receipt-confirmation/rejected-receipts.tsx:113',
          'src/components/worker-reports/report-preview-table.tsx:95',
          'src/components/telmak-check/telmak-check-dialog.tsx:220',
          'src/components/equipment/equipment-history.tsx:62',
        ]}
      >
        <SampleTable />
        <pre className={PRE}>
          {`<DataTable data={pageRows} columns={columns} storageKey="worker-expense-drafts" />`}
        </pre>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="toolbar · szukaj z useState + filtry + ColumnToggle + akcje (filtry jako przyciski, statycznie)"
        sources={[
          'src/components/cash-registers/cash-registers-table.tsx:82',
          'src/components/users/user-data-table.tsx:71',
          'src/components/equipment/equipment-data-table.tsx:71',
          'src/components/sheets/kosztorys-data-table.tsx:33',
          'src/components/sheets/investments-without-sheet-table.tsx:26',
          'src/components/fleet/fleet-data-table.tsx:37',
        ]}
      >
        <SampleTable
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <ControlGrid className={LEFT_GRID}>
                {SEARCH}
                <Button variant="outline" size="sm" className="sm:w-fit sm:min-w-0">
                  <Tags />
                  Typ
                </Button>
                <Button variant="outline" size="sm" className="sm:w-fit sm:min-w-0">
                  <User />
                  Właściciel
                </Button>
              </ControlGrid>
              <ControlGrid className={RIGHT_GRID}>
                <Button size="sm">
                  <Plus />
                  Dodaj kasę
                </Button>
                {COLUMNS_BUTTON}
              </ControlGrid>
            </div>
          }
        />
        <pre className={PRE}>
          {`search={{ value: searchTerm, onChange: setSearchTerm }}
filters={
  <>
    <FilterMultiSelect
      label="Typ"
      options={TYPE_OPTIONS}
      values={typeValues}
      onValuesChange={setTypeValues}
      icon={Tags}
      triggerClassName={GRID_FILTER_TRIGGER_CLASS}
    />
    <FilterMultiSelect
      label="Właściciel"
      options={ownerOptions}
      values={ownerValues}
      onValuesChange={setOwnerValues}
      icon={User}
      searchable
      triggerClassName={GRID_FILTER_TRIGGER_CLASS}
    />
    <ActiveFilterButton
      isActive={showOnlyActive}
      onChange={setShowOnlyActive}
      activeLabel="Aktywne"
      allLabel="Wszystkie"
    />
  </>
}
columnToggle
actions={<AddCashRegisterDialog />}`}
        </pre>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="toolbar · ColumnToggle z sections (Warstwy), licznik jako <Description> nad <DataTable> (też users)"
        sources={[
          'src/components/investments/investment-data-table.tsx:93',
          'src/components/investments/investment-data-table.tsx:84',
          'src/components/users/user-data-table.tsx:62',
        ]}
      >
        <div className="flex w-full flex-col gap-2">
          <Description withIcon={false}>Widoczne inwestycje 12 / 40</Description>
          <SampleTable
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <ControlGrid className={LEFT_GRID}>{SEARCH}</ControlGrid>
                <ControlGrid className={RIGHT_GRID}>{COLUMNS_BUTTON}</ControlGrid>
              </div>
            }
          />
        </div>
        <pre className={PRE}>
          {`search={{ value: searchTerm, onChange: setSearchTerm }}
filters={
  <>
    <StatusFilter
      selectedStatuses={selectedStatuses}
      onToggle={toggleStatus}
      onClear={clearStatuses}
      triggerClassName={GRID_FILTER_TRIGGER_CLASS}
    />
    <FilterMultiSelect
      label="Analiza AI"
      options={AI_PROGRESS_OPTIONS}
      values={aiSteps}
      onValuesChange={setAiSteps}
      icon={Sparkles}
      triggerClassName={GRID_FILTER_TRIGGER_CLASS}
    />
  </>
}
columnToggle={{
  sections: (table, columnVisibility) => (
    <>
      <DropdownMenuLabel>Warstwy</DropdownMenuLabel>
      {LAYERS.map(({ label, columnIds }) => (
        <DropdownMenuCheckboxRow
          key={label}
          checked={columnIds.every((id) => columnVisibility[id] !== false)}
          onCheckedChange={(next) =>
            table.setColumnVisibility((prev) => ({
              ...prev,
              ...Object.fromEntries(columnIds.map((id) => [id, next === true])),
            }))
          }
          label={label}
        />
      ))}
    </>
  ),
}}
actions={<AddInvestmentDialog presets={presets} />}`}
        </pre>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="toolbar · same akcje, bez ColumnToggle mimo storageKey"
        sources={[
          'src/components/worker-reports/worker-reports-data-table.tsx:66',
          'src/components/presets/presets-data-table.tsx:15',
        ]}
      >
        <SampleTable
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <ControlGrid className={RIGHT_GRID}>
                <Button size="sm">
                  <Plus />
                  Nowy szablon
                </Button>
              </ControlGrid>
            </div>
          }
        />
        <pre className={PRE}>{`actions={<ScanReportButton />}`}</pre>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="toolbar · szukaj z parametru URL (searchParams + updateParam + debounceMs)"
        sources={['src/components/leads/leads-data-table.tsx:80']}
      >
        <pre className={PRE}>
          {`search={{
  value: searchParams.get('search') ?? '',
  onChange: (value) => updateParam('search', value),
  placeholder: 'Szukaj zgłoszenia...',
  debounceMs: SEARCH_DEBOUNCE_MS,
}}
filters={
  <ActiveFilterButton
    isActive={noFiles.isActive}
    onChange={noFiles.setActive}
    activeLabel="Bez plików"
  />
}
columnToggle
actions={selectedIds.size > 0 && <TrashLeadsButton leadIds={[...selectedIds]} />}`}
        </pre>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label='toolbar · ColumnToggle contentClassName="w-112" + filterChips, licznik przez aboveToolbar'
        sources={['src/components/work-catalogue/work-catalogue-data-table.tsx:189']}
      >
        <SampleTable
          toolbar={
            <>
              <div className="max-sm:-mt-4">
                <Description withIcon={false}>Widoczne prace 12 / 950</Description>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex w-full flex-col gap-2 sm:w-auto">
                  <ControlGrid className={LEFT_GRID}>{SEARCH}</ControlGrid>
                </div>
                <ControlGrid className={RIGHT_GRID}>{COLUMNS_BUTTON}</ControlGrid>
              </div>
            </>
          }
        />
        <pre className={PRE}>
          {`aboveToolbar={
  /* Counted off \`filteredData\`, not off the deferred list the table renders: behind the
   spinner the count would still be naming the previous search for as long as ~950 rows
   take to redraw. */
  <Description withIcon={false}>
    Widoczne prace {filteredData.length} / {data.length}
  </Description>
}
columnToggle={{ contentClassName: 'w-112' }}
filterChips={
  <ActiveFiltersBar chips={chips} onRemove={removeChip} onClearAll={resetFilters} />
}
search={{
  value: searchTerm,
  onChange: setSearchTerm,
  placeholder: 'Szukaj pracy...',
}}
filters={
  <>
    <FilterMultiSelect
      label="Kategoria"
      options={categoryOptions}
      values={categories}
      onValuesChange={setCategories}
      icon={Tags}
      searchable
      triggerClassName={GRID_FILTER_TRIGGER_CLASS}
      contentClassName="w-112"
    />
    <FilterMultiSelect
      label="j.m."
      options={unitOptions}
      values={units}
      onValuesChange={setUnits}
      icon={Ruler}
      searchable
      triggerClassName={GRID_FILTER_TRIGGER_CLASS}
    />
    <CatalogueFiltersMenu
      toggles={filterToggles}
      onToggle={toggleCondition}
      onClear={() =>
        setConditions(
          filterToggles.map((toggle) => toggle.id),
          false,
        )
      }
    />
    <CatalogueProblemsMenu
      toggles={problemToggles}
      onSelect={(id) => toggleExclusive(id, CATALOGUE_PROBLEM_IDS)}
    />
    {/* Always mounted: toggling it would resize the flex row and nudge the buttons
      sideways on every keystroke. */}
    <GradientSpinner className={cn('max-sm:hidden', !busy && 'invisible')} />
  </>
}
actions={
  <>
    <FillCatalogueTranslationsButton count={countNeedingTranslation(data)} />
    <AddCatalogueItemDialog categorySuggestions={categorySuggestions} />
  </>
}`}
        </pre>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label='toolbar · title + toolbarClassName="mt-8", ColumnToggle tylko w widoku tabeli, bez szukajki'
        sources={['src/components/transfers/transfer-data-table.tsx:103']}
      >
        <SampleTable
          toolbar={
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <h2 className={cn('text-foreground w-full', SECTION_TITLE_CLASS)}>Transakcje</h2>
              <ControlGrid className={RIGHT_GRID}>
                <Button variant="outline" size="sm">
                  Lista
                </Button>
                {COLUMNS_BUTTON}
              </ControlGrid>
            </div>
          }
        />
        <pre className={PRE}>
          {`toolbarClassName="mt-8"
title={title}
columnToggle={view === 'table'}
actions={(table) => (
  <>
    <TransferViewSwitch view={view} onChange={setView} className="max-sm:col-span-2" />
    {invoiceDownload && <InvoiceDownloadDialog fetchRows={fetchRows} />}
    {duplicateFinder && view === 'table' && (
      <DuplicateFinderDialog
        findGroups={(range) => findExpenseDuplicateGroups(config.query.where, range)}
      />
    )}
    {print && (
      <PrintTransfersButton
        fetchRows={fetchRows}
        table={table}
        title={translator.t('title')}
      />
    )}
  </>
)}`}
        </pre>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="toolbar · ręczny flex zamiast DataTableToolbar (nagłówek + ColumnToggle)"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:591',
        ]}
      >
        <SampleTable
          textSize="xs"
          toolbar={
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h3 className={SUBSECTION_TITLE_CLASS}>Robocizna</h3>
              </div>
              {COLUMNS_BUTTON}
            </div>
          }
        />
        <pre className={PRE}>
          {`toolbar={({ table, columnVisibility, ...order }) => (
  <div className="flex items-end justify-between gap-4">
    <div className="min-w-0">{heading}</div>
    <ColumnToggle table={table} columnVisibility={columnVisibility} {...order} />
  </div>
)}`}
        </pre>
      </AuditVariant>

      <AuditVariant
        letter="j"
        label="wygaszenie · getRowClassName → opacity-50"
        sources={[
          'src/components/cash-registers/cash-registers-table.tsx:81',
          'src/components/users/user-data-table.tsx:70',
          'src/components/investments/investment-data-table.tsx:92',
        ]}
      >
        <SampleTable mutedRowClassName="opacity-50" />
        <pre className={PRE}>{`getRowClassName={(row) => (!row.active ? 'opacity-50' : '')}`}</pre>
      </AuditVariant>

      <AuditVariant
        letter="k"
        label="wygaszenie · getRowClassName → opacity-60 (w sprzęcie warunek odwrócony)"
        sources={[
          'src/components/forms/settle-payouts-form/settle-payouts-table.tsx:224',
          'src/components/equipment/equipment-data-table.tsx:70',
          'src/components/fleet/fleet-data-table.tsx:27',
        ]}
      >
        <SampleTable mutedRowClassName="opacity-60" />
        <pre className={PRE}>
          {`getRowClassName={(row) => (row.status === 'RETIRED' ? 'opacity-60' : '')}
getRowClassName={(row) => (isLiveStatus(row.status) ? '' : 'opacity-60')}`}
        </pre>
      </AuditVariant>

      <AuditVariant
        letter="l"
        label="wygaszenie · transferRowClassName — wyszarzony tekst komórek (+ line-through dla anulowanych)"
        sources={[
          'src/components/transfers/transfer-data-table.tsx:97',
          'src/components/telmak-check/telmak-check-dialog.tsx:221',
        ]}
      >
        <SampleTable mutedRowClassName="[&_td]:line-through [&_td]:text-muted-foreground" />
        <SampleTable mutedRowClassName="[&_td]:text-muted-foreground" />
      </AuditVariant>

      <AuditVariant
        letter="m"
        label='className · defaultTextSize="xs" zamiast domyślnego sm'
        sources={[
          'src/components/worker-expenses/expense-draft-duplicate-hints.tsx:120',
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:590',
        ]}
      >
        <SampleTable textSize="xs" />
      </AuditVariant>

      <AuditVariant
        letter="n"
        label="className · w-full + wirtualizacja: wiersz 44, wysokość min(n×44+41+41, 400)"
        sources={['src/components/kosztorys/summary/tables/materials-transactions-table.tsx:218']}
      >
        <pre className={PRE}>
          {`enableVirtualization
virtualRowHeight={ROW_HEIGHT}            // 44
virtualContainerHeight={Math.min(
  visibleRows.length * ROW_HEIGHT + HEADER_HEIGHT + FOOTER_HEIGHT,   // 41 + 41
  TABLE_HEIGHT,                          // 400
)}
className="w-full"`}
        </pre>
      </AuditVariant>

      <AuditVariant
        letter="o"
        label="className · mt-4 w-full + wirtualizacja: wiersz 36, wysokość stała 400"
        sources={['src/components/kosztorys/summary/tables/subcontractor-payouts-table.tsx:77']}
      >
        <SampleTable className="mt-4 w-full" />
        <pre className={PRE}>
          {`enableVirtualization
virtualRowHeight={ROW_HEIGHT}        // 36
virtualContainerHeight={TABLE_HEIGHT} // 400
className="mt-4 w-full"`}
        </pre>
      </AuditVariant>

      <AuditVariant
        letter="p"
        label="className · wirtualizacja: wiersz 52, wysokość z klasy max-h-dialog-scroll (wyłącza domyślne 600)"
        sources={[
          'src/components/kosztorys/editor/dialogs/catalogue/catalogue-picker-table.tsx:49',
        ]}
      >
        <pre className={PRE}>
          {`enableVirtualization
virtualRowHeight={ROW_ESTIMATE}          // 52
virtualContainerClassName="max-h-dialog-scroll"`}
        </pre>
      </AuditVariant>

      <AuditVariant
        letter="q"
        label="className · hack obramowań kolumn [&_td+td]:border-l [&_th+th]:border-l"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:589',
        ]}
      >
        <SampleTable
          textSize="xs"
          className="[&_td+td]:border-border [&_th+th]:border-border [&_td+td]:border-l [&_th+th]:border-l"
        />
      </AuditVariant>

      <AuditVariant
        letter="r"
        label="surowa <table> · worker-summary — 3 tabele, nagłówek jako <tr className={HEAD}> z <td>, wiersz GRAND"
        sources={[
          'src/components/kosztorys/worker-report/worker-summary.tsx:27',
          'src/components/kosztorys/worker-report/worker-summary.tsx:68',
          'src/components/kosztorys/worker-report/worker-summary.tsx:100',
        ]}
      >
        <div className="flex flex-col items-end gap-6">
          <table className={SUMMARY_TABLE}>
            <tbody>
              <tr className={SUMMARY_HEAD}>
                <td className={SUMMARY_LABEL}>Wykonane</td>
                <td className={SUMMARY_VALUE}>Wartość etapu</td>
                <td className={SUMMARY_VALUE}>Udział</td>
                <td className={SUMMARY_VALUE}>Netto</td>
              </tr>
              <tr>
                <td className={SUMMARY_LABEL}>Etap 1</td>
                <td className={cn(SUMMARY_VALUE, 'text-muted-foreground')}>2 222,22 zł</td>
                <td className={cn(SUMMARY_VALUE, 'text-muted-foreground')}>50%</td>
                <td className={SUMMARY_VALUE}>1 111,11 zł</td>
              </tr>
              <tr>
                <td className={SUMMARY_LABEL}>Razem</td>
                <td className={cn(SUMMARY_VALUE, 'text-muted-foreground')}>24 691,34 zł</td>
                <td className={SUMMARY_VALUE} />
                <td className={SUMMARY_VALUE}>12 345,67 zł</td>
              </tr>
            </tbody>
          </table>

          <table className={SUMMARY_TABLE}>
            <tbody>
              <tr className={SUMMARY_HEAD}>
                <td className={SUMMARY_LABEL}>Twoje rozliczenie</td>
                <td className={SUMMARY_VALUE}>Netto</td>
              </tr>
              <tr>
                <td className={SUMMARY_LABEL}>Wykonane razem</td>
                <td className={SUMMARY_VALUE}>12 345,67 zł</td>
              </tr>
              <tr>
                <td className={SUMMARY_LABEL}>Wypłacone</td>
                <td className={cn(SUMMARY_VALUE, 'text-chart-green')}>12 433,67 zł</td>
              </tr>
              <tr className={SUMMARY_GRAND}>
                <td className={cn(SUMMARY_CELL, 'text-left')}>Nadpłata</td>
                <td className={cn(SUMMARY_VALUE, 'text-destructive')}>88,00 zł</td>
              </tr>
            </tbody>
          </table>

          <table className={SUMMARY_TABLE}>
            <tbody>
              <tr className={SUMMARY_HEAD}>
                <td className={SUMMARY_LABEL}>Wypłaty</td>
                <td className={SUMMARY_LABEL}>Opis</td>
                <td className={SUMMARY_VALUE}>Netto</td>
              </tr>
              <tr>
                <td className={cn(SUMMARY_LABEL, 'whitespace-nowrap')}>20.10.2026</td>
                <td className={cn(SUMMARY_LABEL, 'max-w-80')}>Zaliczka</td>
                <td className={SUMMARY_VALUE}>12 433,67 zł</td>
              </tr>
              <tr>
                <td className={SUMMARY_LABEL} colSpan={2}>
                  Razem
                </td>
                <td className={SUMMARY_VALUE}>12 433,67 zł</td>
              </tr>
            </tbody>
          </table>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="s"
        label="surowa <table> · ReportTable + ReportRow (raport arkusz vs aplikacja)"
        sources={['src/components/kosztorys/editor/dialogs/report/sheet-report-parts.tsx:26']}
      >
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm max-sm:text-xs">
            <thead>
              <tr className="text-muted-foreground text-xs">
                <th className="py-1 text-left font-normal" />
                <th className="py-1 pl-3 text-right font-normal">Arkusz Google</th>
                <th className="py-1 pl-3 text-right font-normal">Ta aplikacja</th>
                <th className="py-1 pl-3 text-right font-normal">Różnica</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-border/60 border-t align-middle">
                <td className="py-1">Wartość netto</td>
                <td className="text-foreground py-1 pl-3 text-right tabular-nums">12 345,67 zł</td>
                <td className="text-foreground py-1 pl-3 text-right tabular-nums">12 433,67 zł</td>
                <td className="text-foreground py-1 pl-3 text-right tabular-nums">88,00 zł</td>
              </tr>
              <tr className="border-border/60 border-t align-middle">
                <td className="py-1">Rabat</td>
                <td className="text-foreground py-1 pl-3 text-right tabular-nums">1 111,11 zł</td>
                <td className="text-foreground py-1 pl-3 text-right tabular-nums">1 111,11 zł</td>
                <td className="text-foreground py-1 pl-3 text-right tabular-nums">0,00 zł</td>
              </tr>
            </tbody>
          </table>
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
