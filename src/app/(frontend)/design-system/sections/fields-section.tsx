'use client'

import { useState, type ComponentProps } from 'react'
import { pl } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DecimalInput } from '@/components/ui/decimal-input'
import { DecimalField } from '@/components/ui/decimal-field'
import { Label } from '@/components/ui/label'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Checkbox, type CheckboxVariantT } from '@/components/ui/checkbox'
import { CheckboxRow } from '@/components/ui/checkbox-row'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SimpleSelect, type SelectOptionT } from '@/components/ui/simple-select'
import { SearchSelect } from '@/components/ui/search-select'
import { Combobox } from '@/components/ui/combobox'
import { InlineModeSelect } from '@/components/ui/inline-mode-select'
import { LanguageSelect } from '@/components/ui/language-select'
import { FileInput } from '@/components/ui/file-input'
import { ReasonField } from '@/components/ui/reason-field'
import { Calendar } from '@/components/ui/calendar'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import type { LanguageT } from '@/lib/i18n/languages'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

type FieldOrientationT = NonNullable<ComponentProps<typeof Field>['orientation']>
type SelectTriggerSizeT = NonNullable<ComponentProps<typeof SelectTrigger>['size']>
type SimpleSelectVariantT = NonNullable<ComponentProps<typeof SimpleSelect>['variant']>
type ToggleGroupSizeT = NonNullable<ComponentProps<typeof ToggleGroup>['size']>

const FIELD_ORIENTATIONS = Object.keys({
  vertical: true,
  horizontal: true,
  responsive: true,
} satisfies Record<FieldOrientationT, true>) as FieldOrientationT[]

const CHECKBOX_VARIANTS = Object.keys({
  default: true,
  ai: true,
} satisfies Record<CheckboxVariantT, true>) as CheckboxVariantT[]

const CHECKBOX_STATES = [false, true, 'indeterminate'] as const

const SELECT_TRIGGER_SIZES = Object.keys({
  xs: true,
  sm: true,
  default: true,
} satisfies Record<SelectTriggerSizeT, true>) as SelectTriggerSizeT[]

const SIMPLE_SELECT_VARIANTS = Object.keys({
  default: true,
  soft: true,
  pill: true,
  toolbar: true,
  toolbarSm: true,
} satisfies Record<SimpleSelectVariantT, true>) as SimpleSelectVariantT[]

const TOGGLE_GROUP_SIZES = Object.keys({
  default: true,
  md: true,
  lg: true,
} satisfies Record<ToggleGroupSizeT, true>) as ToggleGroupSizeT[]

const OPTIONS: SelectOptionT[] = [
  { value: 'netto', label: 'Netto' },
  { value: 'brutto', label: 'Brutto' },
  { value: 'vat', label: 'VAT', description: 'Opcja z opisem pod etykietą' },
]

const SEARCH_ITEMS = [
  { value: 'a', label: 'Mieszkanie Mokotów' },
  { value: 'b', label: 'Dom Wilanów' },
  { value: 'c', label: 'Biuro Wola' },
]

const COMBOBOX_OPTIONS = ['m²', 'mb', 'szt.', 'kpl.']

const TOGGLE_OPTIONS = [
  { value: 'day', label: 'Dzień' },
  { value: 'week', label: 'Tydzień' },
  { value: 'month', label: 'Miesiąc' },
] as const

export function FieldsSection() {
  const [text, setText] = useState('')
  const [decimal, setDecimal] = useState<number | null>(12.5)
  const [isChecked, setIsChecked] = useState(true)
  const [selectValue, setSelectValue] = useState('netto')
  const [searchValue, setSearchValue] = useState('')
  const [comboboxValue, setComboboxValue] = useState('m²')
  const [language, setLanguage] = useState<LanguageT>('pl')
  const [reason, setReason] = useState('')
  const [isReasonShown, setIsReasonShown] = useState(false)
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [period, setPeriod] = useState<(typeof TOGGLE_OPTIONS)[number]['value']>('week')

  return (
    <ShowcaseSection id="fields">
      <ShowcaseRow title="Input — stany" source="ui/input.tsx" className="grid sm:grid-cols-3">
        <Input placeholder="Normalny" value={text} onChange={(e) => setText(e.target.value)} />
        <Input placeholder="Disabled" disabled />
        <Input placeholder="Błąd" aria-invalid />
      </ShowcaseRow>
      <ShowcaseRow title="Textarea — stany" source="ui/textarea.tsx" className="grid sm:grid-cols-3">
        <Textarea placeholder="Normalny" />
        <Textarea placeholder="Disabled" disabled />
        <Textarea placeholder="Błąd" aria-invalid />
      </ShowcaseRow>
      <ShowcaseRow title="Liczby" source="ui/decimal-input.tsx, ui/decimal-field.tsx">
        <DecimalInput defaultValue="1,5" />
        <DecimalInput defaultValue="1,5" disabled />
        <DecimalField label="Rabat" hint="Przykładowa podpowiedź" suffix="%" value={decimal} onCommit={setDecimal} />
        <DecimalField label="Z zapisem" labelAbove withSave value={decimal} onCommit={setDecimal} />
      </ShowcaseRow>
      <ShowcaseRow title="Field — orientacje" source="ui/field.tsx, ui/label.tsx" className="grid sm:grid-cols-3">
        {FIELD_ORIENTATIONS.map((orientation) => (
          <Field key={orientation} orientation={orientation}>
            <FieldLabel htmlFor={`field-${orientation}`}>orientation={orientation}</FieldLabel>
            <Input id={`field-${orientation}`} placeholder="Wartość" />
            <FieldDescription>Opis pola</FieldDescription>
          </Field>
        ))}
        <Field data-invalid>
          <Label htmlFor="field-error">Pole z błędem</Label>
          <Input id="field-error" aria-invalid />
          <FieldError>To pole jest wymagane</FieldError>
        </Field>
      </ShowcaseRow>
      <ShowcaseRow title="Checkbox — wariant × stan" source="ui/checkbox.tsx, ui/checkbox-row.tsx">
        {CHECKBOX_VARIANTS.map((variant) => (
          <div key={variant} className="flex items-center gap-3">
            <code className="text-muted-foreground text-xs">{variant}</code>
            {CHECKBOX_STATES.map((state) => (
              <Checkbox key={String(state)} variant={variant} checked={state} aria-label={String(state)} />
            ))}
            <Checkbox variant={variant} checked disabled aria-label="disabled" />
            <Checkbox variant={variant} aria-invalid aria-label="invalid" />
          </div>
        ))}
        <CheckboxRow checked={isChecked} onCheckedChange={setIsChecked}>
          CheckboxRow
        </CheckboxRow>
        <CheckboxRow checked={isChecked} onCheckedChange={setIsChecked} variant="ai">
          CheckboxRow ai
        </CheckboxRow>
      </ShowcaseRow>
      <ShowcaseRow title="SelectTrigger — rozmiary" source="ui/select.tsx" className="grid sm:grid-cols-4">
        {SELECT_TRIGGER_SIZES.map((size) => (
          <Select key={size} value={selectValue} onValueChange={setSelectValue}>
            <SelectTrigger size={size}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Disabled" />
          </SelectTrigger>
          <SelectContent />
        </Select>
      </ShowcaseRow>
      <ShowcaseRow title="SimpleSelect — warianty" source="ui/simple-select.tsx">
        {SIMPLE_SELECT_VARIANTS.map((variant) => (
          <div key={variant} className="flex flex-col gap-1">
            <code className="text-muted-foreground text-xs">{variant}</code>
            <SimpleSelect variant={variant} value={selectValue} onValueChange={setSelectValue} options={OPTIONS} />
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <code className="text-muted-foreground text-xs">invalid</code>
          <SimpleSelect value="" placeholder="Wybierz" onValueChange={setSelectValue} options={OPTIONS} invalid />
        </div>
      </ShowcaseRow>
      <ShowcaseRow title="Wyszukiwanie i wybór" source="ui/search-select.tsx, ui/combobox.tsx" className="grid sm:grid-cols-3">
        <SearchSelect value={searchValue} onChange={setSearchValue} items={SEARCH_ITEMS} placeholder="Wybierz inwestycję" />
        <SearchSelect value="" onChange={setSearchValue} items={SEARCH_ITEMS} placeholder="Błąd" isInvalid />
        <Combobox value={comboboxValue} onChange={setComboboxValue} options={COMBOBOX_OPTIONS} allowCustom />
      </ShowcaseRow>
      <ShowcaseRow title="Selecty złożone" source="ui/inline-mode-select.tsx, ui/language-select.tsx">
        <InlineModeSelect label="Widok" value={selectValue} onValueChange={setSelectValue} options={OPTIONS} description="Przykładowy opis" />
        <InlineModeSelect label="Zablokowany" value={selectValue} onValueChange={setSelectValue} options={OPTIONS} lockedReason="Powód blokady" />
        <LanguageSelect value={language} onValueChange={setLanguage} />
      </ShowcaseRow>
      <ShowcaseRow title="FileInput" source="ui/file-input.tsx" className="grid sm:grid-cols-2">
        <FileInput label="Załącznik" />
        <FileInput label="Disabled" disabled />
      </ShowcaseRow>
      <ShowcaseRow title="ReasonField (autoFocus)" source="ui/reason-field.tsx" className="flex-col items-start">
        <Button variant="outline" size="sm" onClick={() => setIsReasonShown((shown) => !shown)}>
          {isReasonShown ? 'Ukryj' : 'Pokaż'} ReasonField
        </Button>
        {isReasonShown && (
          <div className="w-full max-w-md">
            <ReasonField
              id="reason"
              value={reason}
              onChange={setReason}
              min={10}
              max={200}
              label="Powód zmiany"
              placeholder="Opisz powód"
              counterText={({ length, missing }) => (missing > 0 ? `Brakuje ${missing} znaków` : `${length} znaków`)}
            />
          </div>
        )}
      </ShowcaseRow>
      <ShowcaseRow title="Calendar" source="ui/calendar.tsx">
        <Calendar mode="single" selected={date} onSelect={setDate} locale={pl} className="rounded-md border" />
      </ShowcaseRow>
      <ShowcaseRow title="ToggleGroup — rozmiary" source="ui/toggle-group.tsx" className="flex-col items-start">
        {TOGGLE_GROUP_SIZES.map((size) => (
          <ToggleGroup key={size} size={size} options={[...TOGGLE_OPTIONS]} value={period} onChange={setPeriod} aria-label={size} />
        ))}
        <ToggleGroup options={[...TOGGLE_OPTIONS]} value={period} onChange={setPeriod} isEqualWidth aria-label="isEqualWidth" />
        <ToggleGroup options={[...TOGGLE_OPTIONS]} value={period} onChange={setPeriod} disabled aria-label="disabled" />
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
