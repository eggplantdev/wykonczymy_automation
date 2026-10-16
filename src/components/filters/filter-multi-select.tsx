'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCheck, CheckIcon, RotateCcw, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { FilterTriggerButton } from '@/components/filters/filter-trigger-button'
import { cn } from '@/lib/utils/cn'
import { useTranslation } from '@/hooks/use-translation'

type OptionT = { value: string; label: string }

export type FilterTogglesBulkT = { allActive: boolean; onToggleAll: (next: boolean) => void }

type FilterMultiSelectPropsT = {
  values?: string[]
  onValuesChange?: (values: string[]) => void
  options?: OptionT[]
  /** Ticked, unclickable, and outside the selection entirely — never written to the param, counted, or
   * touched by the bulk row. */
  lockedValues?: string[]
  label: string
  icon?: LucideIcon
  searchable?: boolean
  triggerClassName?: string
  iconOnly?: boolean
  title?: string
  // Swaps the „Wyczyść" row for a select-all / deselect-all pair, for a caller whose ticks are not a
  // filter („Sekcje": ticked = expanded).
  bulkLabels?: { select: string; deselect: string }
  optionToggles?: ReadonlyArray<{
    label: string
    isActive: (current: string[]) => boolean
    select: (current: string[]) => string[]
  }>
  toggles?: ReadonlyArray<{
    id: string
    label: string
    groupLabel?: string
    description?: string
    active: boolean
    onToggle: () => void
    disabled?: boolean
  }>
  togglesBulk?: FilterTogglesBulkT
  actionsHeading?: string
  optionsHeading?: string
  resetAction?: { label: string; onReset: () => void; disabled?: boolean }
  triggerCount?: number
  contentClassName?: string
  intro?: { heading: string; hint?: string }
}

// The param carries exactly the ticked values; [] = nothing ticked = no filter. A link saved under
// the old encoding still carries this marker for „nothing selected".
const LEGACY_NONE = '__none__'
const DEBOUNCE_MS = 600

/**
 * `value` is an id rather than the visible sentence, which is what cmdk would derive: both rows say
 * the same words, so one menu showing both would hold two items under one value.
 */
function BulkSelectRow({
  id,
  allSelected,
  labels,
  onSelect,
}: {
  id: string
  allSelected: boolean
  labels?: { select: string; deselect: string }
  onSelect: () => void
}) {
  const { t } = useTranslation('filters')
  const text = allSelected
    ? (labels?.deselect ?? t('deselectAll'))
    : (labels?.select ?? t('selectAll'))
  return (
    <CommandItem value={id} keywords={[text]} onSelect={onSelect}>
      <CheckCheck />
      {text}
    </CommandItem>
  )
}

export function FilterMultiSelect({
  values = [],
  onValuesChange = () => {},
  options = [],
  lockedValues,
  label,
  icon: Icon,
  searchable = false,
  triggerClassName,
  iconOnly = false,
  title,
  bulkLabels,
  optionToggles,
  toggles,
  togglesBulk,
  resetAction,
  intro,
  actionsHeading,
  optionsHeading,
  triggerCount,
  contentClassName,
}: FilterMultiSelectPropsT) {
  const { t } = useTranslation('filters')
  const [open, setOpen] = useState(false)
  const [localSelected, setLocalSelected] = useState<string[] | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isLocked = (value: string) => lockedValues?.includes(value) ?? false
  const selectableOptions = options.filter((o) => !isLocked(o.value))
  const allValues = selectableOptions.map((o) => o.value)

  const deriveSelected = (vals: string[]) => vals.filter((value) => value !== LEGACY_NONE)

  const committed = deriveSelected(values)
  const selected = localSelected ?? committed
  const allSelected = selected.length === selectableOptions.length
  const hasPendingTicks =
    selected.length !== committed.length || selected.some((value) => !committed.includes(value))

  function scheduleFlush(next: string[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onValuesChange(next)
      debounceRef.current = null
    }, DEBOUNCE_MS)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setLocalSelected(deriveSelected(values))
      setOpen(true)
      return
    }

    if (debounceRef.current && localSelected) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      onValuesChange(localSelected)
    }
    setLocalSelected(null)
    setOpen(false)
  }

  function toggleValue(value: string) {
    const isSelected = selected.includes(value)
    const next = isSelected ? selected.filter((v) => v !== value) : [...selected, value]
    setLocalSelected(next)
    scheduleFlush(next)
  }

  const activeToggleCount =
    toggles?.filter((toggle) => !toggle.disabled && toggle.active).length ?? 0

  const triggerBadgeCount = triggerCount ?? selected.length + activeToggleCount
  const isFiltered = triggerBadgeCount > 0

  function selectValues(next: string[]) {
    setLocalSelected(next)
    scheduleFlush(next)
  }

  // Drops a pending debounce, which would otherwise land after the reset and put the clicks back. The
  // values themselves are the caller's to reset: to „Sekcje" an empty list folds every sekcja.
  function handleReset() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    setLocalSelected(null)
    resetAction?.onReset()
  }


  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const toggleRuns = (toggles ?? []).reduce<
    { heading: string | undefined; items: NonNullable<typeof toggles>[number][] }[]
  >((runs, toggle) => {
    const last = runs[runs.length - 1]
    if (last && last.heading === toggle.groupLabel) last.items.push(toggle)
    else runs.push({ heading: toggle.groupLabel, items: [toggle] })
    return runs
  }, [])

  const bulkToggleRow = togglesBulk && (
    <BulkSelectRow
      id="bulk-toggles"
      allSelected={togglesBulk.allActive}
      labels={bulkLabels}
      onSelect={() => togglesBulk.onToggleAll(!togglesBulk.allActive)}
    />
  )

  const showsClearRow = !bulkLabels && selected.length > 0
  const hasActionRows = bulkLabels != null || showsClearRow || (optionToggles?.length ?? 0) > 0

  const actionRows = (
    <>
      {bulkLabels && (
        <BulkSelectRow
          id="bulk-options"
          allSelected={allSelected}
          labels={bulkLabels}
          onSelect={() => selectValues(allSelected ? [] : [...allValues])}
        />
      )}
      {showsClearRow && (
        <CommandItem value="clear-options" keywords={[t('clear')]} onSelect={() => selectValues([])}>
          <X />
          {t('clear')}
        </CommandItem>
      )}
      {optionToggles?.map((group) => (
        <CommandItem
          key={group.label}
          value={group.label}
          onSelect={() => selectValues(group.select(selected))}
        >
          <CheckIcon className={cn(!group.isActive(selected) && 'opacity-0')} />
          {group.label}
        </CommandItem>
      ))}
    </>
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <FilterTriggerButton
          active={isFiltered}
          icon={Icon}
          className={triggerClassName}
          title={title}
        >
          {iconOnly ? null : (
            <>
              {label}
              {isFiltered ? ` (${triggerBadgeCount})` : ''}
            </>
          )}
        </FilterTriggerButton>
      </PopoverTrigger>
      {/* cmdk's stock list is capped at 300px flat, which on a phone cut a 13-option menu in half. */}
      <PopoverContent
        className={cn('flex flex-col overflow-hidden p-0', contentClassName)}
        align="start"
      >
        {intro && (
          <div className="border-border border-b px-3 py-2">
            <p className="text-sm font-semibold">{intro.heading}</p>
            {intro.hint && <p className="text-muted-foreground text-xs">{intro.hint}</p>}
          </div>
        )}
        {resetAction && (
          <div className="border-border border-b p-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start font-normal"
              // `resetAction.disabled` speaks for what the caller owns outside this list; the local
              // half is judged here, or the button stays dead for the whole debounce after a click.
              disabled={(resetAction.disabled ?? false) && !hasPendingTicks}
              onClick={handleReset}
            >
              <RotateCcw />
              {resetAction.label}
            </Button>
          </div>
        )}
        <Command className="min-h-0 flex-1">
          {searchable && <CommandInput placeholder={t('search')} />}
          <CommandList className="max-h-none">
            {toggles && toggles.length > 0 && (
              <>
                {bulkToggleRow && <CommandGroup>{bulkToggleRow}</CommandGroup>}
                {/* Keyed by each run's first row, not by its heading: an interleaved caller opens
                    two runs under one heading, and a heading key would collide. */}
                {toggleRuns.map((run) => (
                  <CommandGroup key={run.items[0].id} heading={run.heading}>
                    {run.items.map((toggle) => (
                      // Keyed by id: two plane headings can each hold a „Kwota stała (2)", and cmdk
                      // treats rows sharing a value as one.
                      <CommandItem
                        key={toggle.id}
                        value={toggle.id}
                        keywords={[toggle.label]}
                        disabled={toggle.disabled}
                        onSelect={toggle.onToggle}
                      >
                        <CheckIcon className={cn(!toggle.active && 'opacity-0')} />
                        {toggle.description ? (
                          <span className="flex flex-col">
                            {toggle.label}
                            <span className="text-muted-foreground text-xs">
                              {toggle.description}
                            </span>
                          </span>
                        ) : (
                          toggle.label
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
                {options.length > 0 && <CommandSeparator />}
              </>
            )}
            {actionsHeading && options.length > 0 && hasActionRows && (
              <>
                <CommandGroup heading={actionsHeading}>{actionRows}</CommandGroup>
                <CommandSeparator />
              </>
            )}
            {options.length > 0 && (
              <CommandGroup heading={optionsHeading}>
                {!actionsHeading && hasActionRows && (
                  <>
                    {actionRows}
                    <CommandSeparator className="my-1" />
                  </>
                )}
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    disabled={isLocked(opt.value)}
                    onSelect={() => !isLocked(opt.value) && toggleValue(opt.value)}
                  >
                    <CheckIcon
                      className={cn(
                        !isLocked(opt.value) && !selected.includes(opt.value) && 'opacity-0',
                      )}
                    />
                    {opt.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandEmpty>{t('noResults')}</CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
