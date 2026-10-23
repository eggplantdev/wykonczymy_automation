/* eslint-disable local/no-hand-rolled-ui -- audit page renders verbatim copies of hand-rolled markup */
'use client'

import { Badge } from '@/components/ui/badge'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const LONG_DESCRIPTION =
  'Płytki gresowe 60×60 do łazienki na piętrze, klej elastyczny i fuga epoksydowa w kolorze antracytu'
const NOTE = 'Faktura korygująca do zamówienia z września\nDopłata za transport'
const FILTER_LABEL = 'Tylko: pozycje ze stawką wykonawcy od ceny z materiałem'

export function A28TruncatedTextGroup() {
  return (
    <AuditGroup
      id="A28"
      title="Ucięty tekst z podpowiedzią"
      count="3 wystąpienia w 2 plikach · 3 wersje"
      drift={[
        'wyzwalacz: <span> vs <button> (z eslint-disable) dla tej samej podpowiedzi — fokus z klawiatury tylko na przycisku',
        'szerokość: max-w-64 vs max-w-32 vs max-w-full rodzica (chip filtra)',
        'podpowiedź: SimpleTooltip vs natywny atrybut title= (chip filtra)',
        'kolor: text-muted-foreground w tabeli vs dziedziczony kolor chipa; cursor-help tylko w tabeli',
      ]}
      proposal={
        <>
          <code>TruncatedText</code> w <code>ui/</code> (props: <code>text</code>,{' '}
          <code>full?</code>, <code>maxWidth</code>, <code>tone?</code>) —{' '}
          <code>SimpleTooltip</code> + ucinający się span, zamiast natywnego <code>title=</code>.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="<span> wyszarzony, max-w-64, cursor-help + SimpleTooltip"
        sources={['src/components/kosztorys/summary/tables/materials-transactions-table.tsx:74']}
      >
        <SimpleTooltip content={LONG_DESCRIPTION}>
          <span className="text-muted-foreground block max-w-64 cursor-help truncate">
            {LONG_DESCRIPTION}
          </span>
        </SimpleTooltip>
      </AuditVariant>
      <AuditVariant
        letter="b"
        label="<button> wyszarzony, max-w-32, pierścień fokusu + SimpleTooltip z pełną notatką"
        sources={['src/components/kosztorys/summary/tables/materials-transactions-table.tsx:94']}
      >
        <SimpleTooltip content={NOTE}>
          <button
            type="button"
            className="text-muted-foreground focus-visible:ring-ring/50 block max-w-32 cursor-help truncate text-left focus-visible:ring-3"
          >
            Faktura korygująca do zamówienia z września
          </button>
        </SimpleTooltip>
      </AuditVariant>
      <AuditVariant
        letter="c"
        label="<span> truncate z natywnym title= w chipie filtra (Badge outline pill), kontener w-56"
        sources={['src/components/filters/filter-chip.tsx:28']}
      >
        <div className="flex w-56 min-w-0">
          <Badge
            appearance="outline"
            shape="pill"
            onRemove={() => {}}
            removeLabel="Usuń filtr"
            className="border-input bg-background text-foreground max-w-full shrink-0 font-normal"
          >
            <span className="truncate" title={FILTER_LABEL}>
              {FILTER_LABEL}
            </span>
          </Badge>
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
