'use client'

import { WandSparkles } from 'lucide-react'
import { BUTTON_ANIMATION_CLASSES, Button } from '@/components/ui/button'
import { CheckboxRow } from '@/components/ui/checkbox-row'
import * as Collapsible from '@/components/ui/collapsible'
import { cn } from '@/lib/utils/cn'
import { AuditGroup } from '../audit-group'
import { AuditVariant } from '../audit-variant'

function ToolbarAiToggle({ aiReview }: { aiReview: boolean }) {
  return (
    <Button size="sm" variant="outline" aria-pressed={aiReview} className="relative">
      <span
        aria-hidden
        className={cn(
          'gradient-border neon-glow-duo pointer-events-none absolute -inset-px rounded-[inherit] transition-opacity duration-300',
          aiReview
            ? [BUTTON_ANIMATION_CLASSES.comet, BUTTON_ANIMATION_CLASSES.breathe, 'opacity-100']
            : 'opacity-0',
        )}
      />
      <WandSparkles
        className={cn('relative transition-colors duration-300', aiReview && 'text-neon-cyan')}
      />
      <span className={cn('relative transition-colors duration-300', aiReview && 'text-neon-cyan')}>
        Przegląd AI
      </span>
    </Button>
  )
}

export function A06AiButtonGroup() {
  return (
    <AuditGroup
      id="A06"
      title="Przycisk AI"
      count="11 wystąpień w 9 plikach · 9 wersji"
      drift={[
        'wariant ai sam nie koloruje ikony ani etykiety — każde miejsce dopisuje text-neon-cyan ręcznie; przełącznik „Podsumowanie” ma wariant ai bez cyjanu, nagłówek tabeli ma cyjan bez wariantu',
        'font-semibold na etykiecie w 7 miejscach, brak w przełączniku „Przegląd AI” i w checkboksie; saldo dokleja tabular-nums',
        'rozmiar sm albo domyślny; doklejone max-sm:col-span-2, sm:mt-6, w-full',
        'przełącznik w pasku kosztorysu odbudowuje cały wygląd ai (gradient-border, neon-glow-duo, animacje) jako warstwę na przycisku outline',
        'ten sam układ ikona + etykieta skopiowany do DropdownMenuItem i CheckboxRow variant="ai" (tu ikona z ręcznym size-4, etykieta bez koloru)',
        'po fazie 1: a zostaje osobno — wspólny AiLabel nie wchodzi bez zmiany, bo Button z pending podmienia pierwsze dziecko-komponent na spinner i w trakcie znikałaby cała etykieta (fill-catalogue-translations-button, line-items-field:421)',
      ]}
      proposal={
        <>
          Wariant <code>ai</code> w <code>ui/button.tsx</code> sam koloruje ikonę i etykietę (cyjan
          + semibold), a dla menu i checkboksa wspólny <code>AiLabel</code> (props:{' '}
          <code>children</code>, <code>icon?</code> domyślnie <code>WandSparkles</code>);
          przełącznik dostaje prop <code>pressed</code> zamiast własnej warstwy.
        </>
      }
    >
      <AuditVariant
        letter="a"
        label="ai sm + max-sm:col-span-2, ikona i etykieta cyjan semibold"
        sources={[
          'src/components/work-catalogue/fill-catalogue-translations-button.tsx:28',
          'src/components/worker-reports/scan-report-button.tsx:35',
        ]}
      >
        <Button size="sm" variant="ai" className="max-sm:col-span-2">
          <WandSparkles className="text-neon-cyan" />
          <span className="text-neon-cyan font-semibold">Uzupełnij tłumaczenia (AI) · 12</span>
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="b"
        label="ai sm bez dodatkowych klas"
        sources={[
          'src/components/forms/expense-form/line-items-field.tsx:416',
          'src/components/forms/expense-form/line-items-field.tsx:430',
        ]}
      >
        <Button type="button" variant="ai" size="sm">
          <WandSparkles className="text-neon-cyan" />
          <span className="text-neon-cyan font-semibold">Wygeneruj z paragonów</span>
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="c"
        label="ai, domyślny rozmiar + sm:mt-6"
        sources={['src/components/forms/expense-form/line-items-field.tsx:260']}
      >
        <Button type="button" variant="ai" className="sm:mt-6">
          <WandSparkles className="text-neon-cyan" />
          <span className="text-neon-cyan font-semibold">Odczytaj ponownie</span>
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="d"
        label="ai sm disabled w-full, etykieta + tabular-nums (saldo w menu)"
        sources={['src/components/nav/nav-openrouter-balance.tsx:18']}
      >
        <span className="block">
          <Button disabled type="button" variant="ai" size="sm" className="w-full">
            <WandSparkles className="text-neon-cyan" />
            <span className="text-neon-cyan font-semibold tabular-nums">Saldo $12.34</span>
          </Button>
        </span>
      </AuditVariant>
      <AuditVariant
        letter="e"
        label="kopia w DropdownMenuItem — tylko wnętrze w zwykłym div z klasami układu pozycji menu (bez Radix)"
        sources={['src/components/kosztorys/editor/actions/scan-report-action.tsx:12']}
      >
        <div className="relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
          <WandSparkles className="text-neon-cyan" />
          <span className="text-neon-cyan font-semibold">Wczytaj zgłoszenie z kartki (AI)</span>
        </div>
      </AuditVariant>
      <AuditVariant
        letter="f"
        label="CheckboxRow variant ai, ikona size-4, etykieta bez koloru"
        sources={['src/components/forms/form-components/ai-translate-checkbox.tsx:14']}
      >
        <CheckboxRow variant="ai" className="w-fit" checked onCheckedChange={() => {}}>
          <WandSparkles className="text-neon-cyan size-4" />
          Tłumacz automatycznie przy pomocy AI
        </CheckboxRow>
      </AuditVariant>
      <AuditVariant
        letter="g"
        label="przełącznik outline sm z własną warstwą ai — wyłączony i włączony"
        sources={['src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx:116']}
      >
        <div className="flex flex-wrap gap-2">
          <ToolbarAiToggle aiReview={false} />
          <ToolbarAiToggle aiReview />
        </div>
      </AuditVariant>
      <AuditVariant
        letter="h"
        label="ai sm + animacje comet/breathe, chevron, etykieta bez cyjanu"
        sources={['src/components/kosztorys/summary/kosztorys-totals-panel-toggle.tsx:20']}
      >
        <Button size="sm" aria-expanded={false} variant="ai" animations={['comet', 'breathe']}>
          <Collapsible.Chevron open={false} />
          Podsumowanie
        </Button>
      </AuditVariant>
      <AuditVariant
        letter="i"
        label="sam cyjanowy tekst bez ikony i wariantu (nagłówek kolumny)"
        sources={['src/components/tables/investments.tsx:127']}
      >
        <span className="text-neon-cyan">Analiza AI</span>
      </AuditVariant>
    </AuditGroup>
  )
}
