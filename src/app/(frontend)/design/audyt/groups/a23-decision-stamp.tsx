import { Description } from '@/components/ui/description'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A23DecisionStampGroup() {
  return (
    <AuditGroup
      id="A23"
      title="Kto i kiedy zdecydował"
      count="4 wystąpienia w 4 plikach · 3 wersje"
      drift={[
        'Format: „data · osoba” vs „sprawdzono data (osoba)” w przeglądzie raportu w kosztorysie.',
        'Brak decyzji: „—” w tabelach vs linia znika w podglądzie raportu i w przeglądzie.',
        'Opakowanie: goły tekst w komórce vs wyszarzony span z prefiksem „Weryfikował:” vs doklejony do Description size="xs".',
      ]}
      proposal={
        <>
          Przegląd raportu w kosztorysie przechodzi na <code>formatDecision</code> i ten sam format
          „data · osoba”.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="komórka tabeli: goły tekst „data · osoba”, „—” bez decyzji"
        sources={[
          'src/components/tables/worker-reports.tsx:79',
          'src/components/tables/expense-drafts.tsx:190',
        ]}
      >
        <div className="flex flex-col gap-1 text-sm">
          <span>20.10.2026, 14:32 · Anna Nowak</span>
          <span>—</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="podgląd raportu: wyszarzony span „Weryfikował: data · osoba”, bez decyzji linia znika"
        sources={['src/components/worker-reports/report-preview-dialog.tsx:36']}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-muted-foreground">Weryfikował: 20.10.2026, 14:32 · Anna Nowak</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="przegląd raportu w kosztorysie: „ · sprawdzono data (osoba)” doklejone w Description xs"
        sources={[
          'src/components/kosztorys/editor/dialogs/worker-reports/worker-report-review.tsx:315',
        ]}
      >
        <Description withIcon={false} size="xs">
          Wysłano 19.10.2026, 18:05 · sprawdzono 20.10.2026, 14:32 (Anna Nowak)
        </Description>
      </AuditVariant>
    </AuditGroup>
  )
}
