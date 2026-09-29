import { WarningBanner } from '@/components/ui/warning-banner'

// At VAT 0% every prace figure grosses to itself, so netto and brutto print the same złoty and the
// panel reads as broken rather than as VAT-free — that misreading has already cost a bug hunt. What
// it does NOT mean is that the settlement mode is inert (EX-590): Mieszane still splits the panel and
// doubles the grid's columns, and the materiały netto rate never depended on VAT. So the banner names
// the flattened figures, not the control. It sits beside the mode select — the pinned control the
// reader is clicking when nothing moves — rather than by the VAT field, which is one tab deep.
export function ZeroVatWarning() {
  return (
    <WarningBanner>
      VAT 0% — brutto = netto, więc obie kwoty będą takie same, dopóki nie ustawisz stawki VAT. Sam
      sposób rozliczenia nadal zmienia układ podsumowania i naliczanie materiałów.
    </WarningBanner>
  )
}
