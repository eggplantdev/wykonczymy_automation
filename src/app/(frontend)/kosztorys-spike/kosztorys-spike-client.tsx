'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US'

import '@univerjs/preset-sheets-core/lib/index.css'

const MATERIAŁY_SHEET_NAME = 'materiały '
const FIRST_DATA_ROW_INDEX = 2 // row 3 in 1-based view; rows 1–2 are header/sum

type MaterialKind = 'budowlane' | 'wykończeniowe'

type UniverApi = {
  getActiveWorkbook: () => {
    getSheetByName: (name: string) => UniverSheet | null
  }
  dispose: () => void
}

type UniverSheet = {
  getRange: (a1: string) => {
    getValues: () => unknown[][]
    setValues: (values: unknown[][]) => unknown
  }
  setActiveSheet?: () => void
}

type SpikeStatus = 'loading' | 'not-seeded' | 'ready' | 'error'

type KosztorysSpikeProps = {
  investmentId: number
  investmentName: string
}

export function KosztorysSpike({ investmentId, investmentName }: KosztorysSpikeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const apiRef = useRef<UniverApi | null>(null)
  const mountedRef = useRef(false)

  const [status, setStatus] = useState<SpikeStatus>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [appendMsg, setAppendMsg] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [isSeeding, setIsSeeding] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    if (mountedRef.current) return
    mountedRef.current = true

    let cancelled = false
    let disposeFn: (() => void) | null = null

    async function mount() {
      try {
        setStatus('loading')
        const res = await fetch(`/api/kosztorys/${investmentId}/workbook`, { cache: 'no-store' })
        if (res.status === 404) {
          if (!cancelled) setStatus('not-seeded')
          return
        }
        if (!res.ok) throw new Error(`workbook fetch failed: ${res.status}`)
        const workbookData = await res.json()

        if (cancelled || !containerRef.current) return

        const { univerAPI } = createUniver({
          locale: LocaleType.EN_US,
          locales: {
            [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS),
          },
          presets: [
            UniverSheetsCorePreset({
              container: containerRef.current,
            }),
          ],
        })

        univerAPI.createWorkbook(workbookData)
        apiRef.current = univerAPI as unknown as UniverApi
        disposeFn = () => univerAPI.dispose()
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setErrorMsg(msg)
        setStatus('error')

        console.error('[kosztorys-spike] mount failed', err)
      }
    }

    mount()

    return () => {
      cancelled = true
      if (disposeFn) disposeFn()
      apiRef.current = null
      mountedRef.current = false
    }
  }, [investmentId, reloadKey])

  async function handleSeed() {
    setIsSeeding(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/kosztorys/${investmentId}/seed`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `seed failed: ${res.status}`)
      }
      // flip to loading so the container div renders again — only then can the
      // effect bind containerRef and mount Univer
      setStatus('loading')
      setReloadKey((k) => k + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(msg)
      setStatus('error')
    } finally {
      setIsSeeding(false)
    }
  }

  function handleReload() {
    setStatus('loading')
    setReloadKey((k) => k + 1)
  }

  function handleAppend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppendMsg(null)

    const api = apiRef.current
    if (!api) {
      setAppendMsg('Univer not ready')
      return
    }

    const form = event.currentTarget
    const formData = new FormData(form)
    const kind = formData.get('kind') as MaterialKind
    const amount = Number(formData.get('amount'))
    const description = String(formData.get('description') ?? '').trim()

    if (!amount || Number.isNaN(amount)) {
      setAppendMsg('Amount must be a positive number')
      return
    }

    try {
      const sheet = api.getActiveWorkbook().getSheetByName(MATERIAŁY_SHEET_NAME)
      if (!sheet) {
        setAppendMsg(`sheet "${MATERIAŁY_SHEET_NAME}" not found`)
        return
      }

      // Column layout (0-based):
      //   budowlane:      A(0)=label, B(1)=amount,  C(2)=desc, D(3)=comment
      //   wykończeniowe:  E(4)=label, F(5)=amount,  G(6)=desc, H(7)=settled
      const amountCol = kind === 'budowlane' ? 1 : 5
      const descCol = kind === 'budowlane' ? 2 : 6

      const colLetter = kind === 'budowlane' ? 'B' : 'F'
      const scanRange = sheet.getRange(`${colLetter}${FIRST_DATA_ROW_INDEX + 1}:${colLetter}1001`)
      const values = scanRange.getValues()
      let targetRowIndex = FIRST_DATA_ROW_INDEX
      for (let i = 0; i < values.length; i++) {
        const cell = values[i]?.[0]
        if (cell === null || cell === undefined || cell === '') {
          targetRowIndex = FIRST_DATA_ROW_INDEX + i
          break
        }
      }

      const rowNumber = targetRowIndex + 1
      const rowRange = sheet.getRange(
        `${colToA1(amountCol)}${rowNumber}:${colToA1(descCol)}${rowNumber}`,
      )
      const today = new Date().toLocaleDateString('pl-PL')
      rowRange.setValues([[amount, `${description} (in-memory test ${today})`]])

      setAppendMsg(`Appended (in-memory only) row ${rowNumber}, ${colLetter}${rowNumber}=${amount}`)
      form.reset()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setAppendMsg(`Failed: ${msg}`)

      console.error('[kosztorys-spike] append failed', err)
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="border-border flex flex-wrap items-center justify-between gap-4 border-b px-4 py-2">
        <div className="flex flex-col">
          <h1 className="text-foreground text-sm font-medium">
            Kosztorys — {investmentName}{' '}
            <span className="text-muted-foreground font-normal">(spike)</span>
          </h1>
          <span className="text-muted-foreground text-xs">
            Vercel Blob ↔ Univer · investment #{investmentId}
          </span>
        </div>

        {status === 'ready' ? (
          <form
            className="flex flex-wrap items-center gap-2 text-xs"
            onSubmit={handleAppend}
            aria-label="Append test material row (in-memory only)"
          >
            <select
              name="kind"
              defaultValue="budowlane"
              className="border-input rounded border bg-transparent px-2 py-1"
            >
              <option value="budowlane">budowlane</option>
              <option value="wykończeniowe">wykończeniowe</option>
            </select>
            <input
              name="amount"
              type="number"
              step="0.01"
              placeholder="kwota brutto"
              required
              className="border-input w-28 rounded border bg-transparent px-2 py-1"
            />
            <input
              name="description"
              type="text"
              placeholder="co, gdzie, kiedy"
              className="border-input w-48 rounded border bg-transparent px-2 py-1"
            />
            <button type="submit" className="bg-primary text-primary-foreground rounded px-3 py-1">
              Append (in-memory)
            </button>
            {appendMsg ? <span className="text-muted-foreground ml-2">{appendMsg}</span> : null}
          </form>
        ) : null}

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={handleReload}
            className="border-input rounded border px-3 py-1"
          >
            Reload from Blob
          </button>
          <span className="text-muted-foreground">
            {status === 'loading' && 'Loading workbook…'}
            {status === 'not-seeded' && 'No workbook yet'}
            {status === 'ready' && 'Ready'}
            {status === 'error' && `Error: ${errorMsg ?? 'unknown'}`}
          </span>
        </div>
      </div>

      {status === 'not-seeded' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm">
          <p className="text-muted-foreground">
            No kosztorys workbook stored for this investment yet.
          </p>
          <button
            type="button"
            onClick={handleSeed}
            disabled={isSeeding}
            className="bg-primary text-primary-foreground rounded px-4 py-2 disabled:opacity-50"
          >
            {isSeeding ? 'Seeding…' : 'Seed from template'}
          </button>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 overflow-hidden" />
      )}
    </div>
  )
}

function colToA1(colIndex: number): string {
  let n = colIndex
  let s = ''
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}
