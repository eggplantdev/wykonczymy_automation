import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { toastMessage } from '@/lib/utils/toast'
import { openPrintWindow, writeAndPrint } from '@/lib/utils/print-window'
import { buildOfferPrintHtml } from '@/lib/kosztorys/print/offer'
import { documentRows } from '@/lib/kosztorys/print/document-rows'
import { resolveSectionFills } from '@/lib/kosztorys/print/section-fills'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view/settings'

// Reads `rows`, not `viewRows`: an offer is the whole scope. The settings read may only start once the
// window is open, or its rejection goes unhandled on an early return.
export function useOfferPrint() {
  const { rows, stages, investmentName, columnTotals, sectionColumnTotals } =
    useKosztorysEditorContext()

  return (settings: ClientViewSettingsT | (() => Promise<ClientViewSettingsT>)) => {
    if (rows.length === 0) {
      toastMessage('Brak pozycji do wydruku', 'info')
      return
    }
    // Opened synchronously with the click: an await before
    // window.open spends the user activation it needs and the popup is blocked.
    const target = openPrintWindow(investmentName)
    if (!target) {
      toastMessage('Przeglądarka zablokowała okno wydruku', 'error')
      return
    }
    const fillByColorKey = resolveSectionFills()

    const fill = (resolved: ClientViewSettingsT) => {
      if (documentRows(rows, stages, resolved.hideEmptyRows).length === 0) {
        target.close()
        toastMessage('Brak pozycji do wydruku — wszystkie są puste', 'info')
        return
      }
      writeAndPrint(
        target,
        buildOfferPrintHtml({
          rows,
          stages,
          settings: resolved,
          investmentName,
          logoUrl: `${window.location.origin}/logo-wykonczymy.png`,
          fillByColorKey,
          // Safe despite the print's own row filter: the only condition it applies
          // is `client-empty`, a pozycja empty on both axes, which contributes zero to either sum.
          columnTotals,
          sectionColumnTotals,
        }),
      )
    }

    const render = (resolved: ClientViewSettingsT) => {
      try {
        fill(resolved)
      } catch {
        target.close()
        toastMessage('Nie udało się przygotować wydruku', 'error')
      }
    }

    if (typeof settings !== 'function') {
      render(settings)
      return
    }
    void settings()
      .catch(() => {
        target.close()
        toastMessage('Nie udało się odczytać ustawień podglądu', 'error')
        return null
      })
      .then((read) => {
        if (read) render(read)
      })
  }
}
