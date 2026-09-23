'use client'

import { FileText } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { toastMessage } from '@/lib/utils/toast'
import { openPrintWindow, printThenClose } from '@/lib/utils/print-window'
import { buildOfferPrintHtml } from '@/lib/kosztorys/build-offer-print-html'
import { SECTION_COLORS } from '@/lib/kosztorys/section-colors'
import { clientViewSettingsForMode } from '@/lib/kosztorys/client-view-settings'
import { readClientViewSettings } from '@/lib/queries/client-view-settings-endpoint'

/**
 * The palette lives in globals.css as `color-mix()` over the chart hues, and the print popup is a
 * document of its own with no stylesheet — so each section colour is resolved here, against the app's
 * own root, rather than duplicated as hex the two files could drift on.
 */
function resolveSectionFills(): Record<string, string> {
  const probe = document.createElement('div')
  probe.style.display = 'none'
  document.body.append(probe)
  try {
    return Object.fromEntries(
      SECTION_COLORS.map(({ key, fill }) => {
        probe.style.backgroundColor = fill
        return [key, getComputedStyle(probe).backgroundColor]
      }),
    )
  } finally {
    probe.remove()
  }
}

// Reads `rows`, not `viewRows`: an offer is the whole scope, and whatever search or plane filter the
// owner left on the grid is not a decision about what the client is being offered. What IS such a
// decision — which columns and which pozycje a client may see — is the stored client-view config, so
// the offer reads it rather than answering the question a second time.
export function GenerateOfferMenuItem() {
  const { investmentId, rows, stages, investmentName, columnTotals, sectionColumnTotals } =
    useKosztorysEditorContext()

  function handlePrint() {
    if (rows.length === 0) {
      toastMessage('Brak pozycji do wydruku', 'info')
      return
    }
    // Opened synchronously with the click, and only filled once the settings land: an await before
    // window.open spends the user activation it needs and the popup is blocked.
    const printWindow = openPrintWindow(investmentName)
    if (!printWindow) {
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

    void readClientViewSettings(investmentId)
      .then((config) => {
        printWindow.document.write(
          buildOfferPrintHtml({
            rows,
            stages,
            settings: clientViewSettingsForMode(config),
            investmentName,
            logoUrl: `${window.location.origin}/logo-wykonczymy.png`,
            fillByColorKey,
            totalNet,
            sectionNetById,
          }),
        )
        printWindow.document.close()
        // Waits on the LOGO, not on the document: a `document.write`-built page reports `complete` the
        // moment it is closed, so printing on readyState fires before the image is off the network and
        // every page gets a blank box where the mark should be. `error` resolves too — a missing logo is
        // not a reason to withhold the offer.
        const logo = printWindow.document.querySelector('img')
        if (!logo || logo.complete) printThenClose(printWindow)
        else {
          const print = () => printThenClose(printWindow)
          logo.addEventListener('load', print, { once: true })
          logo.addEventListener('error', print, { once: true })
        }
      })
      .catch(() => {
        printWindow.close()
        toastMessage('Nie udało się odczytać ustawień podglądu', 'error')
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
