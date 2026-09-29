'use client'

import { FileText } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { toastMessage } from '@/lib/utils/toast'
import { openPrintWindow, writeAndPrint } from '@/lib/utils/print-window'
import { buildOfferPrintHtml } from '@/lib/kosztorys/print/offer'
import { documentRows } from '@/lib/kosztorys/print/document-rows'
import { resolveSectionFills } from '@/lib/kosztorys/print/section-fills'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view/settings'
import { readClientViewSettings } from '@/lib/queries/client-view-settings-endpoint'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

// Reads `rows`, not `viewRows`: an offer is the whole scope, and whatever search or plane filter the
// owner left on the grid is not a decision about what the client is being offered. What IS such a
// decision — which columns and which pozycje a client may see — is the stored client-view settings,
// so the offer reads them rather than answering the question a second time.
export function GenerateOfferMenuItem() {
  const { investmentId, rows, stages, investmentName, columnTotals, sectionColumnTotals } =
    useKosztorysEditorContext()
  // „Ustawienia podglądu…" already holds these settings; the print joins it instead of firing a
  // second independent read of the same row.
  const { investor } = useKosztorysActions()

  function handlePrint() {
    if (rows.length === 0) {
      toastMessage('Brak pozycji do wydruku', 'info')
      return
    }
    // Opened synchronously with the click, and only filled once the settings land: an await before
    // window.open spends the user activation it needs and the popup is blocked.
    const target = openPrintWindow(investmentName)
    if (!target) {
      toastMessage('Przeglądarka zablokowała okno wydruku', 'error')
      return
    }
    const fillByColorKey = resolveSectionFills()
    // Both figures come from the editor's own memos — the paper prints the application's number, it
    // does not re-add the rows. Safe despite the print's own row filter: the only condition it applies
    // is `client-empty`, a pozycja empty on both axes, which contributes zero to either sum.
    const totalNet = columnTotals.get('plannedNet') ?? 0
    const sectionNetById = new Map(
      [...sectionColumnTotals].flatMap(([sectionId, totals]) => {
        const net = totals.get('plannedNet')
        return net === undefined ? [] : [[sectionId, net] as const]
      }),
    )

    const fill = (settings: ClientViewSettingsT) => {
      // The `rows.length` guard above cannot answer this: the offer is the rows the CLIENT's hider
      // leaves standing, and a kosztorys whose every pozycja is empty on both axes survives it only
      // to print a branded header over an empty table.
      if (documentRows(rows, stages, settings.hideEmptyRows).length === 0) {
        target.close()
        toastMessage('Brak pozycji do wydruku — wszystkie są puste', 'info')
        return
      }
      writeAndPrint(
        target,
        buildOfferPrintHtml({
          rows,
          stages,
          settings,
          investmentName,
          logoUrl: `${window.location.origin}/logo-wykonczymy.png`,
          fillByColorKey,
          totalNet,
          sectionNetById,
        }),
      )
    }

    // Both branches route their failure here, and they report DIFFERENT failures: a throw out of
    // `fill` is the document, not the read that fed it — attributing it to „nie udało się odczytać
    // ustawień" sends the owner to look at settings that loaded fine. The fast branch had no guard at
    // all, so a popup closed between the click and this line leaked an empty window with no toast.
    const render = (settings: ClientViewSettingsT) => {
      try {
        fill(settings)
      } catch {
        target.close()
        toastMessage('Nie udało się przygotować wydruku', 'error')
      }
    }

    if (investor.clientView) {
      render(investor.clientView)
      return
    }
    void readClientViewSettings(investmentId)
      .catch(() => {
        target.close()
        toastMessage('Nie udało się odczytać ustawień podglądu', 'error')
        return null
      })
      .then((read) => {
        if (read) render(read.settings)
      })
  }

  return (
    <DropdownMenuItem onSelect={handlePrint}>
      <FileText />
      <MenuItemBody
        label="Wygeneruj ofertę w PDF"
        description="Otwiera okno wydruku — zapisz jako PDF lub drukuj."
      />
    </DropdownMenuItem>
  )
}
