'use client'

import { Fragment } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RemoveButton } from '@/components/ui/remove-button'
import { Separator } from '@/components/ui/separator'
import { SimpleSelect } from '@/components/ui/simple-select'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const noop = () => {}

const SUPPLIERS = [
  { id: 's1', name: 'Kontenery Kraków', phone: '601 234 567' },
  { id: 's2', name: 'Wywóz Gruzu Nowak', phone: '602 345 678' },
]

const EXTRAS = [
  { key: 'e1', description: 'Skucie starych płytek', unit: 'm2', qty: '6' },
  { key: 'e2', description: 'Wniesienie materiałów', unit: 'szt', qty: '1' },
]

const UNIT_OPTIONS = [
  { value: 'm2', label: 'm²' },
  { value: 'szt', label: 'szt.' },
]

const LINE_ITEMS = [
  { id: 'l1', amount: '123,45', description: 'Klej do płytek' },
  { id: 'l2', amount: '88,00', description: 'Fugi' },
]

export function A27RepeatableRowsGroup() {
  return (
    <AuditGroup
      id="A27"
      title="Lista powtarzalnych wierszy"
      count="4 wystąpienia w 4 plikach · 4 wersje"
      drift={[
        'wyrównanie wiersza: items-end (etykieta tylko w 1. wierszu) vs items-center flex-wrap vs items-start z etykietą w każdym wierszu',
        'usuwanie: RemoveButton z X vs RemoveButton z Trash2 w ręcznym div mt-6 size-9 vs ręczny Button ghost size icon z <X /> (szary, bez czerwonego hovera)',
        'blokada usunięcia ostatniego wiersza tylko na liście odbiorców',
        'dodawanie: outline sm bez ikony vs outline sm + Plus + mt-3 vs outline sm + ml-auto w osobnym pasku',
        'odstęp między wierszami: space-y-3 vs flex-col gap-4 sm:gap-2 vs space-y-6 z Separatorem i numerem pozycji',
      ]}
      proposal={
        <>
          <code>RepeatableRows</code> w <code>ui/</code> (props: <code>items</code>,{' '}
          <code>renderRow(item, index)</code>, <code>onRemove(index)</code>,{' '}
          <code>removeLabel</code>, <code>onAdd</code>, <code>addLabel</code>, <code>minRows?</code>
          ) — sam układa wiersze, stawia <code>RemoveButton</code> i przycisk dodawania.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="items-end, etykiety tylko w 1. wierszu, RemoveButton zawsze aktywny, „Dodaj” outline sm bez ikony"
        sources={['src/components/forms/order-settings-form/order-settings-form.tsx:125']}
      >
        <div className="w-full space-y-3">
          {SUPPLIERS.map((row, index) => (
            <div key={row.id} className="flex items-end gap-2">
              <Field className="min-w-0 flex-1">
                {index === 0 && <FieldLabel>Dostawca</FieldLabel>}
                <Input placeholder="Nazwa" defaultValue={row.name} />
              </Field>
              <Field className="min-w-0 flex-1">
                {index === 0 && <FieldLabel>Telefon</FieldLabel>}
                <Input type="tel" placeholder="601 234 567" defaultValue={row.phone} />
              </Field>
              <RemoveButton onClick={noop} aria-label="Usuń dostawcę" />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm">
            Dodaj dostawcę
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="b"
        label="jak a, ale RemoveButton wyłączony przy ostatnim wierszu (pokazany 1 wiersz)"
        sources={['src/components/forms/recipient-list-form/recipient-list-form.tsx:55']}
      >
        <div className="w-full space-y-3">
          <div className="flex items-end gap-2">
            <Field className="min-w-0 flex-1">
              <FieldLabel>Adresy e-mail</FieldLabel>
              <Input
                type="email"
                placeholder="ktos@wykonczymy.com.pl"
                defaultValue="jan.kowalski@example.com"
              />
            </Field>
            <RemoveButton onClick={noop} disabled aria-label="Usuń odbiorcę" />
          </div>
          <Button type="button" variant="outline" size="sm">
            Dodaj odbiorcę
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="c"
        label="items-center flex-wrap, bez etykiet, ręczny Button ghost icon z <X />, „Dodaj” + Plus + mt-3"
        sources={['src/components/kosztorys/worker-report/extra-work-rows.tsx:32']}
      >
        <div className="w-full">
          <div className="flex flex-col gap-4 sm:gap-2">
            {EXTRAS.map((extra) => (
              <div key={extra.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <Input
                  aria-label="Opis pracy"
                  defaultValue={extra.description}
                  placeholder="Opis pracy"
                  className="h-9 min-w-0 basis-full sm:flex-1 sm:basis-0"
                />
                <SimpleSelect
                  value={extra.unit}
                  onValueChange={noop}
                  options={UNIT_OPTIONS}
                  placeholder="j.m."
                  className="h-9 min-w-0 flex-1 sm:w-28 sm:flex-none"
                />
                <Input
                  aria-label="Ilość"
                  inputMode="decimal"
                  defaultValue={extra.qty}
                  placeholder="0"
                  className="h-9 min-w-0 flex-1 text-right tabular-nums sm:w-24 sm:flex-none"
                />
                <Button variant="ghost" size="icon" aria-label="Usuń pracę">
                  <X />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-3">
            <Plus />
            Dodaj więcej
          </Button>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="d"
        label="items-start, etykiety w każdym wierszu, Separator między wierszami, RemoveButton z Trash2 w div mt-6 size-9, „Dodaj” ml-auto (uproszczone: 2 pola z 4–6)"
        sources={['src/components/forms/expense-form/line-items-field.tsx:151']}
      >
        <div className="w-full space-y-4">
          <div className="space-y-6">
            {LINE_ITEMS.map((item, index) => (
              <Fragment key={item.id}>
                <div className="flex gap-2">
                  <span className="text-muted-foreground mt-6 flex h-9 shrink-0 items-center text-xs tabular-nums">
                    {index + 1}.
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                      <Field className="w-28">
                        <FieldLabel>Kwota</FieldLabel>
                        <Input
                          placeholder="0.00 PLN"
                          inputMode="decimal"
                          defaultValue={item.amount}
                        />
                      </Field>
                      <Field className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
                        <FieldLabel>Opis</FieldLabel>
                        <Input placeholder="Opcjonalnie" defaultValue={item.description} />
                      </Field>
                      <div className="mt-6 flex size-9 shrink-0 items-center justify-center">
                        <RemoveButton icon={Trash2} onClick={noop} />
                      </div>
                    </div>
                  </div>
                </div>
                {index < LINE_ITEMS.length - 1 && (
                  <Separator orientation="horizontal" className="bg-foreground" />
                )}
              </Fragment>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="ml-auto">
              Dodaj pozycję
            </Button>
          </div>
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
