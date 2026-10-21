import { Check, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BADGE_BORDER_CLASS } from '@/components/ui/badge-border'
import { Button } from '@/components/ui/button'
import { DotBadge } from '@/components/ui/dot-badge'
import { CARD_LIST_CLASS, CARD_SHELL_CLASS } from '@/components/ui/panel'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A21MoneyCardGroup() {
  return (
    <AuditGroup
      id="A21"
      title="Karta kwoty na telefonie"
      count="4 wystąpienia w 3 plikach · 4 wersje"
      drift={[
        'Odstępy karty: px-4 py-3 gap-2 (transakcja) vs p-4 gap-3 (paragon); tylko paragon ma CARD_SHELL_CLASS.',
        'Nagłówek: text-xs z #id i datą vs nazwa inwestycji text-sm font-medium z datą ml-auto text-xs.',
        'Kwota: text-lg font-semibold z tabular-nums (paragon) i bez (transakcja); w tabeli font-medium bez tabular-nums.',
        'Kwota netto pod spodem: w kolumnie (flex-col, tabela) vs w tej samej linii (items-baseline gap-2, karta).',
        'Anulowanie: karta dodaje line-through na kwocie, tabela zostawia to wierszowi; opis: break-words tylko w paragonie.',
        'Kolumna kwoty w tabeli transakcji nie ma meta.align: right — kwoty stoją do lewej.',
      ]}
      proposal={
        <>
          <code>MoneyCard</code> z częściami <code>Meta</code> (lewa strona + data),{' '}
          <code>Amount</code> i <code>Description</code> oraz <code>TransferAmount</code> (props:{' '}
          <code>{"size: 'cell' | 'card'"}</code>, <code>colored</code>, <code>net</code>) — zawsze
          tabular-nums i jedna reguła pokazywania netto.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="karta transakcji (lista mobilna) — przyciski akcji w stopce pominięte"
        sources={['src/components/transfers/cards/transfer-card.tsx:42']}
      >
        <div className={cn(CARD_LIST_CLASS, 'w-full')}>
          <article className="flex flex-col gap-2 px-4 py-3">
            <header className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">#4821</span>
              <span className="text-muted-foreground ml-auto">20.10.2026</span>
            </header>
            <div className="flex items-center justify-between gap-1.5">
              <DotBadge color="section-red">Wydatek inwestycyjny</DotBadge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn('text-lg font-semibold', 'text-section-red')}>1 230,00 zł</span>
              <span className="text-muted-foreground text-xs">netto 1 000,00 zł</span>
            </div>
            <div className="text-muted-foreground truncate text-sm">Mieszkanie Mokotów</div>
            <p className="line-clamp-3 text-sm whitespace-pre-line">
              Płytki łazienkowe i klej, Castorama
            </p>
            <div className="flex flex-wrap gap-1">
              <Badge
                appearance="outline"
                className={cn('max-w-full gap-1 font-normal', BADGE_BORDER_CLASS['chart-blue'])}
              >
                <span className="text-muted-foreground shrink-0">Kasa źródłowa:</span>
                <span className="truncate">Kasa Jana</span>
              </Badge>
              <Badge
                appearance="outline"
                className={cn('max-w-full gap-1 font-normal', BADGE_BORDER_CLASS['chart-purple'])}
              >
                <span className="text-muted-foreground shrink-0">Typ wydatku:</span>
                <span className="truncate">Materiały budowlane</span>
              </Badge>
            </div>
          </article>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="karta paragonu do potwierdzenia"
        sources={['src/components/receipt-confirmation/receipts-to-confirm.tsx:53']}
      >
        <ul className={CARD_LIST_CLASS}>
          <li className={cn('flex flex-col gap-3 p-4', CARD_SHELL_CLASS)}>
            <header className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 truncate text-sm font-medium">Mieszkanie Mokotów</span>
                <span className="text-muted-foreground ml-auto shrink-0 text-xs">20.10.2026</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold tabular-nums">1 230,00 zł</span>
                <div className="ml-auto shrink-0">
                  <Badge tone="pending">Czeka na potwierdzenie</Badge>
                </div>
              </div>
            </header>
            <p className="line-clamp-3 text-sm break-words whitespace-pre-line">
              Płytki łazienkowe i klej, Castorama
            </p>
            <div className="mt-1 grid auto-cols-fr grid-flow-col gap-2">
              <Button variant="greenOutline" size="touch">
                <Check />
                Potwierdzam
              </Button>
              <Button variant="destructiveOutline" size="touch">
                <Trash2 />
                Odrzuć
              </Button>
            </div>
          </li>
        </ul>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="kwota z netto w komórce tabeli transakcji (bez wyrównania do prawej)"
        sources={['src/components/tables/transfers.tsx:80']}
      >
        <div className="flex flex-col items-start gap-2">
          <span className={cn('flex flex-col font-medium', 'text-section-red')}>
            1 111,11 zł
            <span className="text-muted-foreground text-xs">netto 903,34 zł</span>
          </span>
          <span className={cn('flex flex-col font-medium', 'text-section-red')}>88,00 zł</span>
          <span className={cn('flex flex-col font-medium', 'text-section-red')}>
            12 345,67 zł
            <span className="text-muted-foreground text-xs">netto 10 037,13 zł</span>
          </span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="kwota z netto w karcie transakcji (anulowana: line-through)"
        sources={['src/components/transfers/cards/transfer-card.tsx:61']}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <span className={cn('text-lg font-semibold', 'text-section-red')}>1 230,00 zł</span>
            <span className="text-muted-foreground text-xs">netto 1 000,00 zł</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-lg font-semibold', 'line-through')}>88,00 zł</span>
          </div>
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
