'use client'

import { FileText } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { toastMessage } from '@/lib/utils/toast'
import { openPrintWindow, printThenClose } from '@/lib/utils/print-window'
import { buildOfferPrintHtml, offeredRows } from '@/lib/kosztorys/build-offer-print-html'
import { SECTION_COLORS } from '@/lib/kosztorys/section-colors'
import type { ClientViewConfigT } from '@/lib/kosztorys/client-view-settings'
import { readClientViewSettings } from '@/lib/queries/client-view-settings-endpoint'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

/**
 * The palette lives in globals.css as `color-mix()` over the chart hues, and the print popup is a
 * document of its own with no stylesheet — so each section colour is resolved here, against the app's
 * own root, rather than duplicated as hex the two files could drift on.
 */
function resolveSectionFills(): ReadonlyMap<string, string> {
  const probe = document.createElement('div')
  probe.style.display = 'none'
  document.body.append(probe)
  try {
    return new Map(
      SECTION_COLORS.map(({ key, fill }) => {
        probe.style.backgroundColor = fill
        return [key, getComputedStyle(probe).backgroundColor] as const
      }),
    )
  } finally {
    probe.remove()
  }
}

// A hung logo request fires neither `load` nor `error`, and the print dialog waits on one of them —
// so without a bound the popup sits there empty with nothing to tell the user. The offer prints
// without its mark rather than not at all, which is the same call the `error` listener makes.
const LOGO_WAIT_MS = 4000

// Reads `rows`, not `viewRows`: an offer is the whole scope, and whatever search or plane filter the
// owner left on the grid is not a decision about what the client is being offered. What IS such a
// decision — which columns and which pozycje a client may see — is the stored client-view config, so
// the offer reads it rather than answering the question a second time.
export function GenerateOfferMenuItem() {
  const { investmentId, rows, stages, investmentName, columnTotals, sectionColumnTotals } =
    useKosztorysEditorContext()
  // „Ustawienia podglądu…" and „Udostępnij" already hold this config; the print joins them instead of
  // firing a third independent read of the same row.
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

    const fill = (config: ClientViewConfigT) => {
      // The `rows.length` guard above cannot answer this: the offer is the rows the CLIENT's hider
      // leaves standing, and a kosztorys whose every pozycja is empty on both axes survives it only
      // to print a branded header over an empty table.
      if (offeredRows(rows, stages, config.variants.OFFER).length === 0) {
        target.close()
        toastMessage('Brak pozycji do wydruku — wszystkie są puste', 'info')
        return
      }
      target.document.write(
        buildOfferPrintHtml({
          rows,
          stages,
          // Always the OFFER variant, never the active mode. The menu item says „Wygeneruj ofertę", and
          // an investment left in ROZLICZENIE would otherwise lay that mode's hidden set over the
          // offer's column list and silently print whatever survived — a set nobody ever saw.
          settings: config.variants.OFFER,
          investmentName,
          logoUrl: `${window.location.origin}/logo-wykonczymy.png`,
          fillByColorKey,
          totalNet,
          sectionNetById,
        }),
      )
      target.document.close()
      // Waits on the LOGO, not on the document: a `document.write`-built page reports `complete` the
      // moment it is closed, so printing on readyState fires before the image is off the network and
      // every page gets a blank box where the mark should be. `error` resolves too — a missing logo is
      // not a reason to withhold the offer.
      const logo = target.document.querySelector('img')
      if (!logo || logo.complete) printThenClose(target)
      else {
        let printed = false
        const print = () => {
          if (printed) return
          printed = true
          printThenClose(target)
        }
        logo.addEventListener('load', print, { once: true })
        logo.addEventListener('error', print, { once: true })
        setTimeout(print, LOGO_WAIT_MS)
      }
    }

    // Both branches route their failure here, and they report DIFFERENT failures: a throw out of
    // `fill` is the document, not the read that fed it — attributing it to „nie udało się odczytać
    // ustawień" sends the owner to look at settings that loaded fine. The fast branch had no guard at
    // all, so a popup closed between the click and this line leaked an empty window with no toast.
    const render = (config: ClientViewConfigT) => {
      try {
        fill(config)
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
      .then((config) => {
        if (config) render(config)
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
