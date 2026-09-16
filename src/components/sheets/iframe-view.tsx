'use client'

import type { ReactNode } from 'react'
import { ExternalLink } from '@/components/ui/external-link'
import { ALL_SHEETS_URL } from '@/lib/constants/sheets'

type PropsT = {
  sheetId: string
  investmentName: string
  toolbar?: ReactNode
}

export function SheetIframeView({ sheetId, investmentName, toolbar }: PropsT) {
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
  const src = `${sheetUrl}?usp=sharing&rm=embedded&embedded=true`
  return (
    <div className="h-below-top-nav flex flex-col overflow-hidden">
      <div className="border-border flex shrink-0 flex-wrap items-center justify-between gap-4 border-b px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <h1 className="text-foreground text-sm font-medium">Kosztorys — {investmentName}</h1>
          <ExternalLink href={sheetUrl}>Otwórz w Arkuszach ↗</ExternalLink>
        </div>
        {/* No wrapping: the sync buttons truncate instead, so the whole bar stays one line tall
            and the sheet keeps the height. */}
        <div className="flex min-w-0 items-center gap-3">
          {toolbar}
          <ExternalLink href={ALL_SHEETS_URL}>Wszystkie kosztorysy ↗</ExternalLink>
        </div>
      </div>
      {/* Desktop only: the embed can render blank when the browser blocks third-party cookies
          (Safari default), and a cross-origin iframe gives us no load/error signal to detect it — so
          always offer open-in-new-tab (T3.3). On a phone the same escape hatch is already one tap
          away as „Otwórz w Arkuszach" above, and two lines of prose cost the sheet its height. */}
      <p className="text-muted-foreground hidden shrink-0 px-4 py-1 text-xs sm:block">
        Jeśli arkusz się nie wyświetla (np. zablokowane pliki cookie),{' '}
        <ExternalLink href={sheetUrl}>otwórz go w nowej karcie ↗</ExternalLink>.
      </p>
      <iframe
        src={src}
        title={`Kosztorys for ${investmentName}`}
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>
  )
}
