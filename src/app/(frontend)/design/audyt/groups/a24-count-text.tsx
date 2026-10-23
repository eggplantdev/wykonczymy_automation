import { Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A24CountTextGroup() {
  return (
    <AuditGroup
      id="A24"
      title="Licznik w tekście"
      count="13 wystąpień w 9 plikach · 9 wersji"
      drift={[
        'Zapis „x / y” vs „x/y” vs „x z y” vs „x z y plików.” — cztery formaty tego samego „ile z ilu”.',
        'Kolor: wyszarzony (Description, muted span) vs domyślny (p.text-sm, statystyki z <b>).',
        'Wyróżnienie liczby: <b> vs <strong> vs brak; jedna statystyka ma warunkowy text-destructive.',
        'Tag: Description (p) vs span vs p.text-sm; rozmiar text-sm vs text-xs.',
        'Licznik załączników: goły span z ikoną size-3 vs Button outline xs min-w-12 z ikoną domyślną.',
      ]}
      proposal={
        <>
          <code>CountText</code> (props: <code>label</code>, <code>shown</code>, <code>total?</code>
          ) z jednym zapisem „x z y” na <code>Description</code>, <code>InlineStat</code> (
          <code>label</code>, <code>value</code>, <code>tone?</code>) z jednym wyróżnieniem liczby i{' '}
          <code>AttachmentCount</code> (<code>count</code>, <code>onClick?</code>).
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="licznik widocznych nad tabelą: Description „Widoczne X x / y”"
        sources={[
          'src/components/investments/investment-data-table.tsx:84',
          'src/components/users/user-data-table.tsx:62',
          'src/components/work-catalogue/work-catalogue-data-table.tsx:185',
        ]}
      >
        <Description withIcon={false}>Widoczne inwestycje 12 / 48</Description>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="statystyka „Etykieta: <b>n</b>” w spanie, domyślny kolor"
        sources={[
          'src/components/telmak-check/telmak-check-dialog.tsx:194',
          'src/components/telmak-check/telmak-check-dialog.tsx:197',
          'src/components/telmak-check/telmak-check-dialog.tsx:200',
        ]}
      >
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span>
            Faktur w paczce: <b>24</b>
          </span>
          <span>
            Wydatków w aplikacji w zakresie: <b>22</b>
          </span>
          <span>
            Zgodne: <b>20</b>
          </span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="ta sama statystyka z warunkowym text-destructive"
        sources={['src/components/telmak-check/telmak-check-dialog.tsx:203']}
      >
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-destructive">
            Rozjazdy: <b>4</b>
          </span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="podgląd synchronizacji: liczby w <strong> w jednym Description xs, łączone „·”"
        sources={['src/components/sheets/sync-button.tsx:148']}
      >
        <div className="space-y-4 text-sm">
          <Description withIcon={false} size="xs">
            Transfery — do dodania: <strong>5</strong> · do odświeżenia: <strong>2</strong> · do
            usunięcia: <strong>0</strong>
          </Description>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="„Przejdą do inwestycji: x z y” w Description"
        sources={['src/components/leads/promote-lead-dialog.tsx:94']}
      >
        <Description withIcon={false}>Przejdą do inwestycji: 3 z 5</Description>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="postęp odczytu zdjęć: wyszarzony span „Odczytano x/y”"
        sources={['src/components/forms/expense-form/line-items-field.tsx:444']}
      >
        <span className="text-muted-foreground self-center text-sm">Odczytano 3/5</span>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="postęp odczytu paczki: p.text-sm w domyślnym kolorze „Odczytano x z y plików.”"
        sources={['src/components/telmak-check/telmak-check-dialog.tsx:183']}
      >
        <p className="text-sm">Odczytano 3 z 5 plików.</p>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="licznik załączników w historii przeglądów: span z ikoną size-3"
        sources={['src/components/fleet/inspection-history.tsx:82']}
      >
        <span className="inline-flex items-center gap-1">
          <Paperclip className="size-3" />2
        </span>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="licznik załączników leada: Button outline xs min-w-12, ikona domyślna"
        sources={['src/components/leads/lead-assets-dialog.tsx:122']}
      >
        <Button variant="outline" size="xs" className="min-w-12" aria-label="Załączniki (2)">
          <Paperclip />2
        </Button>
      </AuditVariant>
    </AuditGroup>
  )
}
