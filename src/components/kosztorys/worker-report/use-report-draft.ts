import { useEffect, useState } from 'react'
import type { ExtraWorkT, ReportDraftT } from '@/components/kosztorys/worker-report/types'
import { parseReportQty } from '@/lib/kosztorys/worker-report/parse-report-qty'

const EMPTY_DRAFT: ReportDraftT = { qtyByItem: {}, extras: [] }

export function reportDraftKey(investmentId: number, workerId: number): string {
  return `worker-report-draft:${investmentId}:${workerId}`
}

// A draft from before the etap choice moved to the kierownik is keyed by etap, not one draft — it
// is dropped rather than guessed into shape.
function parseDraft(raw: string | null): ReportDraftT {
  if (!raw) return EMPTY_DRAFT
  const parsed: unknown = JSON.parse(raw)
  return parsed && typeof parsed === 'object' && 'qtyByItem' in parsed && 'extras' in parsed
    ? (parsed as ReportDraftT)
    : EMPTY_DRAFT
}

/**
 * A pozycja deleted — or a whole kosztorys cleared or restored — since he typed leaves draft lines
 * the send would refuse. They are dropped on load and counted, so he learns what went instead of
 * finding the numbers silently gone. A blank entry is no line, so it is dropped without counting.
 */
export function pruneDraft(
  draft: ReportDraftT,
  liveItemIds: ReadonlySet<number>,
): { draft: ReportDraftT; droppedCount: number } {
  let droppedCount = 0
  const qtyByItem: Record<number, string> = {}
  for (const [key, raw] of Object.entries(draft.qtyByItem)) {
    const itemId = Number(key)
    if (liveItemIds.has(itemId)) qtyByItem[itemId] = raw
    else if (parseReportQty(raw).kind !== 'empty') droppedCount += 1
  }
  return { draft: { ...draft, qtyByItem }, droppedCount }
}

// The szkic lives only in this browser: a worker who switches phone or clears its data starts over.
// Nothing reaches the server until „Wyślij”.
// No key: the szkic lives in memory only.
export function useReportDraft(storageKey: string | undefined, liveItemIds: ReadonlySet<number>) {
  const [draft, setDraft] = useState<ReportDraftT>(EMPTY_DRAFT)
  const [isLoaded, setIsLoaded] = useState(false)
  const [droppedCount, setDroppedCount] = useState(0)

  useEffect(() => {
    if (storageKey === undefined) {
      setIsLoaded(true)
      return
    }
    try {
      const pruned = pruneDraft(parseDraft(localStorage.getItem(storageKey)), liveItemIds)
      setDraft(pruned.draft)
      setDroppedCount(pruned.droppedCount)
    } catch {
      // Storage blocked or the stored text unreadable: he starts from an empty szkic.
    }
    setIsLoaded(true)
    // Read once per key: the live rozpiska is the page's, fixed until the next load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  useEffect(() => {
    // Before the load lands, `draft` is the empty initial state and would overwrite the stored one.
    if (!isLoaded || storageKey === undefined) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft))
    } catch {
      // Storage blocked (private mode, quota): the szkic lives until the tab closes.
    }
  }, [draft, isLoaded, storageKey])

  return {
    isLoaded,
    draft,
    droppedCount,
    setQty: (itemId: number, qty: string) =>
      setDraft((current) => ({ ...current, qtyByItem: { ...current.qtyByItem, [itemId]: qty } })),
    saveExtra: (extra: ExtraWorkT) =>
      setDraft((current) => {
        const exists = current.extras.some((candidate) => candidate.key === extra.key)
        return {
          ...current,
          extras: exists
            ? current.extras.map((candidate) => (candidate.key === extra.key ? extra : candidate))
            : [...current.extras, extra],
        }
      }),
    removeExtra: (key: string) =>
      setDraft((current) => ({
        ...current,
        extras: current.extras.filter((extra) => extra.key !== key),
      })),
    clear: () => setDraft(EMPTY_DRAFT),
  }
}
