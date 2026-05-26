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
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="border-border flex flex-wrap items-center justify-between gap-4 border-b px-4 py-2">
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
      <iframe
        src={src}
        title={`Kosztorys for ${investmentName}`}
        className="w-full flex-1 border-0"
      />
    </div>
  )
}
