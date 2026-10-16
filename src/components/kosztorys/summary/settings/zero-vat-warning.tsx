import { WarningBanner } from '@/components/ui/warning-banner'

export function ZeroVatWarning() {
  return (
    <WarningBanner>
      VAT 0% — brutto = netto, więc obie kwoty będą takie same, dopóki nie ustawisz stawki VAT. Sam
      sposób rozliczenia nadal zmienia układ podsumowania i naliczanie materiałów.
    </WarningBanner>
  )
}
