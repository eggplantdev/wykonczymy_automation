import { InfoList } from '@/components/ui/info-list'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

const LEAD_ANSWERS = [
  { label: 'Zakres prac', value: 'Remont łazienki\nok. 6 m², wymiana płytek' },
  { label: 'Termin rozpoczęcia', value: 'Listopad 2026' },
  { label: 'Budżet', value: '30 000 – 40 000 zł' },
]

export function A25LabelValueListGroup() {
  return (
    <AuditGroup
      id="A25"
      title="Lista etykieta–wartość"
      count="5 wystąpień w 4 plikach · 2 wersje + wzorzec InfoList"
      drift={[
        'dwa ręczne <dl>: siatka grid-cols-[auto_1fr] gap-x-2 z truncate vs wiersze divide-y z kolumną etykiety sm:grid-cols-[12rem_1fr]',
        'żaden ręczny <dt> nie ma font-medium, które daje InfoList; odstęp kolumn gap-x-2 / sm:gap-4 vs gap-x-4',
        'text-foreground na <dd> tylko w zgłoszeniach; w nagłówku raportu brak',
      ]}
      proposal={
        <>
          Zostać przy <code>InfoList</code>: dodać mu <code>truncate</code> (nagłówek raportu) i
          układ <code>layout=&quot;divided&quot;</code> ze stałą kolumną etykiety (zgłoszenia).
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="ręczny <dl>: siatka gap-x-2, <dd> z truncate, bez font-medium"
        sources={['src/components/kosztorys/worker-report/branded-header.tsx:22']}
      >
        <div className="w-56 min-w-0">
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-sm">
            <dt className="text-muted-foreground">Inwestycja</dt>
            <dd className="min-w-0 truncate">Mieszkanie Kowalskich, ul. Długa 12/4, Kraków</dd>
            <dt className="text-muted-foreground">Pracownik</dt>
            <dd className="min-w-0 truncate">Jan Kowalski</dd>
          </dl>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="b"
        label="ręczny <dl>: wiersze divide-y, kolumna etykiety 12rem od sm:, whitespace-pre-line"
        sources={['src/components/leads/lead-answers-dialog.tsx:31']}
      >
        <dl className="divide-border divide-y text-sm">
          {LEAD_ANSWERS.map((answer) => (
            <div key={answer.label} className="grid gap-1 py-2 sm:grid-cols-[12rem_1fr] sm:gap-4">
              <dt className="text-muted-foreground break-words">{answer.label}</dt>
              <dd className="text-foreground break-words whitespace-pre-line">{answer.value}</dd>
            </div>
          ))}
        </dl>
      </AuditVariant>
      <AuditVariant
        letter="c"
        label="wzorzec — InfoList (inline i stacked)"
        sources={[
          'src/app/(frontend)/kasa/[id]/page.tsx:67',
          'src/app/(frontend)/flota/[id]/page.tsx:45',
          'src/app/(frontend)/flota/[id]/page.tsx:54',
          'src/app/(frontend)/pracownicy/[id]/page.tsx:158',
          'src/app/(frontend)/sprzet/[id]/page.tsx:38',
          'src/components/investments/investment-overview.tsx:61',
          'src/app/(frontend)/kasa/[id]/page.tsx:56',
          'src/app/(frontend)/sprzet/[id]/page.tsx:68',
          'src/app/(frontend)/sprzet/[id]/page.tsx:66',
        ]}
      >
        <div className="flex flex-col gap-4">
          <InfoList
            items={[
              { label: 'VIN', value: 'WVWZZZ1KZ6W000001' },
              { label: 'Opony', value: 'Zimowe, 2025' },
              { label: 'Uwagi', value: '' },
            ]}
          />
          <InfoList
            layout="stacked"
            items={[
              { label: 'Od wymiany oleju do ostatniego odczytu przejechano:', value: '8 450 km' },
            ]}
          />
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
