'use client'

import { useState, type FormEvent } from 'react'

type EmbedMode = 'edit' | 'pubhtml'

export function KosztorysIframeClient() {
  const [sheetId, setSheetId] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mode, setMode] = useState<EmbedMode>('edit')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = sheetId.trim()
    if (!trimmed) return
    const id = extractSheetId(trimmed)
    setSheetId(id)
    setActiveId(id)
  }

  function handleClear() {
    setSheetId('')
    setActiveId(null)
  }

  const iframeSrc = activeId ? buildIframeSrc(activeId, mode) : null

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="border-border flex flex-wrap items-center justify-between gap-4 border-b px-4 py-2">
        <div className="flex flex-col">
          <h1 className="text-foreground text-sm font-medium">
            Kosztorys — Google Sheets iframe test
          </h1>
          <span className="text-muted-foreground text-xs">
            Paste a sheet ID or URL. You must be signed into a Google account with access.
          </span>
        </div>

        <form className="flex flex-wrap items-center gap-2 text-xs" onSubmit={handleSubmit}>
          <input
            type="text"
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
            placeholder="Sheet ID or /spreadsheets/d/{ID}/... URL"
            className="border-input w-96 rounded border bg-transparent px-2 py-1 font-mono"
            aria-label="Google Sheet ID or URL"
          />
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as EmbedMode)}
            className="border-input rounded border bg-transparent px-2 py-1"
            aria-label="Embed mode"
          >
            <option value="edit">edit (auth-required, editable)</option>
            <option value="pubhtml">pubhtml (public read-only)</option>
          </select>
          <button type="submit" className="bg-primary text-primary-foreground rounded px-3 py-1">
            Load
          </button>
          {activeId ? (
            <button
              type="button"
              onClick={handleClear}
              className="border-input rounded border px-3 py-1"
            >
              Clear
            </button>
          ) : null}
        </form>
      </div>

      {iframeSrc ? (
        <iframe
          key={iframeSrc}
          src={iframeSrc}
          title="Google Sheet embed"
          className="w-full flex-1 border-0"
          // sandbox is intentionally omitted — Google's edit iframe requires
          // same-origin scripts and form submission to function properly
        />
      ) : (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm">
          <p className="max-w-lg">
            Paste a Google Sheets ID (or a full sheet URL — we&apos;ll extract the ID) and click
            Load.
          </p>
          <p className="text-muted-foreground/70 max-w-lg text-xs">
            <strong className="text-foreground">edit</strong> mode embeds the live editable sheet —
            requires you to be signed into a Google account with access.{' '}
            <strong className="text-foreground">pubhtml</strong> mode embeds the published read-only
            version (only works if the sheet was published via File → Publish to web; public to
            anyone with the URL — do not use for sensitive data).
          </p>
        </div>
      )}
    </div>
  )
}

function extractSheetId(input: string): string {
  // Accept either a bare ID or a URL like
  // https://docs.google.com/spreadsheets/d/{ID}/edit#gid=0
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (match) return match[1]
  return input.trim()
}

function buildIframeSrc(sheetId: string, mode: EmbedMode): string {
  if (mode === 'pubhtml') {
    // Published read-only embed (requires File → Publish to web first)
    return `https://docs.google.com/spreadsheets/d/e/${sheetId}/pubhtml?widget=true&headers=false`
  }
  // Live editable embed — auth-gated by Drive sharing
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing&rm=embedded&embedded=true`
}
