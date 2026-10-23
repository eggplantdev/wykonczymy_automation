import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A22ValueChangeGroup() {
  return (
    <AuditGroup
      id="A22"
      title="Zmiana wartości przed → po"
      count="3 wystąpienia w 3 plikach · 3 wersje"
      drift={[
        'Stara wartość przekreślona w 2 kopiach, w podglądzie raportu nie.',
        'Strzałka w wyszarzonym spanie vs osobne niestylowane „ → ” vs brak strzałki (dwie kolumny „Było” / „Jest”).',
        'Nowa wartość: span font-medium vs cała komórka ReadOnlyCellText emphasize.',
        'tabular-nums tylko w tabeli historii; whitespace-nowrap tylko w podglądzie raportu.',
      ]}
      proposal={
        <>
          <code>ValueChange</code> (props: <code>before</code>, <code>after</code>,{' '}
          <code>strike?: boolean</code>) — wyszarzona stara wartość, strzałka, nowa w font-medium z
          tabular-nums; tabela historii może zostać przy dwóch kolumnach, ale z tymi samymi klasami.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="przyrost ilości w raporcie pracownika: strzałka w wyszarzonym spanie, bez przekreślenia"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx:231',
        ]}
      >
        <span className="text-sm">
          <span className="whitespace-nowrap">
            <span className="text-muted-foreground">12,5 → </span>
            <span className="font-medium">18</span>
          </span>
        </span>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="komórka siatki w widoku historii: przekreślona stara, osobne „ → ”, emphasize na całości"
        sources={['src/components/kosztorys/editor/history/history-change-cell.tsx:23']}
      >
        <div className="w-40 text-sm">
          <ReadOnlyCellText emphasize>
            <span className="text-muted-foreground line-through">1200,00</span>
            {' → '}
            1400,00
          </ReadOnlyCellText>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="tabela historii: kolumny „Było” / „Jest”, przekreślenie i tabular-nums, bez strzałki"
        sources={['src/components/kosztorys/editor/history/history-changes-table.tsx:25']}
      >
        <table className="text-sm">
          <tbody>
            <tr>
              <td className="pr-4">
                <span className="text-muted-foreground tabular-nums line-through">1 200,00 zł</span>
              </td>
              <td>
                <span className="font-medium tabular-nums">1 400,00 zł</span>
              </td>
            </tr>
          </tbody>
        </table>
      </AuditVariant>
    </AuditGroup>
  )
}
