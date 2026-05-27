'use client'

import type { ReactNode } from 'react'
import { ExternalLink } from '@/components/ui/external-link'

type PropsT = {
  sheetId: string
  investmentName: string
  toolbar?: ReactNode
}

const ALL_SHEETS_URL = 'https://docs.google.com/spreadsheets/u/0/'

export function KosztorysIframeView({ sheetId, investmentName, toolbar }: PropsT) {
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
  const src = `${sheetUrl}?usp=sharing&rm=embedded&embedded=true`
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      <div className="border-border flex shrink-0 flex-wrap items-center justify-between gap-4 border-b px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <h1 className="text-foreground text-sm font-medium">Kosztorys — {investmentName}</h1>
          <ExternalLink href={sheetUrl}>Otwórz w Sheets ↗</ExternalLink>
        </div>
        <div className="flex items-center gap-3">
          {toolbar}
          <ExternalLink href={ALL_SHEETS_URL}>Wszystkie kosztorysy ↗</ExternalLink>
        </div>
      </div>
      {/* Desktop: the embedded sheet. The iframe is hidden below lg — Google Sheets
          is barely usable in a phone-width iframe, and the embed also fought the
          mobile footer for vertical space. */}
      <iframe
        src={src}
        title={`Kosztorys for ${investmentName}`}
        className="hidden min-h-0 w-full flex-1 border-0 lg:block"
      />
      {/* Mobile/tablet fallback: skip the embed, point to the full Sheets app. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center lg:hidden">
        <p className="text-muted-foreground text-sm">
          Kosztorys najlepiej otworzyć na komputerze. Na telefonie skorzystaj z aplikacji Arkusze.
        </p>
        <ExternalLink href={sheetUrl} variant="button">
          Otwórz w Arkuszach ↗
        </ExternalLink>
      </div>
    </div>
  )
}
