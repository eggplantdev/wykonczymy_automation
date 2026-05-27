'use client'

import type { ReactNode } from 'react'

type PropsT = {
  sheetId: string
  investmentName: string
  investmentId: number
  toolbar?: ReactNode
}

export function KosztorysIframeView({ sheetId, investmentName, investmentId, toolbar }: PropsT) {
  const src = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing&rm=embedded&embedded=true`
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      <div className="border-border flex shrink-0 flex-wrap items-center justify-between gap-4 border-b px-4 py-2">
        <div className="flex flex-col">
          <h1 className="text-foreground text-sm font-medium">Kosztorys — {investmentName}</h1>
          <span className="text-muted-foreground text-xs">
            Google Sheets · inwestycja #{investmentId}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {toolbar}
          <a
            href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground text-xs underline"
          >
            Otwórz w Sheets ↗
          </a>
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
          Kosztorys najlepiej otworzyć na komputerze. Na telefonie skorzystaj z aplikacji Google
          Sheets.
        </p>
        <a
          href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-medium"
        >
          Otwórz w Google Sheets ↗
        </a>
      </div>
    </div>
  )
}
