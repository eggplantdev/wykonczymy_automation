'use client'

import Link from 'next/link'
import { ClipboardPen, Eye, Settings2 } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { workerPreviewSegment } from '@/lib/kosztorys/worker-view/worker-links'
import type {
  WorkerShareTargetT,
  WorkerTargetT,
} from '@/components/kosztorys/editor/actions/use-worker-actions'

export function WorkerPreviewMenuItem({ target }: { target: WorkerTargetT }) {
  const { investmentId } = useKosztorysEditorContext()
  return (
    <DropdownMenuItem asChild>
      <Link
        href={`/podglad-pracownika/${workerPreviewSegment(target.name, target.id)}/${investmentId}`}
        target="_blank"
      >
        <Eye />
        Podgląd linku pracownika
      </Link>
    </DropdownMenuItem>
  )
}

export function WorkerShareMenuItem({ target }: { target: WorkerShareTargetT }) {
  const { worker } = useKosztorysActions()
  return (
    <DropdownMenuItem onSelect={() => worker.requestShare(target)}>
      <ClipboardPen />
      Link do zgłoszeń
    </DropdownMenuItem>
  )
}

export function WorkerViewSettingsMenuItem() {
  const { worker } = useKosztorysActions()
  return (
    <DropdownMenuItem onSelect={worker.requestSettings}>
      <Settings2 />
      <MenuItemBody
        label="Ustawienia widoku…"
        description="Zdecyduj, które kolumny i pozycje widzą pracownicy — jedno ustawienie dla wszystkich."
      />
    </DropdownMenuItem>
  )
}
