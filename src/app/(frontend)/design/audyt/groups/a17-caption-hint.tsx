import { Description } from '@/components/ui/description'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

export function A17CaptionHintGroup() {
  return (
    <AuditGroup
      id="A17"
      title="Podpis, opis i podpowiedź"
      count="31 wystąpień w 24 plikach · 15 wersji"
      drift={[
        'baza: Description vs surowy <p> / <span> / <div> z text-muted-foreground',
        'rozmiar: ustawiony na elemencie (text-xs / text-sm) albo dziedziczony z rodzica text-xs / text-sm',
        'ikona: Info z Description vs withIcon={false} vs brak; InfoTooltip obok etykiety albo na końcu wiersza',
        'szerokość i wcięcie: max-w-xl / max-w-sm / max-w-lg / brak, pl-4, mt-2, -mt-2, text-balance',
        'kolor błędu i ostrzeżenia: Description tone=error vs surowy text-destructive dla tego samego komunikatu o zakresie dat; text-chart-orange zamiast tokenu warning',
        'podtytuł strony: prop description w PageWrapper (bez ikony, mt-1) vs Description jako pierwsze dziecko (ikona, odstęp gap-6)',
      ]}
      proposal={
        <>
          Wszystko na <code>Description</code> (<code>size</code>, <code>tone</code>,{' '}
          <code>withIcon</code>) plus prop <code>hint?</code> renderujący <code>InfoTooltip</code> z
          etykietą „Więcej o: …”; podtytuł strony tylko przez <code>PageWrapper description</code>.
          Szerokość podpisu pod tabelą ustalona w jednym miejscu (np. <code>caption</code> w{' '}
          <code>SummaryTable</code>).
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="surowy <p> text-muted-foreground, rozmiar z rodzica text-sm"
        sources={[
          'src/components/kosztorys/editor/dialogs/preset/reload-from-preset-dialog.tsx:158',
          'src/components/kosztorys/editor/dialogs/preset/reload-from-preset-dialog.tsx:161',
          'src/components/dialogs/link-sheet-to-investment-dialog.tsx:61',
          'src/components/kosztorys/editor/history/history-banner.tsx:38',
          'src/components/kosztorys/editor/history/history-banner.tsx:41',
          'src/components/transfers/duplicate-finder-dialog.tsx:107',
          'src/components/transfers/duplicate-finder-dialog.tsx:122',
          'src/components/telmak-check/telmak-check-dialog.tsx:156',
        ]}
      >
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">Zniknie: 3 sekcje, 42 pozycje</p>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="b"
        label="podtytuł strony jako <Description> — pierwsze dziecko PageWrapper (ikona, gap-6)"
        sources={[
          'src/app/(frontend)/flota/page.tsx:30',
          'src/app/(frontend)/sprzet/page.tsx:34',
          'src/app/(frontend)/zgloszenia/page.tsx:38',
          'src/app/(frontend)/zgloszenia-prac/page.tsx:24',
        ]}
      >
        <PageWrapper title="Flota">
          <Description>12 pojazdów w użyciu</Description>
        </PageWrapper>
      </AuditVariant>

      <AuditVariant
        letter="c"
        label="podpis nad SummaryTable: Description size=xs max-w-xl, z ikoną"
        sources={[
          'src/components/kosztorys/summary/tables/margin-actual-table.tsx:41',
          'src/components/kosztorys/summary/tables/margin-actual-table.tsx:89',
          'src/components/kosztorys/summary/tables/margin-forecast-table.tsx:29',
        ]}
      >
        <Description className="max-w-xl" size="xs">
          Marża rzeczywista to robocizna minus wypłaty dla ekipy i koszty materiałów.
        </Description>
      </AuditVariant>

      <AuditVariant
        letter="d"
        label="podtytuł strony przez prop PageWrapper description (<p> mt-1 text-sm, bez ikony)"
        sources={[
          'src/app/(frontend)/sprzet/[id]/page.tsx:37',
          'src/app/(frontend)/flota/[id]/page.tsx:39',
        ]}
      >
        <PageWrapper title="WX 12345" description="Ford Transit · 2021" />
      </AuditVariant>

      <AuditVariant
        letter="e"
        label="surowy <p> text-muted-foreground pl-4, rozmiar z rodzica text-xs"
        sources={[
          'src/components/kosztorys/editor/dialogs/catalogue/catalogue-missing-list.tsx:65',
          'src/components/work-catalogue/uncatalogued-usage-list.tsx:27',
        ]}
      >
        <div className="space-y-2 text-xs">
          <p className="text-muted-foreground pl-4">może chodzi o:</p>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="f"
        label="<span> text-muted-foreground text-xs gap-1.5 + InfoTooltip"
        sources={[
          'src/components/kosztorys/editor/toolbar/kosztorys-global-settings.tsx:70',
          'src/components/kosztorys/summary/settings/settings-section.tsx:21',
        ]}
      >
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          Mnożnik ceny
          <InfoTooltip
            content="Cena wykonawcy = cena dla inwestora × mnożnik."
            label="Więcej o: mnożnik ceny"
          />
        </span>
      </AuditVariant>

      <AuditVariant
        letter="g"
        label="przypis pod tabelą: Description size=xs bez ikony, bez max-w"
        sources={[
          'src/components/kosztorys/summary/blocks/settlement-summary.tsx:98',
          'src/components/kosztorys/editor/dialogs/catalogue/catalogue-missing-list.tsx:38',
        ]}
      >
        <Description withIcon={false} size="xs">
          Kwoty brutto liczone ze stawką VAT inwestycji.
        </Description>
      </AuditVariant>

      <AuditVariant
        letter="h"
        label="etykieta text-xs, InfoTooltip na końcu wiersza za paskiem postępu"
        sources={['src/components/kosztorys/summary/charts/kosztorys-progress-counter.tsx:22']}
      >
        <div className="flex min-h-8 items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Postęp prac</span>
          <span className="text-muted-foreground text-xs tabular-nums">62%</span>
          <span
            role="progressbar"
            aria-label="Wykonano"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={62}
            className="bg-border h-1.5 w-24 shrink-0 rounded-full"
          >
            <span
              className="from-chart-green via-chart-teal to-chart-turquoise progress-glow block h-full rounded-full bg-linear-to-r transition-[width]"
              style={{ width: '62%' }}
            />
          </span>
          <InfoTooltip
            content="Ile zostało wykonane względem pierwotnych estymat z wyceny projektu"
            label="Więcej o: postęp prac"
          />
        </div>
      </AuditVariant>

      <AuditVariant
        letter="i"
        label="Description sm (ikona Info) + InfoTooltip ml-1 w div text-muted-foreground text-sm"
        sources={['src/components/investments/financial-stats.tsx:117']}
      >
        <div className="text-muted-foreground space-y-1 text-sm">
          <Description>
            Materiały wliczone w robociznę
            <InfoTooltip
              content="Opis pozycji"
              label="Co to jest: Materiały wliczone w robociznę"
              className="ml-1"
            />
          </Description>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="j"
        label="przypis pod tabelą: Description size=xs z ikoną, mt-2 w-fit max-w-sm text-balance"
        sources={['src/components/kosztorys/summary/tabs/summary-deposits-tab.tsx:32']}
      >
        <Description size="xs" className="mt-2 w-fit max-w-sm text-balance">
          Wpłaty bez oznaczonej formy są traktowane jako gotówka.
        </Description>
      </AuditVariant>

      <AuditVariant
        letter="k"
        label="Description tone=error size=xs z ikoną, max-w-lg gap-2 font-semibold"
        sources={['src/components/kosztorys/summary/blocks/settlement-plane-warning.tsx:16']}
      >
        <Description
          tone="error"
          withIcon
          size="xs"
          role="alert"
          className="max-w-lg gap-2 font-semibold"
        >
          2 wpłaty bez potwierdzonej formy — 12 345,67 zł poza rozliczeniem.
        </Description>
      </AuditVariant>

      <AuditVariant
        letter="l"
        label="surowy <span> text-muted-foreground, rozmiar z rodzica text-sm"
        sources={['src/components/transfers/invoice-download-dialog.tsx:111']}
      >
        <div className="text-sm" aria-live="polite">
          <span className="text-muted-foreground">Wybierz zakres dat — obie daty są wymagane.</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="m"
        label="błąd zakresu dat jako surowy <span> text-destructive w rodzicu text-sm"
        sources={['src/components/transfers/invoice-download-dialog.tsx:112']}
      >
        <div className="text-sm" aria-live="polite">
          <span className="text-destructive">Data „Od” jest późniejsza niż „Do”.</span>
        </div>
      </AuditVariant>

      <AuditVariant
        letter="n"
        label="ten sam błąd zakresu dat jako Description tone=error"
        sources={['src/components/transfers/duplicate-finder-dialog.tsx:126']}
      >
        <Description tone="error">Nieprawidłowy zakres dat</Description>
      </AuditVariant>

      <AuditVariant
        letter="o"
        label="ostrzeżenie pod polem: surowy <p> text-chart-orange -mt-2 text-xs"
        sources={['src/components/forms/inspection-form/inspection-form.tsx:195']}
      >
        <p className="text-chart-orange -mt-2 text-xs">
          Ostatni zapisany przebieg to 120 000 km — wpisany odczyt jest niższy.
        </p>
      </AuditVariant>

      <AuditVariant
        letter="W"
        label="wzorzec: Description — rozmiary sm / xs / 2xs i tony muted / warning / error"
        sources={['src/components/ui/description.tsx']}
      >
        <div className="flex flex-col gap-2">
          <Description>sm · muted · z ikoną</Description>
          <Description withIcon={false}>sm · muted · bez ikony</Description>
          <Description size="xs">xs · muted · z ikoną</Description>
          <Description size="2xs">2xs · muted · z ikoną</Description>
          <Description size="xs" tone="warning">
            xs · warning
          </Description>
          <Description tone="error">sm · error (domyślnie bez ikony)</Description>
          <Description size="xs" tone="error" withIcon>
            xs · error · z ikoną
          </Description>
        </div>
      </AuditVariant>
    </AuditGroup>
  )
}
