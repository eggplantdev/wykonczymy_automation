'use client'

import { useEffect, useEffectEvent, useRef, useState, useTransition } from 'react'
import { KosztorysEditorV2 } from '@/components/kosztorys/editor/kosztorys-editor-v2'
import { PageLoading } from '@/components/ui/loader/page-loading'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { OpenWorkshopPrompt } from '@/components/presets/open-workshop-prompt'
import { OPEN_FLAG } from '@/components/presets/preset-open-href'
import { openPresetInWorkshopAction } from '@/lib/actions/kosztorys-presets'
import type { WorkshopTreeT } from '@/lib/kosztorys/open-preset-in-workshop'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { toastMessage } from '@/lib/utils/toast'

// A wrapper rather than `WorkshopTreeT | undefined`: every server render deserializes a fresh object, so
// its identity marks a new render even when two in a row both found the warsztat holding another
// szablon — which a bare `undefined` could not tell apart.
export type ServerWorkshopT = { workshop: WorkshopTreeT | null }

type PropsT = {
  presetId: number
  presetName: string
  workCatalogue: WorkCatalogueItemT[]
  server: ServerWorkshopT
  autoOpen: boolean
}

// Not `router.replace`, which would re-render the page for a url change nothing reads.
function stripOpenFlag() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(OPEN_FLAG)) return
  url.searchParams.delete(OPEN_FLAG)
  window.history.replaceState(null, '', url)
}

// The action returns the tree it wrote, so the editor renders from the result instead of asking the
// router for a re-render — which would also wipe the prefetch cache (lessons.md, EX-597).
export function TemplateWorkshop({
  presetId,
  presetName,
  workCatalogue,
  server,
  autoOpen,
}: PropsT) {
  const [opened, setOpened] = useState<WorkshopTreeT>()
  const [failed, setFailed] = useState(false)
  const [pending, startTransition] = useTransition()

  // A new server render supersedes what the action returned: with a tree it is fresher, without one
  // someone else took the warsztat, and keeping the action's tree would edit a szablon no longer there.
  const [seenServer, setSeenServer] = useState(server)
  if (server !== seenServer) {
    setSeenServer(server)
    setOpened(undefined)
  }

  const open = () => {
    startTransition(async () => {
      const res = await openPresetInWorkshopAction(presetId)
      stripOpenFlag()
      if (!res.success) {
        setFailed(true)
        toastMessage(res.error ?? 'Nie udało się otworzyć szablonu', 'error')
        return
      }
      setFailed(false)
      setOpened(res.data)
    })
  }

  const workshop = server.workshop ?? opened

  // A latch, because StrictMode mounts twice in dev — the server's re-open short-circuit would make
  // the second call harmless, but not free.
  const autoOpened = useRef(false)
  const openOnMount = useEffectEvent(() => {
    if (!autoOpen || autoOpened.current) return
    autoOpened.current = true
    if (workshop) stripOpenFlag()
    else open()
  })
  useEffect(() => openOnMount(), [])

  if (workshop) {
    return (
      <KosztorysEditorV2
        investmentId={workshop.investmentId}
        tree={workshop.tree}
        investmentName={presetName}
        templatePresetId={presetId}
        workCatalogue={workCatalogue}
        materialsGrossBase={0}
        materialsNetBilled={0}
        materialsBreakdown={[]}
        settledBreakdown={[]}
        laborCostsNetFromTransactions={0}
        discountNetFromTransactions={0}
        investmentLoss={0}
        depositTransactions={[]}
        materialTransactions={[]}
      />
    )
  }

  return (
    <PageWrapper title={presetName}>
      {autoOpen && !failed ? (
        <PageLoading />
      ) : (
        <OpenWorkshopPrompt name={presetName} pending={pending} onOpen={open} />
      )}
    </PageWrapper>
  )
}
