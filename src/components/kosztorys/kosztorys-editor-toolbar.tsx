'use client'

import Link from 'next/link'

import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { KosztorysAddMenu } from '@/components/kosztorys/kosztorys-add-menu'
import { KosztorysGlobalSettings } from '@/components/kosztorys/kosztorys-global-settings'
import { KosztorysToolbarActions } from '@/components/kosztorys/kosztorys-toolbar-actions'
import { KosztorysToolbarViewToggles } from '@/components/kosztorys/kosztorys-toolbar-view-toggles'
import { useKosztorysEditorContext } from '@/components/kosztorys/use-kosztorys-editor-context'

export function KosztorysEditorToolbar() {
  const { investmentId, investmentName, search, setSearch, tree, view, handleGlobalCoeffChange } =
    useKosztorysEditorContext()

  return (
    <div className="border-border shrink-0 border-b">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <h1 className="text-foreground text-sm font-medium">
          <Link href={`/inwestycje/${investmentId}`} className="hover:underline">
            {investmentName}
          </Link>
        </h1>
        <KosztorysToolbarViewToggles />

        <KosztorysAddMenu />
        <SimpleTooltip content="Szukaj pozycji / sekcji">
          {/* SearchFilterInput takes no ref, so the tooltip anchors to a wrapper */}
          <div>
            <SearchFilterInput
              value={search}
              onChange={setSearch}
              placeholder="Szukaj…"
              debounceMs={200}
            />
          </div>
        </SimpleTooltip>
        <KosztorysToolbarActions />
      </div>
      {/* Coeff-only now (VAT/rabat/postęp moved into the Podsumowanie tab). It renders nothing in the
          Klient price view, so the row is dropped there rather than left as an empty strip. */}
      {view !== 'client' && (
        <div className="border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-1.5">
          <KosztorysGlobalSettings
            globalCoeffs={tree.globalCoeffs}
            view={view}
            onGlobalCoeffChange={handleGlobalCoeffChange}
          />
        </div>
      )}
    </div>
  )
}
